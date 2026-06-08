const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAP_SIZE = 320;
const PLAYER_RADIUS = 0.72;
const PLAYER_HEIGHT = 2.15;
const SERVER_TICK_RATE = 20;
const SNAPSHOT_RATE = 15;
const MAX_PLAYERS = Number(process.env.TWO_WEEKS_MAX_PLAYERS || 16);
const BOT_LOBBY_BOT_COUNT = Number(process.env.TWO_WEEKS_BOT_COUNT || 11);
const QUICK_START_PLAYERS = Number(process.env.TWO_WEEKS_QUICK_START_PLAYERS || 2);
const COUNTDOWN_SECONDS = 6;

const WEAPON_STATS = {
  pistol: {
    id: "pistol",
    name: "Pistol",
    rarity: "Common",
    damage: 18,
    buildDamage: 14,
    fireRate: 3.2,
    magazineSize: 12,
    reloadTime: 1.25,
    ammoType: "light",
    spread: 0.018,
    range: 78,
    pellets: 1
  },
  assault: {
    id: "assault",
    name: "Assault Rifle",
    rarity: "Uncommon",
    damage: 24,
    buildDamage: 20,
    fireRate: 7.2,
    magazineSize: 30,
    reloadTime: 1.9,
    ammoType: "medium",
    spread: 0.026,
    range: 108,
    pellets: 1
  },
  shotgun: {
    id: "shotgun",
    name: "Scatter Shotgun",
    rarity: "Rare",
    damage: 9,
    buildDamage: 11,
    fireRate: 1.05,
    magazineSize: 6,
    reloadTime: 2.35,
    ammoType: "shells",
    spread: 0.12,
    range: 48,
    pellets: 8
  },
  sniper: {
    id: "sniper",
    name: "Longview Rifle",
    rarity: "Epic",
    damage: 78,
    buildDamage: 60,
    fireRate: 0.55,
    magazineSize: 4,
    reloadTime: 2.8,
    ammoType: "heavy",
    spread: 0.006,
    range: 170,
    pellets: 1
  }
};

const AMMO_START = {
  light: 48,
  medium: 42,
  shells: 10,
  heavy: 5
};

function now() {
  return Date.now();
}

function makeId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
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
  const stats = WEAPON_STATS[weaponId] || WEAPON_STATS.pistol;
  return {
    slotType: "weapon",
    instanceId: makeId("weapon"),
    weaponId: stats.id,
    ammoInMag: stats.magazineSize,
    rarity: stats.rarity
  };
}

function clonePublicItem(item) {
  return item ? JSON.parse(JSON.stringify(item)) : null;
}

module.exports = {
  AMMO_START,
  BOT_LOBBY_BOT_COUNT,
  COUNTDOWN_SECONDS,
  MAP_SIZE,
  MAX_PLAYERS,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  QUICK_START_PLAYERS,
  ROOM_CODE_CHARS,
  SERVER_TICK_RATE,
  SNAPSHOT_RATE,
  WEAPON_STATS,
  clamp,
  clonePublicItem,
  createWeaponInstance,
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
