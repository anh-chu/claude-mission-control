/**
 * Full inventory screen — overlay that opens/closes with E key.
 *
 * Layout:
 *   ┌──────────────────────────────────┐
 *   │  EQUIPMENT (5 slots)             │
 *   │  [Armor] [Shield]               │
 *   │  [Util1] [Util2] [Util3]        │
 *   ├──────────────────────────────────┤
 *   │  BACKPACK (8x3 grid = 24 slots) │
 *   │  ┌──┬──┬──┬──┬──┬──┬──┬──┐     │
 *   │  │  │  │  │  │  │  │  │  │ x3  │
 *   │  └──┴──┴──┴──┴──┴──┴──┴──┘     │
 *   ├──────────────────────────────────┤
 *   │  HOTBAR (8 slots)               │
 *   │  ┌──┬──┬──┬──┬──┬──┬──┬──┐     │
 *   │  │ 1│ 2│ 3│ 4│ 5│ 6│ 7│ 8│     │
 *   │  └──┴──┴──┴──┴──┴──┴──┴──┘     │
 *   ├──────────────────────────────────┤
 *   │  CRAFTING (recipe list + detail) │
 *   └──────────────────────────────────┘
 *
 * Supports drag-and-drop between slots to move/swap/merge items.
 */

import {
  type Inventory,
  type InventorySlot,
  HOTBAR_SIZE,
  BACKPACK_COLS,
  BACKPACK_ROWS,
} from "@/items/inventory";
import { getItem, type EquipSlot, type ItemCategory } from "@/items/item-registry";
import { type CraftingSystem, type RecipeAvailability } from "@/items/crafting";

// ── Drag state ──

interface DragSource {
  area: "hotbar" | "backpack" | "equipment";
  index: number;
  equipSlot?: EquipSlot;
}

// ── Styles ──

const COLORS = {
  bg: "rgba(0,0,0,0.85)",
  panelBg: "rgba(30,28,26,0.95)",
  slotBg: "rgba(60,58,55,0.8)",
  slotBorder: "rgba(255,255,255,0.15)",
  slotHover: "rgba(245,197,24,0.3)",
  selected: "#F5C518",
  text: "#E8E4DC",
  textDim: "rgba(232,228,220,0.5)",
  tooltipBg: "rgba(20,18,16,0.95)",
  craftable: "rgba(80,180,80,0.3)",
  craftableText: "#6CDB6C",
  missing: "rgba(200,60,60,0.3)",
  missingText: "#E05555",
  workbench: "#D4A940",
};

const SLOT_SIZE = 52;
const SLOT_GAP = 4;

// Category badge colors/labels for item type indicators
const CATEGORY_BADGE: Record<ItemCategory, { label: string; color: string }> = {
  melee_weapon: { label: "M", color: "#E05555" },
  ranged_weapon: { label: "R", color: "#E0A055" },
  healing: { label: "+", color: "#55CC55" },
  armor: { label: "A", color: "#5588DD" },
  shield: { label: "S", color: "#55BBCC" },
  utility: { label: "U", color: "#CCBB55" },
  crafting_material: { label: "C", color: "#888888" },
  currency: { label: "$", color: "#F5C518" },
};

// Tier border colors
const TIER_COLORS: Record<number, string> = {
  1: "rgba(255,255,255,0.15)",
  2: "#8899BB",
  3: "#F5C518",
};

export class InventoryScreen {
  private overlay: HTMLDivElement | null = null;
  private inventory: Inventory;
  private crafting: CraftingSystem | null;
  private _isOpen = false;
  private dragSource: DragSource | null = null;
  private dragGhost: HTMLDivElement | null = null;
  private tooltip: HTMLDivElement | null = null;
  private cleanup: (() => void) | null = null;
  private selectedRecipeId: string | null = null;

