/**
 * Ambient sound manager — plays zone-specific ambient audio loops.
 *
 * Each zone has a distinct ambient soundscape built from layered
 * procedural noise loops (traffic hum, sewer drips, city noise, etc.).
 *
 * Crossfades between zones as the player moves through the world.
 */

import { audioEngine } from "./audio-engine";

export type ZoneName = "highway" | "collapse" | "underground" | "streets" | "none";

// Zone boundaries in world X coordinates (voxel coords × 0.5 = meters)
const ZONE_HIGHWAY_END_X = 280 * 0.5; // 140m
const ZONE_COLLAPSE_END_X = 352 * 0.5; // 176m
const UNDERGROUND_Y_THRESHOLD = (8 - 4) * 0.5; // 2m world

const CROSSFADE_TIME = 2.0; // seconds

interface AmbientLayer {
  source: AudioBufferSourceNode | OscillatorNode;
  gain: GainNode;
  filter?: BiquadFilterNode;
}

export class AmbientManager {
  private currentZone: ZoneName = "none";
  private layers: AmbientLayer[] = [];
  private targetVolume = 1.0;
  private fadeTimer = 0;

  /**
   * Determine the current zone from player position and crossfade ambient.
   */
  update(dt: number, playerX: number, playerY: number): void {
    if (!audioEngine.initialized) return;

    const zone = this.getZone(playerX, playerY);

    if (zone !== this.currentZone) {
      this.transitionTo(zone);
      this.currentZone = zone;
    }

    // Update fade
    if (this.fadeTimer > 0) {
      this.fadeTimer = Math.max(0, this.fadeTimer - dt);
    }
  }

  private getZone(wx: number, wy: number): ZoneName {
    if (wy < UNDERGROUND_Y_THRESHOLD) return "underground";
    if (wx < ZONE_HIGHWAY_END_X) return "highway";
    if (wx < ZONE_COLLAPSE_END_X) return "collapse";
    return "streets";
  }

  private transitionTo(zone: ZoneName): void {
    // Fade out current layers
    this.fadeOutAll();

    // Start new layers for the target zone
    switch (zone) {
      case "highway":
        this.startHighwayAmbient();
        break;
      case "collapse":
        this.startCollapseAmbient();
        break;
      case "underground":
        this.startUndergroundAmbient();
        break;
      case "streets":
        this.startStreetsAmbient();
        break;
    }

    this.fadeTimer = CROSSFADE_TIME;
  }

  private fadeOutAll(): void {
    const ctx = audioEngine.ctx;
    const now = ctx.currentTime;

    for (const layer of this.layers) {
      layer.gain.gain.setTargetAtTime(0, now, CROSSFADE_TIME * 0.3);
      const source = layer.source;
      // Schedule stop after fade
      setTimeout(() => {
        try { source.stop(); } catch { /* already stopped */ }
      }, CROSSFADE_TIME * 1000 + 500);
    }

    this.layers = [];
  }

  // ── Zone Ambients ───────────────────────────────────────────────────

  /**
   * Highway: low traffic hum + occasional wind gusts + engine drone
   */
  private startHighwayAmbient(): void {
    const ctx = audioEngine.ctx;
    const dest = audioEngine.ambientGain;

    // Traffic drone — filtered noise
    const trafficSource = ctx.createBufferSource();
    trafficSource.buffer = audioEngine.noiseBuffer;
    trafficSource.loop = true;
    const trafficFilter = ctx.createBiquadFilter();
    trafficFilter.type = "lowpass";
    trafficFilter.frequency.value = 200;
    trafficFilter.Q.value = 1;
    const trafficGain = ctx.createGain();
    trafficGain.gain.value = 0;
    trafficGain.gain.setTargetAtTime(0.08, ctx.currentTime, CROSSFADE_TIME * 0.3);
    trafficSource.connect(trafficFilter);
    trafficFilter.connect(trafficGain);
    trafficGain.connect(dest);
    trafficSource.start();
    this.layers.push({ source: trafficSource, gain: trafficGain, filter: trafficFilter });

    // Wind — high-passed noise, very quiet
    const windSource = ctx.createBufferSource();
    windSource.buffer = audioEngine.noiseBuffer;
    windSource.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 800;
    windFilter.Q.value = 0.5;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    windGain.gain.setTargetAtTime(0.04, ctx.currentTime, CROSSFADE_TIME * 0.3);
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(dest);
    windSource.start();
    this.layers.push({ source: windSource, gain: windGain, filter: windFilter });

    // Engine hum — low sine oscillator
    const engineOsc = ctx.createOscillator();
    engineOsc.type = "sine";
    engineOsc.frequency.value = 55; // Low A
    const engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineGain.gain.setTargetAtTime(0.03, ctx.currentTime, CROSSFADE_TIME * 0.3);
    engineOsc.connect(engineGain);
    engineGain.connect(dest);
    engineOsc.start();
    this.layers.push({ source: engineOsc, gain: engineGain });
  }

