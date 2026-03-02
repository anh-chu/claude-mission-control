/**
 * Enemy type definitions — stats, behavior config, and visual properties
 * for all 12 regular enemy types from the GDD.
 *
 * Boss enemies are NOT included here (they need custom multi-phase logic).
 */

export type EnemyZone = "highway" | "underground" | "street";

export type BehaviorType =
  | "chase"          // Road Rager — sprint to melee, combo, de-aggro
  | "ranged"         // Coffee Tosser, Crane Drone — maintain distance, fire projectiles
  | "charge"         // Bumper Brawler — telegraph → dash → recovery
  | "area_denial"    // Horn Honker — stationary, periodic AoE
  | "swarm"          // Sewer Rat — group aggro, surround
  | "ambush"         // Sewer Gator — hidden, burst on proximity
  | "burrow"         // Mole Bot — surface → dive → emerge
  | "hit_and_run"    // Drain Spider — ranged → melee → retreat
  | "tank"           // Construction Bot — slow advance, heavy attacks
  | "flanking"       // Stray Dog — pairs, flank
  | "tank_shield";   // MARTA Security — frontal DR, breakable shield

export type DetectionType = "line_of_sight" | "proximity" | "vibration" | "sound";

export interface EnemyTypeDef {
  id: string;
  name: string;
  zone: EnemyZone;
  behavior: BehaviorType;
  detection: DetectionType;

  // Stats
  hp: number;
  damage: number;
  attackSpeed: number;        // attacks per second
  moveSpeed: number;          // multiplier (1.0 = player walk speed, 5 m/s)
  aggroRange: number;         // blocks (1 block = 0.5m voxel)
  deaggroRange: number;       // blocks (typically 1.5x aggro)
  attackRange: number;        // blocks — how close to start attacking

  // Ranged enemies
  projectileSpeed: number;    // 0 = melee only
  projectileRange: number;    // 0 = melee only

  // Visual
  bodyWidth: number;          // meters
  bodyHeight: number;         // meters
  headSize: number;           // meters
  color: string;              // hex
  eyeColor: string;           // hex

  // Spawning
  packSize: number;           // 1 = solo, >1 = spawns in groups
  canStagger: boolean;        // can be stagger-interrupted by hits
  staggerDuration: number;    // seconds

  // Scrap drops
  scrapMin: number;
  scrapMax: number;
}

/** Convert block distance to world meters */
function b(blocks: number): number {
  return blocks * 0.5; // 1 block = 0.5m (VOXEL_SIZE)
}

