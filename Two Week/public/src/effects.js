import * as THREE from "three";
import { makeTextSprite } from "./utils.js";

export class EffectsManager {
  constructor(scene) {
    this.scene = scene;
    this.effects = [];
  }

  tracer(from, to, color = "#fde047") {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z)
    ]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    this.scene.add(line);
    this.effects.push({ object: line, life: 0.12, max: 0.12, kind: "line" });
  }

  damage(text, position, color = "#f8fafc") {
    const sprite = makeTextSprite(THREE, text, {
      width: 128,
      height: 54,
      size: 28,
      worldWidth: 3.2,
      worldHeight: 1.3,
      color,
      background: "rgba(2, 6, 23, 0.5)"
    });
    sprite.position.set(position.x, position.y + 3.2, position.z);
    this.scene.add(sprite);
    this.effects.push({ object: sprite, life: 0.7, max: 0.7, kind: "text" });
  }

  burst(position, color = "#2dd4bf") {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 8, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
    );
    mesh.position.set(position.x, position.y + 1.5, position.z);
    this.scene.add(mesh);
    this.effects.push({ object: mesh, life: 0.35, max: 0.35, kind: "burst" });
  }

  update(dt, camera) {
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const effect = this.effects[i];
      effect.life -= dt;
      const ratio = Math.max(0, effect.life / effect.max);
      if (effect.object.material) effect.object.material.opacity = ratio;
      if (effect.kind === "text") {
        effect.object.position.y += dt * 2.8;
        if (camera) effect.object.quaternion.copy(camera.quaternion);
      }
      if (effect.kind === "burst") {
        effect.object.scale.setScalar(1 + (1 - ratio) * 3);
      }
      if (effect.life <= 0) {
        this.scene.remove(effect.object);
        dispose(effect.object);
        this.effects.splice(i, 1);
      }
    }
  }
}

function dispose(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}
