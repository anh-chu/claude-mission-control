/**
 * Enemy Health Bar HUD — floating name + HP bar above the targeted enemy.
 *
 * On each frame, determines which enemy is closest to the camera crosshair
 * (within ~15 degrees), then displays an HTML overlay positioned above
 * its mesh using THREE.Vector3.project().
 *
 * Smoothly fades in/out when the target changes or disappears.
 */

import * as THREE from "three";
import { type Enemy } from "@/enemies/enemy";

const AIM_CONE_COS = Math.cos((15 * Math.PI) / 180); // ~15 degree half-angle
const FADE_SPEED = 6; // opacity units per second (fast fade)
const MAX_DISPLAY_DISTANCE = 30; // meters — beyond this, don't show bar
const BAR_WIDTH = 140;
const BAR_HEIGHT = 8;

export class EnemyHealthBar {
  private container: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private barBg: HTMLDivElement;
  private barFill: HTMLDivElement;
  private hpText: HTMLSpanElement;

  private currentTargetId: string | null = null;
  private opacity = 0;
  private mounted = false;

  // Reusable vectors to avoid per-frame allocations
  private _screenPos = new THREE.Vector3();
  private _enemyTop = new THREE.Vector3();
  private _toEnemy = new THREE.Vector3();
  private _camForward = new THREE.Vector3();

  constructor() {
    // Root container
    this.container = document.createElement("div");
    this.container.id = "enemy-health-bar";
    this.container.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 55;
      opacity: 0;
      transition: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      transform: translate(-50%, -100%);
      white-space: nowrap;
    `;

    // Enemy name
    this.nameEl = document.createElement("div");
    this.nameEl.style.cssText = `
      font-family: monospace;
      font-size: 12px;
      font-weight: bold;
      color: #ffffff;
      text-shadow: 1px 1px 2px #000, -1px -1px 2px #000;
      margin-bottom: 2px;
    `;
    this.container.appendChild(this.nameEl);

    // Bar background
    this.barBg = document.createElement("div");
    this.barBg.style.cssText = `
      width: ${BAR_WIDTH}px;
      height: ${BAR_HEIGHT}px;
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 2px;
      position: relative;
      overflow: hidden;
    `;
    this.container.appendChild(this.barBg);

    // HP fill bar
    this.barFill = document.createElement("div");
    this.barFill.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 100%;
      background: linear-gradient(180deg, #ff4444 0%, #cc0000 100%);
      transition: width 0.15s ease-out;
    `;
    this.barBg.appendChild(this.barFill);

    // HP text overlay
    this.hpText = document.createElement("span");
    this.hpText.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: monospace;
      font-size: 8px;
      font-weight: bold;
      color: #ffffff;
      text-shadow: 1px 1px 0 #000;
    `;
    this.barBg.appendChild(this.hpText);
  }

  /** Attach the HUD element to the DOM */
  mount(): void {
    if (this.mounted) return;
    this.mounted = true;
    document.body.appendChild(this.container);
  }

  /** Remove from DOM */
  unmount(): void {
    if (!this.mounted) return;
    this.mounted = false;
    this.container.remove();
    this.opacity = 0;
    this.currentTargetId = null;
  }

  /**
   * Call each frame to update targeting and positioning.
   * @param dt       delta time in seconds
   * @param camera   the player's perspective camera
   * @param enemies  active enemies from EnemyManager.getActiveEnemies()
   */
  update(
    dt: number,
    camera: THREE.PerspectiveCamera,
    enemies: readonly Enemy[]
  ): void {
    if (!this.mounted) return;

    // Find the enemy closest to crosshair
    const target = this.findTarget(camera, enemies);

    if (target) {
      // Update content if target changed
      if (this.currentTargetId !== target.id) {
        this.currentTargetId = target.id;
        this.nameEl.textContent = target.typeDef.name;
      }

      // Update HP display
      const frac = target.maxHp > 0 ? target.hp / target.maxHp : 0;
      this.barFill.style.width = `${Math.max(0, frac) * 100}%`;
      this.hpText.textContent = `${Math.max(0, target.hp)} / ${target.maxHp}`;

      // Color shift based on HP fraction
      if (frac > 0.5) {
        this.barFill.style.background =
          "linear-gradient(180deg, #ff4444 0%, #cc0000 100%)";
      } else if (frac > 0.25) {
        this.barFill.style.background =
          "linear-gradient(180deg, #ff8800 0%, #cc5500 100%)";
      } else {
        this.barFill.style.background =
          "linear-gradient(180deg, #ff2222 0%, #aa0000 100%)";
      }

      // Position the overlay above the enemy's head
      this.positionAboveEnemy(target, camera);

      // Fade in
      this.opacity = Math.min(1, this.opacity + FADE_SPEED * dt);
    } else {
      this.currentTargetId = null;
      // Fade out
      this.opacity = Math.max(0, this.opacity - FADE_SPEED * dt);
    }

    this.container.style.opacity = String(this.opacity);
  }

  // ── Private ────────────────────────────────────────────────────────

  /**
   * Find the enemy closest to the camera's forward direction
   * within the aim cone, that is also alive and within range.
   */
  private findTarget(
    camera: THREE.PerspectiveCamera,
    enemies: readonly Enemy[]
  ): Enemy | null {
    // Camera forward vector (negative Z in camera space → world direction)
    camera.getWorldDirection(this._camForward);

    let bestEnemy: Enemy | null = null;
    let bestDot = AIM_CONE_COS; // must be at least this close to center

    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;

      // Direction from camera to enemy
      this._toEnemy
        .copy(enemy.position)
        .sub(camera.position);

      const dist = this._toEnemy.length();
      if (dist > MAX_DISPLAY_DISTANCE || dist < 0.5) continue;

      this._toEnemy.divideScalar(dist); // normalize

      const dot = this._toEnemy.dot(this._camForward);
      if (dot > bestDot) {
        bestDot = dot;
        bestEnemy = enemy;
      }
    }

    return bestEnemy;
  }

  /**
   * Convert the enemy's world position (above head) to screen coordinates
   * and position the HTML overlay.
   */
  private positionAboveEnemy(
    enemy: Enemy,
    camera: THREE.PerspectiveCamera
  ): void {
    // Position above the enemy mesh (use mesh bounding or typeDef height)
    const headHeight = enemy.typeDef.bodyHeight + enemy.typeDef.headSize + 0.3;
    this._enemyTop.copy(enemy.position);
    this._enemyTop.y += headHeight;

    // Project 3D → NDC
    this._screenPos.copy(this._enemyTop);
    this._screenPos.project(camera);

    // Check if behind camera
    if (this._screenPos.z > 1) {
      this.container.style.opacity = "0";
      return;
    }

    // NDC → screen pixels
    const x = (this._screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this._screenPos.y * 0.5 + 0.5) * window.innerHeight;

    this.container.style.left = `${x}px`;
    this.container.style.top = `${y}px`;
  }
}
