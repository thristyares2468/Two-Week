const {
  BOT_LOBBY_BOT_COUNT,
  COUNTDOWN_SECONDS,
  MAX_PLAYERS,
  QUICK_START_PLAYERS,
  lerp,
  makeRoomCode,
  now
} = require("./utils");
const {
  countAliveHumans,
  countAliveContestants,
  createPlayer,
  makeBotOpponents,
  makePracticeDummies,
  makeSpawn,
  resetPlayerForMatch,
  serializePlayer,
  serializeSelf,
  setupBotLoadout
} = require("./playerState");
const { spawnLoot, serializeLoot } = require("./lootServer");
const { serializeBuilds } = require("./buildingServer");
const { createStorm, serializeStorm } = require("./stormServer");

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(roomType = "private", hostSocketId = null, settings = {}) {
    const code = makeRoomCode(new Set(this.rooms.keys()));
    const room = {
      roomCode: code,
      roomType,
      status: "lobby",
      players: new Map(),
      dummies: [],
      hostId: hostSocketId,
      maxPlayers: settings.maxPlayers || MAX_PLAYERS,
      createdAt: now(),
      countdownEndsAt: 0,
      matchStartTime: 0,
      finishedAt: 0,
      winnerId: null,
      winnerName: "",
      matchSettings: {
        maxPlayers: settings.maxPlayers || MAX_PLAYERS,
        botCount: settings.botCount || BOT_LOBBY_BOT_COUNT
      },
      loot: new Map(),
      builds: new Map(),
      buildIndex: new Map(),
      storm: createStorm(),
      dropState: null,
      killFeed: [],
      pendingEvents: [],
      lastSnapshotAt: 0
    };
    this.rooms.set(code, room);
    return room;
  }

  get(roomCode) {
    return this.rooms.get(String(roomCode || "").toUpperCase());
  }

  addPlayer(room, socketId, name) {
    if (!room) return { ok: false, reason: "Room not found." };
    if (room.players.size >= room.maxPlayers) return { ok: false, reason: "Room is full." };
    if (room.status !== "lobby" && room.roomType !== "practice" && room.roomType !== "sandbox") {
      return { ok: false, reason: "Match already started." };
    }
    const player = createPlayer(socketId, name, room.players.size);
    room.players.set(socketId, player);
    if (!room.hostId) room.hostId = socketId;
    if (room.roomType === "practice" || room.roomType === "sandbox") {
      this.startMatch(room);
    } else if (room.roomType === "bot") {
      this.startCountdown(room, 4);
    } else if (room.roomType === "quick" && room.players.size >= QUICK_START_PLAYERS) {
      this.startCountdown(room, COUNTDOWN_SECONDS);
    }
    return { ok: true, player };
  }

  removePlayer(room, socketId) {
    if (!room) return;
    room.players.delete(socketId);
    if (room.hostId === socketId) {
      const nextHost = room.players.keys().next().value;
      room.hostId = nextHost || null;
    }
    if (room.players.size === 0) {
      this.rooms.delete(room.roomCode);
    }
  }

  findQuickRoom() {
    for (const room of this.rooms.values()) {
      if (room.roomType === "quick" && room.status === "lobby" && room.players.size < room.maxPlayers) {
        return room;
      }
    }
    return this.createRoom("quick");
  }

  startCountdown(room, seconds = COUNTDOWN_SECONDS) {
    if (!room || room.status !== "lobby") return false;
    room.status = "countdown";
    room.countdownEndsAt = now() + seconds * 1000;
    return true;
  }

  startMatch(room) {
    if (!room) return;
    room.status = "playing";
    room.matchStartTime = now();
    room.finishedAt = 0;
    room.winnerId = null;
    room.winnerName = "";
    room.loot.clear();
    room.builds.clear();
    room.buildIndex.clear();
    room.killFeed = [];
    room.pendingEvents = [];
    room.storm = createStorm();
    room.dropState = room.roomType === "practice" || room.roomType === "sandbox"
      ? { phase: "active", startedAt: now(), bus: null }
      : {
          phase: "spawnIsland",
          startedAt: now(),
          spawnIslandSeconds: 7,
          busSeconds: 14,
          bus: { x: 0, y: 42, z: -132 },
          path: {
            from: { x: -72, y: 42, z: -132 },
            to: { x: 72, y: 42, z: 132 }
          }
        };
    spawnLoot(room);
    const humans = Array.from(room.players.values());
    humans.forEach((player, index) => {
      const spawn = room.roomType === "practice" || room.roomType === "sandbox"
        ? makeSpawn(index, humans.length)
        : makeSpawnIslandSpawn(index, humans.length);
      resetPlayerForMatch(player, spawn, room.roomType);
    });
    room.dummies = createRoomBots(room);
    if (room.roomType === "bot") {
      const contestants = [...humans, ...room.dummies];
      contestants.forEach((player, index) => {
        resetPlayerForMatch(player, makeSpawnIslandSpawn(index, contestants.length), room.roomType);
        if (player.isBot) setupBotLoadout(player, index);
      });
    }
  }

  finishMatch(room, winner) {
    if (!room || room.status === "finished") return;
    room.status = "finished";
    room.finishedAt = now();
    room.winnerId = winner ? winner.id : null;
    room.winnerName = winner ? winner.name : "No winner";
    for (const player of room.players.values()) {
      if (!player.placement) {
        player.placement = player.alive ? 1 : Math.max(1, countAliveContestants(room));
      }
    }
  }

  maybeFinish(room) {
    if (!room || room.status !== "playing") return;
    if (room.roomType === "practice" || room.roomType === "sandbox") return;
    const contestants = room.roomType === "bot"
      ? [...room.players.values(), ...room.dummies].filter((player) => player.alive)
      : Array.from(room.players.values()).filter((player) => player.alive);
    if (contestants.length <= 1 && room.matchStartTime && now() - room.matchStartTime > 3000) {
      this.finishMatch(room, contestants[0] || null);
    }
  }

  restartLobby(room) {
    if (!room) return;
    room.status = "lobby";
    room.countdownEndsAt = 0;
    room.matchStartTime = 0;
    room.finishedAt = 0;
    room.winnerId = null;
    room.winnerName = "";
    room.loot.clear();
    room.builds.clear();
    room.buildIndex.clear();
    room.dummies = [];
    room.dropState = null;
  }

  cleanupOldRooms(maxAgeMs = 30 * 60 * 1000) {
    const cutoff = now() - maxAgeMs;
    for (const room of this.rooms.values()) {
      if (room.players.size === 0 || (room.status === "finished" && room.finishedAt < cutoff)) {
        this.rooms.delete(room.roomCode);
      }
    }
  }
}

