const { RoomManager, serializeRoom, serializeSnapshot, updateDropState } = require("./rooms");
const { SERVER_TICK_RATE, SNAPSHOT_RATE, now } = require("./utils");
const {
  applyDamage,
  applyInput,
  beginReload,
  finishReloadIfReady,
  resetPlayerForMatch,
  selectSlot,
  setInput
} = require("./playerState");
const { fireHitscan } = require("./projectiles");
const { pickupLoot, useConsumable } = require("./lootServer");
const { placeBuild, damageBuild } = require("./buildingServer");
const { isOutsideStorm, updateStorm } = require("./stormServer");
const { updateBots } = require("./bots");

function attachGameServer(io) {
  const rooms = new RoomManager();
  const socketRooms = new Map();
  const profiles = new Map();

  function getRoomForSocket(socket) {
    const code = socketRooms.get(socket.id);
    return code ? rooms.get(code) : null;
  }

  function emitRoomState(room) {
    if (!room) return;
    for (const playerId of room.players.keys()) {
      io.to(playerId).emit("room:state", serializeRoom(room, playerId));
    }
  }

  function emitImmediateSnapshots(room) {
    if (!room) return;
    for (const playerId of room.players.keys()) {
      io.to(playerId).emit("world:snapshot", serializeSnapshot(room, playerId));
    }
  }

  function joinSocketToRoom(socket, room, name) {
    leaveCurrentRoom(socket);
    const result = rooms.addPlayer(room, socket.id, name);
    if (!result.ok) {
      socket.emit("server:error", result.reason);
      return result;
    }
    socket.join(room.roomCode);
    socketRooms.set(socket.id, room.roomCode);
    socket.emit("connection:state", { connected: true, id: socket.id, roomCode: room.roomCode });
    emitRoomState(room);
    if (room.status === "playing" || room.status === "finished") {
      emitImmediateSnapshots(room);
    }
    return result;
  }

  function leaveCurrentRoom(socket) {
    const room = getRoomForSocket(socket);
    if (!room) return;
    socket.leave(room.roomCode);
    rooms.removePlayer(room, socket.id);
    socketRooms.delete(socket.id);
    emitRoomState(room);
  }

  function addKillFeed(room, message) {
    room.killFeed.push({ id: `${Date.now()}_${Math.random()}`, message, time: Date.now() });
    room.killFeed = room.killFeed.slice(-8);
  }

  io.on("connection", (socket) => {
    socket.emit("connection:state", { connected: true, id: socket.id });

    socket.on("player:create", (payload = {}) => {
      profiles.set(socket.id, {
        name: payload.name,
        createdAt: now()
      });
      socket.emit("connection:state", { connected: true, id: socket.id, profileReady: true });
    });

    socket.on("net:ping", (ack) => {
      if (typeof ack === "function") ack();
    });

    socket.on("room:quickMatch", () => {
      const profile = profiles.get(socket.id) || {};
      const room = rooms.findQuickRoom();
      joinSocketToRoom(socket, room, profile.name);
    });

    socket.on("room:createPrivate", () => {
      const profile = profiles.get(socket.id) || {};
      const room = rooms.createRoom("private", socket.id);
      joinSocketToRoom(socket, room, profile.name);
    });

    socket.on("room:join", (payload = {}) => {
      const profile = profiles.get(socket.id) || {};
      const code = String(payload.roomCode || "").trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        socket.emit("server:error", "Room not found.");
        return;
      }
      joinSocketToRoom(socket, room, profile.name);
    });

    socket.on("room:practice", () => {
      const profile = profiles.get(socket.id) || {};
      const room = rooms.createRoom("practice", socket.id, { maxPlayers: 1 });
      joinSocketToRoom(socket, room, profile.name);
    });

    socket.on("room:sandbox", () => {
      const profile = profiles.get(socket.id) || {};
      const room = rooms.createRoom("sandbox", socket.id, { maxPlayers: 1 });
      joinSocketToRoom(socket, room, profile.name);
    });

    socket.on("room:botLobby", () => {
      const profile = profiles.get(socket.id) || {};
      const room = rooms.createRoom("bot", socket.id, { maxPlayers: 1 });
      joinSocketToRoom(socket, room, profile.name);
    });

    socket.on("room:leave", () => {
      leaveCurrentRoom(socket);
      socket.emit("room:state", null);
    });

    socket.on("match:start", () => {
      const room = getRoomForSocket(socket);
      if (!room) return;
      if (room.hostId !== socket.id) {
        socket.emit("server:error", "Only the host can start this room.");
        return;
      }
      rooms.startCountdown(room, room.roomType === "private" ? 4 : 6);
      io.to(room.roomCode).emit("match:countdown", { seconds: Math.max(0, Math.ceil((room.countdownEndsAt - now()) / 1000)) });
      emitRoomState(room);
    });

    socket.on("player:input", (payload) => {
      const room = getRoomForSocket(socket);
      const player = room && room.players.get(socket.id);
      if (player) setInput(player, payload);
    });

    socket.on("inventory:select", (payload = {}) => {
      const room = getRoomForSocket(socket);
      const player = room && room.players.get(socket.id);
      if (player) selectSlot(player, payload.slot);
    });

    socket.on("combat:reload", () => {
      const room = getRoomForSocket(socket);
      const player = room && room.players.get(socket.id);
      if (player && beginReload(player)) {
        socket.emit("combat:reload", { ok: true });
      }
    });

    socket.on("combat:fire", (payload = {}) => {
      const room = getRoomForSocket(socket);
      const player = room && room.players.get(socket.id);
      if (!room || !player || room.status !== "playing") return;
      const result = fireHitscan(room, player, payload);
      if (!result.ok) {
        socket.emit("server:error", result.reason);
        return;
      }
      for (const hit of result.results) {
        if (hit.type === "player" && hit.eliminated) {
          const defeated = [...room.players.values(), ...room.dummies].find((p) => p.id === hit.targetId);
          addKillFeed(room, `${player.name} eliminated ${defeated ? defeated.name : "a target"}`);
          io.to(room.roomCode).emit("combat:elimination", {
            attackerId: player.id,
            targetId: hit.targetId,
            message: room.killFeed[room.killFeed.length - 1].message
          });
        }
      }
      io.to(room.roomCode).emit("combat:hit", result);
      rooms.maybeFinish(room);
    });

    socket.on("loot:pickup", (payload = {}) => {
      const room = getRoomForSocket(socket);
      const player = room && room.players.get(socket.id);
      if (!room || !player) return;
      const result = pickupLoot(room, player, payload.lootId);
      if (!result.ok) {
        socket.emit("server:error", result.reason);
        return;
      }
      io.to(room.roomCode).emit("loot:update", { pickedUpId: result.item.id, playerId: player.id });
    });

    socket.on("item:use", () => {
      const room = getRoomForSocket(socket);
      const player = room && room.players.get(socket.id);
      if (!player) return;
      const result = useConsumable(player);
      if (!result.ok) {
        socket.emit("server:error", result.reason);
      }
    });

    socket.on("build:place", (payload = {}) => {
      const room = getRoomForSocket(socket);
      const player = room && room.players.get(socket.id);
      if (!room || !player || room.status !== "playing") return;
      const result = placeBuild(room, player, payload);
      if (!result.ok) {
        socket.emit("server:error", result.reason);
        return;
      }
      io.to(room.roomCode).emit("build:update", { action: "placed", piece: result.piece });
    });

    socket.on("build:damage", (payload = {}) => {
      const room = getRoomForSocket(socket);
      const player = room && room.players.get(socket.id);
      if (!room || !player || !player.alive) return;
      const result = damageBuild(room, payload.buildId, 25);
      if (result.ok) {
        io.to(room.roomCode).emit("build:update", {
          action: result.destroyed ? "destroyed" : "damaged",
          piece: result.piece
        });
      }
    });

    socket.on("player:respawnPractice", () => {
      const room = getRoomForSocket(socket);
      const player = room && room.players.get(socket.id);
      if (!room || !player || (room.roomType !== "practice" && room.roomType !== "sandbox")) return;
      resetPlayerForMatch(player, { x: 0, y: 10, z: 0, yaw: 0 }, room.roomType);
    });

    socket.on("disconnect", () => {
      leaveCurrentRoom(socket);
      profiles.delete(socket.id);
    });
  });

  setInterval(() => {
    const dt = 1 / SERVER_TICK_RATE;
    for (const room of rooms.rooms.values()) {
      if (room.status === "countdown" && room.countdownEndsAt <= now()) {
        rooms.startMatch(room);
        io.to(room.roomCode).emit("match:start", serializeRoom(room));
        emitRoomState(room);
        emitImmediateSnapshots(room);
      }
      if (room.status === "playing") {
        updateStorm(room.storm);
        const dropPhase = updateDropState(room);
        for (const player of room.players.values()) {
          finishReloadIfReady(player);
          if (dropPhase !== "bus") applyInput(player, room, dt);
          applyStormDamage(room, player, dt, io, addKillFeed);
        }
        for (const event of updateBots(room, dt)) {
          handleCombatResult(room, event, io, addKillFeed);
        }
        if (room.roomType === "bot") {
          for (const bot of room.dummies) applyStormDamage(room, bot, dt, io, addKillFeed);
        }
        rooms.maybeFinish(room);
      }

      const snapshotInterval = 1000 / SNAPSHOT_RATE;
      if (now() - room.lastSnapshotAt >= snapshotInterval) {
        room.lastSnapshotAt = now();
        for (const playerId of room.players.keys()) {
          io.to(playerId).emit("world:snapshot", serializeSnapshot(room, playerId));
        }
        if (room.status === "playing") {
          io.to(room.roomCode).emit("storm:update", serializeSnapshot(room).storm);
        }
        if (room.status === "finished") {
          io.to(room.roomCode).emit("match:finished", serializeSnapshot(room));
        }
      }
    }
  }, 1000 / SERVER_TICK_RATE);

  setInterval(() => {
    rooms.cleanupOldRooms();
  }, 60 * 1000);
}

