import * as THREE from "three";
import { NetworkClient } from "./network.js";
import { InputController } from "./input.js";
import { AudioManager } from "./audio.js";
import { UIManager } from "./ui.js";
import { SettingsStore } from "./settings.js";
import { World } from "./world.js";
import { PlayerRenderer } from "./player.js";
import { ThirdPersonCamera } from "./camera.js";
import { BuildingRenderer } from "./building.js";
import { LootRenderer } from "./loot.js";
import { StormRenderer } from "./storm.js";
import { EffectsManager } from "./effects.js";
import { distance2D } from "./utils.js";

export class TwoWeeksGame {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.settings = new SettingsStore();
    this.network = new NetworkClient();
    this.audio = new AudioManager(this.settings);
    this.ui = new UIManager(this.settings);
    this.input = new InputController(this.canvas, this.settings);
    this.snapshot = null;
    this.room = null;
    this.localId = null;
    this.lastTime = performance.now();
    this.lastInputSend = 0;
    this.frames = 0;
    this.fpsClock = performance.now();
    this.nearestLoot = null;
    this.initThree();
    this.bind();
  }

  initThree() {
    if (!window.WebGLRenderingContext) {
      this.ui.toast("WebGL is not available in this browser.");
      return;
    }
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.settings.values.graphicsQuality !== "Low",
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.settings.values.graphicsQuality === "High" ? 2 : 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = this.settings.values.graphicsQuality !== "Low";
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#7dd3fc");
    this.scene.fog = new THREE.Fog("#bae6fd", 90, 245);
    this.camera = new THREE.PerspectiveCamera(67, window.innerWidth / window.innerHeight, 0.1, 500);
    this.world = new World(this.scene);
    this.players = new PlayerRenderer(this.scene);
    this.buildings = new BuildingRenderer(this.scene);
    this.loot = new LootRenderer(this.scene);
    this.storm = new StormRenderer(this.scene);
    this.effects = new EffectsManager(this.scene);
    this.chaseCamera = new ThirdPersonCamera(this.camera);
    window.addEventListener("resize", () => this.resize());
    this.canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.ui.toast("WebGL context was lost. Refresh if the scene does not recover.");
    });
  }

  bind() {
    this.ui.on({
      audioClick: () => {
        this.audio.ensureStarted();
        this.audio.click();
        this.audio.startMusic();
      },
      createProfile: (name) => this.network.createProfile(name),
      quickMatch: () => this.network.quickMatch(),
      createPrivate: () => this.network.createPrivate(),
      joinRoom: (code) => this.network.joinRoom(code),
      practice: () => this.network.practice(),
      botLobby: () => this.network.botLobby(),
      sandbox: () => this.network.sandbox(),
      startMatch: () => this.network.startMatch(),
      leaveRoom: () => this.network.leaveRoom(),
      resumeGame: () => {
        this.input.setPaused(false);
        this.ui.setPaused(false);
        if (this.snapshot && this.snapshot.status === "playing" && this.snapshot.self && this.snapshot.self.alive) this.input.setActive(true);
      },
      playAgain: (room) => {
        if (room && room.roomType === "practice") this.network.practice();
        else if (room && room.roomType === "sandbox") this.network.sandbox();
        else if (room && room.roomType === "bot") this.network.botLobby();
        else this.network.quickMatch();
      }
    });

    this.network.addEventListener("connection", (event) => {
      this.localId = event.detail.id || this.localId;
      this.ui.setConnection(event.detail);
    });
    this.network.addEventListener("roomState", (event) => {
      this.room = event.detail;
      this.ui.setRoomState(event.detail);
      this.input.setActive(event.detail && event.detail.status === "playing");
    });
    this.network.addEventListener("snapshot", (event) => {
      this.snapshot = event.detail;
      this.localId = this.network.id || (this.snapshot.self && this.snapshot.self.id);
      this.ui.setSnapshot(this.snapshot);
      this.input.setActive(this.snapshot.status === "playing" && this.snapshot.self && this.snapshot.self.alive);
    });
    this.network.addEventListener("combatHit", (event) => this.onCombatHit(event.detail));
    this.network.addEventListener("elimination", (event) => {
      this.ui.toast(event.detail.message || "Elimination");
      this.audio.elimination();
    });
    this.network.addEventListener("matchFinished", (event) => {
      this.snapshot = event.detail;
      this.ui.showResults(event.detail);
      this.input.setActive(false);
    });
    this.network.addEventListener("error", (event) => {
      this.ui.toast(event.detail || "Server error");
      this.audio.denied();
    });
    this.network.addEventListener("ping", (event) => this.ui.setPing(event.detail.ping));
    this.input.addEventListener("action", (event) => {
      if (event.detail.type === "buildToggle" || event.detail.type === "buildSelect") {
        this.ui.showBuildIndicator(this.input.buildMode, this.input.buildPiece);
      }
    });
  }

  start() {
    this.ui.showLoaded();
    requestAnimationFrame((time) => this.loop(time));
  }

  resize() {
    if (!this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  loop(time) {
    const dt = Math.min(0.05, (time - this.lastTime) / 1000 || 0.016);
    this.lastTime = time;
    this.update(dt, time);
    if (this.renderer) this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((next) => this.loop(next));
  }

  update(dt, time) {
    this.frames += 1;
    if (time - this.fpsClock >= 1000) {
      this.ui.setFps((this.frames * 1000) / (time - this.fpsClock));
      this.frames = 0;
      this.fpsClock = time;
    }
    this.ui.setMapImage(this.world.getMapImage());
    if (!this.snapshot) return;
    this.world.updateDropState(this.snapshot.dropState);
    this.players.update(this.snapshot.players || [], this.localId, dt, this.camera);
    this.buildings.update(this.snapshot.builds || []);
    this.loot.update(this.snapshot.loot || [], dt);
    this.storm.update(this.snapshot.storm);
    this.effects.update(dt, this.camera);

    const localState = this.snapshot.self;
    const localPos = localState ? this.players.getPosition(localState.id) : null;
    if (localPos) {
      this.chaseCamera.update(localPos, this.input.yaw, this.input.pitch, dt);
    }

    this.handleNearestLoot(localState);
    const preview = this.buildings.updatePreview({
      enabled: this.input.buildMode && localState && localState.alive,
      type: this.input.buildPiece,
      rotation: this.input.buildRotation,
      player: localState,
      yaw: this.input.yaw,
      materials: localState ? localState.materials : 0
    });
    if (preview) this.ui.showBuildIndicator(true, this.input.buildPiece);

    if (this.snapshot.status === "playing" && localState && localState.alive && time - this.lastInputSend > 45) {
      this.network.sendInput(this.input.getPacket());
      this.lastInputSend = time;
    }
    this.consumeActions(preview);
  }

  consumeActions(preview) {
    for (const action of this.input.consumeActions()) {
      if (action.type === "pause") {
        this.ui.setPaused(action.paused);
        continue;
      }
      if (action.type === "toggleMap") {
        const opened = this.ui.toggleMap(this.snapshot);
        if (opened && document.pointerLockElement) document.exitPointerLock();
        continue;
      }
      if (!this.snapshot || this.snapshot.status !== "playing") continue;
      if (action.type === "selectSlot") this.network.selectSlot(action.slot);
      if (action.type === "reload") this.network.reload();
      if (action.type === "useItem") this.network.useItem();
      if (action.type === "interact" && this.nearestLoot) {
        this.network.pickup(this.nearestLoot.id);
        this.audio.pickup();
      }
      if (action.type === "fire") {
        this.network.fire({ yaw: this.input.yaw, pitch: this.input.pitch });
        const self = this.snapshot.self;
        const item = self && self.inventory ? self.inventory[self.selectedSlot] : null;
        this.audio.shoot(item ? item.weaponId : "pistol");
      }
      if (action.type === "placeBuild") {
        if (preview && preview.valid) {
          this.network.placeBuild({
            type: preview.type,
            rotation: preview.rotation,
            position: preview.position
          });
          this.audio.build();
        } else {
          this.audio.denied();
          this.ui.toast("Build placement denied.");
        }
      }
    }
  }

  handleNearestLoot(localState) {
    this.nearestLoot = null;
    if (!localState || !localState.alive || !this.snapshot.loot) {
      this.ui.showInteract("");
      return;
    }
    let best = null;
    for (const item of this.snapshot.loot) {
      const d = distance2D(localState, item);
      if (d <= 5 && (!best || d < best.distance)) {
        best = { ...item, distance: d };
      }
    }
    this.nearestLoot = best;
    this.ui.showInteract(best ? `Pick up ${best.name || best.type}` : "");
  }

  onCombatHit(result) {
    if (!result || !result.results) return;
    for (const item of result.results) {
      if (item.type === "tracer") this.effects.tracer(item.from, item.to, result.weaponId === "bandage_launcher_rare" ? "#38bdf8" : "#fde047");
      if (item.type === "explosion" && item.center) this.effects.burst(item.center, "#fb923c");
      if (item.type === "heal") {
        const target = this.snapshot && this.snapshot.players.find((p) => p.id === item.targetId);
        if (target && item.amount > 0) this.effects.damage("+" + item.amount, target, "#22c55e");
      }
      if (item.type === "player") {
        const target = this.snapshot && this.snapshot.players.find((p) => p.id === item.targetId);
        if (target) {
          this.effects.damage((item.headshot ? "HEAD " : "") + String(item.damage), target, item.shieldDamage > 0 ? "#60a5fa" : "#facc15");
          this.effects.burst(target, item.eliminated ? "#fb7185" : "#2dd4bf");
        }
        if (result.shooterId === this.localId) {
          this.ui.showHitMarker();
          this.audio.hit();
        }
      }
    }
  }
}
