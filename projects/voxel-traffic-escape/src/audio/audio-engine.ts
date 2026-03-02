/**
 * Core audio engine — manages Web Audio API context, master volume,
 * category volumes (SFX, music, ambient), and procedural sound playback.
 *
 * All sounds are procedurally generated using oscillators and noise buffers.
 * No external audio files needed — fits the flat-shaded voxel aesthetic.
 *
 * Volume settings are persisted to localStorage.
 */

const STORAGE_KEY = "vte_audio_settings";

export type VolumeCategory = "master" | "sfx" | "music" | "ambient";

interface AudioSettings {
  master: number;
  sfx: number;
  music: number;
  ambient: number;
}

const DEFAULT_SETTINGS: AudioSettings = {
  master: 0.5,
  sfx: 0.7,
  music: 0.4,
  ambient: 0.5,
};

export class AudioEngine {
  private _ctx: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _sfxGain: GainNode | null = null;
  private _musicGain: GainNode | null = null;
  private _ambientGain: GainNode | null = null;
  private _settings: AudioSettings;
  private _initialized = false;
  private _noiseBuffer: AudioBuffer | null = null;

  constructor() {
    this._settings = this.loadSettings();
  }

  /** Lazy-init the AudioContext (must be called after a user gesture). */
  init(): void {
    if (this._initialized) return;

    this._ctx = new AudioContext();
    this._masterGain = this._ctx.createGain();
    this._masterGain.connect(this._ctx.destination);
    this._masterGain.gain.value = this._settings.master;

    this._sfxGain = this._ctx.createGain();
    this._sfxGain.connect(this._masterGain);
    this._sfxGain.gain.value = this._settings.sfx;

    this._musicGain = this._ctx.createGain();
    this._musicGain.connect(this._masterGain);
    this._musicGain.gain.value = this._settings.music;

    this._ambientGain = this._ctx.createGain();
    this._ambientGain.connect(this._masterGain);
    this._ambientGain.gain.value = this._settings.ambient;

    this._noiseBuffer = this.createNoiseBuffer(2);
    this._initialized = true;
  }

  get ctx(): AudioContext {
    if (!this._ctx) throw new Error("AudioEngine not initialized");
    return this._ctx;
  }

  get sfxGain(): GainNode {
    if (!this._sfxGain) throw new Error("AudioEngine not initialized");
    return this._sfxGain;
  }

  get musicGain(): GainNode {
    if (!this._musicGain) throw new Error("AudioEngine not initialized");
    return this._musicGain;
  }

  get ambientGain(): GainNode {
    if (!this._ambientGain) throw new Error("AudioEngine not initialized");
    return this._ambientGain;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  /** Get a pre-generated white noise buffer. */
  get noiseBuffer(): AudioBuffer {
    if (!this._noiseBuffer) throw new Error("AudioEngine not initialized");
    return this._noiseBuffer;
  }

  // ── Volume Control ──────────────────────────────────────────────────

  getVolume(category: VolumeCategory): number {
    return this._settings[category];
  }

  setVolume(category: VolumeCategory, value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this._settings[category] = clamped;

    if (!this._initialized) return;

    const now = this.ctx.currentTime;
    switch (category) {
      case "master":
        this._masterGain!.gain.setTargetAtTime(clamped, now, 0.02);
        break;
      case "sfx":
        this._sfxGain!.gain.setTargetAtTime(clamped, now, 0.02);
        break;
      case "music":
        this._musicGain!.gain.setTargetAtTime(clamped, now, 0.02);
        break;
      case "ambient":
        this._ambientGain!.gain.setTargetAtTime(clamped, now, 0.02);
        break;
    }

    this.saveSettings();
  }

  // ── Procedural Sound Primitives ─────────────────────────────────────

  /**
   * Play a short oscillator tone (beep/bloop style).
   * Returns the oscillator for further manipulation.
   */
  playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = "square",
    volume: number = 0.3,
    destination?: AudioNode
  ): OscillatorNode {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = volume;

    // Quick fade-out to avoid clicks
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(destination ?? this.sfxGain);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.05);

    return osc;
  }

  /**
   * Play a frequency sweep (rising or falling pitch).
   */
  playSweep(
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = "square",
    volume: number = 0.3,
    destination?: AudioNode
  ): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(destination ?? this.sfxGain);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.05);
  }

  /**
   * Play a noise burst (impacts, explosions, footsteps).
   */
  playNoise(
    duration: number,
    volume: number = 0.2,
    filterFreq: number = 1000,
    filterType: BiquadFilterType = "lowpass",
    destination?: AudioNode
  ): void {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination ?? this.sfxGain);

    source.start(ctx.currentTime);
    source.stop(ctx.currentTime + duration + 0.05);
  }

  /**
   * Play a noise burst with a frequency sweep on the filter.
   */
  playFilteredNoise(
    duration: number,
    volume: number,
    startFreq: number,
    endFreq: number,
    filterType: BiquadFilterType = "bandpass",
    destination?: AudioNode
  ): void {
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(startFreq, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination ?? this.sfxGain);

    source.start(ctx.currentTime);
    source.stop(ctx.currentTime + duration + 0.05);
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  /** Resume the AudioContext if suspended (needed for Chrome autoplay). */
  resume(): void {
    if (this._ctx && this._ctx.state === "suspended") {
      this._ctx.resume();
    }
  }

  private createNoiseBuffer(durationSec: number): AudioBuffer {
    const ctx = this.ctx;
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * durationSec;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  private loadSettings(): AudioSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AudioSettings>;
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      // Ignore parse errors
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._settings));
    } catch {
      // Ignore storage errors
    }
  }
}

/** Singleton audio engine instance. */
export const audioEngine = new AudioEngine();
