export class AudioManager {
  constructor(settings) {
    this.settings = settings;
    this.context = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicOsc = null;
    this.started = false;
    this.settings.addEventListener("change", () => this.applySettings());
  }

  ensureStarted() {
    if (this.started) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.musicGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.musicGain.connect(this.context.destination);
    this.sfxGain.connect(this.context.destination);
    this.started = true;
    this.applySettings();
  }

  applySettings() {
    if (!this.context) return;
    const { masterVolume, musicVolume, sfxVolume } = this.settings.values;
    this.musicGain.gain.value = masterVolume * musicVolume;
    this.sfxGain.gain.value = masterVolume * sfxVolume;
  }

  playTone(freq, duration = 0.08, type = "sine", gain = 0.18) {
    this.ensureStarted();
    if (!this.context) return;
    const osc = this.context.createOscillator();
    const env = this.context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, this.context.currentTime);
    env.gain.exponentialRampToValueAtTime(gain, this.context.currentTime + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + duration);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start();
    osc.stop(this.context.currentTime + duration + 0.02);
  }

  click() {
    this.playTone(520, 0.05, "triangle", 0.1);
  }

  shoot(weaponId = "pistol") {
    const freq = weaponId === "sniper" ? 96 : weaponId === "shotgun" ? 120 : weaponId === "assault" ? 180 : 240;
    this.playTone(freq, weaponId === "sniper" ? 0.22 : 0.09, "sawtooth", 0.2);
  }

  pickup() {
    this.playTone(740, 0.08, "triangle", 0.13);
    setTimeout(() => this.playTone(980, 0.07, "triangle", 0.1), 45);
  }

  build() {
    this.playTone(330, 0.08, "square", 0.1);
    setTimeout(() => this.playTone(460, 0.07, "triangle", 0.1), 50);
  }

  denied() {
    this.playTone(120, 0.13, "sawtooth", 0.14);
  }

  hit() {
    this.playTone(880, 0.07, "square", 0.12);
  }

  elimination() {
    this.playTone(520, 0.09, "triangle", 0.14);
    setTimeout(() => this.playTone(780, 0.12, "triangle", 0.12), 90);
  }

  storm() {
    this.playTone(74, 0.18, "sawtooth", 0.08);
  }

  startMusic() {
    this.ensureStarted();
    if (!this.context || this.musicOsc) return;
    this.musicOsc = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 480;
    this.musicOsc.type = "triangle";
    this.musicOsc.frequency.value = 72;
    this.musicOsc.connect(filter);
    filter.connect(this.musicGain);
    this.musicOsc.start();
  }

  stopMusic() {
    if (!this.musicOsc) return;
    this.musicOsc.stop();
    this.musicOsc = null;
  }
}
