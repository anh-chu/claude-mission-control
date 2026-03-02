/**
 * Crafting system for Voxel Traffic Escape.
 *
 * 10 recipes per GDD (06-crafting-building.md):
 *   - 8 basic (craft anywhere)
 *   - 2 advanced (workbench required)
 *
 * Design: instant crafting, recipes visible when player has >= 1 ingredient,
 * greyed out if missing materials. No undo.
 */

import { getItemOrThrow, type ItemDefinition } from "./item-registry";
import { type Inventory } from "./inventory";

// ── Types ──

export interface RecipeIngredient {
  itemId: string;
  quantity: number;
}

export interface Recipe {
  id: string;
  resultItemId: string;
  resultQuantity: number;
  ingredients: RecipeIngredient[];
  requiresWorkbench: boolean;
}

export interface RecipeAvailability {
  recipe: Recipe;
  resultDef: ItemDefinition;
  /** True if player has all ingredients (and workbench if required). */
  canCraft: boolean;
  /** Per-ingredient status: how many the player has vs how many are needed. */
  ingredientStatus: {
    def: ItemDefinition;
    needed: number;
    have: number;
  }[];
}

// ── All 10 recipes ──

const RECIPES: Recipe[] = [
  // Basic recipes (craft anywhere)
  {
    id: "recipe_cable_whip",
    resultItemId: "electric_cable_whip",
    resultQuantity: 1,
    ingredients: [
      { itemId: "cable_wire", quantity: 1 },
      { itemId: "battery", quantity: 1 },
    ],
    requiresWorkbench: false,
  },
  {
    id: "recipe_pipe_bomb",
    resultItemId: "pipe_bomb",
    resultQuantity: 1,
    ingredients: [
      { itemId: "pipe", quantity: 1 },
      { itemId: "gunpowder", quantity: 1 },
    ],
    requiresWorkbench: false,
  },
  {
    id: "recipe_seat_cover_padding",
    resultItemId: "seat_cover_padding",
    resultQuantity: 1,
    ingredients: [{ itemId: "seat_cover", quantity: 2 }],
    requiresWorkbench: false,
  },
  {
    id: "recipe_nails",
    resultItemId: "nails",
    resultQuantity: 10,
    ingredients: [{ itemId: "scrap_metal", quantity: 3 }],
    requiresWorkbench: false,
  },
  {
    id: "recipe_sewer_plate_mail",
    resultItemId: "sewer_plate_mail",
    resultQuantity: 1,
    ingredients: [{ itemId: "metal_plates", quantity: 4 }],
    requiresWorkbench: false,
  },
  {
    id: "recipe_concrete_barricade",
    resultItemId: "concrete_barricade",
    resultQuantity: 1,
    ingredients: [{ itemId: "concrete_chunk", quantity: 4 }],
    requiresWorkbench: false,
  },
  {
    id: "recipe_scrap_bridge_plank",
    resultItemId: "scrap_bridge_plank",
    resultQuantity: 1,
    ingredients: [{ itemId: "scrap_metal", quantity: 2 }],
    requiresWorkbench: false,
  },
  {
    id: "recipe_makeshift_ladder",
    resultItemId: "makeshift_ladder",
    resultQuantity: 1,
    ingredients: [
      { itemId: "scrap_metal", quantity: 2 },
      { itemId: "wood", quantity: 1 },
    ],
    requiresWorkbench: false,
  },

  // Advanced recipes (workbench required)
  {
    id: "recipe_rebar_mace",
    resultItemId: "rebar_mace",
    resultQuantity: 1,
    ingredients: [
      { itemId: "rebar_sword", quantity: 1 },
      { itemId: "concrete_chunk", quantity: 1 },
    ],
    requiresWorkbench: true,
  },
  {
    id: "recipe_traffic_light_flail",
    resultItemId: "traffic_light_flail",
    resultQuantity: 1,
    ingredients: [
      { itemId: "traffic_light", quantity: 1 },
      { itemId: "chain", quantity: 1 },
    ],
    requiresWorkbench: true,
  },
];

// ── Crafting System ──

export class CraftingSystem {
  private inventory: Inventory;

  /**
   * Set to true when the player is within interaction range of a workbench.
   * Controlled externally (by world/entity system).
   */
  isNearWorkbench = false;

  constructor(inventory: Inventory) {
    this.inventory = inventory;
  }

  /** Get all recipes, ordered by availability. */
  getAllRecipes(): Recipe[] {
    return RECIPES;
  }

  /**
   * Get recipes the player has at least 1 ingredient for,
   * along with availability info for each.
   */
  getAvailableRecipes(): RecipeAvailability[] {
    const results: RecipeAvailability[] = [];

    for (const recipe of RECIPES) {
      const ingredientStatus = recipe.ingredients.map((ing) => ({
        def: getItemOrThrow(ing.itemId),
        needed: ing.quantity,
        have: this.inventory.countItem(ing.itemId),
      }));

      const hasAnyIngredient = ingredientStatus.some((s) => s.have > 0);
      if (!hasAnyIngredient) continue;

      const hasAllIngredients = ingredientStatus.every(
        (s) => s.have >= s.needed
      );
      const workbenchOk = !recipe.requiresWorkbench || this.isNearWorkbench;
      const hasRoom = this.inventory.hasRoom(
        recipe.resultItemId,
        recipe.resultQuantity
      );

      results.push({
        recipe,
        resultDef: getItemOrThrow(recipe.resultItemId),
        canCraft: hasAllIngredients && workbenchOk && hasRoom,
        ingredientStatus,
      });
    }

    // Craftable recipes first, then by recipe order
    results.sort((a, b) => {
      if (a.canCraft && !b.canCraft) return -1;
      if (!a.canCraft && b.canCraft) return 1;
      return 0;
    });

    return results;
  }

  /** Check if a specific recipe can be crafted right now. */
  canCraft(recipeId: string): boolean {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return false;

    if (recipe.requiresWorkbench && !this.isNearWorkbench) return false;

    for (const ing of recipe.ingredients) {
      if (this.inventory.countItem(ing.itemId) < ing.quantity) return false;
    }

    return this.inventory.hasRoom(recipe.resultItemId, recipe.resultQuantity);
  }

  /**
   * Execute a craft. Consumes ingredients and produces the result item.
   * Returns true on success, false if requirements not met.
   */
  craft(recipeId: string): boolean {
    if (!this.canCraft(recipeId)) return false;

    const recipe = RECIPES.find((r) => r.id === recipeId)!;

    // Consume ingredients
    for (const ing of recipe.ingredients) {
      this.inventory.removeItem(ing.itemId, ing.quantity);
    }

    // Produce result
    this.inventory.addItem(recipe.resultItemId, recipe.resultQuantity);

    return true;
  }
}
