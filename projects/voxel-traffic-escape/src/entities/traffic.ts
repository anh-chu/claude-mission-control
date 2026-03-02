/**
 * TrafficManager — spawns moving vehicle meshes along the highway lanes.
 *
 * Vehicles are simple Three.js box compositions (NOT voxel-based) that
 * drive at constant speed and can damage the player on collision.
 *
 * Highway layout (from terrain-gen.ts):
 *   - Road surface world Y = 4.0m (GROUND_Y=8 voxels * 0.5m)
 *   - Road runs along X axis from ~0 to ~140m (COLLAPSE_START=280 voxels * 0.5m)
 *   - 8 lanes (4 each direction), centered on Z=0
 *   - ROAD_HALF_WIDTH = 16 voxels = 8m
 *   - Lane width ~2m each (4 voxels * 0.5m)
 *   - Westbound (negative Z): lanes at Z ~ -1, -3, -5, -7
 *   - Eastbound (positive Z): lanes at Z ~ +1, +3, +5, +7
 */

import * as THREE from "three";
import type { HealthSystem } from "@/player/health";

// ── Vehicle color palette ──────────────────────────────────────────────

const VEHICLE_COLORS = [
  0xcc2222, // red
  0x2244aa, // blue
  0xdddddd, // white
  0x222222, // black
  0xddcc22, // yellow
  0xaaaaaa, // silver
  0x22aa44, // green
] as const;

/** Darken a color by multiplying each channel */
function darkenColor(hex: number, factor: number): number {
  const r = Math.floor(((hex >> 16) & 0xff) * factor);
  const g = Math.floor(((hex >> 8) & 0xff) * factor);
  const b = Math.floor((hex & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

// ── Lane definitions ───────────────────────────────────────────────────

interface LaneConfig {
  z: number;       // world Z center of lane
  direction: -1 | 1; // -1 = going -X (westbound), +1 = going +X (eastbound)
}

/**
 * 8 lanes total. Negative Z lanes go westbound (-X), positive Z go eastbound (+X).
 * Lane centers spaced ~2m apart, offset from median.
 */
const LANES: LaneConfig[] = [
  // Westbound (negative Z, driving -X direction)
  { z: -1.0, direction: -1 },
  { z: -3.0, direction: -1 },
  { z: -5.0, direction: -1 },
  { z: -7.0, direction: -1 },
  // Eastbound (positive Z, driving +X direction)
  { z: 1.0, direction: 1 },
  { z: 3.0, direction: 1 },
  { z: 5.0, direction: 1 },
  { z: 7.0, direction: 1 },
];

// ── Constants ──────────────────────────────────────────────────────────

const ROAD_Y = 4.5;             // world Y of road surface (top face of voxel y=8)
const HIGHWAY_X_MIN = 0;        // highway start in world X
const HIGHWAY_X_MAX = 140;      // highway end in world X (COLLAPSE_START)
const VIEW_DISTANCE = 64;       // spawn/despawn distance from player
const MAX_VEHICLES = 12;
const MIN_SPEED = 8;            // m/s
const MAX_SPEED = 15;           // m/s
const SPAWN_INTERVAL_MIN = 0.8; // seconds
const SPAWN_INTERVAL_MAX = 2.0; // seconds
const COLLISION_RADIUS = 1.5;   // meters
const COLLISION_DAMAGE = 15;

// ── Vehicle mesh construction ──────────────────────────────────────────

/** Shared geometries (created once, reused across all vehicles) */
const bodyGeom = new THREE.BoxGeometry(2.8, 1.0, 1.4);
const cabinGeom = new THREE.BoxGeometry(1.4, 0.6, 1.2);
const wheelGeom = new THREE.BoxGeometry(0.4, 0.4, 0.25);
const headlightGeom = new THREE.BoxGeometry(0.2, 0.2, 0.15);

const wheelMat = new THREE.MeshStandardMaterial({
  color: 0x111111,
  flatShading: true,
});
const headlightMat = new THREE.MeshStandardMaterial({
  color: 0xffffaa,
  flatShading: true,
  emissive: 0xffff44,
  emissiveIntensity: 0.4,
});

function createVehicleMesh(color: number): THREE.Group {
  const group = new THREE.Group();

  // Body — metallic car paint with sheen
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.4,
    metalness: 0.3,
  });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.set(0, 0.5, 0); // center of body
  group.add(body);

  // Cabin (on top, center)
  const cabinMat = new THREE.MeshStandardMaterial({
    color: darkenColor(color, 0.75),
    flatShading: true,
    roughness: 0.3,
    metalness: 0.1,
  });
  const cabin = new THREE.Mesh(cabinGeom, cabinMat);
  cabin.position.set(0, 1.0 + 0.3, 0); // on top of body
  group.add(cabin);

  // Wheels — 4 corners underneath the body
  const wheelPositions: [number, number, number][] = [
    [-0.9, 0.2, 0.75],   // front-left
    [-0.9, 0.2, -0.75],  // front-right
    [0.9, 0.2, 0.75],    // rear-left
    [0.9, 0.2, -0.75],   // rear-right
  ];
  for (const [wx, wy, wz] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeom, wheelMat);
    wheel.position.set(wx, wy, wz);
    group.add(wheel);
  }

  // Headlights — at the front (+X side)
  const headlightPositions: [number, number, number][] = [
    [1.4, 0.45, 0.45],
    [1.4, 0.45, -0.45],
  ];
  for (const [hx, hy, hz] of headlightPositions) {
    const hl = new THREE.Mesh(headlightGeom, headlightMat);
    hl.position.set(hx, hy, hz);
    group.add(hl);
  }

  return group;
}

