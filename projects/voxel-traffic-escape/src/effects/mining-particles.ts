/**
 * Mining particle effects — block-colored particles that spray out
 * during mining and burst when a block breaks.
 *
 * Uses a simple pooled particle system with instanced meshes.
 */

import * as THREE from "three";
import { getBlockColor } from "@/world/block-registry";

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

const MAX_PARTICLES = 200;
const GRAVITY = -12;
const BASE_SIZE = 0.06;

export class MiningParticles {
  private particles: Particle[] = [];
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private colorAttr: THREE.InstancedBufferAttribute;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(BASE_SIZE, BASE_SIZE, BASE_SIZE);
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.8,
      metalness: 0.1,
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;

    // Per-instance color
    const colors = new Float32Array(MAX_PARTICLES * 3);
    this.colorAttr = new THREE.InstancedBufferAttribute(colors, 3);
    this.mesh.instanceColor = this.colorAttr;

    // Initialize pool
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        age: 0,
        lifetime: 0,
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        r: 1, g: 1, b: 1,
        scale: 1,
      });
    }

    // Hide all instances initially
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
   * Spawn mining chip particles (small burst during progress).
   * Called periodically while mining.
   */
  spawnChips(worldX: number, worldY: number, worldZ: number, blockId: number, count = 3): void {
    const color = getBlockColor(blockId);
    const cx = worldX + 0.25; // center of voxel
    const cy = worldY + 0.25;
    const cz = worldZ + 0.25;

    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.active = true;
      p.age = 0;
      p.lifetime = 0.4 + Math.random() * 0.4;
      p.x = cx + (Math.random() - 0.5) * 0.3;
      p.y = cy + (Math.random() - 0.5) * 0.3;
      p.z = cz + (Math.random() - 0.5) * 0.3;
      p.vx = (Math.random() - 0.5) * 3;
      p.vy = Math.random() * 2 + 1;
      p.vz = (Math.random() - 0.5) * 3;
      p.r = color.r / 255;
      p.g = color.g / 255;
      p.b = color.b / 255;
      p.scale = 0.6 + Math.random() * 0.4;
    }
  }

  /**
   * Spawn a break burst (larger explosion of particles when block destroyed).
   */
  spawnBreakBurst(worldX: number, worldY: number, worldZ: number, blockId: number): void {
    const color = getBlockColor(blockId);
    const cx = worldX + 0.25;
    const cy = worldY + 0.25;
    const cz = worldZ + 0.25;

    const count = 15 + Math.floor(Math.random() * 10);
    for (let i = 0; i < count; i++) {
      const p = this.getFreeParticle();
      if (!p) break;

      p.active = true;
      p.age = 0;
      p.lifetime = 0.5 + Math.random() * 0.8;

      // Spread from center of block
      p.x = cx + (Math.random() - 0.5) * 0.4;
      p.y = cy + (Math.random() - 0.5) * 0.4;
      p.z = cz + (Math.random() - 0.5) * 0.4;

      // Explode outward
      const speed = 2 + Math.random() * 4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      p.vx = Math.sin(phi) * Math.cos(theta) * speed;
      p.vy = Math.cos(phi) * speed * 0.8 + 2; // bias upward
      p.vz = Math.sin(phi) * Math.sin(theta) * speed;

      // Slight color variation
      const variation = 0.85 + Math.random() * 0.3;
      p.r = Math.min(1, (color.r / 255) * variation);
      p.g = Math.min(1, (color.g / 255) * variation);
      p.b = Math.min(1, (color.b / 255) * variation);
      p.scale = 0.5 + Math.random() * 1.0;
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
        // Hide
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      // Physics
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // Fade out scale toward end of life
      const life = 1 - p.age / p.lifetime;
      const s = BASE_SIZE * p.scale * life;

      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.set(s / BASE_SIZE, s / BASE_SIZE, s / BASE_SIZE);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);

      // Color
      this.colorAttr.setXYZ(i, p.r, p.g, p.b);
    }

    if (needsUpdate) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.colorAttr.needsUpdate = true;
    }
  }

  private getFreeParticle(): Particle | null {
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