function applyStormDamage(room, player, dt, io, addKillFeed) {
  if (!player.alive || !isOutsideStorm(room.storm, player)) {
    player.stormClock = 0;
    return;
  }
  player.stormClock += dt;
  if (player.stormClock < 1) return;
  player.stormClock = 0;
  const outcome = applyDamage(player, room.storm.damage, null, "storm", room);
  if (outcome.eliminated) {
    addKillFeed(room, `${player.name} was claimed by the storm`);
    io.to(room.roomCode).emit("combat:elimination", {
      attackerId: null,
      targetId: player.id,
      message: room.killFeed[room.killFeed.length - 1].message
    });
  }
}

function handleCombatResult(room, result, io, addKillFeed) {
  if (!result || !result.ok) return;
  const shooter = [...room.players.values(), ...room.dummies].find((player) => player.id === result.shooterId);
  for (const hit of result.results) {
    if (hit.type === "player" && hit.eliminated) {
      const defeated = [...room.players.values(), ...room.dummies].find((player) => player.id === hit.targetId);
      addKillFeed(room, `${shooter ? shooter.name : "A bot"} eliminated ${defeated ? defeated.name : "a target"}`);
      io.to(room.roomCode).emit("combat:elimination", {
        attackerId: result.shooterId,
        targetId: hit.targetId,
        message: room.killFeed[room.killFeed.length - 1].message
      });
    }
  }
  io.to(room.roomCode).emit("combat:hit", result);
}

module.exports = {
  attachGameServer
};
