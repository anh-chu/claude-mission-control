/**
 * Core health system for the player.
 *
 * Manages HP pool, damage intake, healing, armor/shield reduction,
 * heart container upgrades, death, and respawn.
 *
 * Based on the GDD: 100 starting HP, max 150 (via 5 heart containers),
 * no passive regen, respawn at last checkpoint with 25% scrap penalty.
 */

import { type ShieldSystem } from "@/combat/shield-system";

export interface DamageEvent {
  /** Raw damage before armor/shield reduction */
  rawDamage: number;
  /** Actual damage dealt after reductions */
  actualDamage: number;
  /** HP remaining after damage */
  hpAfter: number;
  /** Whether this damage killed the player */
  lethal: boolean;
  /** Source identifier for analytics/effects */
  source: string;
}

export interface HealEvent {
  /** Amount healed */
  amount: number;
  /** HP after healing */
  hpAfter: number;
  /** Whether this is a heal-over-time tick */
  isTick: boolean;
  /** Source item name */
  source: string;
}

export type HealthEventType = "damage" | "heal" | "death" | "respawn" | "max-hp-change";

export type HealthListener = (
  type: HealthEventType,
  data: DamageEvent | HealEvent | null
) => void;

interface HealOverTime {
  totalAmount: number;
  remaining: number;
  durationSec: number;
  elapsedSec: number;
  tickIntervalSec: number;
  tickAccumulator: number;
  source: string;
}

export interface CheckpointData {
  position: { x: number; y: number; z: number };
  zone: string;
}

const BASE_MAX_HP = 100;
const HEART_CONTAINER_HP = 10;
const MAX_HEART_CONTAINERS = 5;
const INVINCIBILITY_DURATION_SEC = 1.5;

export class HealthSystem {
  private _hp: number;
  private _maxHp: number;
  private _heartContainers: number = 0;
  private _armorReduction: number = 0; // 0-1 fraction
  private _shieldReduction: number = 0; // 0-1 fraction
  private _isBlocking: boolean = false;
  private _isDead: boolean = false;
  private _invincibleTimer: number = 0;
  private _healsOverTime: HealOverTime[] = [];
  private _listeners: HealthListener[] = [];
  private _lastCheckpoint: CheckpointData | null = null;
  private _scrap: number = 0;
  private _shieldSystem: ShieldSystem | null = null;

  constructor() {
    this._maxHp = BASE_MAX_HP;
    this._hp = this._maxHp;
  }

  // --- Getters ---

  get hp(): number {
    return this._hp;
  }

  get maxHp(): number {
    return this._maxHp;
  }

  get hpFraction(): number {
    return this._maxHp > 0 ? this._hp / this._maxHp : 0;
  }

  get isDead(): boolean {
    return this._isDead;
  }

  get isInvincible(): boolean {
    return this._invincibleTimer > 0;
  }

  get heartContainers(): number {
    return this._heartContainers;
  }

  get armorReduction(): number {
    return this._armorReduction;
  }

  get shieldReduction(): number {
    return this._shieldReduction;
  }

  get isBlocking(): boolean {
    return this._isBlocking;
  }

  get scrap(): number {
    return this._scrap;
  }

  get lastCheckpoint(): CheckpointData | null {
    return this._lastCheckpoint;
  }

  // --- Setters for equipment ---

  setArmorReduction(reduction: number): void {
    this._armorReduction = Math.max(0, Math.min(1, reduction));
  }

  setShieldReduction(reduction: number): void {
    this._shieldReduction = Math.max(0, Math.min(1, reduction));
  }

  setBlocking(blocking: boolean): void {
    this._isBlocking = blocking;
  }

  setScrap(amount: number): void {
    this._scrap = Math.max(0, amount);
  }

  addScrap(amount: number): void {
    this._scrap = Math.max(0, this._scrap + amount);
  }

  /** Attach the shield system so takeDamage can filter through it. */
  setShieldSystem(shield: ShieldSystem): void {
    this._shieldSystem = shield;
  }

  // --- Core methods ---

  /**
   * Add a heart container. Increases max HP by 10 and heals the bonus.
   * Returns false if already at max containers.
   */
  addHeartContainer(): boolean {
    if (this._heartContainers >= MAX_HEART_CONTAINERS) return false;
    this._heartContainers++;
    this._maxHp = BASE_MAX_HP + this._heartContainers * HEART_CONTAINER_HP;
    this._hp = Math.min(this._hp + HEART_CONTAINER_HP, this._maxHp);
    this._emit("max-hp-change", null);
    return true;
  }