  constructor(inventory: Inventory, crafting?: CraftingSystem) {
    this.inventory = inventory;
    this.crafting = crafting ?? null;
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  toggle(): void {
    if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.overlay = this.buildUI();
    document.body.appendChild(this.overlay);

    this.cleanup = this.inventory.onChange(() => this.refresh());
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.cancelDrag();
    this.cleanup?.();
    this.cleanup = null;
    this.overlay?.remove();
    this.overlay = null;
    this.tooltip?.remove();
    this.tooltip = null;
    this.selectedRecipeId = null;
  }

  // ── Build UI ──

  private buildUI(): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.id = "inventory-screen";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      background: COLORS.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "20",
      fontFamily: "monospace",
      color: COLORS.text,
      cursor: "default",
    } satisfies Partial<CSSStyleDeclaration>);

    overlay.addEventListener("mousemove", this.onMouseMove);
    overlay.addEventListener("mouseup", this.onMouseUp);

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      background: COLORS.panelBg,
      borderRadius: "8px",
      padding: "20px",
      border: `1px solid ${COLORS.slotBorder}`,
      minWidth: "460px",
      maxHeight: "90vh",
      overflowY: "auto",
    } satisfies Partial<CSSStyleDeclaration>);

    // Title
    const title = document.createElement("div");
    title.textContent = "INVENTORY";
    Object.assign(title.style, {
      fontSize: "16px",
      fontWeight: "bold",
      marginBottom: "16px",
      textAlign: "center",
      letterSpacing: "2px",
      color: COLORS.selected,
    } satisfies Partial<CSSStyleDeclaration>);
    panel.appendChild(title);

    // Equipment section
    panel.appendChild(this.buildEquipmentSection());

    // Separator
    panel.appendChild(this.buildSeparator());

    // Backpack section
    panel.appendChild(this.buildSectionLabel("BACKPACK"));
    panel.appendChild(this.buildGrid("backpack", BACKPACK_COLS, BACKPACK_ROWS));

    // Separator
    panel.appendChild(this.buildSeparator());

    // Hotbar section
    panel.appendChild(this.buildSectionLabel("HOTBAR"));
    panel.appendChild(this.buildGrid("hotbar", HOTBAR_SIZE, 1));

    // Crafting section
    if (this.crafting) {
      panel.appendChild(this.buildSeparator());
      panel.appendChild(this.buildCraftingSection());
    }

    // Close hint
    const hint = document.createElement("div");
    hint.textContent = "Press [E] to close";
    Object.assign(hint.style, {
      fontSize: "11px",
      textAlign: "center",
      marginTop: "12px",
      color: COLORS.textDim,
    } satisfies Partial<CSSStyleDeclaration>);
    panel.appendChild(hint);

    overlay.appendChild(panel);
    return overlay;
  }

  private buildEquipmentSection(): HTMLDivElement {
    const section = document.createElement("div");

    const label = this.buildSectionLabel("EQUIPMENT");
    section.appendChild(label);

    const grid = document.createElement("div");
    Object.assign(grid.style, {
      display: "flex",
      gap: `${SLOT_GAP}px`,
      justifyContent: "center",
      flexWrap: "wrap",
    } satisfies Partial<CSSStyleDeclaration>);

    const equipSlots: { slot: EquipSlot; label: string }[] = [
      { slot: "armor", label: "Armor" },
      { slot: "shield", label: "Shield" },
      { slot: "utility1", label: "Util 1" },
      { slot: "utility2", label: "Util 2" },
      { slot: "utility3", label: "Util 3" },
    ];

    for (const { slot, label } of equipSlots) {
      const slotEl = this.createSlotElement(
        this.inventory.equipment[slot],
        label
      );
      slotEl.dataset.area = "equipment";
      slotEl.dataset.equipSlot = slot;

      slotEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        if (this.inventory.equipment[slot]) {
          this.inventory.unequip(slot);
        }
      });

      this.addSlotHoverTooltip(slotEl, this.inventory.equipment[slot]);
      grid.appendChild(slotEl);
    }

    section.appendChild(grid);
    return section;
  }

  private buildGrid(
    area: "hotbar" | "backpack",
    cols: number,
    rows: number
  ): HTMLDivElement {
    const grid = document.createElement("div");
    Object.assign(grid.style, {
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, ${SLOT_SIZE}px)`,
      gap: `${SLOT_GAP}px`,
      justifyContent: "center",
    } satisfies Partial<CSSStyleDeclaration>);

    const slots = area === "hotbar" ? this.inventory.hotbar : this.inventory.backpack;

    for (let i = 0; i < cols * rows; i++) {
      const stack = slots[i];
      const keyHint = area === "hotbar" ? String(i + 1) : undefined;
      const slotEl = this.createSlotElement(stack, keyHint);
      slotEl.dataset.area = area;
      slotEl.dataset.index = String(i);

      // Drag start
      slotEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        if (stack) {
          this.startDrag(
            { area, index: i },
            stack,
            e.clientX,
            e.clientY
          );
        }
      });

      this.addSlotHoverTooltip(slotEl, stack);

      // Highlight selected hotbar slot
      if (area === "hotbar" && i === this.inventory.selectedSlot) {
        slotEl.style.borderColor = COLORS.selected;
        slotEl.style.boxShadow = `0 0 6px rgba(245,197,24,0.4)`;
      }

      grid.appendChild(slotEl);
    }

    return grid;
  }

  private createSlotElement(
    stack: InventorySlot,
    hint?: string
  ): HTMLDivElement {
    const slot = document.createElement("div");
    Object.assign(slot.style, {
      width: `${SLOT_SIZE}px`,
      height: `${SLOT_SIZE}px`,
      background: COLORS.slotBg,
      border: `2px solid ${COLORS.slotBorder}`,
      borderRadius: "4px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      cursor: stack ? "grab" : "default",
    } satisfies Partial<CSSStyleDeclaration>);

    slot.addEventListener("mouseenter", () => {
      slot.style.background = COLORS.slotHover;
    });
    slot.addEventListener("mouseleave", () => {
      slot.style.background = COLORS.slotBg;
    });

    if (hint) {
      const keyLabel = document.createElement("span");
      keyLabel.textContent = hint;
      Object.assign(keyLabel.style, {
        position: "absolute",
        top: "2px",
        left: "4px",
        fontSize: "9px",
        color: COLORS.textDim,
      } satisfies Partial<CSSStyleDeclaration>);
      slot.appendChild(keyLabel);
    }

    if (stack) {
      const def = getItem(stack.itemId);
      if (def) {
        // Tier-colored border for higher-tier items
        const tierColor = TIER_COLORS[def.tier] ?? COLORS.slotBorder;
        if (def.tier >= 2) {
          slot.style.borderColor = tierColor;
        }

        const swatch = document.createElement("div");
        Object.assign(swatch.style, {
          width: "26px",
          height: "26px",
          borderRadius: "3px",
          background: def.color,
          border: "1px solid rgba(255,255,255,0.2)",
        } satisfies Partial<CSSStyleDeclaration>);
        slot.appendChild(swatch);

        // Category badge (top-right)
        const badge = CATEGORY_BADGE[def.category];
        if (badge) {
          const badgeEl = document.createElement("span");
          badgeEl.textContent = badge.label;
          Object.assign(badgeEl.style, {
            position: "absolute",
            top: "2px",
            right: "3px",
            fontSize: "8px",
            fontWeight: "bold",
            color: badge.color,
            opacity: "0.7",
          } satisfies Partial<CSSStyleDeclaration>);
          slot.appendChild(badgeEl);
        }

        if (stack.quantity > 1) {
          const count = document.createElement("span");
          count.textContent = String(stack.quantity);
          Object.assign(count.style, {
            position: "absolute",
            bottom: "2px",
            right: "4px",
            fontSize: "11px",
            fontWeight: "bold",
            color: COLORS.text,
            textShadow: "1px 1px 0 #000",
          } satisfies Partial<CSSStyleDeclaration>);
          slot.appendChild(count);
        }
      }
    }

    return slot;
  }

  // ── Crafting UI ──

  private buildCraftingSection(): HTMLDivElement {
    const section = document.createElement("div");

    section.appendChild(this.buildSectionLabel("CRAFTING"));

    const recipes = this.crafting!.getAvailableRecipes();

    if (recipes.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "Collect materials to discover recipes";
      Object.assign(empty.style, {
        fontSize: "11px",
        color: COLORS.textDim,
        textAlign: "center",
        padding: "8px 0",
      } satisfies Partial<CSSStyleDeclaration>);
      section.appendChild(empty);
      return section;
    }

    // Recipe list (button row)
    const recipeList = document.createElement("div");
    Object.assign(recipeList.style, {
      display: "flex",
      flexWrap: "wrap",
      gap: "4px",
      marginBottom: "8px",
    } satisfies Partial<CSSStyleDeclaration>);

    for (const avail of recipes) {
      const btn = this.buildRecipeButton(avail);
      recipeList.appendChild(btn);
    }
    section.appendChild(recipeList);

    // Selected recipe detail
    const selected = recipes.find(
      (r) => r.recipe.id === this.selectedRecipeId
    );
    if (selected) {
      section.appendChild(this.buildRecipeDetail(selected));
    }

    return section;
  }

  private buildRecipeButton(avail: RecipeAvailability): HTMLDivElement {
    const { recipe, resultDef, canCraft } = avail;
    const isSelected = recipe.id === this.selectedRecipeId;

    const btn = document.createElement("div");
    Object.assign(btn.style, {
      display: "flex",
      alignItems: "center",
      gap: "4px",
      padding: "4px 8px",
      borderRadius: "4px",
      border: isSelected
        ? `2px solid ${COLORS.selected}`
        : `1px solid ${canCraft ? COLORS.craftableText : COLORS.slotBorder}`,
      background: canCraft ? COLORS.craftable : COLORS.slotBg,
      cursor: "pointer",
      fontSize: "11px",
      opacity: canCraft ? "1" : "0.6",
    } satisfies Partial<CSSStyleDeclaration>);

    // Color swatch
    const swatch = document.createElement("div");
    Object.assign(swatch.style, {
      width: "14px",
      height: "14px",
      borderRadius: "2px",
      background: resultDef.color,
      border: "1px solid rgba(255,255,255,0.2)",
      flexShrink: "0",
    } satisfies Partial<CSSStyleDeclaration>);
    btn.appendChild(swatch);

    // Name
    const name = document.createElement("span");
    let label = resultDef.name;
    if (recipe.resultQuantity > 1) label += ` x${recipe.resultQuantity}`;
    name.textContent = label;
    name.style.color = canCraft ? COLORS.text : COLORS.textDim;
    btn.appendChild(name);

    // Workbench icon
    if (recipe.requiresWorkbench) {
      const wrench = document.createElement("span");
      wrench.textContent = "[W]";
      wrench.style.color = COLORS.workbench;
      wrench.style.fontSize = "9px";
      wrench.style.marginLeft = "2px";
      btn.appendChild(wrench);
    }

    btn.addEventListener("mouseenter", () => {
      if (!isSelected) {
        btn.style.borderColor = COLORS.selected;
      }
    });
    btn.addEventListener("mouseleave", () => {
      if (!isSelected) {
        btn.style.borderColor = canCraft
          ? COLORS.craftableText
          : COLORS.slotBorder;
      }
    });

    btn.addEventListener("click", () => {
      this.selectedRecipeId = recipe.id;
      this.refresh();
    });

    return btn;
  }

  private buildRecipeDetail(avail: RecipeAvailability): HTMLDivElement {
    const { recipe, resultDef, canCraft, ingredientStatus } = avail;

    const detail = document.createElement("div");
    Object.assign(detail.style, {
      background: "rgba(40,38,36,0.9)",
      borderRadius: "4px",
      padding: "10px",
      border: `1px solid ${COLORS.slotBorder}`,
    } satisfies Partial<CSSStyleDeclaration>);

    // Result name
    const resultRow = document.createElement("div");
    Object.assign(resultRow.style, {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      marginBottom: "8px",
    } satisfies Partial<CSSStyleDeclaration>);

    const resultSwatch = document.createElement("div");
    Object.assign(resultSwatch.style, {
      width: "20px",
      height: "20px",
      borderRadius: "3px",
      background: resultDef.color,
      border: "1px solid rgba(255,255,255,0.2)",
    } satisfies Partial<CSSStyleDeclaration>);
    resultRow.appendChild(resultSwatch);

    const resultName = document.createElement("span");
    let resultLabel = resultDef.name;
    if (recipe.resultQuantity > 1) resultLabel += ` x${recipe.resultQuantity}`;
    resultName.textContent = resultLabel;
    resultName.style.fontWeight = "bold";
    resultName.style.fontSize = "13px";
    resultRow.appendChild(resultName);

    detail.appendChild(resultRow);

    // Ingredients
    const ingLabel = document.createElement("div");
    ingLabel.textContent = "Requires:";
    ingLabel.style.fontSize = "10px";
    ingLabel.style.color = COLORS.textDim;
    ingLabel.style.marginBottom = "4px";
    detail.appendChild(ingLabel);

    for (const ing of ingredientStatus) {
      const ingRow = document.createElement("div");
      Object.assign(ingRow.style, {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        marginBottom: "2px",
        fontSize: "11px",
      } satisfies Partial<CSSStyleDeclaration>);

      const ingSwatch = document.createElement("div");
      Object.assign(ingSwatch.style, {
        width: "12px",
        height: "12px",
        borderRadius: "2px",
        background: ing.def.color,
        border: "1px solid rgba(255,255,255,0.15)",
      } satisfies Partial<CSSStyleDeclaration>);
      ingRow.appendChild(ingSwatch);

      const ingText = document.createElement("span");
      const hasEnough = ing.have >= ing.needed;
      ingText.textContent = `${ing.def.name} (${ing.have}/${ing.needed})`;
      ingText.style.color = hasEnough
        ? COLORS.craftableText
        : COLORS.missingText;
      ingRow.appendChild(ingText);

      const checkmark = document.createElement("span");
      checkmark.textContent = hasEnough ? "OK" : "NEED";
      checkmark.style.fontSize = "9px";
      checkmark.style.fontWeight = "bold";
      checkmark.style.color = hasEnough
        ? COLORS.craftableText
        : COLORS.missingText;
      ingRow.appendChild(checkmark);

      detail.appendChild(ingRow);
    }

    // Workbench warning
    if (recipe.requiresWorkbench && !this.crafting!.isNearWorkbench) {
      const warning = document.createElement("div");
      warning.textContent = "Requires workbench";
      Object.assign(warning.style, {
        fontSize: "10px",
        color: COLORS.workbench,
        marginTop: "4px",
      } satisfies Partial<CSSStyleDeclaration>);
      detail.appendChild(warning);
    }

    // CRAFT button
    const craftBtn = document.createElement("button");
    craftBtn.textContent = "CRAFT";
    Object.assign(craftBtn.style, {
      display: "block",
      width: "100%",
      marginTop: "8px",
      padding: "6px",
      border: "none",
      borderRadius: "4px",
      fontFamily: "monospace",
      fontSize: "13px",
      fontWeight: "bold",
      letterSpacing: "2px",
      cursor: canCraft ? "pointer" : "default",
      background: canCraft ? COLORS.craftableText : COLORS.slotBg,
      color: canCraft ? "#1A1A1A" : COLORS.textDim,
      opacity: canCraft ? "1" : "0.5",
    } satisfies Partial<CSSStyleDeclaration>);

    if (canCraft) {
      craftBtn.addEventListener("mouseenter", () => {
        craftBtn.style.background = "#8AFF8A";
      });
      craftBtn.addEventListener("mouseleave", () => {
        craftBtn.style.background = COLORS.craftableText;
      });
      craftBtn.addEventListener("click", () => {
        this.crafting!.craft(recipe.id);
        this.refresh();
      });
    }

    detail.appendChild(craftBtn);

    return detail;
  }

  // ── Helpers ──

  private buildSectionLabel(text: string): HTMLDivElement {
    const label = document.createElement("div");
    label.textContent = text;
    Object.assign(label.style, {
      fontSize: "11px",
      fontWeight: "bold",
      marginBottom: "6px",
      color: COLORS.textDim,
      letterSpacing: "1px",
    } satisfies Partial<CSSStyleDeclaration>);
    return label;
  }

  private buildSeparator(): HTMLDivElement {
    const sep = document.createElement("div");
    Object.assign(sep.style, {
      height: "1px",
      background: COLORS.slotBorder,
      margin: "12px 0",
    } satisfies Partial<CSSStyleDeclaration>);
    return sep;
  }

  // ── Drag and drop ──

  private startDrag(
    source: DragSource,
    stack: NonNullable<InventorySlot>,
    x: number,
    y: number
  ): void {
    this.dragSource = source;

    const def = getItem(stack.itemId);
    if (!def) return;

    const ghost = document.createElement("div");
    Object.assign(ghost.style, {
      position: "fixed",
      width: "40px",
      height: "40px",
      borderRadius: "4px",
      background: def.color,
      border: "2px solid rgba(255,255,255,0.5)",
      opacity: "0.8",
      pointerEvents: "none",
      zIndex: "100",
      left: `${x - 20}px`,
      top: `${y - 20}px`,
    } satisfies Partial<CSSStyleDeclaration>);

    document.body.appendChild(ghost);
    this.dragGhost = ghost;
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (this.dragGhost) {
      this.dragGhost.style.left = `${e.clientX - 20}px`;
      this.dragGhost.style.top = `${e.clientY - 20}px`;
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (!this.dragSource) return;

    const target = e.target as HTMLElement;
    const slotEl = target.closest("[data-area]") as HTMLElement | null;

    if (slotEl) {
      const toArea = slotEl.dataset.area as "hotbar" | "backpack" | "equipment";
      const from = this.dragSource;

      if (toArea === "equipment") {
        // Equip from source
        if (from.area === "hotbar" || from.area === "backpack") {
          this.inventory.equip(from.area, from.index);
        }
      } else if (from.area === "equipment") {
        // Unequip back — already handled by click
      } else {
        const toIndex = parseInt(slotEl.dataset.index ?? "0", 10);
        this.inventory.swapSlots(from.area, from.index, toArea, toIndex);
      }
    }

    this.cancelDrag();
    this.refresh();
  };

  private cancelDrag(): void {
    this.dragSource = null;
    this.dragGhost?.remove();
    this.dragGhost = null;
  }

  // ── Tooltips ──

  private addSlotHoverTooltip(
    slotEl: HTMLDivElement,
    stack: InventorySlot
  ): void {
    slotEl.addEventListener("mouseenter", (e) => {
      if (!stack) return;
      const def = getItem(stack.itemId);
      if (!def) return;
      this.showItemTooltip(def, e.clientX, e.clientY);
    });

    slotEl.addEventListener("mouseleave", () => {
      this.hideTooltip();
    });
  }

  private showItemTooltip(
    def: { name: string; description: string; category: ItemCategory; tier: number },
    x: number,
    y: number
  ): void {
    this.hideTooltip();

    const tip = document.createElement("div");
    Object.assign(tip.style, {
      position: "fixed",
      left: `${x + 16}px`,
      top: `${y - 8}px`,
      background: COLORS.tooltipBg,
      border: `1px solid ${COLORS.slotBorder}`,
      borderRadius: "4px",
      padding: "8px 10px",
      zIndex: "200",
      pointerEvents: "none",
      fontFamily: "monospace",
      fontSize: "12px",
      maxWidth: "240px",
    } satisfies Partial<CSSStyleDeclaration>);

    // Name (colored by tier)
    const tierColor = def.tier >= 3 ? COLORS.selected : def.tier >= 2 ? "#8899BB" : COLORS.selected;
    const nameEl = document.createElement("div");
    nameEl.textContent = def.name;
    nameEl.style.fontWeight = "bold";
    nameEl.style.color = tierColor;
    nameEl.style.marginBottom = "2px";
    tip.appendChild(nameEl);

    // Category + tier line
    const badge = CATEGORY_BADGE[def.category];
    const catLabel = def.category.replace(/_/g, " ");
    const metaEl = document.createElement("div");
    metaEl.textContent = `Tier ${def.tier} ${catLabel}`;
    metaEl.style.fontSize = "10px";
    metaEl.style.color = badge?.color ?? COLORS.textDim;
    metaEl.style.marginBottom = "4px";
    tip.appendChild(metaEl);

    // Description
    const descEl = document.createElement("div");
    descEl.textContent = def.description;
    descEl.style.color = COLORS.textDim;
    descEl.style.fontSize = "11px";
    descEl.style.lineHeight = "1.4";
    tip.appendChild(descEl);

    document.body.appendChild(tip);
    this.tooltip = tip;
  }

  private hideTooltip(): void {
    this.tooltip?.remove();
    this.tooltip = null;
  }

  // ── Refresh ──

  private refresh(): void {
    if (!this._isOpen || !this.overlay) return;
    // Rebuild the panel contents
    const parent = this.overlay;
    const panel = parent.children[0];
    if (panel) panel.remove();

    // Re-add (simpler than diffing)
    const newOverlay = this.buildUI();
    const newPanel = newOverlay.children[0];
    if (newPanel) {
      parent.appendChild(newPanel);
    }
    newOverlay.remove();
  }

  destroy(): void {
    this.close();
  }
}
