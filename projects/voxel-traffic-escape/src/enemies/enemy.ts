/**
 * Core Enemy class — AI state machine, pathfinding, aggro, combat, and visuals.
 *
 * Implements HitTarget so enemies can be damaged by the player's combat system.
 * Each enemy has a behavior type that determines how it patrols, detects, chases,
 * attacks, and retreats.
 */

import * as THREE from "three";
import { type HitTarget } from "@/combat/hit-target";
import { type EnemyTypeDef, type BehaviorType } from "./enemy-types";
import { findPath, canWalkDirectly, type PathNode, type GetBlockFn, type IsSolidFn } from "./pathfinding";
import { type HealthSystem } from "@/player/health";
import { playEnemyAttack, playEnemyRangedAttack } from "@/audio/sfx";
import { VOXEL_SIZE } from "@/world/chunk";

// ── AI Constants ─────────────────────────────────────────────────────

const AGGRO_MEMORY_SEC = 10;
const PATH_RECALC_SEC = 0.5;
const STUCK_TIMEOUT_SEC = 3;
const PATROL_RADIUS_BLOCKS = 5;
const HIT_FLASH_DURATION = 0.15;
const DEATH_SHRINK_DURATION = 0.5;
const KNOCKBACK_FRICTION = 8;
const BASE_MOVE_SPEED = 5.0; // m/s (player walk speed)
const VERTICAL_AWARENESS = 2.0; // meters (4 blocks × 0.5m)

// ── AI State ─────────────────────────────────────────────────────────

export type EnemyState =
  | "idle"
  | "patrol"
  | "chase"
  | "position"   // ranged: move to optimal range
  | "attack"
  | "retreat"
  | "stagger"
  | "return"      // returning to patrol area after de-aggro
  | "dead";

// ── Enemy Class ──────────────────────────────────────────────────────

let nextEnemyId = 0;

export class Enemy implements HitTarget {
  readonly id: string;
  readonly typeDef: EnemyTypeDef;
  readonly mesh: THREE.Group;
  readonly hitRadius: number;

  // HitTarget state
  private _hp: number;
  private _maxHp: number;
  private _isAlive = true;

  // Position & physics
  private _position: THREE.Vector3;
  private _spawnPos: THREE.Vector3;
  private _velocity = new THREE.Vector3();
  private _facingAngle = 0; // radians on XZ plane

  // AI state machine
  private _state: EnemyState = "idle";
  private _stateTimer = 0;

  // Aggro
  private _aggroTarget: THREE.Vector3 | null = null;
  private _hasLineOfSight = false;
  private _lastSeenTimer = 0;     // time since last LOS to player
  private _aggroMemoryTimer = 0;  // countdown from AGGRO_MEMORY_SEC

  // Pathfinding
  private _path: PathNode[] = [];
  private _pathIndex = 0;
  private _pathRecalcTimer = 0;
  private _stuckTimer = 0;
  private _lastStuckPos = new THREE.Vector3();

  // Attack
  private _attackCooldown = 0;
  private _attackWindup = 0;
  private _isAttacking = false;

  // Patrol
  private _patrolTarget: THREE.Vector3 | null = null;
  private _patrolWaitTimer = 0;

  // Visuals
  private _bodyMesh: THREE.Mesh;
  private _headMesh: THREE.Mesh | null = null;
  private _originalColor: THREE.Color;
  private _hitFlashTimer = 0;
  private _deathTimer = 0;

  // World query callbacks (set by EnemyManager)
  getBlock: GetBlockFn = () => 0;
  isSolidFn: IsSolidFn = () => false;

  constructor(typeDef: EnemyTypeDef, position: THREE.Vector3) {
    this.id = `enemy_${typeDef.id}_${nextEnemyId++}`;
    this.typeDef = typeDef;
    this._hp = typeDef.hp;
    this._maxHp = typeDef.hp;
    this._position = position.clone();
    this._spawnPos = position.clone();
    this.hitRadius = typeDef.bodyWidth / 2 + 0.2;
    this._originalColor = new THREE.Color(typeDef.color);

    // Build mesh — dispatch to per-behavior visual builder
    this.mesh = new THREE.Group();
    // _bodyMesh will be set by buildVisuals; initialize to a placeholder
    this._bodyMesh = null!;
    this.buildVisuals(typeDef);
    this.mesh.position.copy(position);

    // Randomize initial facing
    this._facingAngle = Math.random() * Math.PI * 2;
    this.mesh.rotation.y = this._facingAngle;
  }

  // ── HitTarget interface ────────────────────────────────────────────

  get position(): THREE.Vector3 {
    return this._position;
  }

  get hp(): number {
    return this._hp;
  }

  set hp(value: number) {
    this._hp = value;
  }

  get maxHp(): number {
    return this._maxHp;
  }

  set maxHp(value: number) {
    this._maxHp = value;
  }

  get isAlive(): boolean {
    return this._isAlive;
  }

  get state(): EnemyState {
    return this._state;
  }

  takeDamage(damage: number, knockback: THREE.Vector3 | null): number {
    if (!this._isAlive) return 0;

    const actualDamage = Math.min(damage, this._hp);
    this._hp -= actualDamage;

    // Apply knockback
    if (knockback) {
      this._velocity.add(knockback);
    }

    // Hit flash
    this._hitFlashTimer = HIT_FLASH_DURATION;
    this.setFlashColor(true);

    // Stagger (if not immune)
    if (this.typeDef.canStagger && this._state !== "dead") {
      this._state = "stagger";
      this._stateTimer = this.typeDef.staggerDuration;
      this._isAttacking = false;
    }

    // Death
    if (this._hp <= 0) {
      this._isAlive = false;
      this._state = "dead";
      this._deathTimer = DEATH_SHRINK_DURATION;
      this._isAttacking = false;
    }

    return actualDamage;
  }

