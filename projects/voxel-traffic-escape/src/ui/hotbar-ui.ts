/**
 * Hotbar HUD — 8 slots pinned to bottom-center of screen.
 * Renders as an HTML overlay on top of the Three.js canvas.
 *
 * Shows a floating item name label above the selected slot.
 */

import { type Inventory, HOTBAR_SIZE } from "@/items/inventory";
import { getItem } from "@/items/item-registry";

export class HotbarUI {
  private container: HTMLDivElement;
  private slots: HTMLDivElement[] = [];
  private slotLabels: HTMLDivElement[] = [];
  private itemLabel: HTMLDivElement;
  private inventory: Inventory;
  private cleanup: (() => void) | null = null;
  private labelTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(inventory: Inventory) {
    this.inventory = inventory;
    this.container = this.createContainer();

    // Floating item name label (above hotbar)
    this.itemLabel = document.createElement("div");
    Object.assign(this.itemLabel.style, {
      position: "absolute",
      bottom: "64px",
      left: "50%",
      transform: "translateX(-50%)",
      fontFamily: "monospace",
      fontSize: "12px",
      fontWeight: "bold",
      color: "#E8E4DC",
      textShadow: "1px 1px 2px #000",
      whiteSpace: "nowrap",
      opacity: "0",
      transition: "opacity 0.3s ease",
      pointerEvents: "none",
    } satisfies Partial<CSSStyleDeclaration>);
    this.container.appendChild(this.itemLabel);

    this.createSlots();
    document.body.appendChild(this.container);
    this.refresh();

    this.cleanup = inventory.onChange((event) => {
      if (event === "hotbar_changed" || event === "selected_changed") {
        this.refresh();
        if (event === "selected_changed") {
          this.flashItemLabel();
        }
      }
    });
  }

  private createContainer(): HTMLDivElement {
    const el = document.createElement("div");
    el.id = "hotbar";
    Object.assign(el.style, {
      position: "fixed",
      bottom: "16px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      gap: "4px",
      zIndex: "10",
      pointerEvents: "none",
      userSelect: "none",
    } satisfies Partial<CSSStyleDeclaration>);
    return el;
  }

  private createSlots(): void {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = document.createElement("div");
      slot.dataset.slot = String(i);
      Object.assign(slot.style, {
        width: "56px",
        height: "56px",
        border: "2px solid rgba(255,255,255,0.3)",
        borderRadius: "4px",
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        fontFamily: "monospace",
        color: "#E8E4DC",
      } satisfies Partial<CSSStyleDeclaration>);

      // Key label
      const keyLabel = document.createElement("span");
      keyLabel.textContent = String(i + 1);
      Object.assign(keyLabel.style, {
        position: "absolute",
        top: "2px",
        left: "4px",
        fontSize: "10px",
        opacity: "0.5",
      } satisfies Partial<CSSStyleDeclaration>);
      slot.appendChild(keyLabel);

      // Persistent item name label (below slot)
      const nameLabel = document.createElement("div");
      Object.assign(nameLabel.style, {
        position: "absolute",
        top: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        marginTop: "2px",
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#A0A0A0",
        textAlign: "center",
        whiteSpace: "nowrap",
        overflow: "hidden",
        maxWidth: "58px",
        textOverflow: "ellipsis",
        pointerEvents: "none",
        lineHeight: "1.1",
        textShadow: "1px 1px 0 #000",
      } satisfies Partial<CSSStyleDeclaration>);
      slot.appendChild(nameLabel);
      this.slotLabels.push(nameLabel);

      this.slots.push(slot);
      this.container.appendChild(slot);
    }
  }

  /** Show the selected item name briefly above the hotbar */
  private flashItemLabel(): void {
    const stack = this.inventory.hotbar[this.inventory.selectedSlot];
    if (stack) {
      const def = getItem(stack.itemId);
      this.itemLabel.textContent = def?.name ?? "";
    } else {
      this.itemLabel.textContent = "";
    }

    this.itemLabel.style.opacity = "1";

    if (this.labelTimeout) clearTimeout(this.labelTimeout);
    this.labelTimeout = setTimeout(() => {
      this.itemLabel.style.opacity = "0";
    }, 2000);
  }

  /** Abbreviate an item name to fit under a hotbar slot (max ~8 chars) */
  private abbreviateName(name: string): string {
    if (name.length <= 8) return name;
    // Try dropping common filler words
    const short = name
      .replace(/\b(the|of|a|an)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    if (short.length <= 8) return short;
    // Use first letters of each word for long multi-word names
    const words = short.split(" ");
    if (words.length >= 3) {
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1, 3)).join("");
    }
    // Truncate
    return short.slice(0, 7) + ".";
  }

  refresh(): void {
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const slot = this.slots[i];
      const stack = this.inventory.hotbar[i];
      const isSelected = this.inventory.selectedSlot === i;
      const nameLabel = this.slotLabels[i];

      // Selection highlight
      slot.style.borderColor = isSelected
        ? "#F5C518"
        : "rgba(255,255,255,0.3)";
      slot.style.boxShadow = isSelected
        ? "0 0 8px rgba(245,197,24,0.5), inset 0 0 4px rgba(245,197,24,0.2)"
        : "none";

      // Clear item content (keep key label and name label)
      const keyLabel = slot.children[0] as HTMLElement;
      while (slot.children.length > 2) {
        // Remove all children except keyLabel (first) and nameLabel (last)
        slot.removeChild(slot.children[1]);
      }

      if (stack) {
        const def = getItem(stack.itemId);
        if (!def) {
          nameLabel.textContent = "";
          continue;
        }

        // Item color swatch — insert before nameLabel
        const swatch = document.createElement("div");
        Object.assign(swatch.style, {
          width: "28px",
          height: "28px",
          borderRadius: "3px",
          background: def.color,
          border: "1px solid rgba(255,255,255,0.2)",
        } satisfies Partial<CSSStyleDeclaration>);
        slot.insertBefore(swatch, nameLabel);

        // Stack count (only show if > 1)
        if (stack.quantity > 1) {
          const count = document.createElement("span");
          count.textContent = String(stack.quantity);
          Object.assign(count.style, {
            position: "absolute",
            bottom: "2px",
            right: "4px",
            fontSize: "11px",
            fontWeight: "bold",
            textShadow: "1px 1px 0 #000",
          } satisfies Partial<CSSStyleDeclaration>);
          slot.insertBefore(count, nameLabel);
        }

        // Update name label
        nameLabel.textContent = this.abbreviateName(def.name);
        nameLabel.style.color = isSelected ? "#F5C518" : "#A0A0A0";
      } else {
        nameLabel.textContent = "";
      }

      // Keep key label visible
      keyLabel.style.color = isSelected ? "#F5C518" : "#E8E4DC";
    }
  }

  destroy(): void {
    this.cleanup?.();
    this.container.remove();
  }
}
