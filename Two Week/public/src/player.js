import * as THREE from "three";
import { lerp, makeTextSprite, normalizeAngle } from "./utils.js";

export class PlayerRenderer {
  constructor(scene) {
    this.scene = scene;
    this.players = new Map();
  }

  update(players, localId, dt, camera) {
    const seen = new Set();
    for (const state of players) {
      seen.add(state.id);
      let entry = this.players.get(state.id);
      if (!entry) {
        entry = this.createPlayer(state);
        this.players.set(state.id, entry);
        this.scene.add(entry.group);
      }
      const speed = state.id === localId ? 1 : 1 - Math.exp(-12 * dt);
      entry.group.position.x = lerp(entry.group.position.x, state.x, speed);
      entry.group.position.y = lerp(entry.group.position.y, state.y, speed);
      entry.group.position.z = lerp(entry.group.position.z, state.z, speed);
      entry.group.rotation.y = lerpAngle(entry.group.rotation.y, state.yaw, speed);
      entry.body.material.color.set(state.alive ? state.color : "#64748b");
      setHeldWeapon(entry, state.heldWeaponId || "pistol");
      entry.weaponPivot.visible = state.alive && Boolean(state.heldWeaponId);
      entry.weaponPivot.rotation.x = -Math.max(-0.35, Math.min(0.45, state.pitch || 0)) * 0.45;
      entry.group.visible = state.alive || state.id === localId || state.isBot;
      entry.healthFill.scale.x = Math.max(0.02, (state.health + state.shield) / 200);
      entry.healthFill.material.color.set(state.shield > 0 ? "#60a5fa" : "#84cc16");
      entry.label.visible = state.id !== localId;
      entry.bar.visible = state.id !== localId;
      if (camera) {
        entry.label.quaternion.copy(camera.quaternion);
        entry.bar.quaternion.copy(camera.quaternion);
      }
    }

    for (const [id, entry] of this.players) {
      if (seen.has(id)) continue;
      this.scene.remove(entry.group);
      disposeObject(entry.group);
      this.players.delete(id);
    }
  }

  createPlayer(state) {
    const group = new THREE.Group();
    group.position.set(state.x || 0, state.y || 0, state.z || 0);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: state.color || "#2dd4bf",
      roughness: 0.78,
      metalness: 0.08
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.9 });
    const clothMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.86 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.74 });
    const trimMat = new THREE.MeshStandardMaterial({ color: "#facc15", roughness: 0.58, metalness: 0.08 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.78, 1.65, 4, 8), bodyMat);
    body.position.y = 1.55;
    body.castShadow = true;
    group.add(body);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.15, 0.58), clothMat);
    chest.position.set(0, 1.86, 0.08);
    chest.castShadow = true;
    group.add(chest);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.18, 0.72), darkMat);
    belt.position.y = 1.02;
    group.add(belt);

    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.66, 0), bodyMat);
    head.position.y = 2.85;
    head.castShadow = true;
    group.add(head);

    const helmetBand = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.18, 0.82), trimMat);
    helmetBand.position.y = 3.08;
    group.add(helmetBand);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.2, 0.12), darkMat);
    visor.position.set(0, 2.92, 0.58);
    group.add(visor);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 5), trimMat);
    antenna.position.set(0.28, 3.48, -0.08);
    antenna.rotation.z = -0.22;
    group.add(antenna);

    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1, 0.28), darkMat);
    pack.position.set(0, 1.65, -0.72);
    group.add(pack);

    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), trimMat);
      shoulder.position.set(side * 0.82, 2.08, 0.05);
      group.add(shoulder);

      const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.88, 6), bodyMat);
      upperArm.position.set(side * 0.95, 1.62, 0.18);
      upperArm.rotation.z = side * 0.2;
      upperArm.castShadow = true;
      group.add(upperArm);

      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.74, 6), clothMat);
      forearm.position.set(side * 0.88, 1.25, 0.58);
      forearm.rotation.x = Math.PI / 2.7;
      forearm.rotation.z = side * 0.12;
      forearm.castShadow = true;
      group.add(forearm);

      const glove = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.28), gloveMat);
      glove.position.set(side * 0.84, 1.07, 0.9);
      group.add(glove);

      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.05, 6), clothMat);
      leg.position.set(side * 0.3, 0.45, 0);
      leg.castShadow = true;
      group.add(leg);

      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.58), gloveMat);
      boot.position.set(side * 0.3, -0.1, 0.12);
      group.add(boot);
    }

    const weaponPivot = new THREE.Group();
    weaponPivot.position.set(0.82, 1.22, 0.88);
    weaponPivot.rotation.y = -0.08;
    group.add(weaponPivot);

    const label = makeTextSprite(THREE, state.name || "Runner", {
      width: 220,
      height: 54,
      size: 20,
      worldWidth: 4.2,
      worldHeight: 1
    });
    label.position.y = 4.25;
    group.add(label);

    const bar = new THREE.Group();
    bar.position.y = 3.72;
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 0.22),
      new THREE.MeshBasicMaterial({ color: "#020617", transparent: true, opacity: 0.72 })
    );
    const healthFill = new THREE.Mesh(
      new THREE.PlaneGeometry(2.65, 0.14),
      new THREE.MeshBasicMaterial({ color: "#60a5fa" })
    );
    healthFill.position.z = 0.01;
    healthFill.position.x = -1.325;
    healthFill.geometry.translate(1.325, 0, 0);
    bar.add(bg, healthFill);
    group.add(bar);

    const entry = { group, body, label, bar, healthFill, weaponPivot, weaponId: null };
    setHeldWeapon(entry, state.heldWeaponId || "pistol");
    return entry;
  }

  getPosition(id) {
    const entry = this.players.get(id);
    return entry ? entry.group.position : null;
  }
}

function setHeldWeapon(entry, weaponId) {
  if (entry.weaponId === weaponId) return;
  while (entry.weaponPivot.children.length) {
    const child = entry.weaponPivot.children[0];
    entry.weaponPivot.remove(child);
    disposeObject(child);
  }
  entry.weaponId = weaponId;
  if (!weaponId) return;
  entry.weaponPivot.add(createWeaponModel(weaponId));
}

function createWeaponModel(weaponId) {
  const group = new THREE.Group();
  const color = ({
    pistol: "#e5e7eb",
    assault: "#86efac",
    shotgun: "#93c5fd",
    sniper: "#c084fc"
  })[weaponId] || "#e5e7eb";
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.54, metalness: 0.22 });
  const darkMat = new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.7, metalness: 0.18 });
  const length = weaponId === "pistol" ? 0.95 : weaponId === "shotgun" ? 1.55 : weaponId === "sniper" ? 2.1 : 1.72;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, length), bodyMat);
  body.position.z = length * 0.35;
  body.castShadow = true;
  group.add(body);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.18), darkMat);
  grip.position.set(0, -0.28, 0.08);
  grip.rotation.x = -0.3;
  group.add(grip);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, length * 0.55, 8), darkMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = length * 0.88;
  group.add(barrel);

  if (weaponId !== "pistol") {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.44), darkMat);
    stock.position.z = -0.24;
    group.add(stock);
  }
  if (weaponId === "sniper") {
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.52, 8), darkMat);
    scope.rotation.z = Math.PI / 2;
    scope.position.set(0, 0.22, 0.66);
    group.add(scope);
  }
  return group;
}

function lerpAngle(a, b, t) {
  return a + normalizeAngle(b - a) * t;
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}
