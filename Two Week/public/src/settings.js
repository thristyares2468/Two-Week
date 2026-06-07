const STORAGE_KEY = "two-weeks-settings";

export const DEFAULT_SETTINGS = {
  masterVolume: 0.7,
  musicVolume: 0.34,
  sfxVolume: 0.78,
  mouseSensitivity: 0.0028,
  invertY: false,
  graphicsQuality: "Medium",
  showFps: true,
  showPing: true,
  reducedMotion: false
};

export class SettingsStore extends EventTarget {
  constructor() {
    super();
    this.values = this.load();
  }

  load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
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

  reset() {
    this.values = { ...DEFAULT_SETTINGS };
    this.save();
  }
}
