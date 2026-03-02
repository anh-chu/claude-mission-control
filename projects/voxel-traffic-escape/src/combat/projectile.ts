/**
 * Projectile system for ranged weapons.
 *
 * Handles projectile spawning, movement, collision detection,
 * AoE damage, and visual representation.
 */

import * as THREE from "three";
import { type WeaponStats } from "./weapon-stats";
import { type HitTarget, type HitResult } from "./hit-target";
import { getItem } from "@/items/item-registry";

export interface Projectile {
  id: string;
  weapon: WeaponStats;
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  origin: THREE.Vector3;
  distanceTraveled: number;
  alive: boolean;
}

export type ProjectileEventType = "projectile_hit" | "projectile_expired";

export interface ProjectileEvent {
  type: ProjectileEventType;
  projectile: Projectile;
  hits: HitResult[];
}

export type ProjectileListener = (event: ProjectileEvent) => void;

const GRAVITY = -15;
const PROJECTILE_RADIUS = 0.2;

let nextId = 0;

export class ProjectileSystem {
  private scene: THREE.Scene;
  private projectiles: Map<string, Projectile> = new Map();
  private targets: Map<string, HitTarget> = new Map();
  private listeners: ProjectileListener[] = [];

  // Reusable vectors
  private _tmpDir = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  // ── Target management (shared with combat system) ──

  registerTarget(target: HitTarget): void {
    this.targets.set(target.id, target);
  }

  unregisterTarget(id: string): void {
    this.targets.delete(id);
  }

  // ── Spawn ──

  /**
   * Fire a projectile from a position in a direction.
   */
  fire(
    weapon: WeaponStats,
    origin: THREE.Vector3,
    direction: THREE.Vector3
  ): Projectile {
    const id = `proj_${nextId++}`;

    const mesh = this.createMesh(weapon);
    mesh.position.copy(origin);
    this.scene.add(mesh);

    const velocity = direction.clone().normalize().multiplyScalar(weapon.projectileSpeed);
    // Add slight upward arc for thrown weapons
    if (weapon.projectileSpeed < 20) {
      velocity.y += 3;
    }

    const projectile: Projectile = {
      id,
      weapon,
      mesh,
      velocity,
      origin: origin.clone(),
      distanceTraveled: 0,
      alive: true,
    };

    this.projectiles.set(id, projectile);
    return projectile;
  }

  /**
   * Update all projectiles. Call once per frame.
   */
  update(dt: number): void {
    for (const proj of this.projectiles.values()) {
      if (!proj.alive) continue;

      // Apply gravity
      proj.velocity.y += GRAVITY * dt;

      // Move without allocating a new Vector3
      const mx = proj.velocity.x * dt;
      const my = proj.velocity.y * dt;
      const mz = proj.velocity.z * dt;
      proj.mesh.position.x += mx;
      proj.mesh.position.y += my;
      proj.mesh.position.z += mz;
      proj.distanceTraveled += Math.sqrt(mx * mx + my * my + mz * mz);

      // Rotate to face velocity direction
      if (proj.velocity.lengthSq() > 0.01) {
        proj.mesh.lookAt(
          proj.mesh.position.x + proj.velocity.x,
          proj.mesh.position.y + proj.velocity.y,
          proj.mesh.position.z + proj.velocity.z
        );
      }

      // Check ground collision
      if (proj.mesh.position.y < 0) {
        this.onProjectileImpact(proj);
        continue;
      }

      // Check max range
      if (proj.distanceTraveled > proj.weapon.range) {
        this.onProjectileExpired(proj);
        continue;
      }

      // Check target collision
      const hit = this.checkTargetCollision(proj);
      if (hit) {
        this.onProjectileImpact(proj);
      }
    }

    // Clean up dead projectiles
    for (const [id, proj] of this.projectiles) {
      if (!proj.alive) {
        this.scene.remove(proj.mesh);
        proj.mesh.geometry.dispose();
        if (proj.mesh.material instanceof THREE.Material) {
          proj.mesh.material.dispose();
        }
        this.projectiles.delete(id);
      }
    }
  }

  // ── Events ──

  on(listener: ProjectileListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  // ── Private ──

  private checkTargetCollision(proj: Projectile): HitResult | null {
    for (const target of this.targets.values()) {
      if (!target.isAlive) continue;

      const dist = proj.mesh.position.distanceTo(target.position);
      if (dist <= PROJECTILE_RADIUS + target.hitRadius) {
        // Direct hit
        const totalDamage = proj.weapon.damage + proj.weapon.bonusDamage;

        this._tmpDir
          .subVectors(target.position, proj.mesh.position)
          .normalize()
          .multiplyScalar(proj.weapon.knockback);
        this._tmpDir.y = Math.max(this._tmpDir.y, proj.weapon.knockback * 0.3);

        const knockback = this._tmpDir.clone();
        const actualDamage = target.takeDamage(totalDamage, knockback);

        return {
          target,
          damage: actualDamage,
          knockbackDir: knockback.normalize(),
          lethal: !target.isAlive,
        };
      }
    }
    return null;
  }

  private onProjectileImpact(proj: Projectile): void {
    const hits: HitResult[] = [];

    // AoE damage
    if (proj.weapon.aoeRadius > 0) {
      const aoeHits = this.performAoEDamage(proj);
      hits.push(...aoeHits);
    }

    proj.alive = false;

    this.emitEvent({
      type: "projectile_hit",
      projectile: proj,
      hits,
    });
  }

  private onProjectileExpired(proj: Projectile): void {
    proj.alive = false;

    this.emitEvent({
      type: "projectile_expired",
      projectile: proj,
      hits: [],
    });
  }

  private performAoEDamage(proj: Projectile): HitResult[] {
    const hits: HitResult[] = [];
    const impactPos = proj.mesh.position;

    for (const target of this.targets.values()) {
      if (!target.isAlive) continue;

      const dist = impactPos.distanceTo(target.position);
      if (dist > proj.weapon.aoeRadius) continue;

      // Damage falls off with distance
      const falloff = 1 - dist / proj.weapon.aoeRadius;
      const totalDamage = Math.round(
        (proj.weapon.damage + proj.weapon.bonusDamage) * falloff
      );

      if (totalDamage <= 0) continue;

      this._tmpDir
        .subVectors(target.position, impactPos)
        .normalize()
        .multiplyScalar(proj.weapon.knockback * falloff);
      this._tmpDir.y = Math.max(this._tmpDir.y, proj.weapon.knockback * 0.3);

      const knockback = this._tmpDir.clone();
      const actualDamage = target.takeDamage(totalDamage, knockback);

      hits.push({
        target,
        damage: actualDamage,
        knockbackDir: knockback.normalize(),
        lethal: !target.isAlive,
      });
    }

    return hits;
  }

  private createMesh(weapon: WeaponStats): THREE.Mesh {
    const def = getItem(weapon.itemId);
    const color = def?.color ?? "#808080";

    const geometry = new THREE.SphereGeometry(PROJECTILE_RADIUS, 6, 4);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.2,
      flatShading: true,
      emissive: weapon.damageType === "fire" ? new THREE.Color("#FF4400") : undefined,
      emissiveIntensity: weapon.damageType === "fire" ? 0.5 : 0,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    return mesh;
  }

  private emitEvent(event: ProjectileEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  destroy(): void {
    for (const proj of this.projectiles.values()) {
      this.scene.remove(proj.mesh);
      proj.mesh.geometry.dispose();
      if (proj.mesh.material instanceof THREE.Material) {
        proj.mesh.material.dispose();
      }
    }
    this.projectiles.clear();
  }
}