  /**
   * Collapse zone: groaning metal + crumbling + echoed wind
   */
  private startCollapseAmbient(): void {
    const ctx = audioEngine.ctx;
    const dest = audioEngine.ambientGain;

    // Groaning metal — detuned oscillators
    const groanOsc = ctx.createOscillator();
    groanOsc.type = "sawtooth";
    groanOsc.frequency.value = 45;
    const groanFilter = ctx.createBiquadFilter();
    groanFilter.type = "lowpass";
    groanFilter.frequency.value = 150;
    const groanGain = ctx.createGain();
    groanGain.gain.value = 0;
    groanGain.gain.setTargetAtTime(0.04, ctx.currentTime, CROSSFADE_TIME * 0.3);
    groanOsc.connect(groanFilter);
    groanFilter.connect(groanGain);
    groanGain.connect(dest);
    groanOsc.start();
    this.layers.push({ source: groanOsc, gain: groanGain, filter: groanFilter });

    // Crumbling noise — low rumble
    const rumbleSource = ctx.createBufferSource();
    rumbleSource.buffer = audioEngine.noiseBuffer;
    rumbleSource.loop = true;
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = "lowpass";
    rumbleFilter.frequency.value = 120;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0;
    rumbleGain.gain.setTargetAtTime(0.06, ctx.currentTime, CROSSFADE_TIME * 0.3);
    rumbleSource.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(dest);
    rumbleSource.start();
    this.layers.push({ source: rumbleSource, gain: rumbleGain, filter: rumbleFilter });
  }

  /**
   * Underground: water drips + echoed hum + sewer flow
   */
  private startUndergroundAmbient(): void {
    const ctx = audioEngine.ctx;
    const dest = audioEngine.ambientGain;

    // Sewer water flow — filtered noise
    const waterSource = ctx.createBufferSource();
    waterSource.buffer = audioEngine.noiseBuffer;
    waterSource.loop = true;
    const waterFilter = ctx.createBiquadFilter();
    waterFilter.type = "bandpass";
    waterFilter.frequency.value = 400;
    waterFilter.Q.value = 2;
    const waterGain = ctx.createGain();
    waterGain.gain.value = 0;
    waterGain.gain.setTargetAtTime(0.05, ctx.currentTime, CROSSFADE_TIME * 0.3);
    waterSource.connect(waterFilter);
    waterFilter.connect(waterGain);
    waterGain.connect(dest);
    waterSource.start();
    this.layers.push({ source: waterSource, gain: waterGain, filter: waterFilter });

    // Deep hum — resonant bass
    const humOsc = ctx.createOscillator();
    humOsc.type = "sine";
    humOsc.frequency.value = 60; // B1 electrical hum
    const humGain = ctx.createGain();
    humGain.gain.value = 0;
    humGain.gain.setTargetAtTime(0.03, ctx.currentTime, CROSSFADE_TIME * 0.3);
    humOsc.connect(humGain);
    humGain.connect(dest);
    humOsc.start();
    this.layers.push({ source: humOsc, gain: humGain });

    // Drip scheduling — periodic drip sounds
    this.scheduleDrips(dest);
  }

  private scheduleDrips(dest: AudioNode): void {
    const ctx = audioEngine.ctx;
    const now = ctx.currentTime;

    // Schedule 10 drip sounds over the next 30 seconds
    for (let i = 0; i < 10; i++) {
      const t = now + 1 + Math.random() * 28;
      const freq = 1200 + Math.random() * 600;

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.15);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t - 0.01);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(t - 0.01);
      osc.stop(t + 0.35);
    }
  }

  /**
   * Streets: distant city noise + traffic rumble + occasional horn
   */
  private startStreetsAmbient(): void {
    const ctx = audioEngine.ctx;
    const dest = audioEngine.ambientGain;

    // City hum — mid-frequency noise
    const citySource = ctx.createBufferSource();
    citySource.buffer = audioEngine.noiseBuffer;
    citySource.loop = true;
    const cityFilter = ctx.createBiquadFilter();
    cityFilter.type = "bandpass";
    cityFilter.frequency.value = 300;
    cityFilter.Q.value = 0.5;
    const cityGain = ctx.createGain();
    cityGain.gain.value = 0;
    cityGain.gain.setTargetAtTime(0.06, ctx.currentTime, CROSSFADE_TIME * 0.3);
    citySource.connect(cityFilter);
    cityFilter.connect(cityGain);
    cityGain.connect(dest);
    citySource.start();
    this.layers.push({ source: citySource, gain: cityGain, filter: cityFilter });

    // Low traffic rumble
    const rumbleOsc = ctx.createOscillator();
    rumbleOsc.type = "sine";
    rumbleOsc.frequency.value = 70;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0;
    rumbleGain.gain.setTargetAtTime(0.025, ctx.currentTime, CROSSFADE_TIME * 0.3);
    rumbleOsc.connect(rumbleGain);
    rumbleGain.connect(dest);
    rumbleOsc.start();
    this.layers.push({ source: rumbleOsc, gain: rumbleGain });
  }

  destroy(): void {
    this.fadeOutAll();
    this.currentZone = "none";
  }
}
