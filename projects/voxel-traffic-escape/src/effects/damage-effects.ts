/**
 * Visual and mechanical effects triggered by taking damage.
 *
 * - Screen shake (camera offset)
 * - Knockback velocity
 * - Invincibility flash (mesh blinking)
 * - Damage numbers (floating text) — future
 */

import * as THREE from "three";

export interface KnockbackData {
  /** Direction the knockback pushes (normalized) */
  direction: THREE.Vector3;
  /** Knockback force magnitude */
  force: number;
}

export interface ScreenShakeConfig {
  intensity: number;
  durationSec: number;
}

/**
 * Calculates knockback direction from a damage source position.
 * Always pushes away from the source and slightly upward.
 */
export function calculateKnockback(
  playerPos: THREE.Vector3,
  sourcePos: THREE.Vector3,
  force: number = 8
): KnockbackData {
  const dir = new THREE.Vector3()
    .subVectors(playerPos, sourcePos)
    .normalize();

  // Add upward component for a satisfying knock-up
  dir.y = Math.max(dir.y, 0.3);
  dir.normalize();

  return { direction: dir, force };
}

/**
 * Manages camera screen shake effect.
 * Apply shake, then call update() each frame.
 * The returned offset should be added to the camera position.
 */
export class ScreenShake {
  private _intensity: number = 0;
  private _remaining: number = 0;
  private _offset: THREE.Vector3 = new THREE.Vector3();

  get offset(): THREE.Vector3 {
    return this._offset;
  }

  get isShaking(): boolean {
    return this._remaining > 0;
  }

  /**
   * Trigger a screen shake.
   * If already shaking, uses the higher intensity.
   */
  shake(intensity: number, durationSec: number): void {
    this._intensity = Math.max(this._intensity, intensity);
    this._remaining = Math.max(this._remaining, durationSec);
  }

  /**
   * Update shake per frame. Returns the offset to apply to camera.
   */
  update(dt: number): THREE.Vector3 {
    if (this._remaining <= 0) {
      this._offset.set(0, 0, 0);
      this._intensity = 0;
      return this._offset;
    }

    this._remaining -= dt;

    // Decay intensity linearly toward end
    const progress = Math.max(0, this._remaining) /
      (this._remaining + dt);
    const currentIntensity = this._intensity * progress;

    // Random offset each frame
    this._offset.set(
      (Math.random() - 0.5) * 2 * currentIntensity,
      (Math.random() - 0.5) * 2 * currentIntensity,
      (Math.random() - 0.5) * 2 * currentIntensity
    );

    if (this._remaining <= 0) {
      this._offset.set(0, 0, 0);
      this._intensity = 0;
    }

    return this._offset;
  }
}

/**
 * Manages invincibility blinking effect on a mesh.
 * Makes the mesh blink (toggle visibility) while invincible.
 */
export class InvincibilityFlash {
  private _blinkRate: number = 10; // blinks per second
  private _timer: number = 0;
  private _visible: boolean = true;

  /**
   * Update the flash effect. Returns whether the mesh should be visible.
   */
  update(dt: number, isInvincible: boolean): boolean {
    if (!isInvincible) {
      this._timer = 0;
      this._visible = true;
      return true;
    }

    this._timer += dt * this._blinkRate;
    this._visible = Math.floor(this._timer) % 2 === 0;
    return this._visible;
  }

  get visible(): boolean {
    return this._visible;
  }
}
