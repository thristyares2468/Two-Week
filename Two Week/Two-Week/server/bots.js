const { applyInput, beginReload, finishReloadIfReady, setInput } = require("./playerState");
const { fireHitscan } = require("./projectiles");
const { distance2D, normalizeAngle } = require("./utils");

function updateBots(room, dt) {
  if (!room || room.roomType !== "bot" || room.status !== "playing") return [];
  if (room.dropState && room.dropState.phase !== "active") return [];
  const events = [];
  const contestants = getAliveContestants(room);

  for (const bot of room.dummies) {
    if (!bot.alive) continue;
    finishReloadIfReady(bot);
    const target = chooseTarget(bot, contestants, room);
    const input = makeBotInput(bot, target, room);
    setInput(bot, input);
    applyInput(bot, room, dt);
    maybeReload(bot);

    if (target && distance2D(bot, target) < 82) {
      const fired = maybeFire(bot, target, room);
      if (fired && fired.ok) events.push(fired);
    }
  }

  return events;
}

function getAliveContestants(room) {
  return [...room.players.values(), ...room.dummies].filter((player) => player.alive);
}

function chooseTarget(bot, contestants, room) {
  let best = null;
  for (const candidate of contestants) {
    if (candidate.id === bot.id) continue;
    const d = distance2D(bot, candidate);
    if (!best || d < best.distance) best = { player: candidate, distance: d };
  }
  if (best && best.distance < 95) return best.player;
  if (room.storm && distance2D(bot, room.storm.current) > room.storm.current.radius * 0.82) {
    return { id: "storm-center", x: room.storm.current.x, y: bot.y, z: room.storm.current.z, alive: true };
  }
  return null;
}

function makeBotInput(bot, target, room) {
  const now = Date.now();
  if (now > bot.botThinkAt) {
    bot.botThinkAt = now + 900 + Math.random() * 900;
    bot.botStrafe = Math.random() > 0.5 ? 0.42 : -0.42;
    bot.botWanderYaw += (Math.random() - 0.5) * 1.6;
  }

  let yaw = bot.botWanderYaw;
  let pitch = 0;
  let moveZ = 0.65;
  let moveX = bot.botStrafe * 0.45;

  if (target) {
    const dx = target.x - bot.x;
    const dz = target.z - bot.z;
    const dy = (target.y || 0) - bot.y;
    const dist = Math.max(1, Math.hypot(dx, dz));
    yaw = Math.atan2(dx, dz);
    pitch = Math.max(-0.32, Math.min(0.18, Math.atan2(dy + 1.2, dist)));
    moveZ = dist > 30 ? 1 : dist > 13 ? 0.45 : -0.25;
    moveX = dist < 55 ? bot.botStrafe : 0;
  } else if (room.storm) {
    const towardZone = Math.atan2(room.storm.current.x - bot.x, room.storm.current.z - bot.z);
    yaw = normalizeAngle(bot.botWanderYaw * 0.55 + towardZone * 0.45);
  }

  return {
    moveX,
    moveZ,
    jump: Math.random() < 0.004,
    sprint: true,
    crouch: false,
    yaw,
    pitch,
    seq: now
  };
}

function maybeReload(bot) {
  const item = bot.inventory[bot.selectedSlot];
  if (!item || item.slotType !== "weapon") return;
  if (item.ammoInMag <= 0) beginReload(bot);
}

function maybeFire(bot, target, room) {
  const now = Date.now();
  const skill = bot.botSkill || 0.55;
  if (now < bot.botNextShotAt) return null;
  bot.botNextShotAt = now + 240 + Math.random() * (900 - skill * 420);
  const dx = target.x - bot.x;
  const dz = target.z - bot.z;
  const dy = (target.y || 0) - bot.y;
  const dist = Math.max(1, Math.hypot(dx, dz));
  const aimNoise = (1 - skill) * 0.16;
  const yaw = Math.atan2(dx, dz) + (Math.random() - 0.5) * aimNoise;
  const pitch = Math.atan2(dy + 1.3, dist) + (Math.random() - 0.5) * aimNoise * 0.45;
  return fireHitscan(room, bot, { yaw, pitch });
}

module.exports = {
  updateBots
};
