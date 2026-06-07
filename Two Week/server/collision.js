const { MAP_SIZE, PLAYER_RADIUS, clamp, distance2D } = require("./utils");
const { STATIC_COLLIDERS, terrainHeightAt } = require("./mapData");

const BUILD_DIMS = {
  wall: { x: 6, y: 5, z: 0.75 },
  ramp: { x: 6, y: 4.2, z: 6 },
  floor: { x: 6, y: 0.65, z: 6 },
  roof: { x: 6, y: 3.2, z: 6 }
};

function getBuildDimensions(piece) {
  const dims = BUILD_DIMS[piece.type] || BUILD_DIMS.wall;
  const rot = Math.abs(Math.round((piece.rotation || 0) / 90)) % 2;
  if (piece.type === "wall" && rot === 1) {
    return { x: dims.z, y: dims.y, z: dims.x };
  }
  return { ...dims };
}

function getBuildBounds(piece) {
  const dims = getBuildDimensions(piece);
  const yCenter = (piece.y || 0) + dims.y / 2;
  return {
    min: {
      x: piece.x - dims.x / 2,
      y: yCenter - dims.y / 2,
      z: piece.z - dims.z / 2
    },
    max: {
      x: piece.x + dims.x / 2,
      y: yCenter + dims.y / 2,
      z: piece.z + dims.z / 2
    }
  };
}

function getStaticBounds(collider) {
  const yCenter = (collider.y || 0) + collider.height / 2;
  return {
    min: {
      x: collider.x - collider.width / 2,
      y: yCenter - collider.height / 2,
      z: collider.z - collider.depth / 2
    },
    max: {
      x: collider.x + collider.width / 2,
      y: yCenter + collider.height / 2,
      z: collider.z + collider.depth / 2
    }
  };
}

function sphereAabb(center, radius, bounds) {
  const x = clamp(center.x, bounds.min.x, bounds.max.x);
  const y = clamp(center.y, bounds.min.y, bounds.max.y);
  const z = clamp(center.z, bounds.min.z, bounds.max.z);
  const dx = center.x - x;
  const dy = center.y - y;
  const dz = center.z - z;
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}

