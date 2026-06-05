import * as THREE from "three";

export class StormRenderer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.wall = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 38, 96, 1, true),
      new THREE.MeshBasicMaterial({
        color: "#7c3aed",
        transparent: true,
        opacity: 0.17,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.18, 8, 128),
      new THREE.MeshBasicMaterial({ color: "#a78bfa", transparent: true, opacity: 0.7 })
    );
    this.ring.rotation.x = Math.PI / 2;
    this.group.add(this.wall, this.ring);
    this.scene.add(this.group);
  }

  update(storm) {
    if (!storm || !storm.current) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    this.group.position.set(storm.current.x, 19, storm.current.z);
    const radius = Math.max(1, storm.current.radius);
    this.wall.scale.set(radius, 1, radius);
    this.ring.scale.set(radius, radius, radius);
    this.ring.position.y = -18.8;
    this.wall.material.opacity = storm.mode === "shrinking" ? 0.25 : 0.16;
  }
}
