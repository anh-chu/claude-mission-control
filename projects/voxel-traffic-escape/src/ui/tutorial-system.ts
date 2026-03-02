/**
 * Tutorial System — contextual hint overlays triggered by gameplay milestones.
 *
 * Shows one-time hints at key moments: first item pickup, first inventory open,
 * first crafting materials gathered, zone transitions (collapse, underground, streets).
 *
 * Each hint displays for 4 seconds then fades out over 1 second.
 * Milestones are tracked so no hint repeats.
 */

interface TutorialHint {
  milestone: string;
  /** HTML content for the hint (may contain gold-colored key names). */
  html: string;
}

const HINTS: TutorialHint[] = [
  {
    milestone: "first_item",
    html: 'Press <span style="color:#F5C518">E</span> to open Inventory',
  },
  {
    milestone: "first_inventory",
    html: 'Drag items between slots. <span style="color:#F5C518">1-8</span> for hotbar.',
  },
  {
    milestone: "first_craft_materials",
    html: 'Check <span style="color:#F5C518">Crafting</span> in your Inventory (<span style="color:#F5C518">E</span>)',
  },
  {
    milestone: "collapse_zone",
    html: "The highway has collapsed. Find a way underground.",
  },
  {
    milestone: "underground",
    html: "Watch for enemies in the dark.",
  },
  {
    milestone: "street_zone",
    html: "Find the apartment building to escape!",
  },
];

export class TutorialSystem {
  private completed = new Set<string>();
  private container: HTMLDivElement | null = null;
  private activeHint: HTMLDivElement | null = null;
  private activeTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // empty — mount() creates DOM
  }

  mount(): void {
    if (this.container) return;

    this.container = document.createElement("div");
    Object.assign(this.container.style, {
      position: "fixed",
      top: "60px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "55",
      pointerEvents: "none",
      fontFamily: "monospace",
      textAlign: "center",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.container);
  }

  unmount(): void {
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = null;
    }
    if (this.activeHint) {
      this.activeHint.remove();
      this.activeHint = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  /**
   * Called every frame with player position to check location-based milestones.
   */
  update(_dt: number, playerX: number, playerY: number): void {
    // Location-based milestones
    if (playerX > 140) this.trigger("collapse_zone");
    if (playerY < -2) this.trigger("underground");
    if (playerX > 176) this.trigger("street_zone");
  }

  /** Called by inventory system when an item is added. */
  onItemAdded(): void {
    this.trigger("first_item");
  }

  /** Called when the inventory screen is opened. */
  onInventoryOpened(): void {
    this.trigger("first_inventory");
  }

  /** Called when the number of crafting materials the player holds changes. */
  onCraftingMaterialCount(count: number): void {
    if (count >= 2) {
      this.trigger("first_craft_materials");
    }
  }

  // ── Private ──

  private trigger(milestone: string): void {
    if (this.completed.has(milestone)) return;
    this.completed.add(milestone);

    const hint = HINTS.find((h) => h.milestone === milestone);
    if (!hint) return;

    this.showHint(hint.html);
  }

  private showHint(html: string): void {
    if (!this.container) return;

    // Remove any active hint
    if (this.activeHint) {
      this.activeHint.remove();
      this.activeHint = null;
    }
    if (this.activeTimeout) {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = null;
    }

    const el = document.createElement("div");
    Object.assign(el.style, {
      background: "rgba(0,0,0,0.75)",
      color: "#E8E4DC",
      padding: "10px 20px",
      borderRadius: "6px",
      fontSize: "14px",
      lineHeight: "1.6",
      opacity: "0",
      transition: "opacity 0.4s ease",
    } satisfies Partial<CSSStyleDeclaration>);
    el.innerHTML = html;

    this.container.appendChild(el);
    this.activeHint = el;

    // Fade in
    requestAnimationFrame(() => {
      el.style.opacity = "1";
    });

    // After 4s, fade out over 1s then remove
    this.activeTimeout = setTimeout(() => {
      el.style.transition = "opacity 1s ease";
      el.style.opacity = "0";
      this.activeTimeout = setTimeout(() => {
        el.remove();
        if (this.activeHint === el) this.activeHint = null;
      }, 1000);
    }, 4000);
  }
}
