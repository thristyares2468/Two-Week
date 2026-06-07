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
    this.settings.addEventListener("change", () => {
      this.keys.clear();
    });
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
      if (this.matches(event.code, "toggleMap")) this.push("toggleMap");
      for (let i = 1; i <= 5; i += 1) {
        if (this.matches(event.code, `slot${i}`)) this.push("selectSlot", { slot: i - 1 });
      }
      if (this.matches(event.code, "buildMode")) {
        this.buildMode = !this.buildMode;
        this.push("buildToggle", { enabled: this.buildMode, piece: this.buildPiece });
      }
      if (this.matches(event.code, "buildWall")) this.selectBuild("wall");
      if (this.matches(event.code, "buildRamp")) this.selectBuild("ramp");
      if (this.matches(event.code, "buildFloor")) this.selectBuild("floor");
      if (this.matches(event.code, "buildRoof")) this.selectBuild("roof");
      if (this.matches(event.code, "interact")) this.push("interact");
      if (this.matches(event.code, "useItem")) this.push("useItem");
      if (this.matches(event.code, "reloadRotate")) {
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

  getBind(action) {
    return this.settings.values.keybinds?.[action];
  }

  matches(code, action) {
    return code === this.getBind(action);
  }

  pressed(action) {
    return this.keys.has(this.getBind(action));
  }

  consumeActions() {
    const actions = this.actions;
    this.actions = [];
    return actions;
  }

  getPacket() {
    const forward = (this.pressed("moveForward") ? 1 : 0) - (this.pressed("moveBackward") ? 1 : 0);
    const strafe = (this.pressed("moveRight") ? 1 : 0) - (this.pressed("moveLeft") ? 1 : 0);
    return {
      seq: this.seq++,
      moveX: strafe,
      moveZ: forward,
      jump: this.pressed("jump"),
      sprint: this.pressed("sprint"),
      crouch: this.pressed("crouch"),
      yaw: this.yaw,
      pitch: this.pitch
    };
  }
}
