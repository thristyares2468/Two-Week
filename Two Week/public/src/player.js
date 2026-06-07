import * as THREE from "three";
import { lerp, makeTextSprite, normalizeAngle } from "./utils.js";

const PLAYER_VISUAL_SCALE = 0.62;

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
    const model = new THREE.Group();
    model.scale.setScalar(PLAYER_VISUAL_SCALE);
    group.add(model);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: state.color || "#2dd4bf",
      roughness: 0.78,
      metalness: 0.08
    });
    const darkMat = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.78, 1.65, 4, 8), bodyMat);
    body.position.y = 1.55;
    body.castShadow = true;
    model.add(body);

    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.66, 0), bodyMat);
    head.position.y = 2.85;
    head.castShadow = true;
    model.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.2, 0.12), darkMat);
    visor.position.set(0, 2.92, 0.58);
    model.add(visor);

    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1, 0.28), darkMat);
    pack.position.set(0, 1.65, -0.72);
    model.add(pack);

    const label = makeTextSprite(THREE, state.name || "Runner", {
      width: 220,
      height: 54,
      size: 20,
      worldWidth: 3.1,
      worldHeight: 0.74
    });
    label.position.y = 2.9;
    group.add(label);

    const bar = new THREE.Group();
    bar.position.y = 2.52;
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(2.15, 0.18),
      new THREE.MeshBasicMaterial({ color: "#020617", transparent: true, opacity: 0.72 })
    );
    const healthFill = new THREE.Mesh(
      new THREE.PlaneGeometry(2.03, 0.11),
      new THREE.MeshBasicMaterial({ color: "#60a5fa" })
    );
    healthFill.position.z = 0.01;
    healthFill.position.x = -1.015;
    healthFill.geometry.translate(1.015, 0, 0);
    bar.add(bg, healthFill);
    group.add(bar);

    return { group, model, body, label, bar, healthFill };
  }

  getPosition(id) {
    const entry = this.players.get(id);
    return entry ? entry.group.position : null;
  }
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
