const {
  AMMO_START,
  MAP_SIZE,
  PLAYER_HEIGHT,
  clamp,
  createConsumableInstance,
  createWeaponInstance,
  distance2D,
  normalizeAngle,
  getTerrainHeightAt,
  safeNumber,
  sanitizeName,
  WEAPON_STATS
} = require("./utils");
const { clampToArena, resolvePlayerBuildCollision } = require("./collision");

const PLAYER_COLORS = [
  "#2dd4bf",
  "#fb7185",
  "#facc15",
  "#60a5fa",
  "#c084fc",
  "#34d399",
  "#f97316",
  "#e879f9",
  "#a3e635",
  "#38bdf8",
  "#fda4af",
  "#fde047"
];

function makeStartingInventory(includeMini = true) {
  return includeMini
    ? [createWeaponInstance("pistol_common"), createConsumableInstance("smallShield", 1), null, null, null]
    : [createWeaponInstance("pistol_common"), null, null, null, null];
}

function createPlayer(socketId, name, index = 0, options = {}) {
  const inventory = makeStartingInventory(!options.isBot);
  return {
    id: socketId,
    socketId,
    name: sanitizeName(name),
    color: options.color || PLAYER_COLORS[index % PLAYER_COLORS.length],
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    pitch: 0,
    grounded: true,
    crouching: false,
    alive: true,
    spectator: false,
    isBot: Boolean(options.isBot),
    health: 100,
    shield: 0,
    materials: options.materials || 80,
    ammo: { ...AMMO_START },
    inventory,
    selectedSlot: 0,
    reloadEndsAt: 0,
    lastFireAt: 0,
    input: null,
    droppedFromBus: false,
    eliminations: 0,
    damageDealt: 0,
    damageTaken: 0,
    buildsPlaced: 0,
    shotsFired: 0,
    shotsHit: 0,
    survivalStart: Date.now(),
    eliminatedAt: 0,
    placement: null,
    stormClock: 0,
    lastInputAt: Date.now()
  };
}

function resetPlayerForMatch(player, spawn, mode) {
  player.x = spawn.x;
  player.y = spawn.y || 0;
  player.z = spawn.z;
  player.vx = 0;
  player.vy = 0;
  player.vz = 0;
  player.yaw = spawn.yaw || 0;
  player.pitch = 0;
  player.grounded = player.y <= 0.01;
  player.alive = true;
  player.spectator = false;
  player.health = 100;
  player.shield = 0;
  player.materials = mode === "sandbox" ? 9999 : mode === "practice" ? 400 : 90;
  player.ammo = { ...AMMO_START };
  player.inventory = makeStartingInventory(!player.isBot);
  player.selectedSlot = 0;
  player.reloadEndsAt = 0;
  player.lastFireAt = 0;
  player.droppedFromBus = false;
  player.eliminations = 0;
  player.damageDealt = 0;
  player.damageTaken = 0;
  player.buildsPlaced = 0;
  player.shotsFired = 0;
  player.shotsHit = 0;
  player.survivalStart = Date.now();
  player.eliminatedAt = 0;
  player.placement = null;
  player.stormClock = 0;
}

function serializePlayer(player) {
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    x: Number(player.x.toFixed(3)),
    y: Number(player.y.toFixed(3)),
    z: Number(player.z.toFixed(3)),
    yaw: Number(player.yaw.toFixed(4)),
    pitch: Number(player.pitch.toFixed(4)),
    health: Math.max(0, Math.round(player.health)),
    shield: Math.max(0, Math.round(player.shield)),
    alive: player.alive,
    spectator: player.spectator,
    isBot: player.isBot,
    selectedSlot: player.selectedSlot,
    selectedWeaponId: getHeldWeapon(player) ? getHeldWeapon(player).stats.id : null,
    materials: player.materials,
    eliminations: player.eliminations
  };
}

