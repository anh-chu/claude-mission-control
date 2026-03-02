/**
 * Toast notification system — stacking, auto-dismissing notifications.
 *
 * Displays at top-center, max 3 visible at once.
 * Each toast fades in, holds for the specified duration, then fades out.
 * Style: dark background, gold (#F5C518) border, monospace font.
 *
 * Also includes recipe discovery tracking: when a new recipe becomes
 * available (player picks up an ingredient they didn't have before),
 * a toast is fired with a "NEW" badge and recipe name.
 */

import { type Inventory } from "@/items/inventory";
import { type CraftingSystem, type Recipe } from "@/items/crafting";
import { getItemOrThrow } from "@/items/item-registry";

// ── Toast entry ──

interface ToastEntry {
  el: HTMLDivElement;
  remaining: number;
  fadingOut: boolean;
}

const MAX_VISIBLE = 3;
const FADE_IN_MS = 300;
const FADE_OUT_MS = 500;

// ── ToastSystem ──

export class ToastSystem {
  private container: HTMLDivElement | null = null;
  private toasts: ToastEntry[] = [];

  constructor() {
    // empty — mount() creates DOM
  }

  mount(): void {
    if (this.container) return;

    this.container = document.createElement("div");
    Object.assign(this.container.style, {
      position: "fixed",
      top: "16px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "56",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "6px",
      pointerEvents: "none",
      fontFamily: "monospace",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.container);
  }

  unmount(): void {
    for (const t of this.toasts) {
      t.el.remove();
    }
    this.toasts = [];
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  /**
   * Show a toast notification.
   * @param message  Text content (may include HTML)
   * @param duration  How long to display in seconds (default 3)
   */
  show(message: string, duration = 3): void {
    if (!this.container) return;

    // Evict oldest if at capacity
    while (this.toasts.length >= MAX_VISIBLE) {
      const oldest = this.toasts.shift();
      if (oldest) oldest.el.remove();
    }

    const el = document.createElement("div");
    Object.assign(el.style, {
      background: "rgba(0,0,0,0.85)",
      border: "1px solid #F5C518",
      borderRadius: "4px",
      padding: "8px 16px",
      color: "#E8E4DC",
      fontSize: "13px",
      lineHeight: "1.4",
      opacity: "0",
      transition: `opacity ${FADE_IN_MS}ms ease`,
      whiteSpace: "nowrap",
    } satisfies Partial<CSSStyleDeclaration>);
    el.innerHTML = message;

    this.container.appendChild(el);

    const entry: ToastEntry = { el, remaining: duration, fadingOut: false };
    this.toasts.push(entry);

    // Trigger fade-in
    requestAnimationFrame(() => {
      el.style.opacity = "1";
    });
  }

  /**
   * Called every frame. Ticks down toast timers and handles fade-out removal.
   */
  update(dt: number): void {
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];

      if (t.fadingOut) continue; // already fading, removal handled by transitionend

      t.remaining -= dt;
      if (t.remaining <= 0) {
        t.fadingOut = true;
        t.el.style.transition = `opacity ${FADE_OUT_MS}ms ease`;
        t.el.style.opacity = "0";

        // Remove after fade-out completes
        setTimeout(() => {
          t.el.remove();
          const idx = this.toasts.indexOf(t);
          if (idx !== -1) this.toasts.splice(idx, 1);
        }, FADE_OUT_MS);
      }
    }
  }
}

// ── Recipe Discovery Tracker ──

/**
 * Tracks which recipes the player has seen as "available" and fires toasts
 * when a new recipe becomes discoverable (player picks up a new ingredient).
 */
export class RecipeDiscoveryTracker {
  private knownRecipeIds = new Set<string>();
  private toasts: ToastSystem;
  private inventory: Inventory;
  private crafting: CraftingSystem;

  constructor(toasts: ToastSystem, inventory: Inventory, crafting: CraftingSystem) {
    this.toasts = toasts;
    this.inventory = inventory;
    this.crafting = crafting;
  }

  /**
   * Call after an item is added to inventory.
   * Checks if any new recipes became visible (player has >= 1 ingredient).
   */
  checkNewRecipes(): void {
    const allRecipes: Recipe[] = this.crafting.getAllRecipes();

    for (const recipe of allRecipes) {
      if (this.knownRecipeIds.has(recipe.id)) continue;

      // Check if the player now has at least one ingredient
      const hasAny = recipe.ingredients.some(
        (ing) => this.inventory.countItem(ing.itemId) > 0
      );

      if (hasAny) {
        this.knownRecipeIds.add(recipe.id);
        const resultDef = getItemOrThrow(recipe.resultItemId);
        this.toasts.show(
          `<span style="color:#F5C518;font-weight:bold">NEW</span> ` +
          `Recipe discovered: <span style="color:#F5C518">${resultDef.name}</span>`
        );
      }
    }
  }
}
