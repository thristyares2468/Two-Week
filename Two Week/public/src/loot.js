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
  let color = "#f8fafc";
  if (item.type === "weapon") color = (WEAPON_STATS[item.weaponId] && WEAPON_STATS[item.weaponId].color) || "#dbeafe";
  if (item.type === "ammo") color = "#fbbf24";
  if (item.type === "materials") color = "#b77945";
  if (item.type === "shield") color = "#60a5fa";
  if (item.type === "heal") color = "#84cc16";
  if (item.type === "chest") color = "#f59e0b";
  if (item.type === "ammoBox") color = "#22c55e";

  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.18, roughness: 0.55 });
  if (item.type === "chest") {
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 1.5), mat);
    base.position.y = 0.45;
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 0.32, 1.65),
      new THREE.MeshStandardMaterial({ color: "#fde68a", emissive: "#f59e0b", emissiveIntensity: 0.2, roughness: 0.48 })
    );
    lid.position.y = 1.18;
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.46, 1.75), new THREE.MeshStandardMaterial({ color: "#451a03", roughness: 0.8 }));
    strap.position.y = 0.75;
    base.castShadow = true;
    lid.castShadow = true;
    group.add(base, lid, strap);
  } else if (item.type === "ammoBox") {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.2), mat);
    box.position.y = 0.35;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 1.25), new THREE.MeshStandardMaterial({ color: "#bbf7d0", roughness: 0.62 }));
    lid.position.y = 0.86;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: "#052e16" }));
    mark.position.set(0, 0.95, 0.64);
    box.castShadow = true;
    group.add(box, lid, mark);
  } else {
    const core = item.type === "weapon"
      ? new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.8), mat)
      : new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mat);
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

function dispose(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}
