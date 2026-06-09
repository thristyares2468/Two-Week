const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAP_SIZE = 560;
const PLAYER_RADIUS = 0.72;
const PLAYER_HEIGHT = 2.15;
const SERVER_TICK_RATE = 20;
const SNAPSHOT_RATE = 15;
const MAX_PLAYERS = Number(process.env.TWO_WEEKS_MAX_PLAYERS || 16);
const BOT_LOBBY_BOT_COUNT = Number(process.env.TWO_WEEKS_BOT_COUNT || 11);
const QUICK_START_PLAYERS = Number(process.env.TWO_WEEKS_QUICK_START_PLAYERS || 2);
const COUNTDOWN_SECONDS = 6;
const MAIN_GROUND_Y = 0.35;
const SPAWN_ISLAND_Z = -405;
const SPAWN_ISLAND_RADIUS = 38;
const SPAWN_ISLAND_GROUND_Y = 2.85;

const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
const RARITY_COLORS = {
  Common: "#dbeafe",
  Uncommon: "#86efac",
  Rare: "#60a5fa",
  Epic: "#c084fc",
  Legendary: "#f59e0b"
};

const WEAPON_STATS = {};

function rarityKey(rarity) {
  return String(rarity).toLowerCase();
}

function addWeapon(id, config) {
  WEAPON_STATS[id] = {
    id,
    color: RARITY_COLORS[config.rarity] || "#dbeafe",
    buildDamage: Math.round((config.bodyDamage || config.damage || 20) * (config.buildScale || 0.72)),
    pellets: 1,
    spread: 0.02,
    range: 90,
    reloadTime: 2,
    fireRate: 3,
    magazineSize: 1,
    ammoType: "light",
    headshotMultiplier: 1.5,
    model: "rifle",
    ...config
  };
}

function addRaritySeries(baseId, damages, config) {
  RARITIES.forEach((rarity, index) => {
    if (damages[index] === null || damages[index] === undefined) return;
    const key = rarityKey(rarity);
    const id = baseId + "_" + key;
    const displayName = typeof config.name === "function" ? config.name(rarity, index) : config.name;
    const bodyDamage = damages[index];
    const pellets = config.pellets || 1;
    addWeapon(id, {
      ...config,
      id,
      name: displayName,
      rarity,
      bodyDamage,
      damage: config.damagePerPellet ? Math.max(1, bodyDamage / pellets) : bodyDamage,
      pellets,
      reloadTime: Array.isArray(config.reloadTime) ? config.reloadTime[index] : config.reloadTime
    });
  });
}

addRaritySeries("assault_rifle", [30, 31, 33, 35, 36], {
  name: (rarity) => rarity === "Epic" || rarity === "Legendary" ? "SCAR Assault Rifle" : "Assault Rifle",
  ammoType: "medium",
  fireRate: 5.5,
  magazineSize: 30,
  reloadTime: [2.35, 2.25, 2.15, 2.05, 1.95],
  spread: 0.024,
  range: 122,
  headshotMultiplier: 1.5,
  model: "assault",
  buildScale: 0.68
});

addRaritySeries("burst_assault", [27, 28, 29, 32, 33], {
  name: (rarity) => rarity === "Epic" || rarity === "Legendary" ? "AUG Burst Rifle" : "Burst Assault Rifle",
  ammoType: "medium",
  fireRate: 1.75,
  magazineSize: 30,
  reloadTime: [2.55, 2.45, 2.35, 2.25, 2.15],
  spread: 0.026,
  range: 118,
  roundsPerShot: 3,
  burstCount: 3,
  headshotMultiplier: 1.5,
  model: "burst",
  buildScale: 0.62
});

addRaritySeries("pump_shotgun", [70, 80, 90, 100, 110], {
  name: "Pump Shotgun",
  ammoType: "shells",
  fireRate: 0.72,
  magazineSize: 5,
  reloadTime: [4.8, 4.6, 4.4, 4.2, 4.0],
  spread: 0.12,
  range: 42,
  pellets: 10,
  damagePerPellet: true,
  headshotMultiplier: 2,
  model: "pump",
  buildScale: 0.78
});

addRaritySeries("tactical_shotgun", [71, 75, 79, 83, 87], {
  name: "Tactical Shotgun",
  ammoType: "shells",
  fireRate: 1.5,
  magazineSize: 8,
  reloadTime: [6.3, 6.1, 5.9, 5.7, 5.5],
  spread: 0.105,
  range: 38,
  pellets: 10,
  damagePerPellet: true,
  headshotMultiplier: 2,
  model: "tactical",
  buildScale: 0.7
});

