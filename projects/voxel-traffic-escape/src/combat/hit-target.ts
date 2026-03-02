/**
 * Interface for anything that can receive combat damage:
 * enemies, destructible objects, etc.
 */

import * as THREE from "three";

export interface HitTarget {
  /** Unique identifier */
  readonly id: string;
  /** World position (used for hit detection and knockback direction) */
  readonly position: THREE.Vector3;
  /** Bounding radius for hit detection (sphere collider) */
  readonly hitRadius: number;
  /** Current HP */
  hp: number;
  /** Max HP */
  maxHp: number;
  /** Whether this target is still alive */
  readonly isAlive: boolean;
  /** Apply damage. Returns actual damage dealt. */
  takeDamage(damage: number, knockback: THREE.Vector3 | null): number;
  /** The Three.js mesh for visual effects */
  readonly mesh: THREE.Object3D;
}

export interface HitResult {
  target: HitTarget;
  damage: number;
  knockbackDir: THREE.Vector3;
  lethal: boolean;
}
