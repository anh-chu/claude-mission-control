/**
 * Enemy Manager — spawning, lifecycle, performance budgeting, and integration.
 *
 * Handles:
 * - Zone-based spawn point definitions
 * - Distance-based enemy activation/deactivation
 * - Respawn logic (3+ chunks away, 60s cooldown)
 * - Performance budget (max 12 active enemies)
 * - Registration with CombatSystem for player-vs-enemy damage
 */

import * as THREE from "three";
import { Enemy } from "./enemy";
import { ENEMY_TYPES, type EnemyTypeDef, type EnemyZone } from "./enemy-types";
import { type HitTarget } from "@/combat/hit-target";
import { type HealthSystem } from "@/player/health";
import { ChunkManager } from "@/world/chunk-manager";
import { isSolid } from "@/world/block-registry";
import { CHUNK_SIZE, VOXEL_SIZE } from "@/world/chunk";

// ── Configuration ────────────────────────────────────────────────────

const MAX_ACTIVE_ENEMIES = 12;
const ACTIVATION_RANGE = 4; // in chunks
const DEACTIVATION_RANGE = 6; // in chunks
const RESPAWN_DISTANCE_CHUNKS = 3; // player must be 3+ chunks away
const RESPAWN_COOLDOWN_SEC = 60;
const CHUNK_WORLD_SIZE = CHUNK_SIZE * VOXEL_SIZE; // 16m

// ── Zone boundaries (from terrain-gen.ts) ────────────────────────────

const COLLAPSE_START_VOXEL = 280;
const ZONE3_START_VOXEL = 352;
const COLLAPSE_START = COLLAPSE_START_VOXEL * VOXEL_SIZE; // 140m
const ZONE3_START = ZONE3_START_VOXEL * VOXEL_SIZE; // 176m

// ── Spawn Point Definition ───────────────────────────────────────────

interface SpawnPoint {
  id: string;
  position: THREE.Vector3;
  enemyTypeId: string;
  zone: EnemyZone;
  /** Active enemy instances at this spawn point */
  enemies: Enemy[];
  /** When the enemies were killed (for respawn timing) */
  killedAt: number;
  /** Whether the spawn point is currently depleted */
  depleted: boolean;
}

// ── Enemy Manager ────────────────────────────────────────────────────

export class EnemyManager {
  private scene: THREE.Scene;
  private chunkManager: ChunkManager;
  private spawnPoints: SpawnPoint[] = [];
  private activeEnemies: Enemy[] = [];
  private _registerTarget: ((target: HitTarget) => void) | null = null;
  private _unregisterTarget: ((id: string) => void) | null = null;

  constructor(scene: THREE.Scene, chunkManager: ChunkManager) {
    this.scene = scene;
    this.chunkManager = chunkManager;
  }

  /**
   * Set callbacks to register/unregister enemies with the combat system.
   */
  setCombatCallbacks(
    register: (target: HitTarget) => void,
    unregister: (id: string) => void
  ): void {
    this._registerTarget = register;
    this._unregisterTarget = unregister;
  }

  /**
   * Generate spawn points for all zones.
   * Called once during game initialization.
   */
  generateSpawnPoints(): void {
    this.generateHighwaySpawns();
    this.generateUndergroundSpawns();
    this.generateStreetSpawns();
  }

