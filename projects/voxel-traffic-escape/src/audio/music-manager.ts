/**
 * Procedural background music manager.
 *
 * Generates simple looping musical phrases per zone using oscillators.
 * Each zone has a distinct mood:
 * - Highway: driving, rhythmic pulse
 * - Underground: eerie, sparse, minor key
 * - Streets: tense, percussive
 * - Collapse: atonal, unsettling drones
 *
 * The music is intentionally minimal — retro/chiptune style to match
 * the voxel aesthetic. Loops every few bars with slight variation.
 */

import { audioEngine } from "./audio-engine";

type MusicZone = "highway" | "collapse" | "underground" | "streets" | "none";

// Zone boundaries (same as ambient-manager)
const ZONE_HIGHWAY_END_X = 280 * 0.5;
const ZONE_COLLAPSE_END_X = 352 * 0.5;
const UNDERGROUND_Y_THRESHOLD = (8 - 4) * 0.5;

const CROSSFADE_SEC = 3.0;

// Musical note frequencies (Hz)
const NOTE: Record<string, number> = {
  C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61,
  G3: 196.00, Ab3: 207.65, A3: 220.00, Bb3: 233.08, B3: 246.94,
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23,
  G4: 392.00, Ab4: 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99,
};

interface MusicPhrase {
  notes: number[];    // frequencies
  durations: number[]; // seconds per note
  wave: OscillatorType;
  volume: number;
}

export class MusicManager {
  private currentZone: MusicZone = "none";
  private loopTimer = 0;
  private loopInterval = 0; // seconds per loop
  private activeNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private masterGain: GainNode | null = null;

  update(dt: number, playerX: number, playerY: number): void {
    if (!audioEngine.initialized) return;

    const zone = this.getZone(playerX, playerY);

    if (zone !== this.currentZone) {
      this.stopAll();
      this.currentZone = zone;
      this.loopTimer = 0;
      this.loopInterval = this.getLoopInterval(zone);
    }

    // Loop music phrases
    this.loopTimer += dt;
    if (this.loopTimer >= this.loopInterval && this.loopInterval > 0) {
      this.loopTimer = 0;
      this.playPhrase(zone);
    }
  }

  private getZone(wx: number, wy: number): MusicZone {
    if (wy < UNDERGROUND_Y_THRESHOLD) return "underground";
    if (wx < ZONE_HIGHWAY_END_X) return "highway";
    if (wx < ZONE_COLLAPSE_END_X) return "collapse";
    return "streets";
  }

  private getLoopInterval(zone: MusicZone): number {
    switch (zone) {
      case "highway": return 4.0;     // 4 seconds per phrase
      case "underground": return 6.0; // slower, sparser
      case "streets": return 3.5;     // slightly faster, tense
      case "collapse": return 8.0;    // very slow, ominous
      default: return 0;
    }
  }

  private playPhrase(zone: MusicZone): void {
    switch (zone) {
      case "highway":
        this.playHighwayPhrase();
        break;
      case "underground":
        this.playUndergroundPhrase();
        break;
      case "streets":
        this.playStreetsPhrase();
        break;
      case "collapse":
        this.playCollapsePhrase();
        break;
    }
  }

  /**
   * Highway: driving bass line in E minor, rhythmic.
   */
  private playHighwayPhrase(): void {
    const patterns = [
      [NOTE.E3, NOTE.E3, NOTE.G3, NOTE.A3, NOTE.G3, NOTE.E3, NOTE.D3, NOTE.E3],
      [NOTE.E3, NOTE.G3, NOTE.A3, NOTE.B3, NOTE.A3, NOTE.G3, NOTE.E3, NOTE.D3],
      [NOTE.A3, NOTE.A3, NOTE.G3, NOTE.E3, NOTE.D3, NOTE.E3, NOTE.G3, NOTE.A3],
    ];
    const notes = patterns[Math.floor(Math.random() * patterns.length)];
    const dur = 0.5; // eighth notes at ~120 BPM

    this.scheduleNotes(notes, dur, "square", 0.08);
  }

