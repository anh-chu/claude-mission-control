/**
 * Visual swing arc for melee attacks.
 *
 * Renders a sweeping arc mesh in front of the player
 * that animates through the attack duration.
 */

import * as THREE from "three";
import { type WeaponStats } from "./weapon-stats";
import { getItem } from "@/items/item-registry";

export class SwingVisual {
  private scene: THREE.Scene;
  private arcMesh: THREE.Mesh | null = null;
  private _isPlaying = false;
  private _timer = 0;
  private _duration = 0;
  private _weapon: WeaponStats | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /**
   * Start the swing animation.
   */
  start(
    weapon: WeaponStats,
    position: THREE.Vector3,
    facing: THREE.Vector3,
    duration: number
  ): void {
    this.stop();

    this._weapon = weapon;
    this._isPlaying = true;
    this._timer = 0;
    this._duration = duration;

    const def = getItem(weapon.itemId);
    const color = def?.color ?? "#FFFFFF";

    // Create arc geometry
    const arcRadius = weapon.range * 0.8;
    const arcAngle = weapon.swingArc;
    const geometry = new THREE.RingGeometry(
      arcRadius * 0.3,
      arcRadius,
      12,
      1,
      -arcAngle / 2,
      arcAngle
    );

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.arcMesh = new THREE.Mesh(geometry, material);
    this.arcMesh.rotation.x = -Math.PI / 2; // Lay flat

    // Position at player's feet level
    this.arcMesh.position.copy(position);
    this.arcMesh.position.y = 0.15;

    // Rotate to face the attack direction
    const angle = Math.atan2(facing.x, facing.z);
    this.arcMesh.rotation.z = -angle;

    this.scene.add(this.arcMesh);
  }

  /**
   * Update the swing animation. Call once per frame.
   */
  update(dt: number, playerPos: THREE.Vector3, playerFacing: THREE.Vector3): void {
    if (!this._isPlaying || !this.arcMesh) return;

    this._timer += dt;
    const progress = Math.min(1, this._timer / this._duration);

    // Update position to follow player
    this.arcMesh.position.copy(playerPos);
    this.arcMesh.position.y = 0.15;

    // Update rotation to follow facing
    const angle = Math.atan2(playerFacing.x, playerFacing.z);
    this.arcMesh.rotation.z = -angle;

    // Fade out as the swing completes
    const material = this.arcMesh.material as THREE.MeshBasicMaterial;
    if (progress < 0.3) {
      // Fade in
      material.opacity = 0.4 * (progress / 0.3);
    } else if (progress > 0.7) {
      // Fade out
      material.opacity = 0.4 * (1 - (progress - 0.7) / 0.3);
    } else {
      material.opacity = 0.4;
    }

    // Scale up slightly during the swing
    const scale = 0.8 + 0.4 * Math.sin(progress * Math.PI);
    this.arcMesh.scale.set(scale, scale, 1);

    if (progress >= 1) {
      this.stop();
    }
  }

  stop(): void {
    if (this.arcMesh) {
      this.scene.remove(this.arcMesh);
      this.arcMesh.geometry.dispose();
      if (this.arcMesh.material instanceof THREE.Material) {
        this.arcMesh.material.dispose();
      }
      this.arcMesh = null;
    }
    this._isPlaying = false;
    this._weapon = null;
  }

  destroy(): void {
    this.stop();
  }
}
