import * as THREE from "three";
import { CONSUMABLE_STATS, WEAPON_STATS, getItemColor } from "./weapons.js";

export class LootRenderer {
  constructor(scene) {
    this.scene = scene;
    this.items = new Map();
    this.time = 0;
  }

  update(items, dt, groundHeight = null) {
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
      const visualGround = groundHeight ? groundHeight(item.x, item.z) : item.y;
      const offset = item.type === "chest" ? 1.2 : item.type === "ammoBox" ? 0.85 : 0.65;
      mesh.position.set(item.x, visualGround + offset + bob, item.z);
      mesh.rotation.y += item.container ? dt * 0.25 : dt * 1.8;
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
  const color = getItemColor(item);
  if (item.type === "chest") {
    createChest(group);
  } else if (item.type === "ammoBox") {
    createAmmoBox(group);
  } else if (item.type === "weapon") {
    group.add(createWeaponPickup(item, color));
  } else if (item.type === "ammo") {
    group.add(createAmmoPickup(item));
  } else if (item.type === "materials") {
    group.add(createMaterialsPickup());
  } else if (item.itemId || item.type === "shield" || item.type === "heal" || item.type === "explosive" || item.type === "utility") {
    group.add(createConsumablePickup(item));
  } else {
    const fallback = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), makeStandard(color));
    fallback.castShadow = true;
    group.add(fallback);
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

function createChest(group) {
  const baseMat = makeStandard("#b45309", "#f59e0b", 0.18);
  const trimMat = makeStandard("#fde68a", "#f59e0b", 0.2);
  const darkMat = makeStandard("#451a03");
  const base = box(2.4, 1.1, 1.5, baseMat, 0, 0.45, 0);
  const lid = box(2.55, 0.32, 1.65, trimMat, 0, 1.18, 0);
  const strap = box(0.28, 1.46, 1.75, darkMat, 0, 0.75, 0);
  const latch = box(0.34, 0.28, 0.12, trimMat, 0, 0.78, 0.84);
  group.add(base, lid, strap, latch);
}

function createAmmoBox(group) {
  const mat = makeStandard("#22c55e", "#22c55e", 0.18);
  const lidMat = makeStandard("#bbf7d0");
  const markMat = new THREE.MeshBasicMaterial({ color: "#052e16" });
  const body = box(1.8, 0.9, 1.2, mat, 0, 0.35, 0);
  const lid = box(1.9, 0.18, 1.25, lidMat, 0, 0.86, 0);
  const mark = box(0.9, 0.08, 0.08, markMat, 0, 0.95, 0.64);
  group.add(body, lid, mark);
}

function createWeaponPickup(item, color) {
  const stats = WEAPON_STATS[item.weaponId] || {};
  const model = stats.model || "assault";
  const group = new THREE.Group();
  const main = makeStandard(color, color, 0.2);
  const dark = makeStandard("#111827");
  const metal = makeStandard("#64748b");
  const accent = makeStandard(stats.rarity === "Legendary" ? "#fde68a" : stats.rarity === "Epic" ? "#e9d5ff" : "#e2e8f0");

  if (model === "pistol") {
    group.add(box(1.2, 0.34, 0.42, main, 0, 0.24, 0));
    group.add(box(0.34, 0.72, 0.34, dark, -0.32, -0.16, 0, 0, 0, -0.2));
    group.add(cylinder(0.09, 0.72, metal, 0.72, 0.27, 0, 0, 0, Math.PI / 2));
  } else if (model === "smg") {
    group.add(box(1.55, 0.38, 0.48, main, 0, 0.26, 0));
    group.add(box(0.32, 0.9, 0.32, dark, -0.15, -0.22, 0, 0, 0, 0.08));
    group.add(cylinder(0.08, 0.8, metal, 0.92, 0.28, 0, 0, 0, Math.PI / 2));
    group.add(box(0.74, 0.16, 0.26, dark, -0.95, 0.3, 0));
  } else if (model === "pump" || model === "tactical") {
    group.add(box(1.85, 0.38, 0.5, main, -0.2, 0.26, 0));
    group.add(cylinder(0.075, 1.85, metal, 0.95, 0.32, 0, 0, 0, Math.PI / 2));
    group.add(cylinder(0.055, 1.7, dark, 0.86, 0.16, 0, 0, 0, Math.PI / 2));
    group.add(box(model === "pump" ? 0.64 : 0.92, 0.22, 0.48, accent, 0.28, 0.05, 0));
    group.add(box(0.7, 0.24, 0.34, dark, -1.18, 0.22, 0));
  } else if (model === "sniper") {
    group.add(box(2.25, 0.34, 0.44, main, -0.2, 0.25, 0));
    group.add(cylinder(0.055, 2.4, metal, 1.18, 0.3, 0, 0, 0, Math.PI / 2));
    group.add(cylinder(0.13, 0.72, dark, 0.05, 0.66, 0, Math.PI / 2, 0, 0));
    group.add(box(0.82, 0.22, 0.32, dark, -1.45, 0.28, 0));
    group.add(box(0.34, 0.58, 0.32, dark, -0.48, -0.12, 0));
  } else if (model === "rocket") {
    group.add(cylinder(0.28, 2.45, main, 0, 0.38, 0, 0, 0, Math.PI / 2));
    group.add(cylinder(0.18, 0.45, dark, -1.36, 0.38, 0, 0, 0, Math.PI / 2));
    group.add(box(0.16, 0.52, 0.08, accent, 1.22, 0.38, 0.28));
    group.add(box(0.16, 0.52, 0.08, accent, 1.22, 0.38, -0.28));
  } else if (model === "medLauncher") {
    const white = makeStandard("#f8fafc", "#38bdf8", 0.12);
    const red = makeStandard("#ef4444", "#ef4444", 0.12);
    group.add(cylinder(0.3, 2.15, white, 0, 0.38, 0, 0, 0, Math.PI / 2));
    group.add(box(0.16, 0.78, 0.1, red, 0, 0.39, 0.32));
    group.add(box(0.58, 0.16, 0.1, red, 0, 0.39, 0.33));
    group.add(box(0.46, 0.56, 0.34, dark, -0.45, -0.12, 0));
  } else {
    const bullpup = model === "burst";
    group.add(box(bullpup ? 1.75 : 2.1, 0.4, 0.5, main, -0.2, 0.26, 0));
    group.add(cylinder(0.065, bullpup ? 1.2 : 1.55, metal, 1.02, 0.31, 0, 0, 0, Math.PI / 2));
    group.add(box(0.48, 0.78, 0.34, dark, bullpup ? 0.22 : -0.18, -0.16, 0, 0, 0, bullpup ? 0.18 : -0.14));
    group.add(box(0.78, 0.28, 0.36, dark, -1.34, 0.24, 0));
    if (bullpup) group.add(cylinder(0.12, 0.52, accent, 0.02, 0.62, 0, Math.PI / 2, 0, 0));
  }

  group.scale.setScalar(0.82);
  group.rotation.z = -0.08;
  group.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  return group;
}

function createAmmoPickup(item) {
  const group = new THREE.Group();
  const mat = makeStandard("#fbbf24", "#fbbf24", 0.14);
  const dark = makeStandard("#78350f");
  const count = item.ammoType === "rockets" ? 1 : item.ammoType === "shells" ? 4 : 6;
  for (let i = 0; i < count; i += 1) {
    const x = (i % 3 - 1) * 0.26;
    const z = (Math.floor(i / 3) - 0.5) * 0.24;
    const round = item.ammoType === "rockets" ? cylinder(0.16, 1.25, mat, 0, 0.28, 0, 0, 0, Math.PI / 2) : cylinder(0.06, 0.5, mat, x, 0.25, z, 0, 0, Math.PI / 2);
    group.add(round);
  }
  group.add(box(1.25, 0.12, 0.78, dark, 0, -0.02, 0));
  return group;
}

function createMaterialsPickup() {
  const group = new THREE.Group();
  const wood = makeStandard("#b77945");
  group.add(box(1.35, 0.22, 0.35, wood, 0, 0.2, 0.28, 0, 0.25, 0));
  group.add(box(1.45, 0.22, 0.35, wood, 0.04, 0.43, 0, 0, -0.18, 0));
  group.add(box(1.25, 0.22, 0.35, wood, -0.06, 0.66, -0.28, 0, 0.12, 0));
  return group;
}

function createConsumablePickup(item) {
  const stats = item.itemId ? CONSUMABLE_STATS[item.itemId] : null;
  const kind = item.kind || item.type;
  const color = item.color || (stats && stats.color) || getItemColor(item);
  const group = new THREE.Group();
  const mat = makeStandard(color, color, 0.16);
  const dark = makeStandard("#0f172a");
  const white = makeStandard("#f8fafc");

  if (item.itemId === "smallShield" || item.itemId === "shieldPotion" || kind === "shield") {
    const height = item.itemId === "shieldPotion" ? 1.25 : 0.85;
    group.add(cylinder(0.28, height, mat, 0, height / 2, 0));
    group.add(cylinder(0.24, 0.12, white, 0, height + 0.05, 0));
  } else if (item.itemId === "medkit") {
    group.add(box(1.1, 0.72, 0.82, white, 0, 0.38, 0));
    group.add(box(0.18, 0.58, 0.1, mat, 0, 0.42, 0.43));
    group.add(box(0.58, 0.18, 0.1, mat, 0, 0.42, 0.44));
  } else if (item.itemId === "bandage") {
    group.add(cylinder(0.28, 0.7, white, -0.24, 0.34, 0, 0, 0, Math.PI / 2));
    group.add(cylinder(0.28, 0.7, white, 0.24, 0.34, 0, 0, 0, Math.PI / 2));
    group.add(box(0.2, 0.34, 0.74, mat, 0, 0.34, 0));
  } else if (item.itemId === "grenade" || kind === "explosive") {
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.52, 0), mat);
    body.position.y = 0.52;
    body.castShadow = true;
    group.add(body);
    group.add(box(0.18, 0.18, 0.28, dark, 0, 1.02, 0));
    group.add(cylinder(0.035, 0.42, white, 0.24, 1.08, 0, Math.PI / 2, 0, 0));
  } else if (item.itemId === "fishingRod" || kind === "utility") {
    group.add(cylinder(0.035, 2.2, mat, 0, 0.7, 0, 0.2, 0, -0.52));
    group.add(cylinder(0.12, 0.22, dark, -0.55, 0.25, 0, 0, 0, Math.PI / 2));
    group.add(cylinder(0.025, 0.82, white, 0.42, 0.42, 0, 0.7, 0, 0.1));
  } else {
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mat);
    core.castShadow = true;
    group.add(core);
  }
  return group;
}

function box(w, h, d, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  return mesh;
}

function cylinder(radius, height, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 8), material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  return mesh;
}

function makeStandard(color, emissive = "#000000", emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness: 0.58, metalness: 0.05 });
}

function dispose(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((mat) => mat.dispose());
      else child.material.dispose();
    }
  });
}
