/**
 * Mining tool stats — maps melee weapons to mining capabilities.
 *
 * Each tool has:
 *   - miningTier: max block hardness it can efficiently mine (0–3)
 *   - miningSpeed: multiplier on base break time (higher = faster)
 *   - durability: total uses before the tool breaks (-1 = infinite)
 */

import type { MaterialType } from "./block-registry";

export interface MiningToolStats {
  itemId: string;
  /** Max hardness tier this tool handles efficiently (0–3) */
  miningTier: number;
  /** Speed multiplier (1.0 = bare hands, higher = faster) */
  miningSpeed: number;
  /** Total uses before breaking (-1 = infinite, e.g. fists) */
  durability: number;
}

/**
 * Block hardness by material type.
 *   0 = soft (any tool)
 *   1 = medium (tier 1+ recommended)
 *   2 = hard  (tier 2+ recommended)
 *   3 = tough (tier 3+ recommended)
 *  -1 = unbreakable
 */
const MATERIAL_HARDNESS: Record<MaterialType, number> = {
  glass: 0,
  paint: 0,
  organic: 0,
  dirt: 0,
  none: 1,
  wood: 1,
  stone: 2,
  metal: 3,
  water: -1,
};

/** Base break times in seconds (before tool modifier).
 *  Tuned so bare-hand mining feels snappy (~0.1–0.4s for common blocks).
 *  Tools then provide additional speed multipliers on top. */
const BASE_BREAK_TIME: Record<MaterialType, number> = {
  stone: 0.3,
  metal: 0.4,
  glass: 0.06,
  dirt: 0.12,
  wood: 0.2,
  paint: 0.08,
  organic: 0.1,
  water: 0,
  none: 0.16,
};

/**
 * Penalty multiplier when tool tier is below block hardness.
 * Each tier gap adds this much slowdown.
 */
const UNDERPOWERED_PENALTY = 3.0;

/**
 * Mining stats for all melee weapons.
 * Items not listed here get bare-fist stats.
 */
const MINING_TOOL_DATA: MiningToolStats[] = [
  // ── Bare hands (always available, weakest) ──
  { itemId: "bare_fists", miningTier: 0, miningSpeed: 1.0, durability: -1 },

  // ── Tier 1 — Highway tools ──
  { itemId: "tire_iron", miningTier: 1, miningSpeed: 1.3, durability: 120 },
  { itemId: "broken_antenna", miningTier: 0, miningSpeed: 1.1, durability: 60 },
  { itemId: "car_jack_handle", miningTier: 1, miningSpeed: 1.5, durability: 150 },
  { itemId: "road_flare", miningTier: 0, miningSpeed: 1.0, durability: 30 },

  // ── Tier 2 — Underground tools ──
  { itemId: "rebar_sword", miningTier: 1, miningSpeed: 1.4, durability: 180 },
  { itemId: "pipe_wrench", miningTier: 2, miningSpeed: 2.0, durability: 200 },
  { itemId: "sewer_gator_tooth", miningTier: 1, miningSpeed: 1.2, durability: 100 },
  { itemId: "sledgehammer", miningTier: 2, miningSpeed: 2.5, durability: 250 },
  { itemId: "electric_cable_whip", miningTier: 1, miningSpeed: 1.3, durability: 140 },

  // ── Tier 3 — Street tools ──
  { itemId: "jackhammer", miningTier: 3, miningSpeed: 4.0, durability: 300 },
  { itemId: "rebar_mace", miningTier: 2, miningSpeed: 2.2, durability: 220 },
  { itemId: "stop_sign_axe", miningTier: 2, miningSpeed: 1.8, durability: 200 },
  { itemId: "construction_saw", miningTier: 3, miningSpeed: 3.5, durability: 180 },
  { itemId: "traffic_light_flail", miningTier: 2, miningSpeed: 2.0, durability: 250 },
];

const miningMap = new Map<string, MiningToolStats>();
for (const t of MINING_TOOL_DATA) {
  miningMap.set(t.itemId, t);
}

/** Default stats used when no tool is held (bare fists). */
const BARE_FISTS_STATS: MiningToolStats = miningMap.get("bare_fists")!;

export function getMiningStats(itemId: string | null): MiningToolStats {
  if (!itemId) return BARE_FISTS_STATS;
  return miningMap.get(itemId) ?? BARE_FISTS_STATS;
}

export function getHardness(material: MaterialType): number {
  return MATERIAL_HARDNESS[material];
}

export function getBaseBreakTime(material: MaterialType): number {
  return BASE_BREAK_TIME[material];
}

/**
 * Calculate effective break time for a tool vs a material.
 * Returns 0 if the block is unbreakable.
 */
export function calcBreakTime(material: MaterialType, toolStats: MiningToolStats): number {
  const hardness = MATERIAL_HARDNESS[material];
  if (hardness < 0) return 0; // unbreakable

  const baseTime = BASE_BREAK_TIME[material] ?? 0.8;

  // Apply tool speed multiplier
  let time = baseTime / toolStats.miningSpeed;

  // Penalty for underpowered tools
  const tierGap = hardness - toolStats.miningTier;
  if (tierGap > 0) {
    time *= Math.pow(UNDERPOWERED_PENALTY, tierGap);
  }

  return time;
}
