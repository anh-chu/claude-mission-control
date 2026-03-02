/**
 * Demo enemy for testing the combat system.
 *
 * Simple voxel-style enemies that stand in the world, take damage,
 * show knockback, flash red on hit, and respawn after death.
 */

import * as THREE from "three";
import { type HitTarget } from "./hit-target";

const HIT_FLASH_DURATION = 0.15;
const DEATH_SHRINK_DURATION = 0.5;
const RESPAWN_DELAY = 3.0;
const KNOCKBACK_FRICTION = 8;

export class DemoEnemy implements HitTarget {
  readonly id: string;
  readonly mesh: THREE.Group;
  readonly hitRadius = 0.6;

  private _hp: number;
  private _maxHp: number;
  private _isAlive = true;
  private _spawnPos: THREE.Vector3;
  private _position: THREE.Vector3;

  // Visual state
  private bodyMesh: THREE.Mesh;
  private headMesh: THREE.Mesh;
  private originalColor: THREE.Color;
  private hitFlashTimer = 0;
  private deathTimer = 0;
  private respawnTimer = 0;

  // Physics
  private velocity = new THREE.Vector3();

  constructor(
    id: string,
    position: THREE.Vector3,
    color: string,
    maxHp: number
  ) {
    this.id = id;
    this._maxHp = maxHp;
    this._hp = maxHp;
    this._spawnPos = position.clone();
    this._position = position.clone();
    this.originalColor = new THREE.Color(color);

    // Build mesh group
    this.mesh = new THREE.Group();

    // Body (cube)
    const bodyGeo = new THREE.BoxGeometry(0.8, 1.0, 0.6);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.originalColor,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.y = 0.5;
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    this.mesh.add(this.bodyMesh);

    // Head (smaller cube)
    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMat = new THREE.MeshStandardMaterial({
      color: this.originalColor,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.headMesh.position.y = 1.3;
    this.headMesh.castShadow = true;
    this.mesh.add(this.headMesh);

    // Eyes (two small dark cubes)
    const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: "#FF0000",
      emissive: new THREE.Color("#FF0000"),
      emissiveIntensity: 0.5,
      flatShading: true,
    });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.12, 1.35, 0.26);
    this.mesh.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.12, 1.35, 0.26);
    this.mesh.add(rightEye);

    this.mesh.position.copy(position);
  }

  // ── HitTarget interface ──

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

  takeDamage(damage: number, knockback: THREE.Vector3 | null): number {
    if (!this._isAlive) return 0;

    const actualDamage = Math.min(damage, this._hp);
    this._hp -= actualDamage;

    // Apply knockback
    if (knockback) {
      this.velocity.add(knockback);
    }

    // Hit flash
    this.hitFlashTimer = HIT_FLASH_DURATION;
    this.setFlashColor(true);

    // Death
    if (this._hp <= 0) {
      this._isAlive = false;
      this.deathTimer = DEATH_SHRINK_DURATION;
    }

    return actualDamage;
  }

  // ── Update ──

  update(dt: number): void {
    // Hit flash
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      if (this.hitFlashTimer <= 0) {
        this.setFlashColor(false);
      }
    }

    // Knockback physics
    if (this.velocity.lengthSq() > 0.01) {
      // Move by velocity*dt without allocating a new Vector3
      this._position.x += this.velocity.x * dt;
      this._position.y += this.velocity.y * dt;
      this._position.z += this.velocity.z * dt;
      this._position.y = Math.max(0, this._position.y);
      this.mesh.position.copy(this._position);

      // Friction
      const friction = Math.exp(-KNOCKBACK_FRICTION * dt);
      this.velocity.multiplyScalar(friction);

      // Gravity
      if (this._position.y > 0) {
        this.velocity.y -= 20 * dt;
      } else {
        this.velocity.y = 0;
      }
    }

    // Death animation
    if (!this._isAlive && this.deathTimer > 0) {
      this.deathTimer -= dt;
      const progress = 1 - this.deathTimer / DEATH_SHRINK_DURATION;

      // Shrink and sink
      const scale = Math.max(0.01, 1 - progress);
      this.mesh.scale.set(scale, scale, scale);
      this.mesh.position.y = this._position.y - progress * 0.5;

      // Spin on death
      this.mesh.rotation.y += dt * 8;

      if (this.deathTimer <= 0) {
        this.mesh.visible = false;
        this.respawnTimer = RESPAWN_DELAY;
      }
    }

    // Respawn countdown
    if (!this._isAlive && this.deathTimer <= 0 && this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.respawn();
      }
    }
  }

  // ── Private ──

  private respawn(): void {
    this._hp = this._maxHp;
    this._isAlive = true;
    this._position.copy(this._spawnPos);
    this.mesh.position.copy(this._spawnPos);
    this.mesh.scale.set(1, 1, 1);
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.visible = true;
    this.velocity.set(0, 0, 0);
    this.setFlashColor(false);
  }

  private setFlashColor(flash: boolean): void {
    const color = flash ? new THREE.Color("#FFFFFF") : this.originalColor;
    (this.bodyMesh.material as THREE.MeshStandardMaterial).color.copy(color);
    (this.headMesh.material as THREE.MeshStandardMaterial).color.copy(color);

    if (flash) {
      (this.bodyMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xff4444);
      (this.bodyMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6;
      (this.headMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xff4444);
      (this.headMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6;
    } else {
      (this.bodyMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
      (this.bodyMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
      (this.headMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
      (this.headMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
    }
  }
}