function serializeSelf(player) {
  return {
    ...serializePlayer(player),
    ammo: { ...player.ammo },
    inventory: player.inventory.map((item) => item ? { ...item } : null),
    reloadRemaining: Math.max(0, player.reloadEndsAt - Date.now()),
    damageDealt: Math.round(player.damageDealt),
    damageTaken: Math.round(player.damageTaken),
    buildsPlaced: player.buildsPlaced,
    shotsFired: player.shotsFired,
    shotsHit: player.shotsHit,
    placement: player.placement
  };
}

function setInput(player, input) {
  if (!input || typeof input !== "object") return;
  player.input = {
    moveX: clamp(safeNumber(input.moveX), -1, 1),
    moveZ: clamp(safeNumber(input.moveZ), -1, 1),
    jump: Boolean(input.jump),
    sprint: Boolean(input.sprint),
    crouch: Boolean(input.crouch),
    yaw: normalizeAngle(safeNumber(input.yaw, player.yaw)),
    pitch: clamp(safeNumber(input.pitch, player.pitch), -1.1, 0.75),
    seq: safeNumber(input.seq, 0)
  };
  player.lastInputAt = Date.now();
}

function applyInput(player, room, dt) {
  if (!player.alive || !player.input) return;
  const input = player.input;
  player.yaw = input.yaw;
  player.pitch = input.pitch;
  player.crouching = input.crouch;

  const moveLength = Math.hypot(input.moveX, input.moveZ);
  const normX = moveLength > 1 ? input.moveX / moveLength : input.moveX;
  const normZ = moveLength > 1 ? input.moveZ / moveLength : input.moveZ;
  const sprint = input.sprint && normZ > 0.2;
  const baseSpeed = sprint ? 18 : player.crouching ? 7.5 : 12;
  const airFactor = player.grounded ? 1 : 0.55;
  const sin = Math.sin(player.yaw);
  const cos = Math.cos(player.yaw);
  const dirX = sin * normZ + cos * normX;
  const dirZ = cos * normZ - sin * normX;

  player.vx = dirX * baseSpeed * airFactor;
  player.vz = dirZ * baseSpeed * airFactor;

  if (input.jump && player.grounded) {
    player.vy = 13.5;
    player.grounded = false;
  }

  player.vy -= 28 * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.z += player.vz * dt;

  const groundY = getTerrainHeightAt(player.x, player.z);
  if (player.y <= groundY) {
    player.y = groundY;
    player.vy = 0;
    player.grounded = true;
  }

  const half = MAP_SIZE / 2 - 2;
  player.x = clamp(player.x, -half, half);
  player.z = clamp(player.z, -half, half);
  resolvePlayerBuildCollision(player, room);
  clampToArena(player);
}

function resolveInventoryIndex(player, index = player.selectedSlot) {
  const clamped = clamp(Math.floor(Number(index)), 0, 4);
  const slot = player.inventory[clamped];
  if (!slot || slot.slotType !== "reserved") return clamped;
  const parentIndex = player.inventory.findIndex((candidate) => candidate && candidate.instanceId === slot.parentInstanceId);
  return parentIndex === -1 ? clamped : parentIndex;
}

function getHeldItem(player) {
  return player.inventory[resolveInventoryIndex(player)] || null;
}

function getHeldWeapon(player) {
  const item = getHeldItem(player);
  if (!item || item.slotType !== "weapon") return null;
  const stats = WEAPON_STATS[item.weaponId];
  return stats ? { item, stats } : null;
}

function selectSlot(player, slot) {
  const index = resolveInventoryIndex(player, slot);
  player.selectedSlot = index;
  player.reloadEndsAt = 0;
}

function clearInventorySlot(player, index) {
  const slot = player.inventory[index];
  if (!slot) return;
  if (slot.slotType === "reserved") {
    const parentIndex = player.inventory.findIndex((candidate) => candidate && candidate.instanceId === slot.parentInstanceId);
    if (parentIndex !== -1) clearInventorySlot(player, parentIndex);
    player.inventory[index] = null;
    return;
  }
  if ((slot.slotSize || 1) > 1) {
    for (let i = index + 1; i < Math.min(player.inventory.length, index + slot.slotSize); i += 1) {
      if (player.inventory[i] && player.inventory[i].parentInstanceId === slot.instanceId) player.inventory[i] = null;
    }
  }
  player.inventory[index] = null;
}