addRaritySeries("smg", [17, 18, 19, 20, 21], {
  name: "Submachine Gun",
  ammoType: "light",
  fireRate: 12,
  magazineSize: 30,
  reloadTime: [2.35, 2.25, 2.15, 2.05, 1.95],
  spread: 0.041,
  range: 74,
  headshotMultiplier: 1.5,
  model: "smg",
  buildScale: 0.54
});

addRaritySeries("pistol", [24, 25, 26, 27, 28], {
  name: "Pistol",
  ammoType: "light",
  fireRate: 6.75,
  magazineSize: 16,
  reloadTime: [1.55, 1.5, 1.45, 1.4, 1.35],
  spread: 0.026,
  range: 82,
  headshotMultiplier: 2,
  model: "pistol",
  buildScale: 0.5
});

addRaritySeries("bolt_sniper", [95, 100, 105, 110, 116], {
  name: "Bolt-Action Sniper Rifle",
  ammoType: "heavy",
  fireRate: 0.33,
  magazineSize: 1,
  reloadTime: [3.25, 3.15, 3.05, 2.95, 2.85],
  spread: 0.0025,
  range: 210,
  headshotMultiplier: 2.5,
  model: "sniper",
  buildScale: 0.9
});

["Rare", "Epic", "Legendary"].forEach((rarity, index) => {
  const damages = [110, 116, 121];
  const reloads = [4.1, 3.6, 3.2];
  const key = rarityKey(rarity);
  const id = "rocket_launcher_" + key;
  addWeapon(id, {
    name: "Rocket Launcher",
    rarity,
    bodyDamage: damages[index],
    damage: damages[index],
    ammoType: "rockets",
    fireRate: 0.32,
    magazineSize: 1,
    reloadTime: reloads[index],
    spread: 0.01,
    range: 150,
    headshotMultiplier: 1,
    model: "rocket",
    explosionRadius: 8.5,
    buildDamage: Math.round(damages[index] * 1.25)
  });
});

addWeapon("bandage_launcher_rare", {
  name: "Bandage Launcher",
  rarity: "Rare",
  bodyDamage: 0,
  damage: 0,
  healAmount: 15,
  maxHealth: 105,
  ammoType: "charges",
  fireRate: 1.25,
  magazineSize: 5,
  reloadTime: 0,
  rechargeTime: 8,
  spread: 0.01,
  range: 54,
  headshotMultiplier: 1,
  model: "medLauncher",
  slotSize: 2,
  buildDamage: 0
});

WEAPON_STATS.pistol = WEAPON_STATS.pistol_common;
WEAPON_STATS.assault = WEAPON_STATS.assault_rifle_uncommon;
WEAPON_STATS.shotgun = WEAPON_STATS.pump_shotgun_rare;
WEAPON_STATS.sniper = WEAPON_STATS.bolt_sniper_epic;
WEAPON_STATS.rocket = WEAPON_STATS.rocket_launcher_rare;
WEAPON_STATS.bandageLauncher = WEAPON_STATS.bandage_launcher_rare;

const CONSUMABLE_STATS = {
  smallShield: {
    itemId: "smallShield",
    name: "Small Shield",
    kind: "shield",
    amount: 25,
    maxShield: 50,
    maxStack: 6,
    rarity: "Uncommon",
    color: "#38bdf8"
  },
  shieldPotion: {
    itemId: "shieldPotion",
    name: "Shield Potion",
    kind: "shield",
    amount: 50,
    maxShield: 100,
    maxStack: 3,
    rarity: "Rare",
    color: "#2563eb"
  },
  bandage: {
    itemId: "bandage",
    name: "Bandages",
    kind: "heal",
    amount: 15,
    maxHealth: 75,
    maxStack: 15,
    rarity: "Common",
    color: "#f8fafc"
  },
  medkit: {
    itemId: "medkit",
    name: "Medkit",
    kind: "heal",
    amount: 100,
    maxHealth: 100,
    maxStack: 3,
    rarity: "Uncommon",
    color: "#ef4444"
  },
  grenade: {
    itemId: "grenade",
    name: "Grenade",
    kind: "explosive",
    damage: 100,
    radius: 7.5,
    maxStack: 6,
    rarity: "Common",
    color: "#4ade80"
  },
  fishingRod: {
    itemId: "fishingRod",
    name: "Fishing Rod",
    kind: "utility",
    maxStack: 1,
    rarity: "Common",
    color: "#a16207"
  }
};

