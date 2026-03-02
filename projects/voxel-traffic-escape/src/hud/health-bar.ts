/**
 * HUD health bar — HTML overlay rendered on top of the Three.js canvas.
 *
 * Displays current HP / max HP as a red bar with numeric readout.
 * Animates damage (bar shrinks with a trailing "ghost" bar) and healing.
 * Shows heart container pips below the bar.
 */

import { HealthSystem, DamageEvent, HealEvent, HealthEventType } from "@/player/health";

const BAR_WIDTH = 200;
const BAR_HEIGHT = 16;
const GHOST_DECAY_RATE = 0.4; // fraction per second the ghost bar catches up
const DAMAGE_SOURCE_DISPLAY_SEC = 1.5; // how long the damage source text shows
const DAMAGE_SOURCE_FADE_SEC = 0.4; // fade-out duration

export class HealthBar {
  private container: HTMLDivElement;
  private barFill: HTMLDivElement;
  private barGhost: HTMLDivElement;
  private hpText: HTMLSpanElement;
  private heartPips: HTMLDivElement;
  private flashOverlay: HTMLDivElement;
  private damageSourceEl: HTMLDivElement;
  private health: HealthSystem;
  private ghostFraction: number = 1;
  private damageSourceTimer: number = 0;
  private unsubscribe: (() => void) | null = null;

  constructor(health: HealthSystem) {
    this.health = health;

    // Create the overlay elements
    this.container = document.createElement("div");
    this.container.id = "hud-health";
    this.container.style.cssText = `
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 50;
      font-family: monospace;
      user-select: none;
      pointer-events: none;
      background: rgba(0, 0, 0, 0.3);
      padding: 8px 10px;
      border-radius: 4px;
    `;

    // HP label
    const label = document.createElement("div");
    label.textContent = "HP";
    label.style.cssText = `
      color: #ff4444;
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 2px;
      margin-bottom: 2px;
    `;
    this.container.appendChild(label);

    // Bar background
    const barBg = document.createElement("div");
    barBg.style.cssText = `
      width: ${BAR_WIDTH}px;
      height: ${BAR_HEIGHT}px;
      background: #1a0000;
      border: 2px solid #660000;
      border-radius: 2px;
      position: relative;
      overflow: hidden;
    `;

    // Ghost bar (trails behind during damage)
    this.barGhost = document.createElement("div");
    this.barGhost.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 100%;
      background: #882222;
      transition: none;
    `;
    barBg.appendChild(this.barGhost);

    // Main fill bar
    this.barFill = document.createElement("div");
    this.barFill.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 100%;
      background: linear-gradient(180deg, #ff4444 0%, #cc0000 100%);
      transition: none;
    `;
    barBg.appendChild(this.barFill);

    this.container.appendChild(barBg);

    // HP text (e.g. "85 / 100")
    this.hpText = document.createElement("span");
    this.hpText.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${BAR_WIDTH}px;
      height: ${BAR_HEIGHT}px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 10px;
      font-weight: bold;
      text-shadow: 1px 1px 1px #000;
    `;
    barBg.appendChild(this.hpText);

    // Heart container pips
    this.heartPips = document.createElement("div");
    this.heartPips.style.cssText = `
      display: flex;
      gap: 3px;
      margin-top: 3px;
    `;
    this.container.appendChild(this.heartPips);

    // Damage source text (shows what hit the player, fades out)
    this.damageSourceEl = document.createElement("div");
    this.damageSourceEl.style.cssText = `
      margin-top: 4px;
      font-size: 11px;
      font-weight: bold;
      color: #ff6666;
      text-shadow: 1px 1px 2px #000;
      opacity: 0;
      white-space: nowrap;
      transition: none;
    `;
    this.container.appendChild(this.damageSourceEl);

    // Full-screen red flash overlay for damage
    this.flashOverlay = document.createElement("div");
    this.flashOverlay.id = "damage-flash";
    this.flashOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(ellipse at center, transparent 40%, rgba(255, 0, 0, 0.4) 100%);
      opacity: 0;
      z-index: 40;
      pointer-events: none;
      transition: opacity 0.1s ease-out;
    `;

    // Listen to health events
    this.unsubscribe = health.on((type, data) => {
      this._onHealthEvent(type, data);
    });

    this._syncBar();
    this._syncHeartPips();
  }

  /** Attach the HUD elements to the DOM */
  mount(): void {
    document.body.appendChild(this.container);
    document.body.appendChild(this.flashOverlay);
  }

