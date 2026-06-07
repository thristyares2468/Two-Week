const {
  distance2D,
  makeId,
  snapPosition,
  safeNumber,
  clamp
} = require("./utils");
const { buildOverlapsPlayer, collidesWithBuilds, isInsideArena } = require("./collision");

const BUILD_COST = 10;
const BUILD_GRID = 6;
const BUILD_HEALTH = {
  wall: 150,
  ramp: 140,
  floor: 130,
  roof: 130
};

function normalizeBuildPayload(payload) {
  const type = ["wall", "ramp", "floor", "roof"].includes(payload && payload.type) ? payload.type : "wall";
  const raw = payload && payload.position ? payload.position : {};
  const pos = snapPosition({
    x: safeNumber(raw.x),
    y: safeNumber(raw.y),
    z: safeNumber(raw.z)
  }, BUILD_GRID);
  const rotation = ((Math.round(safeNumber(payload && payload.rotation) / 90) * 90) % 360 + 360) % 360;
  return { type, x: pos.x, y: clamp(pos.y, 0, 24), z: pos.z, rotation };
}

function buildKey(piece) {
  return `${piece.type}:${piece.x}:${piece.y}:${piece.z}:${piece.rotation}`;
}

function validateBuildPlacement(room, player, payload) {
  if (!player || !player.alive) return { ok: false, reason: "You must be alive to build." };
  if (!["playing", "countdown"].includes(room.status)) return { ok: false, reason: "The match is not active." };
  const piece = normalizeBuildPayload(payload || {});
  if (!isInsideArena(piece, 3)) return { ok: false, reason: "Build is outside the arena." };
  if (distance2D(player, piece) > 22) return { ok: false, reason: "Build is too far away." };
  if (player.materials < BUILD_COST && room.roomType !== "sandbox") {
    return { ok: false, reason: "Not enough materials." };
  }
  if (room.buildIndex.has(buildKey(piece))) return { ok: false, reason: "Build space is occupied." };
  const testPiece = { ...piece, id: "test" };
  if (buildOverlapsPlayer(testPiece, room)) return { ok: false, reason: "Cannot build through a player." };
  if (collidesWithBuilds({ x: piece.x, y: piece.y, z: piece.z }, room, 0.5)) {
    return { ok: false, reason: "Build overlaps another piece." };
  }
  return { ok: true, piece };
}

function placeBuild(room, player, payload) {
  const validation = validateBuildPlacement(room, player, payload);
  if (!validation.ok) return validation;
  const piece = {
    ...validation.piece,
    id: makeId("build"),
    ownerId: player.id,
    health: BUILD_HEALTH[validation.piece.type],
    maxHealth: BUILD_HEALTH[validation.piece.type],
    placedAt: Date.now()
  };
  room.builds.set(piece.id, piece);
  room.buildIndex.set(buildKey(piece), piece.id);
  if (room.roomType !== "sandbox") player.materials -= BUILD_COST;
  player.buildsPlaced += 1;
  return { ok: true, piece };
}

function damageBuild(room, buildId, amount) {
  const piece = room.builds.get(buildId);
  if (!piece) return { ok: false };
  piece.health -= amount;
  if (piece.health <= 0) {
    room.builds.delete(piece.id);
    room.buildIndex.delete(buildKey(piece));
    return { ok: true, destroyed: true, piece };
  }
  return { ok: true, destroyed: false, piece };
}

function serializeBuilds(room) {
  return Array.from(room.builds.values()).map((piece) => ({
    id: piece.id,
    ownerId: piece.ownerId,
    type: piece.type,
    x: piece.x,
    y: piece.y,
    z: piece.z,
    rotation: piece.rotation,
    health: Math.max(0, Math.round(piece.health)),
    maxHealth: piece.maxHealth
  }));
}

module.exports = {
  BUILD_COST,
  BUILD_GRID,
  BUILD_HEALTH,
  damageBuild,
  placeBuild,
  serializeBuilds,
  validateBuildPlacement
};
