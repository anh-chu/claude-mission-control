/**
 * Shield blocking system — reads equipped shield from inventory,
 * calculates block chance, and filters incoming damage.
 *
 * Block chance lookup by shield item ID:
 *   car_door:            40%
 *   traffic_cone_shield: 30%
 *   sewer_grate:         50%
 *   dumpster_lid:        60%
 *   riot_shield:         75%
 *
 * Right mouse button (when not placing blocks) raises shield:
 *   - While held, block chance = 100% (guaranteed block from front)
 *   - Movement speed debuff is handled externally by player controller
 *
 * Integration: HealthSystem.takeDamage calls filterDamage() to reduce
 * or negate incoming damage before applying it.
 */

import { type Inventory } from "@/items/inventory";

/** Shield block chance by item ID. */
const SHIELD_BLOCK_CHANCE: Record<string, number> = {
  car_door: 0.40,
  traffic_cone_shield: 0.30,
  sewer_grate: 0.50,
  dumpster_lid: 0.60,
  riot_shield: 0.75,
};

export class ShieldSystem {
  private inventory: Inventory;
  private _isBlocking = false;

  constructor(inventory: Inventory) {
    this.inventory = inventory;
  }

  /** Whether the shield is actively raised (right-click held). */
  get isBlocking(): boolean {
    return this._isBlocking;
  }

  /**
   * Update shield state each frame.
   * @param _dt  Delta time (seconds)
   * @param isBlockInput  Whether the block input (right mouse) is held
   */
  update(_dt: number, isBlockInput: boolean): void {
    this._isBlocking = isBlockInput && this.hasShieldEquipped();
  }

  /**
   * Filter incoming damage through the shield system.
   * Returns the amount of damage that gets through (0 if fully blocked).
   *
   * If the player is actively blocking (right-click held), block chance = 100%.
   * Otherwise, roll against the equipped shield's passive block chance.
   */
  filterDamage(rawDamage: number): number {
    const blockChance = this.getBlockChance();
    if (blockChance <= 0) return rawDamage;

    if (this._isBlocking) {
      // Active blocking — always blocks
      return 0;
    }

    // Passive blocking — random roll
    if (Math.random() < blockChance) {
      return 0;
    }

    return rawDamage;
  }

  // ── Private ──

  private hasShieldEquipped(): boolean {
    return this.inventory.equipment.shield !== null;
  }

  private getBlockChance(): number {
    const shield = this.inventory.equipment.shield;
    if (!shield) return 0;

    return SHIELD_BLOCK_CHANCE[shield.itemId] ?? 0;
  }
}