  /**
   * Update all active enemies and manage spawn/despawn lifecycle.
   * Called once per frame.
   */
  update(dt: number, playerPos: THREE.Vector3, playerHealth: HealthSystem): void {
    const now = performance.now() / 1000;
    const playerChunkX = Math.floor(playerPos.x / CHUNK_WORLD_SIZE);
    const playerChunkZ = Math.floor(playerPos.z / CHUNK_WORLD_SIZE);

    // Activate/deactivate spawn points based on distance
    for (const sp of this.spawnPoints) {
      const spChunkX = Math.floor(sp.position.x / CHUNK_WORLD_SIZE);
      const spChunkZ = Math.floor(sp.position.z / CHUNK_WORLD_SIZE);
      const chunkDist = Math.max(
        Math.abs(spChunkX - playerChunkX),
        Math.abs(spChunkZ - playerChunkZ)
      );

      if (chunkDist <= ACTIVATION_RANGE && sp.enemies.length === 0 && !sp.depleted) {
        // Activate — spawn enemies if budget allows
        if (this.activeEnemies.length < MAX_ACTIVE_ENEMIES) {
          this.spawnAtPoint(sp);
        }
      } else if (chunkDist > DEACTIVATION_RANGE && sp.enemies.length > 0) {
        // Deactivate — remove enemies
        this.despawnAtPoint(sp);
      }

      // Respawn check
      if (sp.depleted && chunkDist >= RESPAWN_DISTANCE_CHUNKS) {
        if (now - sp.killedAt >= RESPAWN_COOLDOWN_SEC) {
          sp.depleted = false;
        }
      }
    }

    // Update active enemies
    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const enemy = this.activeEnemies[i];
      enemy.update(dt, playerPos, playerHealth);

      // Check if enemy died this frame
      if (!enemy.isAlive && enemy.state === "dead") {
        // Find its spawn point and mark depleted
        const sp = this.spawnPoints.find(
          (s) => s.enemies.includes(enemy)
        );
        if (sp) {
          const allDead = sp.enemies.every((e) => !e.isAlive);
          if (allDead) {
            sp.depleted = true;
            sp.killedAt = now;
          }
        }
      }
    }