function serializeRoom(room, viewerId = null) {
  const players = Array.from(room.players.values()).map(serializePlayer);
  return {
    roomCode: room.roomCode,
    roomType: room.roomType,
    status: room.status,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    countdownRemaining: Math.max(0, Math.ceil((room.countdownEndsAt - now()) / 1000)),
    players,
    viewer: viewerId && room.players.has(viewerId) ? serializeSelf(room.players.get(viewerId)) : null,
    winnerId: room.winnerId,
    winnerName: room.winnerName,
    matchStartTime: room.matchStartTime,
    dropState: serializeDropState(room.dropState)
  };
}

function createRoomBots(room) {
  if (room.roomType === "practice" || room.roomType === "sandbox") {
    return makePracticeDummies(room.roomType === "sandbox" ? 3 : 6);
  }
  if (room.roomType === "bot") {
    return makeBotOpponents(room.matchSettings.botCount || BOT_LOBBY_BOT_COUNT);
  }
  return [];
}

function serializeSnapshot(room, viewerId = null) {
  const humans = Array.from(room.players.values());
  const players = [...humans, ...room.dummies].map(serializePlayer);
  const playersRemaining = room.roomType === "bot"
    ? countAliveContestants(room)
    : humans.filter((player) => player.alive).length;
  return {
    serverTime: now(),
    roomCode: room.roomCode,
    roomType: room.roomType,
    status: room.status,
    players,
    self: viewerId && room.players.has(viewerId) ? serializeSelf(room.players.get(viewerId)) : null,
    loot: serializeLoot(room),
    builds: serializeBuilds(room),
    storm: serializeStorm(room.storm),
    dropState: serializeDropState(room.dropState),
    playersRemaining,
    killFeed: room.killFeed.slice(-6),
    winnerId: room.winnerId,
    winnerName: room.winnerName
  };
}