  // ── Main Update ────────────────────────────────────────────────────

  update(
    dt: number,
    playerPos: THREE.Vector3,
    playerHealth: HealthSystem
  ): void {
    // Update timers
    this._attackCooldown = Math.max(0, this._attackCooldown - dt);
    this._pathRecalcTimer = Math.max(0, this._pathRecalcTimer - dt);

    // Hit flash
    if (this._hitFlashTimer > 0) {
      this._hitFlashTimer -= dt;
      if (this._hitFlashTimer <= 0) {
        this.setFlashColor(false);
      }
    }

    // Knockback physics
    this.updateKnockback(dt);

    // State machine
    switch (this._state) {
      case "idle":
        this.updateIdle(dt, playerPos);
        break;
      case "patrol":
        this.updatePatrol(dt, playerPos);
        break;
      case "chase":
        this.updateChase(dt, playerPos, playerHealth);
        break;
      case "position":
        this.updatePosition(dt, playerPos, playerHealth);
        break;
      case "attack":
        this.updateAttack(dt, playerPos, playerHealth);
        break;
      case "retreat":
        this.updateRetreat(dt, playerPos);
        break;
      case "stagger":
        this.updateStagger(dt);
        break;
      case "return":
        this.updateReturn(dt, playerPos);
        break;
      case "dead":
        this.updateDead(dt);
        break;
    }

    // Sync mesh
    this.mesh.position.copy(this._position);
    this.mesh.rotation.y = this._facingAngle;
  }

  // ── Aggro Detection ────────────────────────────────────────────────

  private checkAggro(playerPos: THREE.Vector3): boolean {
    const dx = playerPos.x - this._position.x;
    const dy = playerPos.y - this._position.y;
    const dz = playerPos.z - this._position.z;
    const distXZ = Math.sqrt(dx * dx + dz * dz);

    // Vertical awareness check
    if (Math.abs(dy) > VERTICAL_AWARENESS) return false;

    // Range check
    if (distXZ > this.typeDef.aggroRange) return false;

    // Detection type
    switch (this.typeDef.detection) {
      case "proximity":
      case "vibration":
        // Always detect within range (ignores walls)
        return true;

      case "line_of_sight":
      case "sound":
        // Check LOS using voxel raycast
        return this.checkLineOfSight(playerPos);
    }
  }

  private checkDeaggro(playerPos: THREE.Vector3): boolean {
    const dx = playerPos.x - this._position.x;
    const dz = playerPos.z - this._position.z;
    const distXZ = Math.sqrt(dx * dx + dz * dz);
    return distXZ > this.typeDef.deaggroRange;
  }

  private checkLineOfSight(target: THREE.Vector3): boolean {
    const dx = target.x - this._position.x;
    const dy = (target.y + 0.8) - (this._position.y + this.typeDef.bodyHeight * 0.5);
    const dz = target.z - this._position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < 0.1) return true;

    const dirX = dx / dist;
    const dirY = dy / dist;
    const dirZ = dz / dist;

    // Step along ray checking for solid blocks
    const stepSize = VOXEL_SIZE;
    const steps = Math.ceil(dist / stepSize);

    for (let i = 1; i < steps; i++) {
      const t = (i * stepSize) / dist;
      if (t > 1) break;

      const wx = this._position.x + dx * t;
      const wy = (this._position.y + this.typeDef.bodyHeight * 0.5) + dy * t;
      const wz = this._position.z + dz * t;

      if (this.isSolidFn(this.getBlock(wx, wy, wz))) {
        return false;
      }
    }

