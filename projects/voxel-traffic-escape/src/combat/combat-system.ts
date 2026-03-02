/**
 * Core combat system — handles melee attacks, hit detection,
 * damage calculation, cooldowns, and weapon switching.
 *
 * The combat system reads the player's currently equipped weapon
 * from the inventory hotbar, performs arc-based hit detection
 * against all registered HitTargets, and applies damage + knockback.
 */

import * as THREE from "three";
import { type Inventory, type ItemStack } from "@/items/inventory";
import { getWeaponStats, getUnarmedStats, isWeapon, type WeaponStats } from "./weapon-stats";
import { type HitTarget, type HitResult } from "./hit-target";

export type CombatEventType = "attack_start" | "attack_hit" | "attack_miss" | "attack_end";

export interface CombatEvent {
  type: CombatEventType;
  weapon: WeaponStats;
  hits: HitResult[];
  /** Normalized attack progress (0 = start, 1 = finished) */
  progress: number;
}

export type CombatListener = (event: CombatEvent) => void;

export class CombatSystem {
  private inventory: Inventory;
  private targets: Map<string, HitTarget> = new Map();
  private listeners: CombatListener[] = [];

  // Attack state
  private _isAttacking = false;
  private _attackTimer = 0;
  private _attackDuration = 0;
  private _cooldownTimer = 0;
  private _currentWeapon: WeaponStats | null = null;
  private _hasHitThisSwing = false;

  // Player state (set by the game each frame)
  private _playerPos = new THREE.Vector3();
  private _playerFacing = new THREE.Vector3(0, 0, -1);

  // Reusable vectors (avoids per-frame allocations)
  private _tmpDir = new THREE.Vector3();
  private _tmpFacing = new THREE.Vector3();
  private _tmpKnockback = new THREE.Vector3();

  constructor(inventory: Inventory) {
    this.inventory = inventory;
  }

  // ── Getters ──

  get isAttacking(): boolean {
    return this._isAttacking;
  }

  get attackProgress(): number {
    if (!this._isAttacking || this._attackDuration <= 0) return 0;
    return Math.min(1, this._attackTimer / this._attackDuration);
  }

  get canAttack(): boolean {
    return !this._isAttacking && this._cooldownTimer <= 0;
  }

  get currentWeapon(): WeaponStats | null {
    return this._currentWeapon;
  }

  // ── Player state ──

  setPlayerPosition(pos: THREE.Vector3): void {
    this._playerPos.copy(pos);
  }

  setPlayerFacing(dir: THREE.Vector3): void {
    this._playerFacing.copy(dir).normalize();
  }

  // ── Target management ──

  registerTarget(target: HitTarget): void {
    this.targets.set(target.id, target);
  }

  unregisterTarget(id: string): void {
    this.targets.delete(id);
  }

  getTargets(): HitTarget[] {
    return [...this.targets.values()];
  }

  // ── Attack ──

  /**
   * Start a melee attack with the currently selected weapon.
   * Returns the weapon stats used, or null if can't attack.
   */
  startAttack(): WeaponStats | null {
    if (!this.canAttack) return null;

    const weapon = this.getActiveWeapon();

    // Only melee attacks use the swing system
    if (weapon.type !== "melee") return null;

    this._currentWeapon = weapon;
    this._isAttacking = true;
    this._hasHitThisSwing = false;

    // Attack duration = time for one swing
    this._attackDuration = 1 / weapon.attackSpeed;
    this._attackTimer = 0;

    this.emit({
      type: "attack_start",
      weapon,
      hits: [],
      progress: 0,
    });

    return weapon;
  }

  /**
   * Get the weapon stats for a ranged shot.
   * Does NOT consume ammo — caller handles inventory removal.
   */
  getRangedWeapon(): WeaponStats | null {
    const weapon = this.getActiveWeapon();
    if (weapon.type !== "ranged") return null;
    if (this._cooldownTimer > 0) return null;

    // Set cooldown
    this._cooldownTimer = 1 / weapon.attackSpeed;

    return weapon;
  }

  /**
   * Update per frame. Processes attack timing and hit detection.
   */
  update(dt: number): void {
    // Tick cooldown
    if (this._cooldownTimer > 0) {
      this._cooldownTimer = Math.max(0, this._cooldownTimer - dt);
    }

    if (!this._isAttacking || !this._currentWeapon) return;

    this._attackTimer += dt;
    const progress = this.attackProgress;

    // Hit detection happens at the mid-point of the swing (40-60%)
    if (!this._hasHitThisSwing && progress >= 0.35 && progress <= 0.65) {
      const hits = this.performMeleeHitDetection(this._currentWeapon);
      this._hasHitThisSwing = true;

      if (hits.length > 0) {
        this.emit({
          type: "attack_hit",
          weapon: this._currentWeapon,
          hits,
          progress,
        });
      } else {
        this.emit({
          type: "attack_miss",
          weapon: this._currentWeapon,
          hits: [],
          progress,
        });
      }
    }

    // Attack finished
    if (this._attackTimer >= this._attackDuration) {
      this._isAttacking = false;
      this._cooldownTimer = 0; // Melee cooldown is just the attack duration

      this.emit({
        type: "attack_end",
        weapon: this._currentWeapon,
        hits: [],
        progress: 1,
      });

      this._currentWeapon = null;
    }
  }

  // ── Events ──

  on(listener: CombatListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  // ── Private ──

  private getActiveWeapon(): WeaponStats {
    const selected: ItemStack | null = this.inventory.getSelectedItem();
    if (selected) {
      const stats = getWeaponStats(selected.itemId);
      if (stats) return stats;
    }
    return getUnarmedStats();
  }

  /**
   * Arc-based melee hit detection.
   * Checks all targets within range and within the swing arc.
   */
  private performMeleeHitDetection(weapon: WeaponStats): HitResult[] {
    const hits: HitResult[] = [];
    const halfArc = weapon.swingArc / 2;

    for (const target of this.targets.values()) {
      if (!target.isAlive) continue;

      // Direction from player to target
      this._tmpDir
        .subVectors(target.position, this._playerPos)
        .setY(0)  // Ignore Y for arc check
        .normalize();

      // Reuse _tmpFacing instead of cloning (clone was immediately overwritten anyway)
      this._tmpFacing.copy(this._playerFacing).setY(0).normalize();

      // Distance check (include target's hit radius)
      const dist = this._playerPos.distanceTo(target.position);
      if (dist > weapon.range + target.hitRadius) continue;

      // Angle check — is target within the swing arc?
      const angle = Math.acos(
        Math.max(-1, Math.min(1, this._tmpFacing.dot(this._tmpDir)))
      );
      if (angle > halfArc) continue;

      // Calculate damage
      const totalDamage = weapon.damage + weapon.bonusDamage;

      // Calculate knockback direction (away from player)
      this._tmpKnockback
        .subVectors(target.position, this._playerPos)
        .normalize()
        .multiplyScalar(weapon.knockback);
      // Add upward component
      this._tmpKnockback.y = Math.max(this._tmpKnockback.y, weapon.knockback * 0.3);

      const knockbackCopy = this._tmpKnockback.clone();
      const actualDamage = target.takeDamage(totalDamage, knockbackCopy);

      hits.push({
        target,
        damage: actualDamage,
        knockbackDir: knockbackCopy.normalize(),
        lethal: !target.isAlive,
      });
    }

    return hits;
  }

  private emit(event: CombatEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