  /**
   * Apply damage to the player.
   * Damage is reduced by armor, and additionally by shield if blocking.
   * Formula: actual = raw * (1 - armor%) * (1 - block%) if blocking
   *          actual = raw * (1 - armor%) if not blocking
   */
  takeDamage(rawDamage: number, source: string = "unknown"): DamageEvent | null {
    if (this._isDead || this._invincibleTimer > 0) return null;
    if (rawDamage <= 0) return null;

    // Shield system filtering (block chance / active blocking)
    let filteredDamage = rawDamage;
    if (this._shieldSystem) {
      filteredDamage = this._shieldSystem.filterDamage(rawDamage);
      if (filteredDamage <= 0) {
        // Fully blocked — still trigger invincibility and emit a 0-damage event
        this._invincibleTimer = INVINCIBILITY_DURATION_SEC;
        const event: DamageEvent = {
          rawDamage,
          actualDamage: 0,
          hpAfter: this._hp,
          lethal: false,
          source,
        };
        this._emit("damage", event);
        return event;
      }
    }

    let actual = filteredDamage * (1 - this._armorReduction);
    if (this._isBlocking) {
      actual *= (1 - this._shieldReduction);
    }
    actual = Math.round(actual);
    actual = Math.max(1, actual); // always deal at least 1 damage

    this._hp = Math.max(0, this._hp - actual);
    this._invincibleTimer = INVINCIBILITY_DURATION_SEC;

    const event: DamageEvent = {
      rawDamage,
      actualDamage: actual,
      hpAfter: this._hp,
      lethal: this._hp <= 0,
      source,
    };

    this._emit("damage", event);

    if (this._hp <= 0) {
      this._die();
    }

    return event;
  }

  /**
   * Heal the player instantly.
   */
  heal(amount: number, source: string = "unknown"): HealEvent | null {
    if (this._isDead || amount <= 0) return null;
    if (this._hp >= this._maxHp) return null;

    const before = this._hp;
    this._hp = Math.min(this._hp + amount, this._maxHp);
    const healed = this._hp - before;

    const event: HealEvent = {
      amount: healed,
      hpAfter: this._hp,
      isTick: false,
      source,
    };

    this._emit("heal", event);
    return event;
  }

  /**
   * Start a heal-over-time effect (e.g. Waffle House Plate: 75 HP over 10s).
   */
  startHealOverTime(
    totalAmount: number,
    durationSec: number,
    source: string = "unknown"
  ): void {
    if (this._isDead) return;
    const tickInterval = 0.5; // heal tick every 0.5 seconds
    this._healsOverTime.push({
      totalAmount,
      remaining: totalAmount,
      durationSec,
      elapsedSec: 0,
      tickIntervalSec: tickInterval,
      tickAccumulator: 0,
      source,
    });
  }

  /**
   * Set the current checkpoint for respawn.
   */
  setCheckpoint(data: CheckpointData): void {
    this._lastCheckpoint = { ...data };
  }

  /**
   * Respawn the player. Restores full HP, applies scrap penalty.
   * Returns the checkpoint to respawn at (or null for default spawn).
   */
  respawn(): CheckpointData | null {
    if (!this._isDead) return null;

    // 25% scrap penalty
    const penalty = Math.floor(this._scrap * 0.25);
    this._scrap = Math.max(0, this._scrap - penalty);

    this._hp = this._maxHp;
    this._isDead = false;
    this._invincibleTimer = INVINCIBILITY_DURATION_SEC;
    this._healsOverTime = [];

    this._emit("respawn", null);

    return this._lastCheckpoint;
  }

  /**
   * Update per frame. Processes invincibility timer and heal-over-time effects.
   */
  update(dt: number): void {
    // Tick down invincibility
    if (this._invincibleTimer > 0) {
      this._invincibleTimer = Math.max(0, this._invincibleTimer - dt);
    }

    if (this._isDead) return;

    // Process heal-over-time effects
    for (let i = this._healsOverTime.length - 1; i >= 0; i--) {
      const hot = this._healsOverTime[i];
      hot.elapsedSec += dt;
      hot.tickAccumulator += dt;

      if (hot.tickAccumulator >= hot.tickIntervalSec) {
        hot.tickAccumulator -= hot.tickIntervalSec;

        // Calculate how much to heal this tick
        const ticksTotal = hot.durationSec / hot.tickIntervalSec;
        const amountPerTick = hot.totalAmount / ticksTotal;
        const healAmount = Math.min(amountPerTick, hot.remaining);

        if (healAmount > 0 && this._hp < this._maxHp) {
          const before = this._hp;
          this._hp = Math.min(this._hp + healAmount, this._maxHp);
          const healed = this._hp - before;
          hot.remaining -= healed;

          this._emit("heal", {
            amount: healed,
            hpAfter: this._hp,
            isTick: true,
            source: hot.source,
          });
        }
      }

      // Remove completed HOTs
      if (hot.elapsedSec >= hot.durationSec || hot.remaining <= 0) {
        this._healsOverTime.splice(i, 1);
      }
    }
  }

  /**
   * Full reset (new game).
   */
  reset(): void {
    this._heartContainers = 0;
    this._maxHp = BASE_MAX_HP;
    this._hp = this._maxHp;
    this._isDead = false;
    this._invincibleTimer = 0;
    this._healsOverTime = [];
    this._armorReduction = 0;
    this._shieldReduction = 0;
    this._isBlocking = false;
    this._lastCheckpoint = null;
    this._scrap = 0;
  }

  // --- Events ---

  on(listener: HealthListener): () => void {
    this._listeners.push(listener);
    return () => {
      const idx = this._listeners.indexOf(listener);
      if (idx !== -1) this._listeners.splice(idx, 1);
    };
  }

  // --- Private ---

  private _die(): void {
    this._isDead = true;
    this._healsOverTime = [];
    this._emit("death", null);
  }

  private _emit(
    type: HealthEventType,
    data: DamageEvent | HealEvent | null
  ): void {
    for (const listener of this._listeners) {
      listener(type, data);
    }
  }
}