    return true;
  }

  // ── State: Idle ────────────────────────────────────────────────────

  private updateIdle(dt: number, playerPos: THREE.Vector3): void {
    // Wait briefly then start patrolling
    this._stateTimer += dt;
    if (this._stateTimer > 1 + Math.random() * 2) {
      this._state = "patrol";
      this._stateTimer = 0;
      this.pickPatrolTarget();
    }

    // Check for aggro
    if (this.checkAggro(playerPos)) {
      this.enterAggroState(playerPos);
    }
  }

  // ── State: Patrol ──────────────────────────────────────────────────

  private updatePatrol(dt: number, playerPos: THREE.Vector3): void {
    // Check for aggro first
    if (this.checkAggro(playerPos)) {
      this.enterAggroState(playerPos);
      return;
    }

    // Waiting at patrol point
    if (this._patrolWaitTimer > 0) {
      this._patrolWaitTimer -= dt;
      if (this._patrolWaitTimer <= 0) {
        this.pickPatrolTarget();
      }
      return;
    }

    // Move toward patrol target
    if (this._patrolTarget) {
      const reached = this.moveToward(this._patrolTarget, dt, 0.5);
      if (reached) {
        this._patrolWaitTimer = 1 + Math.random() * 3;
        this._patrolTarget = null;
      }
    } else {
      this.pickPatrolTarget();
    }
  }

  private pickPatrolTarget(): void {
    const radius = PATROL_RADIUS_BLOCKS * VOXEL_SIZE;
    const angle = Math.random() * Math.PI * 2;
    this._patrolTarget = new THREE.Vector3(
      this._spawnPos.x + Math.cos(angle) * radius,
      this._position.y,
      this._spawnPos.z + Math.sin(angle) * radius
    );
  }

  // ── State: Chase (melee enemies) ───────────────────────────────────

  private updateChase(dt: number, playerPos: THREE.Vector3, health: HealthSystem): void {
    this._aggroTarget = playerPos;
    this.faceTarget(playerPos);

    // Check de-aggro
    if (this.checkDeaggro(playerPos)) {
      this._aggroMemoryTimer -= dt;
      if (this._aggroMemoryTimer <= 0) {
        this._state = "return";
        this._path = [];
        return;
      }
    } else {
      this._aggroMemoryTimer = AGGRO_MEMORY_SEC;
    }

    // LOS tracking
    this._hasLineOfSight = this.checkLineOfSight(playerPos);
    if (this._hasLineOfSight) {
      this._lastSeenTimer = 0;
    } else {
      this._lastSeenTimer += dt;
      if (this._lastSeenTimer > AGGRO_MEMORY_SEC) {
        this._state = "return";
        this._path = [];
        return;
      }
    }

    // Check if in attack range
    const dist = this.distToXZ(playerPos);
    if (dist <= this.typeDef.attackRange && this._attackCooldown <= 0) {
      this._state = "attack";
      this._isAttacking = true;
      this._attackWindup = 0.3; // 0.3s windup telegraph
      this._stateTimer = 0;
      return;
    }

    // Move toward player
    this.navigateToward(playerPos, dt);
  }

  // ── State: Position (ranged enemies) ───────────────────────────────

  private updatePosition(dt: number, playerPos: THREE.Vector3, health: HealthSystem): void {
    this._aggroTarget = playerPos;
    this.faceTarget(playerPos);

    // Check de-aggro
    if (this.checkDeaggro(playerPos)) {
      this._aggroMemoryTimer -= dt;
      if (this._aggroMemoryTimer <= 0) {
        this._state = "return";
        this._path = [];
        return;
      }
    } else {
      this._aggroMemoryTimer = AGGRO_MEMORY_SEC;
    }

    const dist = this.distToXZ(playerPos);
    const optimalRange = this.typeDef.attackRange * 0.7;
    const tooClose = dist < optimalRange * 0.5;

    // If player closes in too much, retreat
    if (tooClose) {
      this._state = "retreat";
      this._stateTimer = 0;
      return;
    }

    // If in attack range and can attack, fire
    if (dist <= this.typeDef.attackRange && this._attackCooldown <= 0) {
      if (this.checkLineOfSight(playerPos)) {
        this._state = "attack";
        this._isAttacking = true;
        this._attackWindup = 0.5; // ranged windup is longer (more telegraphed)
        this._stateTimer = 0;
        return;
      }
    }

    // Move to optimal range
    if (dist > this.typeDef.attackRange) {
      this.navigateToward(playerPos, dt);
    } else if (dist < optimalRange * 0.8) {
      // Too close — back up
      this.moveAwayFrom(playerPos, dt);
    }
  }

  // ── State: Attack ──────────────────────────────────────────────────

  private updateAttack(dt: number, playerPos: THREE.Vector3, health: HealthSystem): void {
    this.faceTarget(playerPos);

    // Windup phase
    if (this._attackWindup > 0) {
      this._attackWindup -= dt;
      return;
    }

    // Execute attack
    const dist = this.distToXZ(playerPos);
    const isRanged = this.typeDef.projectileSpeed > 0;

    if (isRanged) {
      // Ranged attack — deal damage if player is within range and LOS
      playEnemyRangedAttack();
      if (dist <= this.typeDef.attackRange && this.checkLineOfSight(playerPos)) {
        health.takeDamage(this.typeDef.damage, this.typeDef.name);
      }
    } else {
      // Melee attack — deal damage if player is within melee range
      playEnemyAttack();
      if (dist <= this.typeDef.attackRange) {
        health.takeDamage(this.typeDef.damage, this.typeDef.name);
      }
    }

    // Set cooldown and return to chase/position
    this._attackCooldown = 1 / this.typeDef.attackSpeed;
    this._isAttacking = false;

    if (isRanged) {
      this._state = "position";
    } else {
      this._state = "chase";
    }
  }

  // ── State: Retreat ─────────────────────────────────────────────────

  private updateRetreat(dt: number, playerPos: THREE.Vector3): void {
    this.faceTarget(playerPos);
    this._stateTimer += dt;

    // Back up for 1-2 seconds
    this.moveAwayFrom(playerPos, dt);

    const dist = this.distToXZ(playerPos);
    const isRanged = this.typeDef.projectileSpeed > 0;

    if (this._stateTimer > 1.5 || dist > this.typeDef.attackRange * 0.8) {
      this._state = isRanged ? "position" : "chase";
      this._stateTimer = 0;
    }
  }

  // ── State: Stagger ─────────────────────────────────────────────────

  private updateStagger(dt: number): void {
    this._stateTimer -= dt;
    if (this._stateTimer <= 0) {
      // Resume previous behavior
      if (this._aggroTarget) {
        const isRanged = this.typeDef.projectileSpeed > 0;
        this._state = isRanged ? "position" : "chase";
      } else {
        this._state = "patrol";
      }
      this._stateTimer = 0;
    }
  }

  // ── State: Return (back to patrol area) ────────────────────────────

  private updateReturn(dt: number, playerPos: THREE.Vector3): void {
    // Check for re-aggro
    if (this.checkAggro(playerPos)) {
      this.enterAggroState(playerPos);
      return;
    }

    // Move toward spawn point
    const reached = this.moveToward(this._spawnPos, dt, 1.0);
    if (reached) {
      this._state = "idle";
      this._stateTimer = 0;
      this._aggroTarget = null;
      this._aggroMemoryTimer = 0;
    }
  }

  // ── State: Dead ────────────────────────────────────────────────────

  private updateDead(dt: number): void {
    if (this._deathTimer > 0) {
      this._deathTimer -= dt;
      const progress = 1 - this._deathTimer / DEATH_SHRINK_DURATION;

      // Shrink and sink
      const scale = Math.max(0.01, 1 - progress);
      this.mesh.scale.set(scale, scale, scale);
      this.mesh.position.y = this._position.y - progress * 0.5;
      this.mesh.rotation.y += dt * 8;

      if (this._deathTimer <= 0) {
        this.mesh.visible = false;
      }
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────

  private navigateToward(target: THREE.Vector3, dt: number): void {
    // Try direct movement first (cheaper)
    if (canWalkDirectly(
      this._position.x, this._position.y, this._position.z,
      target.x, target.z,
      this.getBlock, this.isSolidFn
    )) {
      this.moveToward(target, dt, 0.5);
      this._path = [];
      return;
    }

    // Need pathfinding
    if (this._pathRecalcTimer <= 0 || this._path.length === 0) {
      this.recalculatePath(target);
      this._pathRecalcTimer = PATH_RECALC_SEC;
    }

    // Follow path
    if (this._path.length > 0 && this._pathIndex < this._path.length) {
      const waypoint = this._path[this._pathIndex];
      const wpTarget = new THREE.Vector3(waypoint.x, waypoint.y, waypoint.z);
      const reached = this.moveToward(wpTarget, dt, VOXEL_SIZE);

      if (reached) {
        this._pathIndex++;
        if (this._pathIndex >= this._path.length) {
          this._path = [];
          this._pathIndex = 0;
        }
      }
    }

    // Stuck detection
    this.checkStuck(dt);
  }

  private recalculatePath(target: THREE.Vector3): void {
    const result = findPath(
      this._position.x, this._position.y, this._position.z,
      target.x, target.y, target.z,
      this.getBlock, this.isSolidFn,
      200
    );

    if (result) {
      this._path = result;
      this._pathIndex = 0;
      this._stuckTimer = 0;
    }
  }

  private checkStuck(dt: number): void {
    const moved = this._position.distanceTo(this._lastStuckPos);
    if (moved < 0.1) {
      this._stuckTimer += dt;
      if (this._stuckTimer > STUCK_TIMEOUT_SEC) {
        // Stuck — clear path and try a new one
        this._path = [];
        this._pathIndex = 0;
        this._stuckTimer = 0;
      }
    } else {
      this._stuckTimer = 0;
      this._lastStuckPos.copy(this._position);
    }
  }

  // ── Movement Helpers ───────────────────────────────────────────────

  private moveToward(target: THREE.Vector3, dt: number, arrivalDist: number): boolean {
    const dx = target.x - this._position.x;
    const dz = target.z - this._position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist <= arrivalDist) return true;

    const speed = BASE_MOVE_SPEED * this.typeDef.moveSpeed;
    const move = Math.min(speed * dt, dist);

    this._position.x += (dx / dist) * move;
    this._position.z += (dz / dist) * move;

    // Simple gravity: keep on ground
    this.applyGravity(dt);

    // Face movement direction
    this._facingAngle = Math.atan2(dx, dz);

    return false;
  }

  private moveAwayFrom(target: THREE.Vector3, dt: number): void {
    const dx = this._position.x - target.x;
    const dz = this._position.z - target.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.1) return;

    const speed = BASE_MOVE_SPEED * this.typeDef.moveSpeed * 0.6; // retreat is slower
    this._position.x += (dx / dist) * speed * dt;
    this._position.z += (dz / dist) * speed * dt;

    this.applyGravity(dt);
  }

  private applyGravity(dt: number): void {
    // Check if there's ground below
    const feetY = this._position.y;
    const vy = Math.floor(feetY / VOXEL_SIZE);
    const vx = Math.floor(this._position.x / VOXEL_SIZE);
    const vz = Math.floor(this._position.z / VOXEL_SIZE);

    // Check current position — if inside solid, push up
    if (this.isSolidFn(this.getBlock(vx * VOXEL_SIZE, vy * VOXEL_SIZE, vz * VOXEL_SIZE))) {
      this._position.y = (vy + 1) * VOXEL_SIZE;
      return;
    }

    // Check below — if air, fall
    const belowId = this.getBlock(vx * VOXEL_SIZE, (vy - 1) * VOXEL_SIZE, vz * VOXEL_SIZE);
    if (!this.isSolidFn(belowId)) {
      // Fall
      this._position.y -= 10 * dt; // Simple fall speed

      // Check 2 blocks below for floor
      const belowBelowId = this.getBlock(vx * VOXEL_SIZE, (vy - 2) * VOXEL_SIZE, vz * VOXEL_SIZE);
      if (this.isSolidFn(belowBelowId)) {
        this._position.y = Math.max(this._position.y, (vy - 1) * VOXEL_SIZE);
      }
    } else {
      // Snap to floor
      const floorY = vy * VOXEL_SIZE;
      if (this._position.y < floorY) {
        this._position.y = floorY;
      }
    }
  }

  private faceTarget(target: THREE.Vector3): void {
    const dx = target.x - this._position.x;
    const dz = target.z - this._position.z;
    if (dx * dx + dz * dz > 0.01) {
      this._facingAngle = Math.atan2(dx, dz);
    }
  }

  // ── Aggro Helpers ──────────────────────────────────────────────────

  private enterAggroState(playerPos: THREE.Vector3): void {
    this._aggroTarget = playerPos;
    this._aggroMemoryTimer = AGGRO_MEMORY_SEC;
    this._lastSeenTimer = 0;

    const isRanged = this.typeDef.projectileSpeed > 0;
    this._state = isRanged ? "position" : "chase";
    this._path = [];
    this._pathIndex = 0;
    this._stateTimer = 0;
  }

  private distToXZ(target: THREE.Vector3): number {
    const dx = target.x - this._position.x;
    const dz = target.z - this._position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  // ── Knockback Physics ──────────────────────────────────────────────

  private updateKnockback(dt: number): void {
    if (this._velocity.lengthSq() < 0.01) return;

    this._position.x += this._velocity.x * dt;
    this._position.y += this._velocity.y * dt;
    this._position.z += this._velocity.z * dt;
    this._position.y = Math.max(0, this._position.y);

    // Friction
    const friction = Math.exp(-KNOCKBACK_FRICTION * dt);
    this._velocity.multiplyScalar(friction);

    // Gravity on knockback
    if (this._position.y > 0) {
      this._velocity.y -= 20 * dt;
    } else {
      this._velocity.y = 0;
    }
  }

  // ── Visuals ────────────────────────────────────────────────────────

  /** Shared material factory */
  private makeMat(color: THREE.Color | string): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });
  }

  /** Convenience: add a box part to the mesh group */
  private addPart(
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    color?: THREE.Color | string,
    shadows = true,
  ): THREE.Mesh {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = this.makeMat(color ?? this._originalColor);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadows;
    m.receiveShadow = shadows;
    this.mesh.add(m);
    return m;
  }

  /** Add glowing eyes to the mesh */
  private addEyes(def: EnemyTypeDef, eyeY: number, eyeZ: number): void {
    const size = Math.max(0.06, def.headSize * 0.2);
    const spacing = def.headSize * 0.25 || 0.12;
    const eyeGeo = new THREE.BoxGeometry(size, size, size);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: def.eyeColor,
      emissive: new THREE.Color(def.eyeColor),
      emissiveIntensity: 0.5,
      flatShading: true,
    });
    const l = new THREE.Mesh(eyeGeo, eyeMat);
    l.position.set(-spacing, eyeY, eyeZ);
    this.mesh.add(l);
    const r = new THREE.Mesh(eyeGeo, eyeMat);
    r.position.set(spacing, eyeY, eyeZ);
    this.mesh.add(r);
  }

  /** Dispatch to per-behavior visual builder */
  private buildVisuals(def: EnemyTypeDef): void {
    switch (def.behavior) {
      case "chase": this.buildChaseVisual(def); break;
      case "ranged": this.buildRangedVisual(def); break;
      case "charge": this.buildChargeVisual(def); break;
      case "area_denial": this.buildAreaDenialVisual(def); break;
      case "swarm": this.buildSwarmVisual(def); break;
      case "ambush": this.buildAmbushVisual(def); break;
      case "burrow": this.buildBurrowVisual(def); break;
      case "hit_and_run": this.buildSpiderVisual(def); break;
      case "tank": this.buildTankVisual(def); break;
      case "flanking": this.buildDogVisual(def); break;
      case "tank_shield": this.buildShieldVisual(def); break;
      default: this.buildDefaultVisual(def); break;
    }
  }

  /** Chase (Road Rager): Humanoid — body + head + two forward arms */
  private buildChaseVisual(def: EnemyTypeDef): void {
    const bw = def.bodyWidth, bh = def.bodyHeight;
    // Torso
    this._bodyMesh = this.addPart(bw, bh, bw * 0.6, 0, bh / 2, 0);
    // Head
    const hs = def.headSize;
    this._headMesh = this.addPart(hs, hs, hs, 0, bh + hs / 2 + 0.05, 0);
    // Arms — reaching forward aggressively
    const armW = bw * 0.2, armH = bh * 0.6;
    this.addPart(armW, armH, armW, -bw / 2 - armW / 2, bh * 0.5, bw * 0.2);
    this.addPart(armW, armH, armW, bw / 2 + armW / 2, bh * 0.5, bw * 0.2);
    // Eyes
    this.addEyes(def, bh + hs * 0.55, hs * 0.4);
  }

  /** Ranged (Coffee Tosser / Crane Drone): Body + one raised throwing arm */
  private buildRangedVisual(def: EnemyTypeDef): void {
    const bw = def.bodyWidth, bh = def.bodyHeight;
    if (def.headSize === 0) {
      // Crane Drone: flat body + rotor blades
      this._bodyMesh = this.addPart(bw * 1.5, bh, bw, 0, bh / 2, 0);
      // Rotor arms (X shape)
      const darker = new THREE.Color(def.color).multiplyScalar(0.6);
      this.addPart(bw * 2, 0.06, 0.08, 0, bh + 0.05, 0, darker);
      this.addPart(0.08, 0.06, bw * 2, 0, bh + 0.05, 0, darker);
      // Red light underneath
      this.addEyes(def, bh * 0.2, bw * 0.3);
      return;
    }
    // Coffee Tosser: humanoid with raised arm
    this._bodyMesh = this.addPart(bw, bh, bw * 0.6, 0, bh / 2, 0);
    const hs = def.headSize;
    this._headMesh = this.addPart(hs, hs, hs, 0, bh + hs / 2 + 0.05, 0);
    // Right arm raised above head (throwing pose)
    const armW = bw * 0.2;
    this.addPart(armW, bh * 0.4, armW, bw / 2 + armW / 2, bh + 0.2, 0);
    // Left arm at side
    this.addPart(armW, bh * 0.5, armW, -bw / 2 - armW / 2, bh * 0.4, 0);
    this.addEyes(def, bh + hs * 0.55, hs * 0.4);
  }

  /** Charge (Bumper Brawler): Wide, low, armored body like a bumper */
  private buildChargeVisual(def: EnemyTypeDef): void {
    const bw = def.bodyWidth, bh = def.bodyHeight;
    // Wide flat body
    this._bodyMesh = this.addPart(bw * 1.3, bh * 0.6, bw * 0.8, 0, bh * 0.3, 0);
    // Armored head plate — lower, wider
    const hs = def.headSize;
    this._headMesh = this.addPart(bw * 1.1, hs * 0.7, hs, 0, bh * 0.6 + hs * 0.35, bw * 0.15);
    // Shoulder spikes / horn bumpers
    const darker = new THREE.Color(def.color).multiplyScalar(0.7);
    this.addPart(0.15, 0.3, 0.15, -bw * 0.6, bh * 0.6, bw * 0.3, darker);
    this.addPart(0.15, 0.3, 0.15, bw * 0.6, bh * 0.6, bw * 0.3, darker);
    this.addEyes(def, bh * 0.6 + hs * 0.4, hs * 0.45);
  }

  /** Area Denial (Horn Honker): Squat body + speaker/horn on top */
  private buildAreaDenialVisual(def: EnemyTypeDef): void {
    const bw = def.bodyWidth, bh = def.bodyHeight;
    // Squat body
    this._bodyMesh = this.addPart(bw, bh, bw, 0, bh / 2, 0);
    // Head
    const hs = def.headSize;
    this._headMesh = this.addPart(hs, hs, hs, 0, bh + hs / 2 + 0.05, 0);
    // Horn/speaker cone on top — wider at top
    const hornColor = new THREE.Color(def.eyeColor);
    this.addPart(hs * 0.8, 0.3, hs * 0.8, 0, bh + hs + 0.2, 0, hornColor);
    this.addPart(hs * 0.4, 0.15, hs * 0.4, 0, bh + hs + 0.45, 0, hornColor);
    this.addEyes(def, bh + hs * 0.55, hs * 0.4);
  }

  /** Swarm (Sewer Rat): Low elongated body + pointed nose + thin tail */
  private buildSwarmVisual(def: EnemyTypeDef): void {
    const bw = def.bodyWidth, bh = def.bodyHeight;
    // Elongated body (longer on Z axis)
    this._bodyMesh = this.addPart(bw, bh, bw * 1.8, 0, bh / 2, 0);
    // Pointed nose
    const noseColor = new THREE.Color(def.color).multiplyScalar(1.2);
    this.addPart(bw * 0.3, bh * 0.5, bw * 0.5, 0, bh * 0.35, bw * 1.1, noseColor);
    // Thin tail
    const darker = new THREE.Color(def.color).multiplyScalar(0.6);
    this.addPart(bw * 0.1, bw * 0.1, bw * 1.0, 0, bh * 0.4, -bw * 1.2, darker);
    // Tiny ears
    this.addPart(bw * 0.15, bw * 0.2, bw * 0.1, -bw * 0.25, bh + 0.02, bw * 0.3, noseColor);
    this.addPart(bw * 0.15, bw * 0.2, bw * 0.1, bw * 0.25, bh + 0.02, bw * 0.3, noseColor);
    // Beady eyes
    this.addEyes(def, bh * 0.55, bw * 0.85);
  }

  /** Ambush (Sewer Gator): Very wide, flat body + long jaw */
  private buildAmbushVisual(def: EnemyTypeDef): void {
    const bw = def.bodyWidth, bh = def.bodyHeight;
    // Wide flat body
    this._bodyMesh = this.addPart(bw * 1.2, bh, bw * 1.5, 0, bh / 2, 0);
    // Long jaw extending forward
    const jawColor = new THREE.Color(def.color).multiplyScalar(0.8);
    this.addPart(bw * 0.7, bh * 0.4, bw * 0.9, 0, bh * 0.3, bw * 1.0, jawColor);
    // Upper jaw / snout (smaller, on top)
    this.addPart(bw * 0.6, bh * 0.25, bw * 0.7, 0, bh * 0.6, bw * 0.85);
    // Teeth ridge
    this.addPart(bw * 0.5, 0.05, 0.05, 0, bh * 0.45, bw * 1.4, "#FFFFF0");
    // Bumpy spine ridges
    const spineColor = new THREE.Color(def.color).multiplyScalar(0.65);
    for (let i = 0; i < 4; i++) {
      this.addPart(0.08, 0.1, 0.08, 0, bh + 0.05, -bw * 0.3 + i * bw * 0.35, spineColor);
    }
    // Eyes on top of head
    this.addEyes(def, bh * 0.75, bw * 0.5);
  }

  /** Burrow (Mole Bot): Cylindrical body (octagonal) + drill nose */
  private buildBurrowVisual(def: EnemyTypeDef): void {
    const bw = def.bodyWidth, bh = def.bodyHeight;
    // Main body — approximated as a slightly rotated box
    this._bodyMesh = this.addPart(bw, bh, bw * 0.8, 0, bh / 2, 0);
    // Drill nose cone — tapered (stack of shrinking boxes)
    const drillColor = new THREE.Color(def.color).multiplyScalar(0.6);
    this.addPart(bw * 0.5, bh * 0.5, bw * 0.4, 0, bh * 0.4, bw * 0.5, drillColor);
    this.addPart(bw * 0.3, bh * 0.3, bw * 0.3, 0, bh * 0.35, bw * 0.75, drillColor);
    this.addPart(bw * 0.15, bh * 0.15, bw * 0.2, 0, bh * 0.3, bw * 0.95, "#4A4A4A");
    // Digging claws on sides
    this.addPart(bw * 0.3, 0.08, bw * 0.3, -bw * 0.55, bh * 0.2, bw * 0.1, drillColor);
    this.addPart(bw * 0.3, 0.08, bw * 0.3, bw * 0.55, bh * 0.2, bw * 0.1, drillColor);
    // Visor / eyes
    this.addEyes(def, bh * 0.6, bw * 0.35);
  }

  /** Hit & Run (Drain Spider): Flat body + 4 diagonal legs */
  private buildSpiderVisual(def: EnemyTypeDef): void {
    const bw = def.bodyWidth, bh = def.bodyHeight;
    // Flat round-ish body
    this._bodyMesh = this.addPart(bw, bh, bw, 0, bh / 2 + 0.1, 0);
    // 4 legs extending diagonally
    const legW = bw * 0.1, legH = bh * 0.8, legD = bw * 0.1;
    const legSpread = bw * 0.7;
    const legY = bh * 0.25;
    // Front-left, front-right, back-left, back-right
    const darker = new THREE.Color(def.color).multiplyScalar(0.7);
    this.addPart(legW, legH, legD, -legSpread, legY, legSpread, darker);
    this.addPart(legW, legH, legD, legSpread, legY, legSpread, darker);
    this.addPart(legW, legH, legD, -legSpread, legY, -legSpread, darker);
    this.addPart(legW, legH, legD, legSpread, legY, -legSpread, darker);
    // Lower leg segments (extending further out and down)
    this.addPart(legW, legH * 0.6, legD, -legSpread * 1.5, legY * 0.3, legSpread * 1.5, darker);
    this.addPart(legW, legH * 0.6, legD, legSpread * 1.5, legY * 0.3, legSpread * 1.5, darker);
    this.addPart(legW, legH * 0.6, legD, -legSpread * 1.5, legY * 0.3, -legSpread * 1.5, darker);
    this.addPart(legW, legH * 0.6, legD, legSpread * 1.5, legY * 0.3, -legSpread * 1.5, darker);
    // Multiple beady eyes
    const eyeSize = 0.04;
    const eyeMat = new THREE.MeshStandardMaterial({
      color: def.eyeColor, emissive: new THREE.Color(def.eyeColor),
      emissiveIntensity: 0.8, flatShading: true,
    });
    for (let i = -2; i <= 2; i++) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(eyeSize, eyeSize, eyeSize), eyeMat);
      e.position.set(i * 0.06, bh * 0.55, bw * 0.45);
      this.mesh.add(e);
    }
  }

  /** Tank (Construction Bot): Tall, wide body + hard hat + crane arm */
  private buildTankVisual(def: EnemyTypeDef): void {
    const bw = def.bodyWidth, bh = def.bodyHeight;
    // Thick torso
    this._bodyMesh = this.addPart(bw, bh, bw * 0.7, 0, bh / 2, 0);
    // Head (smaller)
    const hs = def.headSize;
    this._headMesh = this.addPart(hs, hs * 0.8, hs, 0, bh + hs * 0.4 + 0.05, 0);
    // Hard hat on top (wider, flat)
    this.addPart(hs * 1.3, hs * 0.25, hs * 1.3, 0, bh + hs * 0.85, 0, "#FFD700");
    // Crane arm extending up and forward from right shoulder
    const armColor = new THREE.Color(def.color).multiplyScalar(0.7);
    this.addPart(bw * 0.15, bh * 0.6, bw * 0.15, bw * 0.5, bh * 0.8, 0, armColor);
    this.addPart(bw * 0.1, bw * 0.1, bh * 0.4, bw * 0.5, bh * 1.1, bh * 0.15, armColor);
    // Thick legs
    this.addPart(bw * 0.3, bh * 0.3, bw * 0.25, -bw * 0.25, 0.15, 0, armColor);
    this.addPart(bw * 0.3, bh * 0.3, bw * 0.25, bw * 0.25, 0.15, 0, armColor);
    this.addEyes(def, bh + hs * 0.45, hs * 0.45);
  }

  /** Flanking (Stray Dog): Four-legged animal shape */
  private buildDogVisual(def: EnemyTypeDef): void {
    const bw = def.bodyWidth, bh = def.bodyHeight;
    // Elongated body
    this._bodyMesh = this.addPart(bw * 0.8, bh * 0.7, bw * 1.6, 0, bh * 0.55, 0);
    // Head (offset forward)
    const hs = def.headSize;
    this._headMesh = this.addPart(hs, hs * 0.8, hs, 0, bh * 0.7, bw * 0.9);
    // Snout
    const noseColor = new THREE.Color(def.color).multiplyScalar(0.8);
    this.addPart(hs * 0.4, hs * 0.35, hs * 0.5, 0, bh * 0.6, bw * 0.9 + hs * 0.5, noseColor);
    // 4 legs
    const legW = bw * 0.15, legH = bh * 0.5;
    const darker = new THREE.Color(def.color).multiplyScalar(0.7);
    this.addPart(legW, legH, legW, -bw * 0.25, legH / 2, bw * 0.5, darker);
    this.addPart(legW, legH, legW, bw * 0.25, legH / 2, bw * 0.5, darker);
    this.addPart(legW, legH, legW, -bw * 0.25, legH / 2, -bw * 0.5, darker);
    this.addPart(legW, legH, legW, bw * 0.25, legH / 2, -bw * 0.5, darker);
    // Tail
    this.addPart(bw * 0.08, bh * 0.4, bw * 0.08, 0, bh * 0.7, -bw * 0.9, darker);
    // Ears
    this.addPart(hs * 0.2, hs * 0.3, hs * 0.1, -hs * 0.3, bh * 0.7 + hs * 0.5, bw * 0.85);
    this.addPart(hs * 0.2, hs * 0.3, hs * 0.1, hs * 0.3, bh * 0.7 + hs * 0.5, bw * 0.85);
    this.addEyes(def, bh * 0.75, bw * 0.9 + hs * 0.35);
  }

  /** Tank + Shield (MARTA Security): Humanoid + flat shield on left side */
  private buildShieldVisual(def: EnemyTypeDef): void {
    const bw = def.bodyWidth, bh = def.bodyHeight;
    // Torso
    this._bodyMesh = this.addPart(bw, bh, bw * 0.6, 0, bh / 2, 0);
    // Head with visor
    const hs = def.headSize;
    this._headMesh = this.addPart(hs, hs, hs, 0, bh + hs / 2 + 0.05, 0);
    // Visor (dark strip across face)
    this.addPart(hs * 0.9, hs * 0.25, 0.04, 0, bh + hs * 0.55, hs * 0.48, "#1A1A2E");
    // Shield on left arm (big flat rectangle)
    const shieldColor = "#0068A8";
    this.addPart(0.08, bh * 0.8, bw * 0.7, -bw / 2 - 0.1, bh * 0.5, bw * 0.15, shieldColor);
    // Right arm (baton)
    const armColor = new THREE.Color(def.color).multiplyScalar(0.7);
    this.addPart(bw * 0.15, bh * 0.6, bw * 0.15, bw / 2 + bw * 0.1, bh * 0.45, 0, armColor);
    // Baton
    this.addPart(0.06, bh * 0.35, 0.06, bw / 2 + bw * 0.1, bh * 0.1, bw * 0.15, "#2A2724");
    // Legs
    this.addPart(bw * 0.25, bh * 0.25, bw * 0.2, -bw * 0.2, 0.12, 0, armColor);
    this.addPart(bw * 0.25, bh * 0.25, bw * 0.2, bw * 0.2, 0.12, 0, armColor);
    this.addEyes(def, bh + hs * 0.55, hs * 0.4);
  }

  /** Fallback: generic box + head (original behavior) */
  private buildDefaultVisual(def: EnemyTypeDef): void {
    this._bodyMesh = this.addPart(
      def.bodyWidth, def.bodyHeight, def.bodyWidth * 0.75,
      0, def.bodyHeight / 2, 0,
    );
    if (def.headSize > 0) {
      this._headMesh = this.addPart(
        def.headSize, def.headSize, def.headSize,
        0, def.bodyHeight + def.headSize / 2 + 0.05, 0,
      );
      this.addEyes(def, def.bodyHeight + def.headSize * 0.55, def.headSize * 0.4);
    }
  }

  private setFlashColor(flash: boolean): void {
    const emissiveHex = flash ? 0xff4444 : 0x000000;
    const emissiveIntensity = flash ? 0.6 : 0;

    // Flash all mesh children (body, head, arms, legs, etc.)
    this.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mat = obj.material as THREE.MeshStandardMaterial;
        if (flash) {
          // Store original color if not yet stored
          if (!obj.userData._origColor) {
            obj.userData._origColor = mat.color.getHex();
          }
          mat.color.set(0xffffff);
        } else if (obj.userData._origColor !== undefined) {
          mat.color.setHex(obj.userData._origColor);
        }
        mat.emissive.setHex(emissiveHex);
        mat.emissiveIntensity = emissiveIntensity;
      }
    });
  }

  // ── Respawn ────────────────────────────────────────────────────────

  respawn(): void {
    this._hp = this._maxHp;
    this._isAlive = true;
    this._state = "idle";
    this._stateTimer = 0;
    this._position.copy(this._spawnPos);
    this.mesh.position.copy(this._spawnPos);
    this.mesh.scale.set(1, 1, 1);
    this.mesh.rotation.set(0, this._facingAngle, 0);
    this.mesh.visible = true;
    this._velocity.set(0, 0, 0);
    this._attackCooldown = 0;
    this._path = [];
    this._pathIndex = 0;
    this._aggroTarget = null;
    this._isAttacking = false;
    this.setFlashColor(false);
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  dispose(): void {
    this.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    });
  }
}