export const ENEMY_TYPES: Record<string, EnemyTypeDef> = {
  // ── Highway Zone (Tier 1) ──────────────────────────────────────────

  road_rager: {
    id: "road_rager",
    name: "Road Rager",
    zone: "highway",
    behavior: "chase",
    detection: "line_of_sight",
    hp: 25,
    damage: 8,
    attackSpeed: 1.2,
    moveSpeed: 0.8,
    aggroRange: b(12),
    deaggroRange: b(20),
    attackRange: b(3),
    projectileSpeed: 0,
    projectileRange: 0,
    bodyWidth: 0.7,
    bodyHeight: 1.0,
    headSize: 0.45,
    color: "#C44B4B",
    eyeColor: "#FF0000",
    packSize: 1,
    canStagger: true,
    staggerDuration: 0.3,
    scrapMin: 3,
    scrapMax: 8,
  },

  coffee_tosser: {
    id: "coffee_tosser",
    name: "Coffee Tosser",
    zone: "highway",
    behavior: "ranged",
    detection: "line_of_sight",
    hp: 15,
    damage: 5,
    attackSpeed: 0.8,
    moveSpeed: 0.5,
    aggroRange: b(16),
    deaggroRange: b(24),
    attackRange: b(14),
    projectileSpeed: 8,
    projectileRange: b(14),
    bodyWidth: 0.6,
    bodyHeight: 0.9,
    headSize: 0.4,
    color: "#8B6914",
    eyeColor: "#FF4444",
    packSize: 1,
    canStagger: true,
    staggerDuration: 0.3,
    scrapMin: 2,
    scrapMax: 5,
  },

  bumper_brawler: {
    id: "bumper_brawler",
    name: "Bumper Brawler",
    zone: "highway",
    behavior: "charge",
    detection: "line_of_sight",
    hp: 35,
    damage: 14,
    attackSpeed: 0.25, // charge every 4s
    moveSpeed: 0.6,
    aggroRange: b(18),
    deaggroRange: b(28),
    attackRange: b(15),
    projectileSpeed: 0,
    projectileRange: 0,
    bodyWidth: 1.2,
    bodyHeight: 1.2,
    headSize: 0.5,
    color: "#5C7D3A",
    eyeColor: "#FF0000",
    packSize: 1,
    canStagger: false,
    staggerDuration: 0,
    scrapMin: 5,
    scrapMax: 10,
  },

  horn_honker: {
    id: "horn_honker",
    name: "Horn Honker",
    zone: "highway",
    behavior: "area_denial",
    detection: "line_of_sight",
    hp: 20,
    damage: 4,
    attackSpeed: 0.33, // honk every 3s
    moveSpeed: 0,
    aggroRange: b(14),
    deaggroRange: b(20),
    attackRange: b(8),
    projectileSpeed: 0,
    projectileRange: 0,
    bodyWidth: 0.7,
    bodyHeight: 0.8,
    headSize: 0.4,
    color: "#4A4A6A",
    eyeColor: "#FFAA00",
    packSize: 1,
    canStagger: true,
    staggerDuration: 0.3,
    scrapMin: 3,
    scrapMax: 6,
  },

  // ── Underground Zone (Tier 2) ──────────────────────────────────────

  sewer_rat: {
    id: "sewer_rat",
    name: "Sewer Rat",
    zone: "underground",
    behavior: "swarm",
    detection: "proximity",
    hp: 10,
    damage: 4,
    attackSpeed: 2.0,
    moveSpeed: 1.2,
    aggroRange: b(10),
    deaggroRange: b(16),
    attackRange: b(2),
    projectileSpeed: 0,
    projectileRange: 0,
    bodyWidth: 0.35,
    bodyHeight: 0.3,
    headSize: 0.2,
    color: "#6B5B3B",
    eyeColor: "#FF0000",
    packSize: 4,
    canStagger: true,
    staggerDuration: 0.2,
    scrapMin: 2,
    scrapMax: 4,
  },

  sewer_gator: {
    id: "sewer_gator",
    name: "Sewer Gator",
    zone: "underground",
    behavior: "ambush",
    detection: "proximity",
    hp: 50,
    damage: 14,
    attackSpeed: 0.8,
    moveSpeed: 0.4,
    aggroRange: b(6),
    deaggroRange: b(20),
    attackRange: b(3),
    projectileSpeed: 0,
    projectileRange: 0,
    bodyWidth: 1.0,
    bodyHeight: 0.6,
    headSize: 0.5,
    color: "#3A5A3A",
    eyeColor: "#FFFF00",
    packSize: 1,
    canStagger: false,
    staggerDuration: 0,
    scrapMin: 10,
    scrapMax: 15,
  },

  mole_bot: {
    id: "mole_bot",
    name: "Mole Bot",
    zone: "underground",
    behavior: "burrow",
    detection: "vibration",
    hp: 40,
    damage: 12,
    attackSpeed: 1.0,
    moveSpeed: 0.6,
    aggroRange: b(16),
    deaggroRange: b(24),
    attackRange: b(3),
    projectileSpeed: 0,
    projectileRange: 0,
    bodyWidth: 0.7,
    bodyHeight: 0.9,
    headSize: 0.4,
    color: "#8B7355",
    eyeColor: "#FFCC00",
    packSize: 1,
    canStagger: true,
    staggerDuration: 0.3,
    scrapMin: 8,
    scrapMax: 12,
  },

  drain_spider: {
    id: "drain_spider",
    name: "Drain Spider",
    zone: "underground",
    behavior: "hit_and_run",
    detection: "sound",
    hp: 25,
    damage: 8,
    attackSpeed: 1.5,
    moveSpeed: 1.0,
    aggroRange: b(12),
    deaggroRange: b(18),
    attackRange: b(2.5),
    projectileSpeed: 6,
    projectileRange: b(10),
    bodyWidth: 0.5,
    bodyHeight: 0.35,
    headSize: 0.25,
    color: "#4A3A5A",
    eyeColor: "#FF0000",
    packSize: 1,
    canStagger: true,
    staggerDuration: 0.3,
    scrapMin: 5,
    scrapMax: 8,
  },

  // ── Street Zone (Tier 3) ───────────────────────────────────────────

  construction_bot: {
    id: "construction_bot",
    name: "Construction Bot",
    zone: "street",
    behavior: "tank",
    detection: "line_of_sight",
    hp: 60,
    damage: 15,
    attackSpeed: 0.8,
    moveSpeed: 0.5,
    aggroRange: b(16),
    deaggroRange: b(24),
    attackRange: b(3),
    projectileSpeed: 0,
    projectileRange: 0,
    bodyWidth: 1.0,
    bodyHeight: 1.6,
    headSize: 0.5,
    color: "#CC7722",
    eyeColor: "#FF0000",
    packSize: 1,
    canStagger: false,
    staggerDuration: 0,
    scrapMin: 15,
    scrapMax: 20,
  },

  stray_dog: {
    id: "stray_dog",
    name: "Stray Dog",
    zone: "street",
    behavior: "flanking",
    detection: "line_of_sight",
    hp: 20,
    damage: 10,
    attackSpeed: 2.0,
    moveSpeed: 1.3,
    aggroRange: b(14),
    deaggroRange: b(22),
    attackRange: b(2),
    projectileSpeed: 0,
    projectileRange: 0,
    bodyWidth: 0.5,
    bodyHeight: 0.5,
    headSize: 0.3,
    color: "#7A6B5A",
    eyeColor: "#332211",
    packSize: 2,
    canStagger: true,
    staggerDuration: 0.2,
    scrapMin: 5,
    scrapMax: 10,
  },

  marta_security: {
    id: "marta_security",
    name: "MARTA Security",
    zone: "street",
    behavior: "tank_shield",
    detection: "line_of_sight",
    hp: 45,
    damage: 12,
    attackSpeed: 1.2,
    moveSpeed: 0.7,
    aggroRange: b(18),
    deaggroRange: b(28),
    attackRange: b(3),
    projectileSpeed: 0,
    projectileRange: 0,
    bodyWidth: 0.8,
    bodyHeight: 1.1,
    headSize: 0.45,
    color: "#2A3A6A",
    eyeColor: "#FF4444",
    packSize: 1,
    canStagger: true,
    staggerDuration: 0.3,
    scrapMin: 12,
    scrapMax: 18,
  },

  crane_drone: {
    id: "crane_drone",
    name: "Crane Drone",
    zone: "street",
    behavior: "ranged",
    detection: "line_of_sight",
    hp: 30,
    damage: 12,
    attackSpeed: 0.25, // drop every 4s
    moveSpeed: 1.0,
    aggroRange: b(20),
    deaggroRange: b(30),
    attackRange: b(16),
    projectileSpeed: 12,
    projectileRange: b(16),
    bodyWidth: 0.6,
    bodyHeight: 0.3,
    headSize: 0,
    color: "#5C5C5C",
    eyeColor: "#FF0000",
    packSize: 1,
    canStagger: true,
    staggerDuration: 0.3,
    scrapMin: 10,
    scrapMax: 15,
  },
};

/** Get enemy type definition by ID */
export function getEnemyType(id: string): EnemyTypeDef | undefined {
  return ENEMY_TYPES[id];
}

/** Get all enemy types for a specific zone */
export function getZoneEnemyTypes(zone: EnemyZone): EnemyTypeDef[] {
  return Object.values(ENEMY_TYPES).filter((t) => t.zone === zone);
}
