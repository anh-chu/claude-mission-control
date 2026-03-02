/**
 * Loot drop tables for enemies and containers.
 *
 * Based on the GDD (docs/vte/05-loot-weapons-health.md):
 * - Each enemy type has a defined set of drops with drop rates
 * - Scrap drops are guaranteed with a min-max range
 * - Item drops use independent probability rolls
 * - Containers use zone-specific drop tables with 1-3 item count
 */

export type ZoneId = "highway" | "underground" | "street";

export interface LootEntry {
  /** Item ID from item-registry */
  itemId: string;
  /** Drop chance 0-1 (1 = guaranteed) */
  chance: number;
  /** Quantity range [min, max] */
  quantity: [number, number];
}

export interface LootTable {
  /** Guaranteed scrap drop range [min, max], or null for no scrap */
  scrap: [number, number] | null;
  /** Item drop entries — each rolled independently */
  items: LootEntry[];
}

// ── Enemy Drop Tables ──

export const ENEMY_LOOT: Record<string, LootTable> = {
  // Highway enemies
  road_rager: {
    scrap: [3, 8],
    items: [
      { itemId: "gas_station_snack", chance: 0.20, quantity: [1, 1] },
    ],
  },
  coffee_tosser: {
    scrap: [2, 5],
    items: [
      { itemId: "coffee_cup", chance: 0.30, quantity: [1, 1] },
    ],
  },
  bumper_brawler: {
    scrap: [5, 10],
    items: [
      { itemId: "battery", chance: 0.15, quantity: [1, 1] },
      { itemId: "seat_cover", chance: 0.10, quantity: [1, 1] },
    ],
  },
  horn_honker: {
    scrap: [3, 6],
    items: [
      { itemId: "scrap_metal", chance: 0.10, quantity: [1, 1] },
    ],
  },

  // Underground enemies
  sewer_rat: {
    scrap: [2, 4],
    items: [
      { itemId: "scrap_metal", chance: 0.10, quantity: [1, 1] },
    ],
  },
  sewer_gator: {
    scrap: [10, 15],
    items: [
      { itemId: "sewer_gator_tooth", chance: 0.05, quantity: [1, 1] },
      { itemId: "metal_plates", chance: 0.15, quantity: [1, 1] },
    ],
  },
  mole_bot: {
    scrap: [8, 12],
    items: [
      { itemId: "battery", chance: 0.10, quantity: [1, 1] },
    ],
  },
  drain_spider: {
    scrap: [5, 8],
    items: [
      { itemId: "cable_wire", chance: 0.10, quantity: [1, 1] },
    ],
  },

  // Street enemies
  construction_bot: {
    scrap: [15, 20],
    items: [
      { itemId: "scrap_metal", chance: 0.10, quantity: [1, 2] },
      { itemId: "chain", chance: 0.05, quantity: [1, 1] },
    ],
  },
  stray_dog: {
    scrap: [5, 10],
    items: [],
  },
  marta_security: {
    scrap: [12, 18],
    items: [
      { itemId: "dumpster_lid", chance: 0.08, quantity: [1, 1] },
      { itemId: "energy_drink", chance: 0.05, quantity: [1, 1] },
    ],
  },
  crane_drone: {
    scrap: [10, 15],
    items: [
      { itemId: "battery", chance: 0.08, quantity: [1, 1] },
      { itemId: "scrap_metal", chance: 0.05, quantity: [1, 1] },
    ],
  },

  // Boss enemies — guaranteed drops
  big_rig_bertha: {
    scrap: [50, 50],
    items: [
      { itemId: "sledgehammer", chance: 1.0, quantity: [1, 1] },
      { itemId: "energy_drink", chance: 1.0, quantity: [2, 2] },
    ],
  },
  king_gator: {
    scrap: [75, 75],
    items: [
      { itemId: "sweet_tea_jug", chance: 1.0, quantity: [1, 1] },
    ],
  },
  the_foreman: {
    scrap: [100, 100],
    items: [
      { itemId: "construction_saw", chance: 1.0, quantity: [1, 1] },
      { itemId: "marta_riot_gear", chance: 1.0, quantity: [1, 1] },
    ],
  },
};

// ── Container Drop Tables (by zone) ──

