import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { makeTextSprite } from "./utils.js";

const MAP_MODEL_TARGET_SIZE = 540;
const MAP_MODEL_URL = new URL("../assets/models/map.glb", import.meta.url).href;
const SPAWN_ISLAND_Z = -405;

const POIS = [
  { name: "Rusty Depot", x: -54, z: -42, color: "#f97316" },
  { name: "Neon Farm", x: 52, z: -54, color: "#22c55e" },
  { name: "Signal Hill", x: -82, z: 50, color: "#38bdf8" },
  { name: "Broken Bridge", x: 74, z: 38, color: "#a78bfa" },
  { name: "Solar Yard", x: 8, z: -84, color: "#facc15" },
  { name: "Old Radio Town", x: -8, z: 10, color: "#60a5fa" },
  { name: "Quarry Camp", x: 90, z: -12, color: "#94a3b8" },
  { name: "Stormwatch Tower", x: -22, z: 82, color: "#c084fc" },
  { name: "Timber Flats", x: 44, z: 78, color: "#84cc16" },
  { name: "Blue Barns", x: -92, z: -10, color: "#3b82f6" }
];

export class World {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.fallbackRoot = new THREE.Group();
    this.bus = null;
    this.modelLoaded = false;
    this.mapImage = null;
    this.scene.add(this.root);
    this.root.add(this.fallbackRoot);
    this.createLighting();
    this.createFallbackMap();
    this.createSpawnIsland();
    this.createDropBus();
    this.tryLoadMapModel();
  }

  createLighting() {
    const hemi = new THREE.HemisphereLight("#dbeafe", "#29513d", 1.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight("#fff7ed", 2.4);
    sun.position.set(60, 85, 20);
    sun.castShadow = true;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 210;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    this.scene.add(sun);
  }

  createFallbackMap() {
    const groundMat = new THREE.MeshStandardMaterial({ color: "#3f8f59", roughness: 0.92 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520, 28, 28), groundMat);
    const pos = ground.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const h = Math.sin(x * 0.045) * 2.2 + Math.cos(y * 0.038) * 1.6 + Math.sin((x + y) * 0.025);
      pos.setZ(i, h);
    }
    ground.geometry.computeVertexNormals();
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.fallbackRoot.add(ground);

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(620, 620),
      new THREE.MeshBasicMaterial({ color: "#0e7490", transparent: true, opacity: 0.42 })
    );
    water.position.y = -2.2;
    water.rotation.x = -Math.PI / 2;
    this.fallbackRoot.add(water);

    this.addRoad(0, -90, 0, 90);
    this.addRoad(-95, 0, 95, 0);
    for (const poi of POIS) this.addPoi(poi);
    for (let i = 0; i < 70; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 35 + Math.random() * 215;
      this.addTree(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    for (let i = 0; i < 40; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 30 + Math.random() * 220;
      this.addRock(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
  }

  addRoad(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const road = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.08, len),
      new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.95 })
    );
    road.position.set((x1 + x2) / 2, 0.12, (z1 + z2) / 2);
    road.rotation.y = Math.atan2(dx, dz);
    road.receiveShadow = true;
    this.fallbackRoot.add(road);
  }

  addPoi(poi) {
    const group = new THREE.Group();
    group.position.set(poi.x, 0, poi.z);
    const baseMat = new THREE.MeshStandardMaterial({ color: poi.color, roughness: 0.82 });
    const count = poi.name === "Old Radio Town" ? 7 : 4;
    for (let i = 0; i < count; i += 1) {
      const h = 3 + Math.random() * 6;
      const house = new THREE.Mesh(new THREE.BoxGeometry(5 + Math.random() * 4, h, 5 + Math.random() * 4), baseMat);
      house.position.set((Math.random() - 0.5) * 18, h / 2, (Math.random() - 0.5) * 18);
      house.rotation.y = Math.random() * Math.PI;
      house.castShadow = true;
      house.receiveShadow = true;
      group.add(house);
    }
    if (poi.name.includes("Tower") || poi.name.includes("Radio")) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 18, 5), new THREE.MeshStandardMaterial({ color: "#e2e8f0" }));
      tower.position.y = 9;
      tower.castShadow = true;
      group.add(tower);
    }
    const label = makeTextSprite(THREE, poi.name, {
      width: 260,
      height: 56,
      size: 20,
      worldWidth: 10,
      worldHeight: 2,
      background: "rgba(15, 23, 42, 0.58)"
    });
    label.position.set(0, 12, 0);
    group.add(label);
    this.fallbackRoot.add(group);
  }

  addTree(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.6, 5), new THREE.MeshStandardMaterial({ color: "#854d0e" }));
    trunk.position.set(x, 1.3, z);
    trunk.castShadow = true;
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.6, 6), new THREE.MeshStandardMaterial({ color: "#15803d", roughness: 0.95 }));
    top.position.set(x, 4.1, z);
    top.castShadow = true;
    this.fallbackRoot.add(trunk, top);
  }

  addRock(x, z) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 + Math.random() * 1.6, 0), new THREE.MeshStandardMaterial({ color: "#64748b", roughness: 1 }));
    rock.position.set(x, 0.9, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    this.fallbackRoot.add(rock);
  }

  createSpawnIsland() {
    const group = new THREE.Group();
    group.position.set(0, 0, SPAWN_ISLAND_Z);
    const spawnWater = new THREE.Mesh(
      new THREE.PlaneGeometry(130, 130),
      new THREE.MeshBasicMaterial({ color: "#0ea5c7", transparent: true, opacity: 0.72 })
    );
    spawnWater.rotation.x = -Math.PI / 2;
    spawnWater.position.y = -2.3;
    group.add(spawnWater);
    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(28, 34, 5, 9),
      new THREE.MeshStandardMaterial({ color: "#6da45f", roughness: 0.92 })
    );
    island.position.y = 0.35;
    island.receiveShadow = true;
    group.add(island);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(12, 12, 0.35, 8),
      new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.82 })
    );
    pad.position.y = 3.05;
    group.add(pad);
    const sign = makeTextSprite(THREE, "Spawn Island", {
      width: 240,
      height: 56,
      size: 22,
      worldWidth: 9,
      worldHeight: 2
    });
    sign.position.set(0, 8.4, -12);
    group.add(sign);
    this.root.add(group);
  }

  createDropBus() {
    const bus = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(8, 3, 14),
      new THREE.MeshStandardMaterial({ color: "#facc15", roughness: 0.7 })
    );
    body.castShadow = true;
    bus.add(body);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(7.4, 1.4, 4),
      new THREE.MeshStandardMaterial({ color: "#38bdf8", roughness: 0.4, metalness: 0.1 })
    );
    cabin.position.set(0, 1.2, 2.6);
    bus.add(cabin);
    const balloon = new THREE.Mesh(
      new THREE.SphereGeometry(6, 12, 8),
      new THREE.MeshStandardMaterial({ color: "#fb7185", roughness: 0.85 })
    );
    balloon.position.set(0, 8.8, 0);
    bus.add(balloon);
    const cableMat = new THREE.MeshBasicMaterial({ color: "#e2e8f0" });
    for (const sx of [-3, 3]) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 8, 5), cableMat);
      cable.position.set(sx, 5, -3);
      bus.add(cable);
      const cable2 = cable.clone();
      cable2.position.z = 3;
      bus.add(cable2);
    }
    bus.visible = false;
    this.bus = bus;
    this.root.add(bus);
  }

  async tryLoadMapModel() {
    const loader = new GLTFLoader();
    loader.load(
      MAP_MODEL_URL,
      (gltf) => {
        const model = gltf.scene;
        model.name = "ProvidedMapModel";
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) child.material.needsUpdate = true;
          }
        });
        this.normalizeMapModel(model);
        this.root.add(model);
        this.fallbackRoot.visible = false;
        this.modelLoaded = true;
        this.mapImage = this.createMapImage(model);
      },
      undefined,
      (error) => {
        this.modelLoaded = false;
        this.mapImage = this.createFallbackMapImage();
        console.warn("Map model failed to load; using generated fallback map.", error);
      }
    );
  }

  normalizeMapModel(model) {
    model.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model);
    let size = box.getSize(new THREE.Vector3());
    const shouldRotateToYUp = size.y > Math.max(size.x, size.z) * 1.35;
    if (shouldRotateToYUp) {
      model.rotation.x = -Math.PI / 2;
      model.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(model);
      size = box.getSize(new THREE.Vector3());
    }
    const horizontalSize = Math.max(size.x, size.z) || 1;
    const scale = MAP_MODEL_TARGET_SIZE / horizontalSize;
    model.scale.multiplyScalar(scale);
    model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const finalSize = box.getSize(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;

    // User-provided island meshes often include ocean depth/underside geometry.
    // Anchor the upper terrain band to the server ground plane instead of the lowest vertex.
    const terrainSurfaceY = box.min.y + finalSize.y * 0.72;
    model.position.y -= terrainSurfaceY;
    model.position.y += 0.35;

    model.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) {
          mat.side = THREE.DoubleSide;
          mat.needsUpdate = true;
        }
      }
    });
  }

  getMapImage() {
    if (!this.mapImage) this.mapImage = this.createFallbackMapImage();
    return this.mapImage;
  }

  createMapImage(model) {
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.setClearColor("#0e7490", 1);

    const mapScene = new THREE.Scene();
    mapScene.background = new THREE.Color("#0e7490");
    const clone = model.clone(true);
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) {
          mat.side = THREE.DoubleSide;
          mat.needsUpdate = true;
        }
      }
    });
    mapScene.add(clone);
    mapScene.add(new THREE.HemisphereLight("#ffffff", "#23402f", 2.2));
    const sun = new THREE.DirectionalLight("#fff7ed", 2.4);
    sun.position.set(80, 220, 120);
    mapScene.add(sun);

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_MODEL_TARGET_SIZE * 1.25, MAP_MODEL_TARGET_SIZE * 1.25),
      new THREE.MeshBasicMaterial({ color: "#0ea5c7" })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -3;
    mapScene.add(water);

    const camera = new THREE.OrthographicCamera(
      -MAP_MODEL_TARGET_SIZE / 2,
      MAP_MODEL_TARGET_SIZE / 2,
      MAP_MODEL_TARGET_SIZE / 2,
      -MAP_MODEL_TARGET_SIZE / 2,
      0.1,
      1200
    );
    camera.position.set(0, 720, 0.01);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    renderer.render(mapScene, camera);
    const output = document.createElement("canvas");
    output.width = size;
    output.height = size;
    output.getContext("2d").drawImage(canvas, 0, 0);
    renderer.dispose();
    return output;
  }

  createFallbackMapImage() {
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const water = ctx.createLinearGradient(0, 0, size, size);
    water.addColorStop(0, "#0ea5c7");
    water.addColorStop(1, "#064e70");
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#3f9f52";
    ctx.beginPath();
    const points = [[0.48, 0.03], [0.73, 0.1], [0.96, 0.34], [0.85, 0.72], [0.55, 0.96], [0.25, 0.85], [0.04, 0.55], [0.1, 0.22]];
    points.forEach(([x, y], i) => i ? ctx.lineTo(x * size, y * size) : ctx.moveTo(x * size, y * size));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let i = 0; i < 34; i += 1) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      ctx.beginPath();
      ctx.arc(x, y, 8 + Math.random() * 18, 0, Math.PI * 2);
      ctx.fill();
    }
    return canvas;
  }

  updateDropState(dropState) {
    if (!this.bus) return;
    if (!dropState || dropState.phase === "active") {
      this.bus.visible = false;
      return;
    }
    this.bus.visible = dropState.phase === "bus";
    if (dropState.bus) {
      this.bus.position.set(dropState.bus.x, dropState.bus.y, dropState.bus.z);
      this.bus.rotation.y = 0;
    }
  }
}