function dropPlayerFromBus(room, player) {
  const state = room && room.dropState;
  if (!state || state.phase !== "bus" || !player || !player.alive || player.hasDropped) return false;
  const bus = state.bus || state.path.from;
  player.hasDropped = true;
  player.onBus = false;
  player.canFight = true;
  player.x = bus.x;
  player.y = Math.max(22, bus.y - 7);
  player.z = bus.z;
  player.vx = Math.sin(player.yaw || 0) * 3;
  player.vy = -3.5;
  player.vz = Math.cos(player.yaw || 0) * 3;
  player.grounded = false;
  return true;
}

function updateDropState(room) {
  const state = room.dropState;
  if (!state || state.phase === "active") return "active";
  const elapsed = (now() - state.startedAt) / 1000;
  if (state.phase === "spawnIsland" && elapsed >= state.spawnIslandSeconds) {
    state.phase = "bus";
    state.busStartedAt = now();
    const busRiders = room.roomType === "bot" ? [...room.players.values(), ...room.dummies] : [...room.players.values()];
    for (const player of busRiders) {
      if (!player.alive) continue;
      player.hasDropped = false;
      player.onBus = true;
      player.canFight = false;
    }
  }
  if (state.phase === "bus") {
    const busElapsed = (now() - state.busStartedAt) / 1000;
    const t = Math.min(1, busElapsed / state.busSeconds);
    state.bus = {
      x: lerp(state.path.from.x, state.path.to.x, t),
      y: lerp(state.path.from.y, state.path.to.y, t),
      z: lerp(state.path.from.z, state.path.to.z, t)
    };
    let offset = 0;
    const busRiders = room.roomType === "bot" ? [...room.players.values(), ...room.dummies] : [...room.players.values()];
    for (const player of busRiders) {
      if (!player.alive) continue;
      if (player.hasDropped) {
        player.onBus = false;
        player.canFight = true;
        continue;
      }
      player.onBus = true;
      player.canFight = false;
      player.x = state.bus.x + (offset % 4 - 1.5) * 1.4;
      player.y = state.bus.y - 4;
      player.z = state.bus.z - Math.floor(offset / 4) * 1.6;
      player.vx = 0;
      player.vy = 0;
      player.vz = 0;
      player.grounded = false;
      offset += 1;
    }
    if (t >= 1) {
      state.phase = "active";
      let index = 0;
      const contestants = room.roomType === "bot" ? [...room.players.values(), ...room.dummies] : [...room.players.values()];
      const count = contestants.length;
      for (const player of contestants) {
        if (!player.alive) continue;
        const spawn = makeSpawn(index, count);
        if (!player.hasDropped) {
          player.x = spawn.x;
          player.y = spawn.y;
          player.z = spawn.z;
          player.vy = -5;
          player.yaw = spawn.yaw;
        }
        player.hasDropped = true;
        player.onBus = false;
        player.canFight = true;
        player.grounded = false;
        index += 1;
      }
    }
  }
  return state.phase;
}

function serializeDropState(dropState) {
  if (!dropState) return null;
  return {
    phase: dropState.phase,
    spawnIslandSeconds: dropState.spawnIslandSeconds,
    busSeconds: dropState.busSeconds,
    bus: dropState.bus ? {
      x: Number(dropState.bus.x.toFixed(2)),
      y: Number(dropState.bus.y.toFixed(2)),
      z: Number(dropState.bus.z.toFixed(2))
    } : null
  };
}

function makeSpawnIslandSpawn(index, count) {
  const angle = (index / Math.max(1, count)) * Math.PI * 2;
  const radius = 6 + (index % 4) * 2.2;
  return {
    x: Math.cos(angle) * radius,
    y: 0,
    z: -150 + Math.sin(angle) * radius,
    yaw: 0
  };
}

module.exports = {
  dropPlayerFromBus,
  RoomManager,
  serializeRoom,
  serializeSnapshot,
  updateDropState
};
