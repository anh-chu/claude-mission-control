/**
 * 3D item entities that exist in the game world.
 *
 * Features:
 * - Bobbing + rotation animation for resting items
 * - Drop physics: items launched upward with velocity, bounce, then settle
 * - Glow effect: emissive pulse so drops are visible
 * - Despawn timer: dropped items disappear after 5 minutes (GDD spec)
 * - Players can pick them up by walking near or pressing interact
 */

import * as THREE from "three";
import { getItem, type ItemDefinition } from "./item-registry";

/** How an item was created — affects physics and despawn behavior. */
export type SpawnMode = "placed" | "dropped";

export interface WorldItem {
  id: string;
  itemId: string;
  quantity: number;
  mesh: THREE.Mesh;
  /** Seconds since spawn, drives bobbing animation. */
  age: number;
  /** Y position at rest (bob oscillates around this). */
  baseY: number;
  /** Whether this item was dropped (has physics + despawn) or placed (static). */
  mode: SpawnMode;

  // -- Drop physics --
  /** Current vertical velocity (units/sec). 0 when resting. */
  velocityY: number;
  /** Current horizontal velocity for scatter on drop. */
  velocityX: number;
  velocityZ: number;
  /** True once the item has settled and should bob/rotate normally. */
  settled: boolean;
  /** Number of bounces completed. */
  bounceCount: number;

  // -- Glow --
  /** Glow pulse phase offset (randomized per item). */
  glowPhase: number;

  // -- Despawn --
  /** Time remaining before despawn (seconds). -1 = never despawn. */
  despawnTimer: number;
  /** True when in the warning blink phase (last 10 seconds). */
  blinking: boolean;
}

// ── Constants ──

const BOB_SPEED = 2.0;
const BOB_HEIGHT = 0.15;
const ROTATE_SPEED = 1.5;
const ITEM_SCALE = 0.4;
const PICKUP_RADIUS = 1.5;

// Drop physics
const DROP_LAUNCH_Y = 4.0; // Initial upward velocity
const DROP_SCATTER_XZ = 2.0; // Horizontal scatter range
const GRAVITY = -12.0;
const GROUND_Y = 0.3; // Ground level for items
const BOUNCE_DAMPING = 0.4; // Velocity retained per bounce
const MAX_BOUNCES = 3;

// Glow
const GLOW_SPEED = 3.0; // Pulse frequency
const GLOW_INTENSITY = 0.3; // Max emissive intensity

// Despawn
const DESPAWN_TIME_SEC = 300; // 5 minutes
const BLINK_WARN_SEC = 10; // Start blinking this many seconds before despawn
const BLINK_RATE = 6.0; // Blinks per second

let nextId = 0;

export class ItemEntityManager {
  private scene: THREE.Scene;
  private items: Map<string, WorldItem> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Spawn an item at a world position.
   * @param mode "placed" = static world item (no physics, no despawn).
   *             "dropped" = loot drop (bounces, glows, despawns).
   */
  spawn(
    itemId: string,
    quantity: number,
    position: THREE.Vector3,
    mode: SpawnMode = "placed"
  ): WorldItem | null {
    const def = getItem(itemId);
    if (!def) return null;

    const mesh = this.createMesh(def);
    mesh.position.copy(position);
    this.scene.add(mesh);

    const id = `world_item_${nextId++}`;

    const isDrop = mode === "dropped";

    const worldItem: WorldItem = {
      id,
      itemId,
      quantity,
      mesh,
      age: 0,
      baseY: GROUND_Y,
      mode,

      // Drop physics — only active for "dropped" mode
      velocityY: isDrop ? DROP_LAUNCH_Y + Math.random() * 1.5 : 0,
      velocityX: isDrop ? (Math.random() - 0.5) * DROP_SCATTER_XZ : 0,
      velocityZ: isDrop ? (Math.random() - 0.5) * DROP_SCATTER_XZ : 0,
      settled: !isDrop,
      bounceCount: 0,

      glowPhase: Math.random() * Math.PI * 2,

      despawnTimer: isDrop ? DESPAWN_TIME_SEC : -1,
      blinking: false,
    };

    // Placed items start at resting position
    if (!isDrop) {
      mesh.position.y = GROUND_Y;
      worldItem.baseY = GROUND_Y;
    }

    this.items.set(id, worldItem);
    return worldItem;
  }

  /**
   * Spawn loot drops scattered from a position (e.g., enemy death).
   * Items launch upward and scatter horizontally.
   */
  spawnDrops(
    drops: Array<{ itemId: string; quantity: number }>,
    origin: THREE.Vector3
  ): WorldItem[] {
    const spawned: WorldItem[] = [];
    for (const drop of drops) {
      const item = this.spawn(drop.itemId, drop.quantity, origin.clone(), "dropped");
      if (item) {
        spawned.push(item);
      }
    }
    return spawned;
  }