// ── Vehicle instance ───────────────────────────────────────────────────

interface Vehicle {
  mesh: THREE.Group;
  lane: LaneConfig;
  speed: number;        // m/s (always positive; direction from lane)
  hasHitPlayer: boolean; // prevent repeat damage
}

// ── TrafficManager ─────────────────────────────────────────────────────

export class TrafficManager {
  private scene: THREE.Scene;
  private vehicles: Vehicle[] = [];
  private spawnTimer: number = 0;
  private nextSpawnInterval: number;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.nextSpawnInterval = this.randomSpawnInterval();
  }

  /**
   * Called every frame from the game loop.
   * Spawns new vehicles, moves existing ones, checks collisions, removes old ones.
   */
  update(
    dt: number,
    playerX: number,
    playerZ: number,
    playerHealth: HealthSystem,
  ): void {
    // ── Spawn logic ──
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.nextSpawnInterval && this.vehicles.length < MAX_VEHICLES) {
      this.trySpawn(playerX);
      this.spawnTimer = 0;
      this.nextSpawnInterval = this.randomSpawnInterval();
    }

    // ── Update + collision + despawn ──
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];

      // Move vehicle along X in its lane direction
      v.mesh.position.x += v.lane.direction * v.speed * dt;

      // Despawn if too far behind player
      const distBehind = (v.mesh.position.x - playerX) * v.lane.direction;
      // Vehicle has passed the player if distBehind is very negative
      if (distBehind < -VIEW_DISTANCE) {
        this.removeVehicle(i);
        continue;
      }

      // Also despawn if vehicle has gone way past highway bounds
      if (v.mesh.position.x < HIGHWAY_X_MIN - VIEW_DISTANCE ||
          v.mesh.position.x > HIGHWAY_X_MAX + VIEW_DISTANCE) {
        this.removeVehicle(i);
        continue;
      }

      // Collision check (XZ distance only — player is on the road)
      if (!v.hasHitPlayer) {
        const dx = v.mesh.position.x - playerX;
        const dz = v.mesh.position.z - playerZ;
        const distSq = dx * dx + dz * dz;
        if (distSq < COLLISION_RADIUS * COLLISION_RADIUS) {
          playerHealth.takeDamage(COLLISION_DAMAGE, "traffic");
          v.hasHitPlayer = true;
        }
      }
    }
  }

  /** Remove all vehicles and clean up */
  dispose(): void {
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      this.removeVehicle(i);
    }
    // Dispose shared geometries / materials
    bodyGeom.dispose();
    cabinGeom.dispose();
    wheelGeom.dispose();
    headlightGeom.dispose();
    wheelMat.dispose();
    headlightMat.dispose();
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private trySpawn(playerX: number): void {
    // Only spawn if player is within highway zone
    if (playerX < HIGHWAY_X_MIN - 10 || playerX > HIGHWAY_X_MAX + 10) return;

    // Pick a random lane
    const laneIdx = Math.floor(Math.random() * LANES.length);
    const lane = LANES[laneIdx];

    // Calculate spawn X: ahead of the player in the vehicle's travel direction
    let spawnX: number;
    if (lane.direction > 0) {
      // Eastbound: spawn behind the player's view (coming from -X)
      spawnX = playerX - VIEW_DISTANCE;
    } else {
      // Westbound: spawn ahead in +X (coming from +X toward player)
      spawnX = playerX + VIEW_DISTANCE;
    }

    // Clamp to highway bounds (with some margin)
    spawnX = Math.max(HIGHWAY_X_MIN - 20, Math.min(HIGHWAY_X_MAX + 20, spawnX));

    // Speed varies per vehicle
    const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);

    // Pick random color
    const color = VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)];

    // Create mesh
    const mesh = createVehicleMesh(color);
    mesh.position.set(spawnX, ROAD_Y, lane.z);

    // Rotate vehicle to face its travel direction
    // Default mesh faces +X. Westbound vehicles need to face -X.
    if (lane.direction < 0) {
      mesh.rotation.y = Math.PI;
    }

    this.scene.add(mesh);

    this.vehicles.push({
      mesh,
      lane,
      speed,
      hasHitPlayer: false,
    });
  }

  private removeVehicle(index: number): void {
    const v = this.vehicles[index];
    this.scene.remove(v.mesh);
    // Dispose per-vehicle materials (body + cabin)
    v.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material;
        if (mat instanceof THREE.MeshStandardMaterial) {
          // Only dispose non-shared materials (body and cabin have unique colors)
          if (mat !== wheelMat && mat !== headlightMat) {
            mat.dispose();
          }
        }
      }
    });
    this.vehicles.splice(index, 1);
  }

  private randomSpawnInterval(): number {
    return SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
  }
}