function rayAabb(origin, dir, bounds, maxDistance) {
  let tMin = 0;
  let tMax = maxDistance;
  const axes = ["x", "y", "z"];
  for (const axis of axes) {
    const d = dir[axis];
    if (Math.abs(d) < 0.00001) {
      if (origin[axis] < bounds.min[axis] || origin[axis] > bounds.max[axis]) return null;
    } else {
      const inv = 1 / d;
      let t1 = (bounds.min[axis] - origin[axis]) * inv;
      let t2 = (bounds.max[axis] - origin[axis]) * inv;
      if (t1 > t2) {
        const temp = t1;
        t1 = t2;
        t2 = temp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return null;
    }
  }
  return tMin >= 0 && tMin <= maxDistance ? tMin : null;
}

function raySphere(origin, dir, center, radius, maxDistance) {
  const oc = {
    x: origin.x - center.x,
    y: origin.y - center.y,
    z: origin.z - center.z
  };
  const b = oc.x * dir.x + oc.y * dir.y + oc.z * dir.z;
  const c = oc.x * oc.x + oc.y * oc.y + oc.z * oc.z - radius * radius;
  const h = b * b - c;
  if (h < 0) return null;
  const t = -b - Math.sqrt(h);
  if (t >= 0 && t <= maxDistance) return t;
  const t2 = -b + Math.sqrt(h);
  return t2 >= 0 && t2 <= maxDistance ? t2 : null;
}

function clampToArena(player) {
  const half = MAP_SIZE / 2 - PLAYER_RADIUS;
  player.x = clamp(player.x, -half, half);
  player.z = clamp(player.z, -half, half);
}

function collidesWithStaticWorld(pos, radius = PLAYER_RADIUS) {
  const center = { x: pos.x, y: (pos.y || 0) + 1.5, z: pos.z };
  for (const collider of STATIC_COLLIDERS) {
    if (sphereAabb(center, radius, getStaticBounds(collider))) return true;
  }
  return false;
}

function collidesWithBuilds(pos, room, radius = PLAYER_RADIUS) {
  const center = { x: pos.x, y: (pos.y || 0) + 1.5, z: pos.z };
  for (const piece of room.builds.values()) {
    if (sphereAabb(center, radius, getBuildBounds(piece))) return true;
  }
  return false;
}

function resolvePlayerBuildCollision(player, room) {
  for (let pass = 0; pass < 2; pass += 1) {
    for (const piece of room.builds.values()) {
      const bounds = getBuildBounds(piece);
      const center = { x: player.x, y: player.y + 1.45, z: player.z };
      if (!sphereAabb(center, PLAYER_RADIUS, bounds)) continue;
      const pushX = center.x < (bounds.min.x + bounds.max.x) / 2
        ? bounds.min.x - center.x - PLAYER_RADIUS
        : bounds.max.x - center.x + PLAYER_RADIUS;
      const pushZ = center.z < (bounds.min.z + bounds.max.z) / 2
        ? bounds.min.z - center.z - PLAYER_RADIUS
        : bounds.max.z - center.z + PLAYER_RADIUS;
      if (Math.abs(pushX) < Math.abs(pushZ)) {
        player.x += pushX;
      } else {
        player.z += pushZ;
      }
    }
  }
  clampToArena(player);
}

function resolvePlayerStaticCollision(player) {
  for (let pass = 0; pass < 3; pass += 1) {
    for (const collider of STATIC_COLLIDERS) {
      const bounds = getStaticBounds(collider);
      const center = { x: player.x, y: player.y + 1.45, z: player.z };
      if (!sphereAabb(center, PLAYER_RADIUS, bounds)) continue;
      const midX = (bounds.min.x + bounds.max.x) / 2;
      const midZ = (bounds.min.z + bounds.max.z) / 2;
      const pushX = center.x < midX
        ? bounds.min.x - center.x - PLAYER_RADIUS
        : bounds.max.x - center.x + PLAYER_RADIUS;
      const pushZ = center.z < midZ
        ? bounds.min.z - center.z - PLAYER_RADIUS
        : bounds.max.z - center.z + PLAYER_RADIUS;
      if (Math.abs(pushX) < Math.abs(pushZ)) {
        player.x += pushX;
      } else {
        player.z += pushZ;
      }
    }
  }
  clampToArena(player);
}

function buildOverlapsPlayer(piece, room) {
  const bounds = getBuildBounds(piece);
  for (const player of room.players.values()) {
    if (!player.alive) continue;
    const center = { x: player.x, y: player.y + 1.45, z: player.z };
    if (sphereAabb(center, PLAYER_RADIUS, bounds)) return true;
  }
  return false;
}

function buildOverlapsStaticWorld(piece) {
  const bounds = getBuildBounds(piece);
  for (const collider of STATIC_COLLIDERS) {
    if (aabbIntersects(bounds, getStaticBounds(collider))) return true;
  }
  return false;
}

function aabbIntersects(a, b) {
  return a.min.x <= b.max.x && a.max.x >= b.min.x
    && a.min.y <= b.max.y && a.max.y >= b.min.y
    && a.min.z <= b.max.z && a.max.z >= b.min.z;
}

function isInsideArena(pos, padding = 0) {
  const half = MAP_SIZE / 2 - padding;
  return pos.x >= -half && pos.x <= half && pos.z >= -half && pos.z <= half;
}

function getClosestBuildHit(room, origin, dir, maxDistance) {
  let closest = null;
  for (const piece of room.builds.values()) {
    const t = rayAabb(origin, dir, getBuildBounds(piece), maxDistance);
    if (t === null) continue;
    if (!closest || t < closest.distance) {
      closest = { piece, distance: t };
    }
  }
  return closest;
}

function getClosestStaticHit(origin, dir, maxDistance) {
  let closest = null;
  for (const collider of STATIC_COLLIDERS) {
    const distance = rayAabb(origin, dir, getStaticBounds(collider), maxDistance);
    if (distance === null) continue;
    if (!closest || distance < closest.distance) closest = { collider, distance };
  }
  return closest;
}

function getNearestInteractable(room, pos, maxDistance) {
  let closest = null;
  for (const loot of room.loot.values()) {
    const d = distance2D(pos, loot);
    if (d <= maxDistance && (!closest || d < closest.distance)) {
      closest = { loot, distance: d };
    }
  }
  return closest;
}

module.exports = {
  BUILD_DIMS,
  buildOverlapsPlayer,
  buildOverlapsStaticWorld,
  clampToArena,
  collidesWithBuilds,
  collidesWithStaticWorld,
  getClosestStaticHit,
  getBuildBounds,
  getBuildDimensions,
  getClosestBuildHit,
  getNearestInteractable,
  getStaticBounds,
  terrainHeightAt,
  isInsideArena,
  rayAabb,
  raySphere,
  resolvePlayerBuildCollision,
  resolvePlayerStaticCollision,
  sphereAabb
};
