/**
 * Combat particle effects — hit sparks when damaging enemies,
 * death explosions when enemies die.
 *
 * Uses the same pooled instanced-mesh approach as MiningParticles.
 */

import * as THREE from "three";

interface Particle {
  active: boolean;
  age: number;
  lifetime: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
  g: number;
  b: number;
  scale: number;
}

const MAX_PARTICLES = 150;
const GRAVITY = -10;
const BASE_SIZE = 0.05;

export class CombatParticles {
  private particles: Particle[] = [];
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private colorAttr: THREE.InstancedBufferAttribute;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(BASE_SIZE, BASE_SIZE, BASE_SIZE);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.6,
      metalness: 0.3,
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    const colors = new Float32Array(MAX_PARTICLES * 3);
    this.colorAttr = new THREE.InstancedBufferAttribute(colors, 3);
    this.mesh.instanceColor = this.colorAttr;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false, age: 0, lifetime: 0,
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        r: 1, g: 0.3, b: 0.1, scale: 1,
      });
    }

    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.count = MAX_PARTICLES;

    scene.add(this.mesh);
  }

  /**
   * Spawn hit sparks at an enemy's position when they take damage.
   * Color derived from the enemy's color.
   */
  spawnHitSparks(
    x: number, y: number, z: number,
    enemyColor: string,
    count = 6,
  ): void {
    const col = new THREE.Color(enemyColor);
    for (let i = 0; i < count; i++) {
      const p = this.getFree();
      if (!p) break;

      p.active = true;
      p.age = 0;
      p.lifetime = 0.3 + Math.random() * 0.3;
      p.x = x + (Math.random() - 0.5) * 0.5;
      p.y = y + (Math.random() - 0.5) * 0.5;
      p.z = z + (Math.random() - 0.5) * 0.5;

      const speed = 3 + Math.random() * 4;
      const theta = Math.random() * Math.PI * 2;
      p.vx = Math.cos(theta) * speed;
      p.vy = Math.random() * 3 + 2;
      p.vz = Math.sin(theta) * speed;

      // Mix enemy color with spark yellow
      const variation = 0.7 + Math.random() * 0.6;
      p.r = Math.min(1, col.r * variation + 0.3);
      p.g = Math.min(1, col.g * variation + 0.15);
      p.b = Math.min(1, col.b * variation);
      p.scale = 0.6 + Math.random() * 0.6;
    }
  }

  /**
   * Spawn a death explosion — larger burst of fragments in enemy's color.
   */
  spawnDeathBurst(
    x: number, y: number, z: number,
    enemyColor: string,
  ): void {
    const col = new THREE.Color(enemyColor);
    const count = 20 + Math.floor(Math.random() * 10);

    for (let i = 0; i < count; i++) {
      const p = this.getFree();
      if (!p) break;

      p.active = true;
      p.age = 0;
      p.lifetime = 0.4 + Math.random() * 0.8;

      p.x = x + (Math.random() - 0.5) * 0.6;
      p.y = y + (Math.random() - 0.5) * 0.6;
      p.z = z + (Math.random() - 0.5) * 0.6;

      const speed = 2 + Math.random() * 6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      p.vx = Math.sin(phi) * Math.cos(theta) * speed;
      p.vy = Math.cos(phi) * speed * 0.6 + 3; // bias upward
      p.vz = Math.sin(phi) * Math.sin(theta) * speed;

      const variation = 0.7 + Math.random() * 0.6;
      p.r = Math.min(1, col.r * variation);
      p.g = Math.min(1, col.g * variation);
      p.b = Math.min(1, col.b * variation);
      p.scale = 0.5 + Math.random() * 1.2;
    }
  }

  update(dt: number): void {
    let needsUpdate = false;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      needsUpdate = true;
      p.age += dt;

      if (p.age >= p.lifetime) {
        p.active = false;
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // Friction
      p.vx *= 0.98;
      p.vz *= 0.98;

      const life = 1 - p.age / p.lifetime;
      const s = BASE_SIZE * p.scale * life;

      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.set(s / BASE_SIZE, s / BASE_SIZE, s / BASE_SIZE);
      this.dummy.rotation.set(p.age * 8, p.age * 6, 0); // tumble
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);

      this.colorAttr.setXYZ(i, p.r, p.g, p.b);
    }

    if (needsUpdate) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.colorAttr.needsUpdate = true;
    }
  }

  private getFree(): Particle | null {
    for (const p of this.particles) {
      if (!p.active) return p;
    }
    return null;
  }

  destroy(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.parent?.remove(this.mesh);
  }
}
