/**
 * First-person weapon viewmodel — shows the held weapon in the lower-right
 * of the player's view, with swing animation on attack and walk bob.
 */

import * as THREE from "three";
import { getItem } from "@/items/item-registry";
import { type WeaponStats, getWeaponStats, getUnarmedStats } from "./weapon-stats";

// ── Idle pose (camera-local coordinates) ──────────────────────────────

const IDLE_POS = new THREE.Vector3(0.35, -0.3, -0.5);
const IDLE_ROT = new THREE.Euler(-0.1, -0.2, 0);

// ── Walk bob ──────────────────────────────────────────────────────────

const BOB_SPEED = 10; // cycles per second
const BOB_AMOUNT_X = 0.02;
const BOB_AMOUNT_Y = 0.03;

// ── Swing animation ──────────────────────────────────────────────────

const SWING_PITCH = -0.8; // radians — pitch forward
const SWING_ROLL = 0.6; // radians — roll right
const SWING_OFFSET_Z = -0.15; // thrust forward

export class WeaponViewmodel {
  private mesh: THREE.Mesh;
  private group: THREE.Group;
  private camera: THREE.PerspectiveCamera;

  // Current weapon
  private _currentItemId = "bare_fists";

  // Walk bob state
  private _bobTimer = 0;
  private _isMoving = false;
  private _isSprinting = false;

  // Swing animation state
  private _swinging = false;
  private _swingTimer = 0;
  private _swingDuration = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;

    this.group = new THREE.Group();
    this.group.position.copy(IDLE_POS);
    this.group.rotation.copy(IDLE_ROT);

    // Build the weapon mesh — a simple box colored by item color
    const geo = this.buildGeometry("bare_fists");
    const mat = new THREE.MeshLambertMaterial({
      color: "#D2B48C",
      flatShading: true,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.group.add(this.mesh);

    camera.add(this.group);
  }

  /** Build geometry sized by weapon type */
  private buildGeometry(itemId: string): THREE.BoxGeometry {
    const stats = getWeaponStats(itemId);
    if (!stats) {
      // Bare fists: blocky fist shape
      return new THREE.BoxGeometry(0.1, 0.12, 0.14);
    }
    if (stats.type === "ranged") {
      // Ranged weapons: compact box
      return new THREE.BoxGeometry(0.08, 0.1, 0.2);
    }
    // Melee: longer weapon, scale based on damage
    const scale = 0.7 + (stats.damage / 30) * 0.5; // 0.7 to 1.2
    return new THREE.BoxGeometry(0.06 * scale, 0.07 * scale, 0.35 * scale);
  }

  /** Switch to a different weapon */
  setWeapon(itemId: string | null): void {
    const id = itemId ?? "bare_fists";
    if (id === this._currentItemId) return;
    this._currentItemId = id;

    // Update color
    const def = getItem(id);
    const color = def?.color ?? "#D2B48C";
    (this.mesh.material as THREE.MeshLambertMaterial).color.set(color);

    // Rebuild geometry for new weapon size
    this.mesh.geometry.dispose();
    this.mesh.geometry = this.buildGeometry(id);
  }

  /** Start the attack swing animation */
  startSwing(weapon: WeaponStats): void {
    this._swinging = true;
    this._swingTimer = 0;
    this._swingDuration = 1 / weapon.attackSpeed;
  }

  /** Set movement state for walk bob */
  setMovement(isMoving: boolean, isSprinting: boolean): void {
    this._isMoving = isMoving;
    this._isSprinting = isSprinting;
  }

  update(dt: number): void {
    // ── Walk bob ──
    if (this._isMoving) {
      const speed = this._isSprinting ? BOB_SPEED * 1.3 : BOB_SPEED;
      this._bobTimer += dt * speed;
    } else {
      // Settle back to center
      this._bobTimer += dt * 2;
    }

    const bobX = this._isMoving ? Math.sin(this._bobTimer * 2) * BOB_AMOUNT_X : 0;
    const bobY = this._isMoving ? Math.sin(this._bobTimer * 2 * 2) * BOB_AMOUNT_Y : 0;

    // ── Swing animation ──
    let swingPitch = 0;
    let swingRoll = 0;
    let swingZ = 0;

    if (this._swinging) {
      this._swingTimer += dt;
      const progress = Math.min(1, this._swingTimer / this._swingDuration);

      // Smooth ease-out arc: fast start, slow recovery
      const t = progress < 0.4
        ? progress / 0.4 // 0→1 in first 40%
        : 1 - (progress - 0.4) / 0.6; // 1→0 in last 60%
      const ease = Math.sin(t * Math.PI * 0.5); // ease-out

      swingPitch = SWING_PITCH * ease;
      swingRoll = SWING_ROLL * ease;
      swingZ = SWING_OFFSET_Z * ease;

      if (progress >= 1) {
        this._swinging = false;
      }
    }

    // Apply position
    this.group.position.set(
      IDLE_POS.x + bobX,
      IDLE_POS.y + bobY,
      IDLE_POS.z + swingZ,
    );

    // Apply rotation
    this.group.rotation.set(
      IDLE_ROT.x + swingPitch,
      IDLE_ROT.y,
      IDLE_ROT.z + swingRoll,
    );
  }

  destroy(): void {
    this.camera.remove(this.group);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
