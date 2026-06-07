import * as THREE from "three";
import { distance2D, snapPosition } from "./utils.js";

const MATERIALS = {
  wall: new THREE.MeshStandardMaterial({ color: "#d6a25e", roughness: 0.82, transparent: true, opacity: 0.92 }),
  ramp: new THREE.MeshStandardMaterial({ color: "#b77945", roughness: 0.86, transparent: true, opacity: 0.92 }),
  floor: new THREE.MeshStandardMaterial({ color: "#c08457", roughness: 0.9, transparent: true, opacity: 0.92 }),
  roof: new THREE.MeshStandardMaterial({ color: "#a16207", roughness: 0.9, transparent: true, opacity: 0.92 })
};

export class BuildingRenderer {
  constructor(scene) {
    this.scene = scene;
    this.builds = new Map();
    this.preview = null;
    this.previewPiece = null;
  }

  update(builds) {
    const seen = new Set();
    for (const piece of builds || []) {
      seen.add(piece.id);
      let mesh = this.builds.get(piece.id);
      if (!mesh) {
        mesh = createBuildMesh(piece, false);
        this.builds.set(piece.id, mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(piece.x, piece.y, piece.z);
      mesh.rotation.y = (piece.rotation || 0) * Math.PI / 180;
      mesh.userData.piece = piece;
      const healthRatio = piece.health / piece.maxHealth;
      mesh.traverse((child) => {
        if (child.material && child.material.opacity !== undefined) {
          child.material.opacity = 0.58 + healthRatio * 0.36;
        }
      });
    }
    for (const [id, mesh] of this.builds) {
      if (seen.has(id)) continue;
      this.scene.remove(mesh);
      dispose(mesh);
      this.builds.delete(id);
    }
  }

  updatePreview({ enabled, type, rotation, player, yaw, materials }) {
    if (!enabled || !player) {
      if (this.preview) this.preview.visible = false;
      this.previewPiece = null;
      return null;
    }
    if (!this.preview || this.preview.userData.type !== type) {
      if (this.preview) {
        this.scene.remove(this.preview);
        dispose(this.preview);
      }
      this.preview = createBuildMesh({ type, rotation: 0 }, true);
      this.preview.userData.type = type;
      this.scene.add(this.preview);
    }
    const forward = { x: Math.sin(yaw), z: Math.cos(yaw) };
    const pos = snapPosition({
      x: player.x + forward.x * 9,
      y: type === "floor" || type === "roof" ? Math.round(player.y / 6) * 6 : 0,
      z: player.z + forward.z * 9
    });
    const valid = distance2D(player, pos) <= 22 && materials >= 10;
    this.preview.position.set(pos.x, pos.y, pos.z);
    this.preview.rotation.y = (rotation || 0) * Math.PI / 180;
    this.preview.visible = true;
    this.preview.traverse((child) => {
      if (child.material) {
        child.material.color.set(valid ? "#22c55e" : "#ef4444");
        child.material.opacity = 0.36;
      }
    });
    this.previewPiece = {
      type,
      rotation,
      position: pos,
      valid
    };
    return this.previewPiece;
  }
}

function createBuildMesh(piece, preview) {
  let mesh;
  const mat = preview
    ? new THREE.MeshStandardMaterial({ color: "#22c55e", transparent: true, opacity: 0.35, roughness: 0.85 })
    : MATERIALS[piece.type].clone();
  if (piece.type === "ramp") {
    mesh = new THREE.Mesh(createRampGeometry(), mat);
  } else if (piece.type === "floor") {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(6, 0.55, 6), mat);
  } else if (piece.type === "roof") {
    mesh = new THREE.Mesh(new THREE.ConeGeometry(4.5, 3.2, 4), mat);
    mesh.rotation.y = Math.PI / 4;
  } else {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 0.65), mat);
    mesh.position.y = 2.5;
  }
  const group = new THREE.Group();
  if (piece.type !== "wall") mesh.position.y = piece.type === "floor" ? 0.28 : 1.6;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  group.position.set(piece.x || 0, piece.y || 0, piece.z || 0);
  group.rotation.y = (piece.rotation || 0) * Math.PI / 180;
  group.userData.piece = piece;
  return group;
}

function createRampGeometry() {
  const vertices = new Float32Array([
    -3, 0, -3, 3, 0, -3, 3, 0, 3, -3, 0, 3,
    -3, 0, -3, 3, 0, -3, 3, 4.2, 3, -3, 4.2, 3
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    0, 4, 7, 0, 7, 3,
    1, 5, 6, 1, 6, 2,
    3, 2, 6, 3, 6, 7,
    0, 1, 5, 0, 5, 4
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function dispose(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}