function placeInventoryItem(player, item, index) {
  const size = Math.max(1, item.slotSize || 1);
  for (let i = index; i < Math.min(player.inventory.length, index + size); i += 1) clearInventorySlot(player, i);
  player.inventory[index] = item;
  for (let i = 1; i < size && index + i < player.inventory.length; i += 1) {
    player.inventory[index + i] = {
      slotType: "reserved",
      parentInstanceId: item.instanceId,
      name: item.name || "Linked slot"
    };
  }
  return index;
}

function findInventorySpace(player, size = 1) {
  for (let i = 0; i <= player.inventory.length - size; i += 1) {
    let open = true;
    for (let j = 0; j < size; j += 1) {
      if (player.inventory[i + j]) {
        open = false;
        break;
      }
    }
    if (open) return i;
  }
  return -1;
}

function addInventoryItem(player, item) {
  if (!item) return -1;
  if (item.slotType === "consumable") {
    const stackIndex = player.inventory.findIndex((slot) => slot && slot.slotType === "consumable" && slot.itemId === item.itemId && (slot.count || 1) < (slot.maxStack || 1));
    if (stackIndex !== -1) {
      const slot = player.inventory[stackIndex];
      const moved = Math.min((item.count || 1), (slot.maxStack || 1) - (slot.count || 1));
      slot.count = (slot.count || 1) + moved;
      return stackIndex;
    }
  }
  const size = Math.max(1, item.slotSize || 1);
  const emptyIndex = findInventorySpace(player, size);
  if (emptyIndex !== -1) return placeInventoryItem(player, item, emptyIndex);
  const target = Math.min(resolveInventoryIndex(player), player.inventory.length - size);
  return placeInventoryItem(player, item, Math.max(0, target));
}

function beginReload(player) {
  const held = getHeldWeapon(player);
  if (!held || player.reloadEndsAt > Date.now()) return false;
  const { item, stats } = held;
  if (item.ammoInMag >= stats.magazineSize) return false;
  if ((player.ammo[stats.ammoType] || 0) <= 0) return false;
  player.reloadEndsAt = Date.now() + stats.reloadTime * 1000;
  return true;
}

function rechargeChargeWeapons(player, time = Date.now()) {
  for (const item of player.inventory) {
    if (!item || item.slotType !== "weapon") continue;
    const stats = WEAPON_STATS[item.weaponId];
    if (!stats || stats.ammoType !== "charges" || item.ammoInMag >= stats.magazineSize) continue;
    const interval = (stats.rechargeTime || 8) * 1000;
    if (!item.lastChargeAt) item.lastChargeAt = time;
    while (item.ammoInMag < stats.magazineSize && time - item.lastChargeAt >= interval) {
      item.ammoInMag += 1;
      item.lastChargeAt += interval;
    }
  }
}

function finishReloadIfReady(player) {
  const time = Date.now();
  rechargeChargeWeapons(player, time);
  if (!player.reloadEndsAt || player.reloadEndsAt > time) return;
  const held = getHeldWeapon(player);
  if (!held) {
    player.reloadEndsAt = 0;
    return;
  }
  const { item, stats } = held;
  const needed = stats.magazineSize - item.ammoInMag;
  const available = player.ammo[stats.ammoType] || 0;
  const moved = Math.min(needed, available);
  item.ammoInMag += moved;
  player.ammo[stats.ammoType] = available - moved;
  player.reloadEndsAt = 0;
}

