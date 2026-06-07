import * as THREE from "three";
import { WEAPON_STATS } from "./weapons.js";

export class LootRenderer {
  constructor(scene) {
    this.scene = scene;
    this.items = new Map();
    this.time = 0;
  }

  update(items, dt) {
    this.time += dt;
    const seen = new Set();
    for (const item of items || []) {
      seen.add(item.id);
      let mesh = this.items.get(item.id);
      if (!mesh) {
        mesh = createLootMesh(item);
        this.items.set(item.id, mesh);
        this.scene.add(mesh);
      }
      const bob = item.container ? Math.sin(this.time * 2 + item.x) * 0.04 : Math.sin(this.time * 3 + item.x) * 0.18;
      mesh.position.set(item.x, item.y + bob, item.z);
      mesh.rotation.y = item.container
        ? item.rotation || 0
        : (item.rotation || 0) + this.time * 1.8;
    }
    for (const [id, mesh] of this.items) {
      if (seen.has(id)) continue;
      this.scene.remove(mesh);
      dispose(mesh);
      this.items.delete(id);
    }
  }
}

function createLootMesh(item) {
  const group = new THREE.Group();
  let color = "#f8fafc";
  if (item.type === "weapon") color = (WEAPON_STATS[item.weaponId] && WEAPON_STATS[item.weaponId].color) || "#dbeafe";
  if (item.type === "ammo") color = "#fbbf24";
  if (item.type === "materials") color = "#b77945";
  if (item.type === "shield") color = "#60a5fa";
  if (item.type === "heal") color = "#84cc16";
  if (item.type === "chest") color = "#f59e0b";
  if (item.type === "ammoBox") color = "#22c55e";
  if (item.type === "supplyCrate") color = "#38bdf8";

  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.18, roughness: 0.55 });
  if (item.type === "chest") {
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 1.5), texturedMat("#9a5a18", "#f59e0b", "chest"));
    base.position.y = 0.45;
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 0.32, 1.65),
      texturedMat("#fbbf24", "#fde68a", "lid")
    );
    lid.position.y = 1.18;
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.46, 1.75), new THREE.MeshStandardMaterial({ color: "#451a03", roughness: 0.8 }));
    strap.position.y = 0.75;
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, 0.12), new THREE.MeshStandardMaterial({ color: "#fef3c7", metalness: 0.2, roughness: 0.42 }));
    latch.position.set(0, 0.78, 0.82);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const corner = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.18), new THREE.MeshStandardMaterial({ color: "#fef3c7", roughness: 0.52 }));
        corner.position.set(sx * 1.08, 0.9, sz * 0.72);
        group.add(corner);
      }
    }
    base.castShadow = true;
    lid.castShadow = true;
    group.add(base, lid, strap, latch);
  } else if (item.type === "ammoBox") {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.2), texturedMat("#14532d", "#22c55e", "ammo"));
    box.position.y = 0.35;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 1.25), texturedMat("#86efac", "#bbf7d0", "ammo-lid"));
    lid.position.y = 0.86;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: "#052e16" }));
    mark.position.set(0, 0.95, 0.64);
    box.castShadow = true;
    group.add(box, lid, mark);
  } else if (item.type === "supplyCrate") {
    const crateMat = texturedMat("#0f766e", "#38bdf8", "supply");
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.6, 2.1), crateMat);
    crate.position.y = 0.78;
    const straps = new THREE.Group();
    const strapMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.78 });
    const strapA = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.18, 0.18), strapMat);
    strapA.position.set(0, 1.15, 1.08);
    const strapB = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 2.25), strapMat);
    strapB.position.set(0, 1.17, 0);
    straps.add(strapA, strapB);
    crate.castShadow = true;
    group.add(crate, straps);
  } else if (item.type === "weapon") {
    group.add(createWeaponPickup(item.weaponId, color));
  } else if (item.type === "ammo") {
    group.add(createAmmoPickup(color));
  } else if (item.type === "materials") {
    group.add(createMaterialStack());
  } else if (item.type === "shield" || item.type === "heal") {
    group.add(createConsumablePickup(item.type, color));
  } else {
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mat);
    core.castShadow = true;
    group.add(core);
  }
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(item.container ? 1.7 : 1.4, 0.06, 6, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  group.userData.item = item;
  return group;
}

function texturedMat(base, accent, key) {
  const texture = makeTexture(base, accent, key);
  return new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: texture,
    roughness: 0.68,
    metalness: 0.06
  });
}

const textureCache = new Map();

function makeTexture(base, accent, key) {
  const cacheKey = `${key}:${base}:${accent}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = accent;
  for (let i = 0; i < 7; i += 1) {
    ctx.fillRect(i * 21 - 16, 0, 7, 128);
    ctx.fillRect(0, i * 19, 128, 3);
  }
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(12, 12, 104, 18);
  ctx.strokeStyle = "rgba(2,6,23,0.38)";
  ctx.lineWidth = 5;
  ctx.strokeRect(5, 5, 118, 118);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  textureCache.set(cacheKey, texture);
  return texture;
}

function createWeaponPickup(weaponId, color) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.16, roughness: 0.48, metalness: 0.18 });
  const dark = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.75 });
  const length = weaponId === "pistol" ? 1.35 : weaponId === "sniper" ? 3.2 : weaponId === "shotgun" ? 2.6 : 2.8;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, length), mat);
  body.position.y = 0.35;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.55, 0.22), dark);
  grip.position.set(0, 0.05, -0.32);
  grip.rotation.x = -0.35;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, length * 0.5, 8), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.37, length * 0.48);
  group.add(body, grip, barrel);
  if (weaponId === "sniper") {
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.72, 8), dark);
    scope.rotation.z = Math.PI / 2;
    scope.position.set(0, 0.62, 0.25);
    group.add(scope);
  }
  group.rotation.z = -0.08;
  return group;
}

function createAmmoPickup(color) {
  const group = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color, metalness: 0.22, roughness: 0.42 });
  for (let i = 0; i < 4; i += 1) {
    const round = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 8), brass);
    round.rotation.z = Math.PI / 2;
    round.position.set((i - 1.5) * 0.22, 0.25, (i % 2) * 0.22);
    group.add(round);
  }
  return group;
}

function createMaterialStack() {
  const group = new THREE.Group();
  const wood = texturedMat("#8b5a2b", "#d6a25e", "wood");
  for (let i = 0; i < 4; i += 1) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 0.34), wood);
    plank.position.set(0, i * 0.18, (i % 2) * 0.28);
    plank.rotation.y = (i % 2) * 0.12;
    group.add(plank);
  }
  return group;
}

function createConsumablePickup(type, color) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.16, roughness: 0.42 });
  const core = type === "shield"
    ? new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.05, 10), mat)
    : new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 0.7), mat);
  core.position.y = 0.35;
  group.add(core);
  return group;
}

function dispose(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}
