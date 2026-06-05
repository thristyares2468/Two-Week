export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

export function smoothDamp(current, target, rate, dt) {
  const t = 1 - Math.exp(-rate * dt);
  return lerp(current, target, t);
}

export function distance2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function normalizeAngle(angle) {
  let result = angle;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
}

export function snap(value, size = 6) {
  return Math.round(value / size) * size;
}

export function snapPosition(pos, size = 6) {
  return {
    x: snap(pos.x, size),
    y: Math.max(0, snap(pos.y || 0, size)),
    z: snap(pos.z, size)
  };
}

export function formatSeconds(seconds) {
  const safe = Math.max(0, Math.ceil(seconds || 0));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function makeTextSprite(THREE, text, options = {}) {
  const canvas = document.createElement("canvas");
  const scale = window.devicePixelRatio || 1;
  canvas.width = (options.width || 256) * scale;
  canvas.height = (options.height || 64) * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${options.weight || 800} ${options.size || 24}px ${options.font || "Inter, sans-serif"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (options.backing !== false) {
    ctx.fillStyle = options.background || "rgba(3, 7, 18, 0.72)";
    ctx.strokeStyle = options.border || "rgba(255,255,255,0.2)";
    roundRect(ctx, 8, 8, (options.width || 256) - 16, (options.height || 64) - 16, 8);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = options.color || "#f8fafc";
  ctx.fillText(text, (options.width || 256) / 2, (options.height || 64) / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(options.worldWidth || 5, options.worldHeight || 1.2, 1);
  sprite.userData.texture = texture;
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