    // Remove fully dead enemies (after death animation)
    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const enemy = this.activeEnemies[i];
      if (!enemy.isAlive && !enemy.mesh.visible) {
        // Death animation finished — clean up
        this.removeEnemy(enemy);
        // Remove from spawn point
        for (const sp of this.spawnPoints) {
          const idx = sp.enemies.indexOf(enemy);
          if (idx !== -1) {
            sp.enemies.splice(idx, 1);
            break;
          }
        }
        this.activeEnemies.splice(i, 1);
      }
    }
  }

  /**
   * Get all active enemies (for external queries).
   */
  getActiveEnemies(): readonly Enemy[] {
    return this.activeEnemies;
  }

  // ── Spawn Logic ────────────────────────────────────────────────────

  private spawnAtPoint(sp: SpawnPoint): void {
    const typeDef = ENEMY_TYPES[sp.enemyTypeId];
    if (!typeDef) return;

    const count = typeDef.packSize;
    for (let i = 0; i < count; i++) {
      if (this.activeEnemies.length >= MAX_ACTIVE_ENEMIES) break;

      // Offset pack members slightly so they don't stack
      const offset = new THREE.Vector3(
        (i - (count - 1) / 2) * 1.2,
        0,
        (i % 2) * 0.8
      );
      const pos = sp.position.clone().add(offset);

      const enemy = new Enemy(typeDef, pos);
      enemy.getBlock = (wx, wy, wz) => this.chunkManager.getBlock(wx, wy, wz);
      enemy.isSolidFn = isSolid;

      this.scene.add(enemy.mesh);
      sp.enemies.push(enemy);
      this.activeEnemies.push(enemy);

      if (this._registerTarget) {
        this._registerTarget(enemy);
      }
    }
  }

  private despawnAtPoint(sp: SpawnPoint): void {
    for (const enemy of sp.enemies) {
      this.removeEnemy(enemy);
      const idx = this.activeEnemies.indexOf(enemy);
      if (idx !== -1) this.activeEnemies.splice(idx, 1);
    }
    sp.enemies = [];
    sp.depleted = false; // Can respawn since we're just deactivating
  }

  private removeEnemy(enemy: Enemy): void {
    this.scene.remove(enemy.mesh);
    if (this._unregisterTarget) {
      this._unregisterTarget(enemy.id);
    }
    enemy.dispose();
  }

  // ── Zone Spawn Generation ──────────────────────────────────────────

  private generateHighwaySpawns(): void {
    const groundY = 8 * VOXEL_SIZE; // GROUND_Y from terrain-gen
    const types = ["road_rager", "coffee_tosser", "bumper_brawler", "horn_honker"];

    // Highway spans from x=0 to x=COLLAPSE_START (140m)
    // Spawn enemies along the highway shoulders and median
    for (let x = 10; x < COLLAPSE_START - 10; x += 12) {
      const typeId = types[Math.floor(seededRandom(x * 7 + 13) * types.length)];
      const side = seededRandom(x * 3 + 7) > 0.5 ? 1 : -1;
      const zOffset = 5 + seededRandom(x * 11 + 23) * 5; // Near road edge

      this.addSpawnPoint(
        `hw_${x}`,
        new THREE.Vector3(x, groundY, side * zOffset),
        typeId,
        "highway"
      );
    }
  }

  private generateUndergroundSpawns(): void {
    // Correct underground Y positions (voxel → world):
    //   Tunnel floor: vy=-19 → -9.5m   (main sewer tunnels)
    //   MARTA platform: vy=-14 → -7.0m  (standing on platform)
    //   Branch tunnels: vy=-17 → -8.5m  (utility corridors)
    const tunnelFloorY = -19 * VOXEL_SIZE; // -9.5m
    const platformY = -14 * VOXEL_SIZE; // -7.0m
    const branchY = -17 * VOXEL_SIZE; // -8.5m

    // Main sewer tunnel (Z≈0) — rats and gators along the central corridor
    // Tunnel runs from roughly vx=220 to vx=440 in voxel coords
    const tunnelStartX = 220 * VOXEL_SIZE; // 110m
    const tunnelEndX = 440 * VOXEL_SIZE; // 220m

    for (let x = tunnelStartX; x < tunnelEndX; x += 15) {
      const typeId = seededRandom(x * 13 + 37) > 0.6 ? "sewer_gator" : "sewer_rat";
      const z = (seededRandom(x * 17 + 41) - 0.5) * 6; // Near tunnel center

      this.addSpawnPoint(
        `ug_main_${Math.round(x)}`,
        new THREE.Vector3(x, tunnelFloorY, z),
        typeId,
        "underground"
      );
    }

    // Branch tunnels (utility corridors at Z=±15) — mole bots and spiders
    for (let x = tunnelStartX + 20; x < tunnelEndX - 20; x += 20) {
      const typeId = seededRandom(x * 19 + 53) > 0.5 ? "mole_bot" : "drain_spider";
      const z = seededRandom(x * 23 + 61) > 0.5 ? 15 * VOXEL_SIZE : -15 * VOXEL_SIZE;

      this.addSpawnPoint(
        `ug_branch_${Math.round(x)}`,
        new THREE.Vector3(x, branchY, z),
        typeId,
        "underground"
      );
    }

    // MARTA station area (vx≈290-330) — mole bots and drain spiders on platform
    for (let x = 295 * VOXEL_SIZE; x < 325 * VOXEL_SIZE; x += 8) {
      const typeId = seededRandom(x * 29 + 71) > 0.5 ? "mole_bot" : "drain_spider";
      const z = (seededRandom(x * 31 + 73) > 0.5 ? 1 : -1) * (6 + seededRandom(x * 37 + 79) * 4);

      this.addSpawnPoint(
        `ug_marta_${Math.round(x)}`,
        new THREE.Vector3(x, platformY, z),
        typeId,
        "underground"
      );
    }
  }

  private generateStreetSpawns(): void {
    const groundY = 8 * VOXEL_SIZE;
    const types = ["construction_bot", "stray_dog", "marta_security", "crane_drone"];

    // Streets start at ZONE3_START and extend to the right
    for (let x = ZONE3_START + 10; x < ZONE3_START + 120; x += 10) {
      const typeId = types[Math.floor(seededRandom(x * 19 + 53) * types.length)];
      const z = (seededRandom(x * 23 + 59) - 0.5) * 30;

      this.addSpawnPoint(
        `st_${Math.round(x)}`,
        new THREE.Vector3(x, groundY, z),
        typeId,
        "street"
      );
    }
  }

  private addSpawnPoint(
    id: string,
    position: THREE.Vector3,
    enemyTypeId: string,
    zone: EnemyZone
  ): void {
    this.spawnPoints.push({
      id,
      position,
      enemyTypeId,
      zone,
      enemies: [],
      killedAt: 0,
      depleted: false,
    });
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  dispose(): void {
    for (const enemy of this.activeEnemies) {
      this.removeEnemy(enemy);
    }
    this.activeEnemies = [];
    this.spawnPoints = [];
  }
}

// ── Deterministic pseudo-random for spawn point placement ────────────

function seededRandom(seed: number): number {
  let x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  x = x - Math.floor(x);
  return x;
}