  /** Remove from DOM */
  unmount(): void {
    this.container.remove();
    this.flashOverlay.remove();
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /** Call each frame to animate the ghost bar and damage source fade */
  update(dt: number): void {
    const targetFraction = this.health.hpFraction;

    // Ghost bar decays toward the real bar
    if (this.ghostFraction > targetFraction) {
      this.ghostFraction = Math.max(
        targetFraction,
        this.ghostFraction - GHOST_DECAY_RATE * dt
      );
    } else {
      // Healing: ghost snaps to match
      this.ghostFraction = targetFraction;
    }

    this.barGhost.style.width = `${this.ghostFraction * 100}%`;

    // Damage source text fade-out
    if (this.damageSourceTimer > 0) {
      this.damageSourceTimer -= dt;
      if (this.damageSourceTimer <= DAMAGE_SOURCE_FADE_SEC) {
        // Fade out over the last DAMAGE_SOURCE_FADE_SEC seconds
        const fadeProgress = Math.max(0, this.damageSourceTimer / DAMAGE_SOURCE_FADE_SEC);
        this.damageSourceEl.style.opacity = String(fadeProgress);
      }
      if (this.damageSourceTimer <= 0) {
        this.damageSourceTimer = 0;
        this.damageSourceEl.style.opacity = "0";
      }
    }
  }

  // --- Private ---

  private _onHealthEvent(
    type: HealthEventType,
    data: DamageEvent | HealEvent | null
  ): void {
    switch (type) {
      case "damage":
        this._syncBar();
        this._flashDamage(data as DamageEvent);
        break;
      case "heal":
        this._syncBar();
        break;
      case "death":
        this._syncBar();
        this._flashDeath();
        break;
      case "respawn":
        this.ghostFraction = 1;
        this._syncBar();
        break;
      case "max-hp-change":
        this._syncBar();
        this._syncHeartPips();
        break;
    }
  }

  private _syncBar(): void {
    const frac = this.health.hpFraction;
    this.barFill.style.width = `${frac * 100}%`;
    this.hpText.textContent = `${this.health.hp} / ${this.health.maxHp}`;

    // Color shift: green > yellow > red as HP drops
    if (frac > 0.6) {
      this.barFill.style.background =
        "linear-gradient(180deg, #ff4444 0%, #cc0000 100%)";
    } else if (frac > 0.3) {
      this.barFill.style.background =
        "linear-gradient(180deg, #ff8800 0%, #cc5500 100%)";
    } else {
      this.barFill.style.background =
        "linear-gradient(180deg, #ff2222 0%, #aa0000 100%)";
      // Pulse effect at low HP
      this.barFill.style.animation = "hud-pulse 0.6s ease-in-out infinite";
    }

    if (frac > 0.3) {
      this.barFill.style.animation = "none";
    }
  }

  private _syncHeartPips(): void {
    this.heartPips.innerHTML = "";
    const total = 5;
    const collected = this.health.heartContainers;

    for (let i = 0; i < total; i++) {
      const pip = document.createElement("div");
      const filled = i < collected;
      pip.style.cssText = `
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 1px solid ${filled ? "#ff4444" : "#440000"};
        background: ${filled ? "#ff4444" : "transparent"};
      `;
      // Heart shape via clip-path
      pip.style.clipPath =
        "polygon(50% 85%, 15% 55%, 0% 35%, 5% 15%, 25% 0%, 50% 15%, 75% 0%, 95% 15%, 100% 35%, 85% 55%)";
      this.heartPips.appendChild(pip);
    }
  }

  private _flashDamage(event: DamageEvent): void {
    // Flash intensity scales with damage percentage
    const intensity = Math.min(1, event.actualDamage / 30);
    this.flashOverlay.style.background = `radial-gradient(ellipse at center, transparent 40%, rgba(255, 0, 0, ${0.2 + intensity * 0.4}) 100%)`;
    this.flashOverlay.style.opacity = "1";

    setTimeout(() => {
      this.flashOverlay.style.transition = "opacity 0.4s ease-out";
      this.flashOverlay.style.opacity = "0";
      setTimeout(() => {
        this.flashOverlay.style.transition = "opacity 0.1s ease-out";
      }, 400);
    }, 50);

    // Show damage source name
    if (event.source && event.source !== "unknown") {
      this.damageSourceEl.textContent = `\u2620 ${event.source} \u2212${event.actualDamage}`;
      this.damageSourceEl.style.opacity = "1";
      this.damageSourceEl.style.transition = "none";
      this.damageSourceTimer = DAMAGE_SOURCE_DISPLAY_SEC;
    }
  }

  private _flashDeath(): void {
    this.flashOverlay.style.background = "rgba(80, 0, 0, 0.7)";
    this.flashOverlay.style.opacity = "1";
    this.flashOverlay.style.transition = "opacity 2s ease-out";
  }

  /**
   * Inject the CSS keyframes for the low-HP pulse animation.
   * Call once at startup.
   */
  static injectStyles(): void {
    if (document.getElementById("hud-health-styles")) return;
    const style = document.createElement("style");
    style.id = "hud-health-styles";
    style.textContent = `
      @keyframes hud-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);
  }
}
