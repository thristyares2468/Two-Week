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
    const distance = 10;
    const height = 4.2;
    const back = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const desired = new THREE.Vector3(
      target.x + back.x * distance,
      Math.max(2.2, target.y + height + Math.max(0, -pitch) * 6),
      target.z + back.z * distance
    );
    this.position.x = smoothDamp(this.position.x, desired.x, 12, dt);
    this.position.y = smoothDamp(this.position.y, desired.y, 10, dt);
    this.position.z = smoothDamp(this.position.z, desired.z, 12, dt);
    this.camera.position.copy(this.position);
    const aim = new THREE.Vector3(
      target.x + Math.sin(yaw) * 18,
      target.y + 2.1 + Math.sin(pitch) * 15,
      target.z + Math.cos(yaw) * 18
    );
    this.lookTarget.lerp(aim, 1 - Math.exp(-18 * dt));
    this.camera.lookAt(this.lookTarget);
  }
}
