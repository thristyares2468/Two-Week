const STORAGE_KEY = "two-weeks-settings";

export const DEFAULT_KEYBINDS = {
  moveForward: "KeyW",
  moveBackward: "KeyS",
  moveLeft: "KeyA",
  moveRight: "KeyD",
  jump: "Space",
  sprint: "ShiftLeft",
  crouch: "ControlLeft",
  interact: "KeyE",
  reloadRotate: "KeyR",
  useItem: "KeyG",
  toggleMap: "KeyM",
  buildMode: "KeyQ",
  buildWall: "KeyZ",
  buildRamp: "KeyX",
  buildFloor: "KeyC",
  buildRoof: "KeyV",
  slot1: "Digit1",
  slot2: "Digit2",
  slot3: "Digit3",
  slot4: "Digit4",
  slot5: "Digit5"
};

export const DEFAULT_SETTINGS = {
  masterVolume: 0.7,
  musicVolume: 0.34,
  sfxVolume: 0.78,
  mouseSensitivity: 0.0028,
  invertY: false,
  graphicsQuality: "Medium",
  showFps: true,
  showPing: true,
  reducedMotion: false,
  keybinds: { ...DEFAULT_KEYBINDS }
};

export class SettingsStore extends EventTarget {
  constructor() {
    super();
    this.values = this.load();
  }

  load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        keybinds: {
          ...DEFAULT_KEYBINDS,
          ...(parsed.keybinds || {})
        }
      };
    } catch (_error) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  save() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
    this.dispatchEvent(new CustomEvent("change", { detail: this.values }));
  }

  set(key, value) {
    this.values[key] = value;
    this.save();
  }

  setKeybind(action, code) {
    if (!DEFAULT_KEYBINDS[action] || !code) return;
    const next = { ...DEFAULT_KEYBINDS, ...(this.values.keybinds || {}) };
    const previous = next[action];
    const conflict = Object.entries(next).find(([otherAction, otherCode]) => otherAction !== action && otherCode === code);
    next[action] = code;
    if (conflict && previous) {
      next[conflict[0]] = previous;
    }
    this.values.keybinds = next;
    this.save();
  }

  resetKeybinds() {
    this.values.keybinds = { ...DEFAULT_KEYBINDS };
    this.save();
  }

  reset() {
    this.values = {
      ...DEFAULT_SETTINGS,
      keybinds: { ...DEFAULT_KEYBINDS }
    };
    this.save();
  }
}