export const CONTAINER_LOOT: Record<ZoneId, LootTable> = {
  highway: {
    scrap: [3, 8],
    items: [
      { itemId: "gas_station_snack", chance: 0.30, quantity: [1, 2] },
      { itemId: "water_bottle", chance: 0.20, quantity: [1, 1] },
      { itemId: "tire_iron", chance: 0.15, quantity: [1, 1] },
      { itemId: "broken_antenna", chance: 0.15, quantity: [1, 1] },
      { itemId: "road_flare", chance: 0.10, quantity: [1, 1] },
      { itemId: "hi_vis_vest", chance: 0.08, quantity: [1, 1] },
      { itemId: "car_door", chance: 0.08, quantity: [1, 1] },
      { itemId: "traffic_cone_shield", chance: 0.10, quantity: [1, 1] },
      { itemId: "coffee_cup", chance: 0.12, quantity: [1, 1] },
      { itemId: "hubcap_frisbee", chance: 0.08, quantity: [1, 1] },
      { itemId: "car_jack_handle", chance: 0.05, quantity: [1, 1] },
      { itemId: "hard_hat", chance: 0.05, quantity: [1, 1] },
      { itemId: "seat_cover", chance: 0.10, quantity: [1, 1] },
      { itemId: "battery", chance: 0.08, quantity: [1, 1] },
    ],
  },
  underground: {
    scrap: [8, 15],
    items: [
      { itemId: "water_bottle", chance: 0.20, quantity: [1, 1] },
      { itemId: "first_aid_kit", chance: 0.08, quantity: [1, 1] },
      { itemId: "rebar_sword", chance: 0.12, quantity: [1, 1] },
      { itemId: "pipe_wrench", chance: 0.10, quantity: [1, 1] },
      { itemId: "nail_gun", chance: 0.05, quantity: [1, 1] },
      { itemId: "sewer_grate", chance: 0.08, quantity: [1, 1] },
      { itemId: "manhole_vest", chance: 0.04, quantity: [1, 1] },
      { itemId: "cable_wire", chance: 0.15, quantity: [1, 2] },
      { itemId: "metal_plates", chance: 0.12, quantity: [1, 2] },
      { itemId: "pipe", chance: 0.10, quantity: [1, 1] },
      { itemId: "scrap_metal", chance: 0.20, quantity: [1, 3] },
      { itemId: "energy_drink", chance: 0.10, quantity: [1, 1] },
      { itemId: "walkie_talkie", chance: 0.05, quantity: [1, 1] },
      { itemId: "grapple_hook", chance: 0.03, quantity: [1, 1] },
    ],
  },
  street: {
    scrap: [15, 25],
    items: [
      { itemId: "first_aid_kit", chance: 0.12, quantity: [1, 1] },
      { itemId: "energy_drink", chance: 0.15, quantity: [1, 1] },
      { itemId: "stop_sign_axe", chance: 0.08, quantity: [1, 1] },
      { itemId: "jackhammer", chance: 0.03, quantity: [1, 1] },
      { itemId: "flare_gun", chance: 0.05, quantity: [1, 1] },
      { itemId: "concrete_launcher", chance: 0.03, quantity: [1, 1] },
      { itemId: "hard_hat_suit", chance: 0.05, quantity: [1, 1] },
      { itemId: "riot_shield", chance: 0.03, quantity: [1, 1] },
      { itemId: "marta_riot_gear", chance: 0.02, quantity: [1, 1] },
      { itemId: "boots_of_hustle", chance: 0.03, quantity: [1, 1] },
      { itemId: "night_vision_goggles", chance: 0.03, quantity: [1, 1] },
      { itemId: "concrete_chunk", chance: 0.15, quantity: [1, 3] },
      { itemId: "chain", chance: 0.10, quantity: [1, 1] },
      { itemId: "traffic_light", chance: 0.08, quantity: [1, 1] },
      { itemId: "waffle_house_plate", chance: 0.04, quantity: [1, 1] },
    ],
  },
};

// ── Roll helpers ──

/** Random integer in [min, max] inclusive. */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface LootDrop {
  itemId: string;
  quantity: number;
}

/**
 * Roll a loot table and return the resulting drops.
 * Each entry is rolled independently (not mutually exclusive).
 */
export function rollLootTable(table: LootTable): LootDrop[] {
  const drops: LootDrop[] = [];

  // Guaranteed scrap drop
  if (table.scrap) {
    const amount = randInt(table.scrap[0], table.scrap[1]);
    if (amount > 0) {
      drops.push({ itemId: "scrap", quantity: amount });
    }
  }

  // Roll each item entry independently
  for (const entry of table.items) {
    if (Math.random() < entry.chance) {
      const qty = randInt(entry.quantity[0], entry.quantity[1]);
      if (qty > 0) {
        drops.push({ itemId: entry.itemId, quantity: qty });
      }
    }
  }

  return drops;
}

/**
 * Roll drops for a specific enemy type.
 * Returns empty array if enemy type is unknown.
 */
export function rollEnemyDrops(enemyType: string): LootDrop[] {
  const table = ENEMY_LOOT[enemyType];
  if (!table) return [];
  return rollLootTable(table);
}

/**
 * Roll drops for a container in a specific zone.
 * Containers drop 1-3 items (not counting scrap).
 * We roll the full table and cap non-scrap items.
 */
export function rollContainerDrops(zone: ZoneId): LootDrop[] {
  const table = CONTAINER_LOOT[zone];
  if (!table) return [];

  const allDrops = rollLootTable(table);

  // Separate scrap from item drops
  const scrapDrops = allDrops.filter((d) => d.itemId === "scrap");
  const itemDrops = allDrops.filter((d) => d.itemId !== "scrap");

  // Cap non-scrap items to 1-3
  const maxItems = randInt(1, 3);
  const cappedItems = itemDrops.slice(0, maxItems);

  return [...scrapDrops, ...cappedItems];
}