function applyDamage(target, amount, attacker, cause = "damage", room = null) {
  if (!target.alive || amount <= 0) return { eliminated: false, shieldDamage: 0, healthDamage: 0 };
  let remaining = amount;
  const shieldDamage = Math.min(target.shield, remaining);
  target.shield -= shieldDamage;
  remaining -= shieldDamage;
  const healthDamage = Math.min(target.health, remaining);
  target.health -= healthDamage;
  target.damageTaken += shieldDamage + healthDamage;
  if (attacker && attacker.id !== target.id) {
    attacker.damageDealt += shieldDamage + healthDamage;
    if (healthDamage + shieldDamage > 0) attacker.shotsHit += 1;
  }
  let eliminated = false;
  if (target.health <= 0) {
    eliminated = true;
    target.health = 0;
    target.alive = false;
    target.spectator = !target.isBot;
    target.eliminatedAt = Date.now();
    if (room) {
      target.placement = Math.max(1, countAliveContestants(room) + 1);
    }
    if (attacker && attacker.id !== target.id) attacker.eliminations += 1;
  }
  return { eliminated, shieldDamage, healthDamage, cause };
}

function countAliveHumans(room) {
  let alive = 0;
  for (const player of room.players.values()) {
    if (!player.isBot && player.alive) alive += 1;
  }
  return alive;
}

function countAliveContestants(room) {
  let alive = countAliveHumans(room);
  if (room && room.roomType === "bot") {
    for (const bot of room.dummies || []) {
      if (bot.alive) alive += 1;
    }
  }
  return alive;
}

function makeSpawn(index, count) {
  const angle = (index / Math.max(1, count)) * Math.PI * 2;
  const radius = 92 + (index % 5) * 22;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  return {
    x,
    y: getTerrainHeightAt(x, z) + 2,
    z,
    yaw: angle + Math.PI
  };
}

function makePracticeDummies(count = 5) {
  const dummies = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const dummy = createPlayer(`dummy_${i + 1}`, `Target ${i + 1}`, i + 10, {
      isBot: true,
      materials: 0
    });
    resetPlayerForMatch(dummy, {
      x: Math.cos(angle) * 58,
      y: getTerrainHeightAt(Math.cos(angle) * 58, Math.sin(angle) * 58) + 0.2,
      z: Math.sin(angle) * 58,
      yaw: angle + Math.PI
    }, "practice");
    dummy.shield = 0;
    dummies.push(dummy);
  }
  return dummies;
}

function makeBotOpponents(count = 11) {
  const names = [
    "Patch", "Vector", "Comet", "Latch", "Mica", "Orbit",
    "Fable", "Rift", "Sparks", "Nova", "Kite", "Bolt",
    "Echo", "Slate", "Juno", "Pixel"
  ];
  const bots = [];
  for (let i = 0; i < count; i += 1) {
    const bot = createPlayer(`bot_${i + 1}_${Date.now().toString(36)}`, names[i % names.length], i + 20, {
      isBot: true,
      materials: 70
    });
    bot.botSkill = 0.45 + Math.random() * 0.45;
    bot.botNextShotAt = 0;
    bot.botStrafe = Math.random() > 0.5 ? 0.35 : -0.35;
    bot.botThinkAt = 0;
    bot.botWanderYaw = Math.random() * Math.PI * 2;
    bots.push(bot);
  }
  return bots;
}

function setupBotLoadout(bot, index = 0) {
  const choices = ["assault_rifle_uncommon", "pump_shotgun_rare", "smg_common", "burst_assault_rare", "bolt_sniper_epic"];
  bot.inventory[0] = createWeaponInstance(choices[index % choices.length]);
  bot.selectedSlot = 0;
  bot.shield = 25;
  bot.materials = 80;
  bot.ammo.light += 24;
  bot.ammo.medium += 48;
  bot.ammo.shells += 12;
  bot.ammo.heavy += 6;
}

module.exports = {
  PLAYER_COLORS,
  addInventoryItem,
  applyDamage,
  applyInput,
  beginReload,
  countAliveContestants,
  countAliveHumans,
  createPlayer,
  finishReloadIfReady,
  getHeldItem,
  getHeldWeapon,
  makeBotOpponents,
  makePracticeDummies,
  makeSpawn,
  resetPlayerForMatch,
  selectSlot,
  serializePlayer,
  serializeSelf,
  setupBotLoadout,
  setInput
};