  /**
   * Underground: sparse minor key, eerie sustained notes.
   */
  private playUndergroundPhrase(): void {
    const patterns = [
      [NOTE.C3, 0, NOTE.Eb3, 0, NOTE.Ab3, 0],
      [NOTE.Ab3, 0, NOTE.G3, 0, NOTE.Eb3, NOTE.C3],
      [NOTE.C4, NOTE.Bb3, 0, NOTE.Ab3, 0, NOTE.G3],
    ];
    const notes = patterns[Math.floor(Math.random() * patterns.length)];
    const dur = 1.0;

    this.scheduleNotes(notes, dur, "sine", 0.06);
  }

  /**
   * Streets: tense rhythmic pattern, Bb minor.
   */
  private playStreetsPhrase(): void {
    const patterns = [
      [NOTE.Bb3, NOTE.Bb3, NOTE.F3, NOTE.Eb3, NOTE.Bb3, NOTE.Ab3, NOTE.F3],
      [NOTE.F3, NOTE.Ab3, NOTE.Bb3, NOTE.Ab3, NOTE.F3, NOTE.Eb3, NOTE.F3],
      [NOTE.Bb3, NOTE.Ab3, NOTE.F3, NOTE.Eb3, NOTE.F3, NOTE.Ab3, NOTE.Bb3],
    ];
    const notes = patterns[Math.floor(Math.random() * patterns.length)];
    const dur = 0.5;

    this.scheduleNotes(notes, dur, "square", 0.06);
  }

  /**
   * Collapse: atonal drones with detuning.
   */
  private playCollapsePhrase(): void {
    const ctx = audioEngine.ctx;
    const dest = audioEngine.musicGain;
    const now = ctx.currentTime;

    // Two detuned drones that slowly beat against each other
    const baseFreq = 55 + Math.random() * 20;

    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = baseFreq + i * 3; // slight detuning
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.04, now + 2);
      gain.gain.linearRampToValueAtTime(0, now + 7.5);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 8);
      this.activeNodes.push({ osc, gain });
    }
  }

  /**
   * Schedule a sequence of notes, with 0 = rest.
   */
  private scheduleNotes(
    notes: number[],
    noteDuration: number,
    wave: OscillatorType,
    volume: number
  ): void {
    const ctx = audioEngine.ctx;
    const dest = audioEngine.musicGain;
    const now = ctx.currentTime;

    for (let i = 0; i < notes.length; i++) {
      const freq = notes[i];
      if (freq === 0) continue; // rest

      const startTime = now + i * noteDuration;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = wave;
      osc.frequency.value = freq;

      // Envelope: quick attack, sustain, quick release
      const attackEnd = startTime + 0.01;
      const releaseStart = startTime + noteDuration * 0.8;
      const releaseEnd = startTime + noteDuration;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, attackEnd);
      gain.gain.setValueAtTime(volume, releaseStart);
      gain.gain.exponentialRampToValueAtTime(0.001, releaseEnd);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(startTime);
      osc.stop(releaseEnd + 0.05);
      this.activeNodes.push({ osc, gain });
    }

    // Cleanup old nodes
    this.cleanupNodes();
  }

  private cleanupNodes(): void {
    // Keep only recent nodes (prevent memory buildup)
    if (this.activeNodes.length > 50) {
      this.activeNodes = this.activeNodes.slice(-20);
    }
  }

  private stopAll(): void {
    const ctx = audioEngine.ctx;
    const now = ctx.currentTime;

    for (const { osc, gain } of this.activeNodes) {
      try {
        gain.gain.setTargetAtTime(0, now, 0.3);
        osc.stop(now + CROSSFADE_SEC);
      } catch {
        // Already stopped
      }
    }

    this.activeNodes = [];
  }

  destroy(): void {
    this.stopAll();
    this.currentZone = "none";
  }
}
