const { WEAPON_STATS, PLAYER_HEIGHT, PLAYER_RADIUS, clamp, normalizeAngle, randomFloat } = require("./utils");
const { applyDamage, getHeldWeapon } = require("./playerState");
const { damageBuild } = require("./buildingServer");
const { getClosestBuildHit, raySphere } = require("./collision");

function directionFromAngles(yaw, pitch) {
  const cp = Math.cos(pitch);
  return {
    x: Math.sin(yaw) * cp,
    y: Math.sin(pitch),
    z: Math.cos(yaw) * cp
  };
}

function normalizeVector(v) {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function findPlayerHit(room, shooter, origin, dir, maxDistance, blockedDistance) {
  let closest = null;
  const candidates = [...room.players.values(), ...room.dummies];
  for (const target of candidates) {
    if (!target.alive || target.id === shooter.id) continue;
    const bodyRadius = target.isBot ? PLAYER_RADIUS * 1.15 : PLAYER_RADIUS;
    const bodyCenter = { x: target.x, y: target.y + PLAYER_HEIGHT * 0.54, z: target.z };
    const headCenter = { x: target.x, y: target.y + PLAYER_HEIGHT * 0.88, z: target.z };
    const headDistance = raySphere(origin, dir, headCenter, bodyRadius * 0.5, maxDistance);
    const bodyDistance = raySphere(origin, dir, bodyCenter, bodyRadius, maxDistance);
    const hits = [];
    if (headDistance !== null) hits.push({ distance: headDistance, headshot: true });
    if (bodyDistance !== null) hits.push({ distance: bodyDistance, headshot: false });
    for (const hit of hits) {
      if (blockedDistance !== null && hit.distance > blockedDistance) continue;
      if (!closest || hit.distance < closest.distance) closest = { target, distance: hit.distance, headshot: hit.headshot };
    }
  }
  return closest;
}

function canFire(player, weapon, time) {
  if (!player.alive) return { ok: false, reason: "You are eliminated." };
  if (player.reloadEndsAt > time) return { ok: false, reason: "Reloading." };
  const minInterval = 1000 / weapon.stats.fireRate;
  if (time - player.lastFireAt < minInterval * 0.88) return { ok: false, reason: "Firing too fast." };
  const ammoCost = weapon.stats.roundsPerShot || 1;
  if (weapon.item.ammoInMag < ammoCost) return { ok: false, reason: "Out of ammo." };
  return { ok: true };
}

function fireHitscan(room, player, payload = {}) {
  const held = getHeldWeapon(player);
  if (!held) return { ok: false, reason: "No weapon selected." };
  const time = Date.now();
  const permission = canFire(player, held, time);
  if (!permission.ok) return permission;

  const stats = WEAPON_STATS[held.stats.id] || held.stats;
  const yaw = normalizeAngle(Number.isFinite(payload.yaw) ? payload.yaw : player.yaw);
  const pitch = clamp(Number.isFinite(payload.pitch) ? payload.pitch : player.pitch, -1.1, 0.75);
  player.yaw = yaw;
  player.pitch = pitch;
  player.lastFireAt = time;

  const ammoCost = stats.roundsPerShot || 1;
  held.item.ammoInMag -= ammoCost;
  if (stats.ammoType === "charges") held.item.lastChargeAt = time;
  const origin = {
    x: player.x + Math.sin(yaw) * 0.9,
    y: player.y + PLAYER_HEIGHT * 0.58,
    z: player.z + Math.cos(yaw) * 0.9
  };

  if (stats.healAmount) {
    player.shotsFired += 1;
    return fireHealingBeam(room, player, stats, origin, yaw, pitch, held.item.ammoInMag);
  }

  const shots = stats.pellets && stats.pellets > 1 ? stats.pellets : stats.burstCount || 1;
  const results = [];
  let anyHit = false;
  player.shotsFired += shots;

  for (let i = 0; i < shots; i += 1) {
    const spreadScale = stats.pellets && stats.pellets > 1 ? 1 : stats.burstCount ? 0.45 : 0.6;
    const shotYaw = yaw + randomFloat(-stats.spread, stats.spread) * spreadScale;
    const shotPitch = pitch + randomFloat(-stats.spread, stats.spread) * spreadScale;
    const dir = normalizeVector(directionFromAngles(shotYaw, shotPitch));
    const buildHit = getClosestBuildHit(room, origin, dir, stats.range);
    const blockedDistance = buildHit ? buildHit.distance : null;
    const playerHit = findPlayerHit(room, player, origin, dir, stats.range, blockedDistance);
    let endDistance = stats.range;
    let directTargetId = null;

    if (playerHit) {
      endDistance = playerHit.distance;
      directTargetId = playerHit.target.id;
      const falloff = Math.max(0.55, 1 - playerHit.distance / (stats.range * 1.45));
      const damage = Math.max(1, Math.round(stats.damage * falloff * (playerHit.headshot ? stats.headshotMultiplier || 1 : 1)));
      const outcome = applyDamage(playerHit.target, damage, player, "shot", room);
      anyHit = true;
      results.push({
        type: "player",
        targetId: playerHit.target.id,
        damage,
        shieldDamage: Math.round(outcome.shieldDamage),
        healthDamage: Math.round(outcome.healthDamage),
        eliminated: outcome.eliminated,
        headshot: Boolean(playerHit.headshot),
        distance: playerHit.distance
      });
    } else if (buildHit) {
      endDistance = buildHit.distance;
      const buildOutcome = damageBuild(room, buildHit.piece.id, stats.buildDamage);
      anyHit = true;
      results.push({
        type: "build",
        buildId: buildHit.piece.id,
        damage: stats.buildDamage,
        destroyed: Boolean(buildOutcome.destroyed),
        distance: buildHit.distance
      });
    }

    const end = {
      x: origin.x + dir.x * endDistance,
      y: origin.y + dir.y * endDistance,
      z: origin.z + dir.z * endDistance
    };
    results.push({ type: "tracer", from: origin, to: end });

    if (stats.explosionRadius) {
      const explosionHits = applyExplosion(room, player, end, stats, directTargetId);
      if (explosionHits.length) anyHit = true;
      results.push({ type: "explosion", center: end, radius: stats.explosionRadius }, ...explosionHits);
    }
  }

  return {
    ok: true,
    shooterId: player.id,
    weaponId: stats.id,
    ammoInMag: held.item.ammoInMag,
    results
  };
}

function fireHealingBeam(room, player, stats, origin, yaw, pitch, ammoInMag) {
  const dir = normalizeVector(directionFromAngles(yaw, pitch));
  const playerHit = findPlayerHit(room, { ...player, id: "__none__" }, origin, dir, stats.range, null);
  const target = playerHit ? playerHit.target : player;
  const before = target.health;
  target.health = Math.min(stats.maxHealth || 100, target.health + stats.healAmount);
  const applied = target.health - before;
  const distance = playerHit ? playerHit.distance : 8;
  const end = {
    x: origin.x + dir.x * distance,
    y: origin.y + dir.y * distance,
    z: origin.z + dir.z * distance
  };
  return {
    ok: true,
    shooterId: player.id,
    weaponId: stats.id,
    ammoInMag,
    results: [
      { type: "tracer", from: origin, to: end },
      { type: "heal", targetId: target.id, amount: Math.round(applied), distance }
    ]
  };
}

function applyExplosion(room, player, center, stats, directTargetId = null) {
  const hits = [];
  const candidates = [...room.players.values(), ...room.dummies];
  for (const target of candidates) {
    if (!target.alive || target.id === player.id || target.id === directTargetId) continue;
    const dx = target.x - center.x;
    const dz = target.z - center.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > stats.explosionRadius) continue;
    const falloff = 1 - d / stats.explosionRadius * 0.45;
    const damage = Math.max(1, Math.round(stats.damage * falloff));
    const outcome = applyDamage(target, damage, player, "explosion", room);
    hits.push({
      type: "player",
      targetId: target.id,
      damage,
      shieldDamage: Math.round(outcome.shieldDamage),
      healthDamage: Math.round(outcome.healthDamage),
      eliminated: outcome.eliminated,
      headshot: false,
      distance: d
    });
  }
  return hits;
}

module.exports = {
  fireHitscan
};
