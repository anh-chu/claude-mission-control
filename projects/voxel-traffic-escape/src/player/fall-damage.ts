/**
 * Fall damage calculator.
 *
 * Tracks the player's vertical velocity / fall distance and applies
 * damage when landing after a long fall.
 *
 * Design:
 * - Short falls (< safe threshold): no damage
 * - Medium falls: linear scaling damage
 * - Extreme falls: lethal
 * - Hard Hat utility item negates fall damage from debris (handled elsewhere),
 *   but doesn't prevent fall damage from heights
 */

import { HealthSystem } from "@/player/health";

/** Minimum fall distance (world units) before damage is applied */
const SAFE_FALL_DISTANCE = 4;

/** Fall distance at which damage becomes lethal */
const LETHAL_FALL_DISTANCE = 25;

/** Damage per unit of fall distance beyond the safe threshold */
const DAMAGE_PER_UNIT = 5;

/** Maximum fall damage (at lethal distance) */
const MAX_FALL_DAMAGE = 100;

export class FallDamageTracker {
  private _fallStartY: number | null = null;
  private _wasOnGround: boolean = true;
  private _health: HealthSystem;

  constructor(health: HealthSystem) {
    this._health = health;
  }

  /**
   * Call each frame with the player's current Y position and grounded state.
   * Returns the fall damage dealt (0 if none).
   */
  update(playerY: number, isOnGround: boolean): number {
    // Just left the ground — record the starting height
    if (this._wasOnGround && !isOnGround) {
      this._fallStartY = playerY;
    }

    // Just landed — calculate fall damage
    if (!this._wasOnGround && isOnGround && this._fallStartY !== null) {
      const fallDistance = this._fallStartY - playerY;
      this._fallStartY = null;
      this._wasOnGround = isOnGround;

      // Only apply damage for downward falls exceeding the safe threshold
      if (fallDistance > SAFE_FALL_DISTANCE) {
        const excessDistance = fallDistance - SAFE_FALL_DISTANCE;
        const damage = Math.min(
          Math.round(excessDistance * DAMAGE_PER_UNIT),
          MAX_FALL_DAMAGE
        );

        if (damage > 0) {
          this._health.takeDamage(damage, "fall");
          return damage;
        }
      }
    }

    // Continuously update fall start if still going higher while airborne
    // (e.g. ascending a jump — only count the peak)
    if (!isOnGround && this._fallStartY !== null && playerY > this._fallStartY) {
      this._fallStartY = playerY;
    }

    this._wasOnGround = isOnGround;
    return 0;
  }

  /** Reset tracker state (e.g. on respawn/teleport) */
  reset(): void {
    this._fallStartY = null;
    this._wasOnGround = true;
  }
}
