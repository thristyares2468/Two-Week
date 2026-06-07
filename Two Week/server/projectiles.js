const { WEAPON_STATS, clamp, normalizeAngle, randomFloat } = require("./utils");
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
    const radius = target.isBot ? 1.35 : 1.25;
    const center = { x: target.x, y: target.y + 1.55, z: target.z };
    const t = raySphere(origin, dir, center, radius, maxDistance);
    if (t === null) continue;
    if (blockedDistance !== null && t > blockedDistance) continue;
    if (!closest || t < closest.distance) closest = { target, distance: t };
  }
  return closest;
}

function canFire(player, weapon, time) {
  if (!player.alive) return { ok: false, reason: "You are eliminated." };
  if (player.reloadEndsAt > time) return { ok: false, reason: "Reloading." };
  const minInterval = 1000 / weapon.stats.fireRate;
  if (time - player.lastFireAt < minInterval * 0.88) return { ok: false, reason: "Firing too fast." };
  if (weapon.item.ammoInMag <= 0) return { ok: false, reason: "Out of ammo." };
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
  player.shotsFired += 1;
  held.item.ammoInMag -= 1;

  const origin = {
    x: player.x + Math.sin(yaw) * 0.9,
    y: player.y + 1.65,
    z: player.z + Math.cos(yaw) * 0.9
  };
  const pellets = stats.pellets || 1;
  const results = [];
  let anyHit = false;

  for (let i = 0; i < pellets; i += 1) {
    const spreadScale = pellets > 1 ? 1 : 0.6;
    const shotYaw = yaw + randomFloat(-stats.spread, stats.spread) * spreadScale;
    const shotPitch = pitch + randomFloat(-stats.spread, stats.spread) * spreadScale;
    const dir = normalizeVector(directionFromAngles(shotYaw, shotPitch));
    const buildHit = getClosestBuildHit(room, origin, dir, stats.range);
    const blockedDistance = buildHit ? buildHit.distance : null;
    const playerHit = findPlayerHit(room, player, origin, dir, stats.range, blockedDistance);
    let endDistance = stats.range;

    if (playerHit) {
      endDistance = playerHit.distance;
      const falloff = Math.max(0.55, 1 - playerHit.distance / (stats.range * 1.45));
      const damage = Math.round(stats.damage * falloff);
      const outcome = applyDamage(playerHit.target, damage, player, "shot", room);
      anyHit = true;
      results.push({
        type: "player",
        targetId: playerHit.target.id,
        damage,
        shieldDamage: Math.round(outcome.shieldDamage),
        healthDamage: Math.round(outcome.healthDamage),
        eliminated: outcome.eliminated,
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

    results.push({
      type: "tracer",
      from: origin,
      to: {
        x: origin.x + dir.x * endDistance,
        y: origin.y + dir.y * endDistance,
        z: origin.z + dir.z * endDistance
      }
    });
  }

  if (anyHit) player.shotsHit += 1;
  return {
    ok: true,
    shooterId: player.id,
    weaponId: stats.id,
    ammoInMag: held.item.ammoInMag,
    results
  };
}

module.exports = {
  fireHitscan
};
