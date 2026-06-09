const { MAP_SIZE, distance2D, lerp, randomPointInCircle } = require("./utils");

const STORM_PHASES = [
  { wait: 45, shrink: 35, radius: 170, damage: 1 },
  { wait: 35, shrink: 30, radius: 105, damage: 2 },
  { wait: 26, shrink: 24, radius: 52, damage: 4 },
  { wait: 15, shrink: 20, radius: 18, damage: 7 }
];

function createStorm() {
  return {
    phaseIndex: 0,
    mode: "waiting",
    phaseStartedAt: Date.now(),
    from: { x: 0, z: 0, radius: MAP_SIZE / 2 - 12 },
    current: { x: 0, z: 0, radius: MAP_SIZE / 2 - 12 },
    target: makeNextTarget(0),
    damage: STORM_PHASES[0].damage
  };
}

function makeNextTarget(phaseIndex, previous = { x: 0, z: 0 }) {
  const phase = STORM_PHASES[Math.min(phaseIndex, STORM_PHASES.length - 1)];
  const maxOffset = Math.max(6, phase.radius * 0.65);
  const point = randomPointInCircle(maxOffset, previous);
  return {
    x: Number(point.x.toFixed(2)),
    z: Number(point.z.toFixed(2)),
    radius: phase.radius
  };
}

function updateStorm(storm) {
  const phase = STORM_PHASES[Math.min(storm.phaseIndex, STORM_PHASES.length - 1)];
  const elapsed = (Date.now() - storm.phaseStartedAt) / 1000;
  storm.damage = phase.damage;

  if (storm.mode === "waiting" && elapsed >= phase.wait) {
    storm.mode = "shrinking";
    storm.phaseStartedAt = Date.now();
    storm.from = { ...storm.current };
    return;
  }

  if (storm.mode === "shrinking") {
    const t = Math.min(1, elapsed / phase.shrink);
    storm.current = {
      x: lerp(storm.from.x, storm.target.x, t),
      z: lerp(storm.from.z, storm.target.z, t),
      radius: lerp(storm.from.radius, storm.target.radius, t)
    };
    if (t >= 1) {
      storm.phaseIndex = Math.min(storm.phaseIndex + 1, STORM_PHASES.length - 1);
      storm.mode = "waiting";
      storm.phaseStartedAt = Date.now();
      storm.current = { ...storm.target };
      storm.from = { ...storm.current };
      storm.target = makeNextTarget(storm.phaseIndex, storm.current);
    }
  }
}

function isOutsideStorm(storm, player) {
  return distance2D(player, storm.current) > storm.current.radius;
}

function secondsUntilStormChange(storm) {
  const phase = STORM_PHASES[Math.min(storm.phaseIndex, STORM_PHASES.length - 1)];
  const elapsed = (Date.now() - storm.phaseStartedAt) / 1000;
  return Math.max(0, (storm.mode === "waiting" ? phase.wait : phase.shrink) - elapsed);
}

function serializeStorm(storm) {
  return {
    phaseIndex: storm.phaseIndex,
    mode: storm.mode,
    current: {
      x: Number(storm.current.x.toFixed(2)),
      z: Number(storm.current.z.toFixed(2)),
      radius: Number(storm.current.radius.toFixed(2))
    },
    target: { ...storm.target },
    damage: storm.damage,
    secondsRemaining: Number(secondsUntilStormChange(storm).toFixed(1))
  };
}

module.exports = {
  STORM_PHASES,
  createStorm,
  isOutsideStorm,
  serializeStorm,
  updateStorm
};