const AMMO_START = {
  light: 48,
  medium: 0,
  shells: 0,
  heavy: 0,
  rockets: 0,
  charges: 0
};

function now() {
  return Date.now();
}

function makeId(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 9) + "_" + Date.now().toString(36);
}

function makeRoomCode(existingCodes = new Set()) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    let code = "";
    for (let i = 0; i < 6; i += 1) {
      code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    if (!existingCodes.has(code)) return code;
  }
  return makeId("room").slice(0, 6).toUpperCase();
}

function sanitizeName(name) {
  const cleaned = String(name || "Runner")
    .replace(/[^\w .-]/g, "")
    .trim()
    .slice(0, 18);
  return cleaned || "Runner";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

function distance2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function distance3D(a, b) {
  const dx = a.x - b.x;
  const dy = (a.y || 0) - (b.y || 0);
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function randomFloat(min, max) {
  return min + Math.random() * (max - min);
}

function randomPointInCircle(radius, center = { x: 0, z: 0 }) {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * radius;
  return {
    x: center.x + Math.cos(angle) * r,
    z: center.z + Math.sin(angle) * r
  };
}

function isOnSpawnIsland(x, z) {
  return Math.hypot(x, z - SPAWN_ISLAND_Z) <= SPAWN_ISLAND_RADIUS;
}

function getTerrainHeightAt(x, z) {
  return isOnSpawnIsland(x, z) ? SPAWN_ISLAND_GROUND_Y : MAIN_GROUND_Y;
}

function groundLootY(x, z, baseOffset = 0.9) {
  return Number((getTerrainHeightAt(x, z) + baseOffset).toFixed(2));
}


function snap(value, size = 6) {
  return Math.round(value / size) * size;
}

function snapPosition(pos, size = 6) {
  return {
    x: snap(pos.x, size),
    y: Math.max(0, snap(pos.y || 0, size)),
    z: snap(pos.z, size)
  };
}

function normalizeAngle(angle) {
  if (!Number.isFinite(angle)) return 0;
  let result = angle;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function createWeaponInstance(weaponId) {
  const stats = WEAPON_STATS[weaponId] || WEAPON_STATS.pistol_common;
  return {
    slotType: "weapon",
    instanceId: makeId("weapon"),
    weaponId: stats.id,
    ammoInMag: stats.magazineSize,
    rarity: stats.rarity,
    slotSize: stats.slotSize || 1,
    lastChargeAt: stats.ammoType === "charges" ? Date.now() : null
  };
}

function createConsumableInstance(itemId, count = 1) {
  const stats = CONSUMABLE_STATS[itemId] || CONSUMABLE_STATS.smallShield;
  return {
    slotType: "consumable",
    instanceId: makeId("item"),
    itemId: stats.itemId,
    kind: stats.kind,
    amount: stats.amount || 0,
    damage: stats.damage || 0,
    radius: stats.radius || 0,
    maxHealth: stats.maxHealth || null,
    maxShield: stats.maxShield || null,
    count: clamp(Math.floor(count || 1), 1, stats.maxStack || 1),
    maxStack: stats.maxStack || 1,
    rarity: stats.rarity,
    color: stats.color,
    name: stats.name
  };
}

function clonePublicItem(item) {
  return item ? JSON.parse(JSON.stringify(item)) : null;
}

module.exports = {
  AMMO_START,
  BOT_LOBBY_BOT_COUNT,
  CONSUMABLE_STATS,
  COUNTDOWN_SECONDS,
  MAIN_GROUND_Y,
  MAP_SIZE,
  MAX_PLAYERS,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  QUICK_START_PLAYERS,
  RARITIES,
  RARITY_COLORS,
  ROOM_CODE_CHARS,
  SERVER_TICK_RATE,
  SNAPSHOT_RATE,
  SPAWN_ISLAND_GROUND_Y,
  SPAWN_ISLAND_RADIUS,
  SPAWN_ISLAND_Z,
  WEAPON_STATS,
  clamp,
  clonePublicItem,
  createConsumableInstance,
  createWeaponInstance,
  getTerrainHeightAt,
  groundLootY,
  isOnSpawnIsland,
  distance2D,
  distance3D,
  lerp,
  makeId,
  makeRoomCode,
  normalizeAngle,
  now,
  randomFloat,
  randomPointInCircle,
  safeNumber,
  sanitizeName,
  snap,
  snapPosition
};
