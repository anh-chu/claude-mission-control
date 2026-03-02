/**
 * Item definitions and registry for Voxel Traffic Escape.
 * Based on the GDD: 50 unique items across weapons, armor, shields,
 * healing, utility, and crafting materials.
 */

export type ItemCategory =
  | "melee_weapon"
  | "ranged_weapon"
  | "healing"
  | "armor"
  | "shield"
  | "utility"
  | "crafting_material"
  | "currency";

export type EquipSlot = "armor" | "shield" | "utility1" | "utility2" | "utility3";

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  maxStack: number;
  /** Hex color for the voxel representation in-world. */
  color: string;
  /** Tier 1-3, higher = better. */
  tier: number;
  /** Which equipment slot this occupies, if any. */
  equipSlot?: EquipSlot;
  /** Palette index of the block this item places. Only items with blockId can be placed. */
  blockId?: number;
  /** Short description shown in inventory tooltip. */
  description: string;
}

// Stack size constants
const NO_STACK = 1;
const CONSUMABLE_STACK = 20;
const MATERIAL_STACK = 99;
const CURRENCY_STACK = 9999;

const ITEMS: ItemDefinition[] = [
  // ── Melee Weapons (Tier 1 — Highway) ──
  { id: "bare_fists", name: "Bare Fists", category: "melee_weapon", maxStack: NO_STACK, color: "#D2B48C", tier: 1, description: "Your own two hands. 3 damage." },
  { id: "tire_iron", name: "Tire Iron", category: "melee_weapon", maxStack: NO_STACK, color: "#6B6B6B", tier: 1, description: "Solid swing. 8 damage." },
  { id: "broken_antenna", name: "Broken Antenna", category: "melee_weapon", maxStack: NO_STACK, color: "#A0A0A0", tier: 1, description: "Flexible whip. 6 damage." },
  { id: "car_jack_handle", name: "Car Jack Handle", category: "melee_weapon", maxStack: NO_STACK, color: "#4A4A4A", tier: 1, description: "Heavy metal. 10 damage." },
  { id: "road_flare", name: "Road Flare", category: "melee_weapon", maxStack: NO_STACK, color: "#FF4444", tier: 1, description: "Burns on hit. 7 damage + burn." },

  // ── Melee Weapons (Tier 2 — Underground) ──
  { id: "rebar_sword", name: "Rebar Sword", category: "melee_weapon", maxStack: NO_STACK, color: "#8B4513", tier: 2, description: "Rusty but sharp. 14 damage." },
  { id: "pipe_wrench", name: "Pipe Wrench", category: "melee_weapon", maxStack: NO_STACK, color: "#5C5C5C", tier: 2, description: "Industrial strength. 16 damage." },
  { id: "sewer_gator_tooth", name: "Sewer Gator Tooth", category: "melee_weapon", maxStack: NO_STACK, color: "#FFFFF0", tier: 2, description: "Trophy fang. 12 damage." },
  { id: "sledgehammer", name: "Sledgehammer", category: "melee_weapon", maxStack: NO_STACK, color: "#3A3A3A", tier: 2, description: "Slow but devastating. 20 damage." },
  { id: "electric_cable_whip", name: "Electric Cable Whip", category: "melee_weapon", maxStack: NO_STACK, color: "#FFD700", tier: 2, description: "Crafted. 11 damage + chain lightning." },

  // ── Melee Weapons (Tier 3 — Street) ──
  { id: "jackhammer", name: "Jackhammer", category: "melee_weapon", maxStack: NO_STACK, color: "#E8B830", tier: 3, description: "Best mining tool. 25 damage." },
  { id: "rebar_mace", name: "Rebar Mace", category: "melee_weapon", maxStack: NO_STACK, color: "#6B4E35", tier: 3, description: "Crafted. 22 damage." },
  { id: "stop_sign_axe", name: "Stop Sign Axe", category: "melee_weapon", maxStack: NO_STACK, color: "#D94040", tier: 3, description: "Ironic weapon. 18 damage." },
  { id: "construction_saw", name: "Construction Saw", category: "melee_weapon", maxStack: NO_STACK, color: "#FF8C00", tier: 3, description: "Highest raw damage. 28 damage." },
  { id: "traffic_light_flail", name: "Traffic Light Flail", category: "melee_weapon", maxStack: NO_STACK, color: "#228B22", tier: 3, description: "Crafted. 24 damage + knockback." },

  // ── Ranged Weapons ──
  { id: "rock_rubble", name: "Rock / Rubble", category: "ranged_weapon", maxStack: CONSUMABLE_STACK, color: "#808080", tier: 1, description: "Throwable rock. 5 damage." },
  { id: "coffee_cup", name: "Coffee Cup", category: "ranged_weapon", maxStack: CONSUMABLE_STACK, color: "#8B4513", tier: 1, description: "Hot coffee. 4 damage + burn." },
  { id: "hubcap_frisbee", name: "Hubcap Frisbee", category: "ranged_weapon", maxStack: NO_STACK, color: "#C0C0C0", tier: 1, description: "Reusable throw. 8 damage." },
  { id: "pipe_bomb", name: "Pipe Bomb", category: "ranged_weapon", maxStack: CONSUMABLE_STACK, color: "#4A4A4A", tier: 2, description: "Crafted explosive. 30 AoE damage." },
  { id: "nail_gun", name: "Nail Gun", category: "ranged_weapon", maxStack: NO_STACK, color: "#FFD700", tier: 2, description: "Rapid fire. 10 damage, 3/sec." },
  { id: "manhole_cover", name: "Manhole Cover", category: "ranged_weapon", maxStack: NO_STACK, color: "#5C5C5C", tier: 2, description: "Heavy throw. 18 damage." },
  { id: "flare_gun", name: "Flare Gun", category: "ranged_weapon", maxStack: NO_STACK, color: "#FF4500", tier: 3, description: "12 damage + burn AoE." },
  { id: "concrete_launcher", name: "Concrete Launcher", category: "ranged_weapon", maxStack: NO_STACK, color: "#A0A0A0", tier: 3, description: "22 damage, breaks blocks." },

  // ── Healing Items ──
  { id: "gas_station_snack", name: "Gas Station Snack", category: "healing", maxStack: CONSUMABLE_STACK, color: "#FFA500", tier: 1, description: "Restores 15 HP." },
  { id: "water_bottle", name: "Water Bottle", category: "healing", maxStack: CONSUMABLE_STACK, color: "#87CEEB", tier: 1, description: "Restores 20 HP." },
  { id: "energy_drink", name: "Energy Drink", category: "healing", maxStack: CONSUMABLE_STACK, color: "#00FF00", tier: 2, description: "30 HP + speed buff." },
  { id: "first_aid_kit", name: "First Aid Kit", category: "healing", maxStack: CONSUMABLE_STACK, color: "#FF0000", tier: 2, description: "Restores 50 HP." },
  { id: "waffle_house_plate", name: "Waffle House Plate", category: "healing", maxStack: CONSUMABLE_STACK, color: "#F5C518", tier: 3, description: "75 HP over time." },
  { id: "sweet_tea_jug", name: "Sweet Tea Jug", category: "healing", maxStack: NO_STACK, color: "#8B4513", tier: 3, description: "Full heal. Rare boss drop." },

  // ── Armor ──
  { id: "hi_vis_vest", name: "Hi-Vis Vest", category: "armor", maxStack: NO_STACK, color: "#ADFF2F", tier: 1, equipSlot: "armor", description: "10% damage reduction." },
  { id: "seat_cover_padding", name: "Seat Cover Padding", category: "armor", maxStack: NO_STACK, color: "#D2B48C", tier: 1, equipSlot: "armor", description: "Crafted. 15% DR." },
  { id: "sewer_plate_mail", name: "Sewer Plate Mail", category: "armor", maxStack: NO_STACK, color: "#5C6668", tier: 2, equipSlot: "armor", description: "Crafted. 25% DR." },
  { id: "manhole_vest", name: "Manhole Vest", category: "armor", maxStack: NO_STACK, color: "#4A4A4A", tier: 2, equipSlot: "armor", description: "30% damage reduction." },
  { id: "hard_hat_suit", name: "Hard Hat Suit", category: "armor", maxStack: NO_STACK, color: "#FFD700", tier: 3, equipSlot: "armor", description: "35% damage reduction." },
  { id: "marta_riot_gear", name: "MARTA Riot Gear", category: "armor", maxStack: NO_STACK, color: "#0068A8", tier: 3, equipSlot: "armor", description: "40% DR. Rarest armor." },

  // ── Shields ──
  { id: "car_door", name: "Car Door", category: "shield", maxStack: NO_STACK, color: "#A8A29E", tier: 1, equipSlot: "shield", description: "40% block chance." },
  { id: "traffic_cone_shield", name: "Traffic Cone Shield", category: "shield", maxStack: NO_STACK, color: "#F07830", tier: 1, equipSlot: "shield", description: "30% block chance." },
  { id: "sewer_grate", name: "Sewer Grate", category: "shield", maxStack: NO_STACK, color: "#5C5C5C", tier: 2, equipSlot: "shield", description: "50% block chance." },
  { id: "dumpster_lid", name: "Dumpster Lid", category: "shield", maxStack: NO_STACK, color: "#3A5A4A", tier: 3, equipSlot: "shield", description: "60% block chance." },
  { id: "riot_shield", name: "Riot Shield", category: "shield", maxStack: NO_STACK, color: "#2A2724", tier: 3, equipSlot: "shield", description: "75% block. Best shield." },

  // ── Utility ──
  { id: "phone_flashlight", name: "Phone Flashlight", category: "utility", maxStack: NO_STACK, color: "#E8E4DC", tier: 1, equipSlot: "utility1", description: "Starting light source." },
  { id: "hard_hat", name: "Hard Hat", category: "utility", maxStack: NO_STACK, color: "#FFD700", tier: 1, equipSlot: "utility1", description: "Debris protection." },
  { id: "work_flashlight", name: "Work Flashlight", category: "utility", maxStack: NO_STACK, color: "#E8B830", tier: 2, equipSlot: "utility1", description: "Better illumination." },
  { id: "grapple_hook", name: "Grapple Hook", category: "utility", maxStack: NO_STACK, color: "#6B6B6B", tier: 2, equipSlot: "utility2", description: "Key traversal item." },
  { id: "marta_pass", name: "MARTA Pass", category: "utility", maxStack: NO_STACK, color: "#0068A8", tier: 2, equipSlot: "utility2", description: "Fast travel. Quest reward." },
  { id: "walkie_talkie", name: "Walkie-Talkie", category: "utility", maxStack: NO_STACK, color: "#2A2724", tier: 2, equipSlot: "utility3", description: "Reveals enemies on minimap." },
  { id: "boots_of_hustle", name: "Boots of Hustle", category: "utility", maxStack: NO_STACK, color: "#D94040", tier: 3, equipSlot: "utility3", description: "+25% move speed." },
  { id: "night_vision_goggles", name: "Night Vision Goggles", category: "utility", maxStack: NO_STACK, color: "#4D7A2E", tier: 3, equipSlot: "utility1", description: "Full dark visibility." },

  // ── Crafting Materials ──
  { id: "scrap_metal", name: "Scrap Metal", category: "crafting_material", maxStack: MATERIAL_STACK, color: "#A0A0A0", tier: 1, blockId: 7, description: "Common salvage material. Placeable." },
  { id: "concrete_chunk", name: "Concrete Chunk", category: "crafting_material", maxStack: MATERIAL_STACK, color: "#9B9489", tier: 1, blockId: 5, description: "Heavy building debris. Placeable." },
  { id: "cable_wire", name: "Cable / Wire", category: "crafting_material", maxStack: MATERIAL_STACK, color: "#FFD700", tier: 1, description: "Flexible wiring." },
  { id: "battery", name: "Battery", category: "crafting_material", maxStack: MATERIAL_STACK, color: "#2A2724", tier: 1, description: "Stored electricity." },
  { id: "chain", name: "Chain", category: "crafting_material", maxStack: MATERIAL_STACK, color: "#6B6B6B", tier: 1, description: "Heavy metal links." },
  { id: "seat_cover", name: "Seat Cover", category: "crafting_material", maxStack: MATERIAL_STACK, color: "#D2B48C", tier: 1, description: "Salvaged upholstery." },
  { id: "metal_plates", name: "Metal Plates", category: "crafting_material", maxStack: MATERIAL_STACK, color: "#5C6668", tier: 2, blockId: 104, description: "Sturdy flat metal. Placeable." },
  { id: "pipe", name: "Pipe", category: "crafting_material", maxStack: MATERIAL_STACK, color: "#5C5C5C", tier: 1, description: "Cylindrical tube." },
  { id: "gunpowder", name: "Gunpowder", category: "crafting_material", maxStack: MATERIAL_STACK, color: "#2A2724", tier: 2, description: "Explosive powder." },
  { id: "traffic_light", name: "Traffic Light", category: "crafting_material", maxStack: NO_STACK, color: "#228B22", tier: 2, description: "Heavy signal light." },

  // ── Ammo ──
  { id: "nails", name: "Nails", category: "crafting_material", maxStack: MATERIAL_STACK, color: "#8A8A8A", tier: 1, description: "Nail Gun ammo." },
  { id: "wood", name: "Wood", category: "crafting_material", maxStack: MATERIAL_STACK, color: "#A0785A", tier: 1, blockId: 75, description: "Salvaged wood planks. Placeable." },

  // ── Building Blocks ──
  { id: "concrete_barricade", name: "Concrete Barricade", category: "crafting_material", maxStack: 10, color: "#9B9489", tier: 2, blockId: 6, description: "Crafted. Placeable concrete block." },
  { id: "scrap_bridge_plank", name: "Scrap Bridge Plank", category: "crafting_material", maxStack: 10, color: "#A0A0A0", tier: 2, blockId: 46, description: "Crafted. Placeable metal plank." },
  { id: "makeshift_ladder", name: "Makeshift Ladder", category: "crafting_material", maxStack: 10, color: "#8B7355", tier: 2, blockId: 10, description: "Crafted. Placeable wood block." },

  // ── Currency ──
  { id: "scrap", name: "Scrap", category: "currency", maxStack: CURRENCY_STACK, color: "#C0C0C0", tier: 1, description: "Universal currency." },
];

const registry = new Map<string, ItemDefinition>();
for (const item of ITEMS) {
  registry.set(item.id, item);
}

export function getItem(id: string): ItemDefinition | undefined {
  return registry.get(id);
}

export function getItemOrThrow(id: string): ItemDefinition {
  const item = registry.get(id);
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}

export function getAllItems(): ItemDefinition[] {
  return [...ITEMS];
}

export function getItemsByCategory(category: ItemCategory): ItemDefinition[] {
  return ITEMS.filter((i) => i.category === category);
}
