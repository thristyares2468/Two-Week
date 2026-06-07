import * as THREE from "three";
import { smoothDamp } from "./utils.js";

export class ThirdPersonCamera {
  constructor(camera) {
    this.camera = camera;
    this.position = new THREE.Vector3(0, 12, -18);
    this.lookTarget = new THREE.Vector3();
  }

  update(target, yaw, pitch, dt) {
    if (!target) return;
    const distance = 8.2;
    const height = 2.75;
    const back = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const desired = new THREE.Vector3(
      target.x + back.x * distance,
      Math.max(1.45, target.y + height + Math.max(0, -pitch) * 4.5),
      target.z + back.z * distance
    );
    this.position.x = smoothDamp(this.position.x, desired.x, 12, dt);
    this.position.y = smoothDamp(this.position.y, desired.y, 10, dt);
    this.position.z = smoothDamp(this.position.z, desired.z, 12, dt);
    this.camera.position.copy(this.position);
    const aim = new THREE.Vector3(
      target.x + Math.sin(yaw) * 15,
      target.y + 1.35 + Math.sin(pitch) * 11,
      target.z + Math.cos(yaw) * 15
    );
    this.lookTarget.lerp(aim, 1 - Math.exp(-18 * dt));
    this.camera.lookAt(this.lookTarget);
  }
}
