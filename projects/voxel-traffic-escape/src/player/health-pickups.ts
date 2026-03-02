/**
 * Health pickup item definitions and usage logic.
 *
 * From the GDD:
 * - Gas Station Snack: 15 HP instant
 * - Water Bottle: 20 HP instant
 * - Energy Drink: 30 HP instant + 5s speed boost
 * - First Aid Kit: 50 HP instant
 * - Waffle House Plate: 75 HP over 10s
 * - Sweet Tea Jug: full heal instant
 */

import { HealthSystem } from "@/player/health";

export type HealingItemId =
  | "gas_station_snack"
  | "water_bottle"
  | "energy_drink"
  | "first_aid_kit"
  | "waffle_house_plate"
  | "sweet_tea_jug"
  | "heart_container";

export interface HealingItemDef {
  id: HealingItemId;
  name: string;
  healAmount: number;
  /** If > 0, healing is spread over this many seconds instead of instant */
  healDurationSec: number;
  /** Extra buff effect ID (e.g. "speed_boost"), empty string if none */
  buffId: string;
  /** Duration of the buff in seconds */
  buffDurationSec: number;
  /** Max stack size in inventory */
  stackSize: number;
  /** Tier / zone */
  tier: number;
  description: string;
}

export const HEALING_ITEMS: Record<HealingItemId, HealingItemDef> = {
  gas_station_snack: {
    id: "gas_station_snack",
    name: "Gas Station Snack",
    healAmount: 15,
    healDurationSec: 0,
    buffId: "",
    buffDurationSec: 0,
    stackSize: 20,
    tier: 1,
    description: "Chips, candy bars — they're everywhere.",
  },
  water_bottle: {
    id: "water_bottle",
    name: "Water Bottle",
    healAmount: 20,
    healDurationSec: 0,
    buffId: "",
    buffDurationSec: 0,
    stackSize: 20,
    tier: 1,
    description: "Basic reliable hydration.",
  },
  energy_drink: {
    id: "energy_drink",
    name: "Energy Drink",
    healAmount: 30,
    healDurationSec: 0,
    buffId: "speed_boost",
    buffDurationSec: 5,
    stackSize: 20,
    tier: 2,
    description: "+20% move speed for 5 seconds.",
  },
  first_aid_kit: {
    id: "first_aid_kit",
    name: "First Aid Kit",
    healAmount: 50,
    healDurationSec: 0,
    buffId: "",
    buffDurationSec: 0,
    stackSize: 20,
    tier: 2,
    description: "Found in vehicles and buildings.",
  },
  waffle_house_plate: {
    id: "waffle_house_plate",
    name: "Waffle House Plate",
    healAmount: 75,
    healDurationSec: 10,
    buffId: "",
    buffDurationSec: 0,
    stackSize: 20,
    tier: 3,
    description: "Sit down and eat. Atlanta's finest.",
  },
  sweet_tea_jug: {
    id: "sweet_tea_jug",
    name: "Sweet Tea Jug",
    healAmount: -1, // Special: full heal
    healDurationSec: 0,
    buffId: "",
    buffDurationSec: 0,
    stackSize: 20,
    tier: 3,
    description: "Fully restores HP. A trophy item.",
  },
  heart_container: {
    id: "heart_container",
    name: "Heart Container",
    healAmount: 0, // Special: +10 max HP
    healDurationSec: 0,
    buffId: "",
    buffDurationSec: 0,
    stackSize: 1,
    tier: 0,
    description: "Permanently increases max HP by 10.",
  },
};

export interface UseItemResult {
  success: boolean;
  /** Buff to apply (empty string if none) */
  buffId: string;
  buffDurationSec: number;
  /** Message to show player */
  message: string;
}

/**
 * Use a healing item on the player.
 * Returns the result including any buffs to apply.
 */
export function useHealingItem(
  itemId: HealingItemId,
  health: HealthSystem
): UseItemResult {
  const def = HEALING_ITEMS[itemId];
  if (!def) {
    return { success: false, buffId: "", buffDurationSec: 0, message: "Unknown item" };
  }

  // Heart container — special handling
  if (itemId === "heart_container") {
    const added = health.addHeartContainer();
    if (!added) {
      return {
        success: false,
        buffId: "",
        buffDurationSec: 0,
        message: "Already at max heart containers!",
      };
    }
    return {
      success: true,
      buffId: "",
      buffDurationSec: 0,
      message: `Max HP increased to ${health.maxHp}!`,
    };
  }

  // Don't waste healing items at full HP (except for buffs)
  if (health.hp >= health.maxHp && !def.buffId) {
    return {
      success: false,
      buffId: "",
      buffDurationSec: 0,
      message: "Already at full health!",
    };
  }

  // Sweet Tea Jug — full heal
  if (itemId === "sweet_tea_jug") {
    const missingHp = health.maxHp - health.hp;
    if (missingHp > 0) {
      health.heal(missingHp, def.name);
    }
    return {
      success: true,
      buffId: "",
      buffDurationSec: 0,
      message: "Fully healed!",
    };
  }

  // Heal-over-time (Waffle House Plate)
  if (def.healDurationSec > 0) {
    health.startHealOverTime(def.healAmount, def.healDurationSec, def.name);
    return {
      success: true,
      buffId: def.buffId,
      buffDurationSec: def.buffDurationSec,
      message: `Healing ${def.healAmount} HP over ${def.healDurationSec}s...`,
    };
  }

  // Instant heal
  health.heal(def.healAmount, def.name);

  return {
    success: true,
    buffId: def.buffId,
    buffDurationSec: def.buffDurationSec,
    message: def.buffId
      ? `+${def.healAmount} HP and ${def.name} boost!`
      : `+${def.healAmount} HP`,
  };
}