  /** Remove an item from the world. */
  remove(id: string): void {
    const item = this.items.get(id);
    if (item) {
      this.scene.remove(item.mesh);
      item.mesh.geometry.dispose();
      if (item.mesh.material instanceof THREE.Material) {
        item.mesh.material.dispose();
      }
      this.items.delete(id);
    }
  }

  /** Update all items (physics, bobbing, glow, despawn). */
  update(dt: number): void {
    const toRemove: string[] = [];

    for (const item of this.items.values()) {
      item.age += dt;

      if (!item.settled) {
        // ── Drop physics ──
        this.updateDropPhysics(item, dt);
      } else {
        // ── Settled: bobbing + rotation ──
        item.mesh.position.y =
          item.baseY + Math.sin(item.age * BOB_SPEED) * BOB_HEIGHT;
        item.mesh.rotation.y += dt * ROTATE_SPEED;
      }

      // ── Glow pulse ──
      this.updateGlow(item);

      // ── Despawn timer ──
      if (item.despawnTimer > 0) {
        item.despawnTimer -= dt;

        if (item.despawnTimer <= BLINK_WARN_SEC) {
          item.blinking = true;
          // Blink visibility on/off
          const blinkPhase = Math.sin(item.age * BLINK_RATE * Math.PI * 2);
          item.mesh.visible = blinkPhase > 0;
        }

        if (item.despawnTimer <= 0) {
          toRemove.push(item.id);
        }
      }
    }

    // Remove despawned items
    for (const id of toRemove) {
      this.remove(id);
    }
  }

  /** Simulate drop bounce physics. */
  private updateDropPhysics(item: WorldItem, dt: number): void {
    // Apply gravity
    item.velocityY += GRAVITY * dt;

    // Move
    item.mesh.position.x += item.velocityX * dt;
    item.mesh.position.y += item.velocityY * dt;
    item.mesh.position.z += item.velocityZ * dt;

    // Tumble while airborne
    item.mesh.rotation.x += dt * 5;
    item.mesh.rotation.z += dt * 3;

    // Ground collision
    if (item.mesh.position.y <= GROUND_Y) {
      item.mesh.position.y = GROUND_Y;
      item.bounceCount++;

      if (item.bounceCount >= MAX_BOUNCES || Math.abs(item.velocityY) < 0.5) {
        // Settle
        item.settled = true;
        item.velocityY = 0;
        item.velocityX = 0;
        item.velocityZ = 0;
        item.baseY = GROUND_Y;
        item.age = 0; // Reset age so bobbing starts from a clean phase
        // Reset rotation to upright
        item.mesh.rotation.x = 0;
        item.mesh.rotation.z = 0;
      } else {
        // Bounce
        item.velocityY = -item.velocityY * BOUNCE_DAMPING;
        item.velocityX *= BOUNCE_DAMPING;
        item.velocityZ *= BOUNCE_DAMPING;
      }
    }
  }

  /** Update emissive glow pulse on the item material. */
  private updateGlow(item: WorldItem): void {
    const mat = item.mesh.material;
    if (!(mat instanceof THREE.MeshStandardMaterial)) return;

    const pulse =
      (Math.sin(item.age * GLOW_SPEED + item.glowPhase) + 1) * 0.5;
    const intensity = pulse * GLOW_INTENSITY;

    mat.emissiveIntensity = intensity;
  }

  /**
   * Find all items within pickup radius of a position.
   * Returns items sorted by distance (closest first).
   * Only returns settled items (can't pick up mid-bounce).
   */
  getItemsInRange(position: THREE.Vector3): WorldItem[] {
    const result: { item: WorldItem; dist: number }[] = [];

    for (const item of this.items.values()) {
      if (!item.settled) continue;
      const dist = position.distanceTo(item.mesh.position);
      if (dist <= PICKUP_RADIUS) {
        result.push({ item, dist });
      }
    }

    result.sort((a, b) => a.dist - b.dist);
    return result.map((r) => r.item);
  }

  /** Get all world items. */
  getAll(): WorldItem[] {
    return [...this.items.values()];
  }

  /** Create the 3D mesh for a world item. */
  private createMesh(def: ItemDefinition): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(ITEM_SCALE, ITEM_SCALE, ITEM_SCALE);
    const material = new THREE.MeshStandardMaterial({
      color: def.color,
      roughness: 0.8,
      metalness: 0.1,
      flatShading: true,
      emissive: def.color,
      emissiveIntensity: 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /** Clean up all items. */
  destroy(): void {
    for (const id of [...this.items.keys()]) {
      this.remove(id);
    }
  }
}
