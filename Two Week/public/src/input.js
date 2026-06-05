import { clamp } from "./utils.js";

export class InputController extends EventTarget {
  constructor(canvas, settings) {
    super();
    this.canvas = canvas;
    this.settings = settings;
    this.keys = new Set();
    this.actions = [];
    this.yaw = 0;
    this.pitch = -0.12;
    this.seq = 0;
    this.buildMode = false;
    this.buildPiece = "wall";
    this.buildRotation = 0;
    this.active = false;
    this.paused = false;
    this.bind();
  }

  bind() {
    window.addEventListener("keydown", (event) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      if (event.code === "Escape") {
        this.paused = !this.paused;
        if (document.pointerLockElement) document.exitPointerLock();
        this.push("pause", { paused: this.paused });
      }
      if (!this.active) return;
      if (event.code === "KeyM") this.push("toggleMap");
      if (event.code >= "Digit1" && event.code <= "Digit5") {
        this.push("selectSlot", { slot: Number(event.code.slice(-1)) - 1 });
      }
      if (event.code === "KeyQ") {
        this.buildMode = !this.buildMode;
        this.push("buildToggle", { enabled: this.buildMode, piece: this.buildPiece });
      }
      if (event.code === "KeyZ") this.selectBuild("wall");
      if (event.code === "KeyX") this.selectBuild("ramp");
      if (event.code === "KeyC") this.selectBuild("floor");
      if (event.code === "KeyV") this.selectBuild("roof");
      if (event.code === "Space") this.push("dropFromBus");
      if (event.code === "KeyE") this.push("interact");
      if (event.code === "KeyG") this.push("useItem");
      if (event.code === "KeyR") {
        if (this.buildMode) {
          this.buildRotation = (this.buildRotation + 90) % 360;
          this.push("buildRotate", { rotation: this.buildRotation });
        } else {
          this.push("reload");
        }
      }
    });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
    });

    this.canvas.addEventListener("mousedown", (event) => {
      if (!this.active || this.paused) return;
      if (document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock?.();
      }
      if (event.button === 0) {
        this.push(this.buildMode ? "placeBuild" : "fire");
      }
      if (event.button === 2) {
        if (this.buildMode) {
          this.buildMode = false;
          this.push("buildToggle", { enabled: false, piece: this.buildPiece });
        }
      }
    });

    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    document.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement !== this.canvas || this.paused) return;
      const sensitivity = this.settings.values.mouseSensitivity;
      this.yaw += event.movementX * sensitivity;
      const invert = this.settings.values.invertY ? -1 : 1;
      this.pitch -= event.movementY * sensitivity * invert;
      this.pitch = clamp(this.pitch, -0.9, 0.55);
    });
  }

  setActive(active) {
    this.active = active;
    if (!active && document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
  }

  selectBuild(piece) {
    this.buildMode = true;
    this.buildPiece = piece;
    this.push("buildSelect", { piece, enabled: true });
  }

  push(type, payload = {}) {
    this.actions.push({ type, ...payload });
    this.dispatchEvent(new CustomEvent("action", { detail: { type, ...payload } }));
  }

  consumeActions() {
    const actions = this.actions;
    this.actions = [];
    return actions;
  }

  getPacket() {
    const forward = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0);
    const strafe = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    return {
      seq: this.seq++,
      moveX: strafe,
      moveZ: forward,
      jump: this.keys.has("Space"),
      sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      crouch: this.keys.has("ControlLeft") || this.keys.has("ControlRight"),
      yaw: this.yaw,
      pitch: this.pitch
    };
  }
}
