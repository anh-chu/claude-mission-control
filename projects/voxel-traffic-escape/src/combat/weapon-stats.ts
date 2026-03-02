/**
 * Weapon stat definitions for all melee and ranged weapons.
 *
 * Damage values come from item-registry descriptions.
 * Attack speed is in attacks-per-second (higher = faster).
 * Range is in world units (melee reach or projectile max range).
 * Knockback is the force applied to targets on hit.
 */

export type WeaponType = "melee" | "ranged";
export type DamageType = "physical" | "fire" | "electric";

export interface WeaponStats {
  itemId: string;
  type: WeaponType;
  damage: number;
  /** Attacks per second */
  attackSpeed: number;
  /** Melee reach or projectile max range (world units) */
  range: number;
  /** Knockback force applied to targets */
  knockback: number;
  /** Arc width in radians for melee swing hitbox */
  swingArc: number;
  /** Extra damage type (burn, chain lightning, etc.) */
  damageType: DamageType;
  /** Extra damage from elemental effect */
  bonusDamage: number;
  /** Whether projectile is consumed on use (ammo) */
  consumable: boolean;
  /** For ranged: projectile speed (world units/sec) */
  projectileSpeed: number;
  /** For ranged: AoE radius (0 = single target) */
  aoeRadius: number;
}

const MELEE_DEFAULTS = {
  type: "melee" as const,
  swingArc: Math.PI / 2, // 90 degree arc
  damageType: "physical" as const,
  bonusDamage: 0,
  consumable: false,
  projectileSpeed: 0,
  aoeRadius: 0,
};

const RANGED_DEFAULTS = {
  type: "ranged" as const,
  swingArc: 0,
  damageType: "physical" as const,
  bonusDamage: 0,
  consumable: false,
  projectileSpeed: 20,
  aoeRadius: 0,
};

const WEAPON_DATA: WeaponStats[] = [
  // ── Melee Tier 1 (Highway) ──
  { ...MELEE_DEFAULTS, itemId: "bare_fists", damage: 3, attackSpeed: 3.0, range: 1.2, knockback: 2 },
  { ...MELEE_DEFAULTS, itemId: "tire_iron", damage: 8, attackSpeed: 2.0, range: 1.8, knockback: 5 },
  { ...MELEE_DEFAULTS, itemId: "broken_antenna", damage: 6, attackSpeed: 2.5, range: 2.0, knockback: 3 },
  { ...MELEE_DEFAULTS, itemId: "car_jack_handle", damage: 10, attackSpeed: 1.5, range: 1.6, knockback: 7 },
  { ...MELEE_DEFAULTS, itemId: "road_flare", damage: 7, attackSpeed: 2.0, range: 1.5, knockback: 3, damageType: "fire", bonusDamage: 3 },

  // ── Melee Tier 2 (Underground) ──
  { ...MELEE_DEFAULTS, itemId: "rebar_sword", damage: 14, attackSpeed: 1.8, range: 2.0, knockback: 5 },
  { ...MELEE_DEFAULTS, itemId: "pipe_wrench", damage: 16, attackSpeed: 1.4, range: 1.8, knockback: 8 },
  { ...MELEE_DEFAULTS, itemId: "sewer_gator_tooth", damage: 12, attackSpeed: 2.2, range: 1.5, knockback: 4 },
  { ...MELEE_DEFAULTS, itemId: "sledgehammer", damage: 20, attackSpeed: 0.8, range: 2.0, knockback: 12 },
  { ...MELEE_DEFAULTS, itemId: "electric_cable_whip", damage: 11, attackSpeed: 2.0, range: 2.5, knockback: 4, damageType: "electric", bonusDamage: 5 },

  // ── Melee Tier 3 (Street) ──
  { ...MELEE_DEFAULTS, itemId: "jackhammer", damage: 25, attackSpeed: 1.2, range: 1.5, knockback: 10 },
  { ...MELEE_DEFAULTS, itemId: "rebar_mace", damage: 22, attackSpeed: 1.3, range: 2.0, knockback: 9 },
  { ...MELEE_DEFAULTS, itemId: "stop_sign_axe", damage: 18, attackSpeed: 1.6, range: 2.2, knockback: 7 },
  { ...MELEE_DEFAULTS, itemId: "construction_saw", damage: 28, attackSpeed: 1.0, range: 1.5, knockback: 6 },
  { ...MELEE_DEFAULTS, itemId: "traffic_light_flail", damage: 24, attackSpeed: 1.0, range: 2.5, knockback: 15, swingArc: Math.PI * 0.6 },

  // ── Ranged Tier 1 ──
  { ...RANGED_DEFAULTS, itemId: "rock_rubble", damage: 5, attackSpeed: 1.5, range: 15, knockback: 3, consumable: true, projectileSpeed: 18 },
  { ...RANGED_DEFAULTS, itemId: "coffee_cup", damage: 4, attackSpeed: 1.5, range: 12, knockback: 2, consumable: true, projectileSpeed: 16, damageType: "fire", bonusDamage: 2 },
  { ...RANGED_DEFAULTS, itemId: "hubcap_frisbee", damage: 8, attackSpeed: 1.2, range: 20, knockback: 5, projectileSpeed: 22 },

  // ── Ranged Tier 2 ──
  { ...RANGED_DEFAULTS, itemId: "pipe_bomb", damage: 30, attackSpeed: 0.5, range: 18, knockback: 15, consumable: true, projectileSpeed: 14, aoeRadius: 4 },
  { ...RANGED_DEFAULTS, itemId: "nail_gun", damage: 10, attackSpeed: 3.0, range: 15, knockback: 2, projectileSpeed: 30 },
  { ...RANGED_DEFAULTS, itemId: "manhole_cover", damage: 18, attackSpeed: 0.6, range: 12, knockback: 12, projectileSpeed: 16 },

  // ── Ranged Tier 3 ──
  { ...RANGED_DEFAULTS, itemId: "flare_gun", damage: 12, attackSpeed: 0.8, range: 25, knockback: 6, projectileSpeed: 20, damageType: "fire", bonusDamage: 8, aoeRadius: 3 },
  { ...RANGED_DEFAULTS, itemId: "concrete_launcher", damage: 22, attackSpeed: 0.5, range: 20, knockback: 10, projectileSpeed: 18 },
];

const weaponMap = new Map<string, WeaponStats>();
for (const w of WEAPON_DATA) {
  weaponMap.set(w.itemId, w);
}

export function getWeaponStats(itemId: string): WeaponStats | undefined {
  return weaponMap.get(itemId);
}

export function isWeapon(itemId: string): boolean {
  return weaponMap.has(itemId);
}

export function getUnarmedStats(): WeaponStats {
  return weaponMap.get("bare_fists")!;
}
