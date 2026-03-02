/**
 * Inventory data model for Voxel Traffic Escape.
 *
 * Layout (per GDD):
 *   Hotbar:    8 slots  (indices 0-7)
 *   Backpack: 24 slots  (indices 0-23, stored as 8x3 grid)
 *   Equipment: 5 slots  (armor, shield, utility1, utility2, utility3)
 */

import { getItemOrThrow, type EquipSlot, type ItemDefinition } from "./item-registry";
import { getMiningStats } from "@/world/mining-stats";

// ── Types ──

export interface ItemStack {
  itemId: string;
  quantity: number;
  /** Remaining durability for tools/weapons. undefined = no durability tracking. */
  durability?: number;
}

export type InventorySlot = ItemStack | null;

export interface EquipmentSlots {
  armor: ItemStack | null;
  shield: ItemStack | null;
  utility1: ItemStack | null;
  utility2: ItemStack | null;
  utility3: ItemStack | null;
}

export type InventoryEventType =
  | "hotbar_changed"
  | "backpack_changed"
  | "equipment_changed"
  | "selected_changed"
  | "item_added"
  | "item_removed";

export type InventoryListener = (event: InventoryEventType) => void;

// ── Constants ──

export const HOTBAR_SIZE = 8;
export const BACKPACK_COLS = 8;
export const BACKPACK_ROWS = 3;
export const BACKPACK_SIZE = BACKPACK_COLS * BACKPACK_ROWS; // 24

// ── Inventory class ──

export class Inventory {
  readonly hotbar: InventorySlot[];
  readonly backpack: InventorySlot[];
  readonly equipment: EquipmentSlots;

  /** Currently selected hotbar slot (0-7). */
  private _selectedSlot = 0;
  private listeners: InventoryListener[] = [];

  constructor() {
    this.hotbar = new Array<InventorySlot>(HOTBAR_SIZE).fill(null);
    this.backpack = new Array<InventorySlot>(BACKPACK_SIZE).fill(null);
    this.equipment = {
      armor: null,
      shield: null,
      utility1: null,
      utility2: null,
      utility3: null,
    };
  }

  // ── Selection ──

  get selectedSlot(): number {
    return this._selectedSlot;
  }

  selectSlot(index: number): void {
    if (index < 0 || index >= HOTBAR_SIZE) return;
    if (this._selectedSlot !== index) {
      this._selectedSlot = index;
      this.emit("selected_changed");
    }
  }

  /** Returns the item stack in the currently selected hotbar slot, or null. */
  getSelectedItem(): ItemStack | null {
    return this.hotbar[this._selectedSlot];
  }

  // ── Add items ──

  /**
   * Add items to inventory. Tries hotbar first, then backpack.
   * Returns the number of items that could NOT be added (overflow).
   */
  addItem(itemId: string, quantity = 1): number {
    const def = getItemOrThrow(itemId);
    let remaining = quantity;

    // First pass: stack into existing slots (hotbar then backpack)
    remaining = this.stackInto(this.hotbar, itemId, remaining, def);
    if (remaining > 0) {
      remaining = this.stackInto(this.backpack, itemId, remaining, def);
    }

    // Second pass: place in empty slots
    if (remaining > 0) {
      remaining = this.placeInEmpty(this.hotbar, itemId, remaining, def, "hotbar_changed");
    }
    if (remaining > 0) {
      remaining = this.placeInEmpty(this.backpack, itemId, remaining, def, "backpack_changed");
    }

    if (remaining < quantity) {
      this.emit("hotbar_changed");
      this.emit("backpack_changed");
      this.emit("item_added");
    }

    return remaining;
  }

  private stackInto(
    slots: InventorySlot[],
    itemId: string,
    remaining: number,
    def: ItemDefinition
  ): number {
    for (let i = 0; i < slots.length && remaining > 0; i++) {
      const slot = slots[i];
      if (slot && slot.itemId === itemId && slot.quantity < def.maxStack) {
        const space = def.maxStack - slot.quantity;
        const toAdd = Math.min(remaining, space);
        slot.quantity += toAdd;
        remaining -= toAdd;
      }
    }
    return remaining;
  }

  private placeInEmpty(
    slots: InventorySlot[],
    itemId: string,
    remaining: number,
    def: ItemDefinition,
    _event: InventoryEventType
  ): number {
    for (let i = 0; i < slots.length && remaining > 0; i++) {
      if (slots[i] === null) {
        const toAdd = Math.min(remaining, def.maxStack);
        const stack: ItemStack = { itemId, quantity: toAdd };
        // Initialize durability for tools (maxStack 1 items with mining stats)
        const mining = getMiningStats(itemId);
        if (mining.durability > 0 && def.maxStack === 1) {
          stack.durability = mining.durability;
        }
        slots[i] = stack;
        remaining -= toAdd;
      }
    }
    return remaining;
  }

  // ── Remove items ──

  /**
   * Remove a quantity of items from anywhere in the inventory.
   * Returns the number that could NOT be removed (shortage).
   */
  removeItem(itemId: string, quantity = 1): number {
    let remaining = quantity;

    remaining = this.removeFrom(this.backpack, itemId, remaining);
    if (remaining > 0) {
      remaining = this.removeFrom(this.hotbar, itemId, remaining);
    }

    if (remaining < quantity) {
      this.emit("hotbar_changed");
      this.emit("backpack_changed");
      this.emit("item_removed");
    }

    return remaining;
  }

  private removeFrom(slots: InventorySlot[], itemId: string, remaining: number): number {
    for (let i = slots.length - 1; i >= 0 && remaining > 0; i--) {
      const slot = slots[i];
      if (slot && slot.itemId === itemId) {
        const toRemove = Math.min(remaining, slot.quantity);
        slot.quantity -= toRemove;
        remaining -= toRemove;
        if (slot.quantity <= 0) {
          slots[i] = null;
        }
      }
    }
    return remaining;
  }

  // ── Remove from specific slot ──

  /** Remove item from a specific hotbar slot. Returns what was removed, or null. */
  removeFromHotbar(index: number, quantity = 1): ItemStack | null {
    return this.removeFromSlot(this.hotbar, index, quantity, "hotbar_changed");
  }

  /** Remove item from a specific backpack slot. Returns what was removed, or null. */
  removeFromBackpack(index: number, quantity = 1): ItemStack | null {
    return this.removeFromSlot(this.backpack, index, quantity, "backpack_changed");
  }

  private removeFromSlot(
    slots: InventorySlot[],
    index: number,
    quantity: number,
    event: InventoryEventType
  ): ItemStack | null {
    const slot = slots[index];
    if (!slot) return null;

    const toRemove = Math.min(quantity, slot.quantity);
    slot.quantity -= toRemove;
    const removed: ItemStack = { itemId: slot.itemId, quantity: toRemove };

    if (slot.quantity <= 0) {
      slots[index] = null;
    }

    this.emit(event);
    return removed;
  }

  // ── Move / Swap ──

  /** Swap contents between two slots in any combination of hotbar/backpack. */
  swapSlots(
    fromArea: "hotbar" | "backpack",
    fromIndex: number,
    toArea: "hotbar" | "backpack",
    toIndex: number
  ): void {
    const fromSlots = fromArea === "hotbar" ? this.hotbar : this.backpack;
    const toSlots = toArea === "hotbar" ? this.hotbar : this.backpack;

    if (fromIndex < 0 || fromIndex >= fromSlots.length) return;
    if (toIndex < 0 || toIndex >= toSlots.length) return;

    const fromItem = fromSlots[fromIndex];
    const toItem = toSlots[toIndex];

    // If same item type, try merging
    if (fromItem && toItem && fromItem.itemId === toItem.itemId) {
      const def = getItemOrThrow(fromItem.itemId);
      const space = def.maxStack - toItem.quantity;
      if (space > 0) {
        const toMove = Math.min(space, fromItem.quantity);
        toItem.quantity += toMove;
        fromItem.quantity -= toMove;
        if (fromItem.quantity <= 0) {
          fromSlots[fromIndex] = null;
        }
        this.emit("hotbar_changed");
        this.emit("backpack_changed");
        return;
      }
    }

    // Otherwise swap
    fromSlots[fromIndex] = toItem;
    toSlots[toIndex] = fromItem;
    this.emit("hotbar_changed");
    this.emit("backpack_changed");
  }

  // ── Equipment ──

  /** Equip an item from a slot. Returns the previously equipped item, if any. */
  equip(fromArea: "hotbar" | "backpack", fromIndex: number): ItemStack | null {
    const slots = fromArea === "hotbar" ? this.hotbar : this.backpack;
    const stack = slots[fromIndex];
    if (!stack) return null;

    const def = getItemOrThrow(stack.itemId);
    if (!def.equipSlot) return null;

    const slot = def.equipSlot;
    const previous = this.equipment[slot];

    // Move item to equipment
    this.equipment[slot] = { itemId: stack.itemId, quantity: 1 };

    // If the item had quantity > 1, leave the rest
    if (stack.quantity > 1) {
      stack.quantity -= 1;
    } else {
      slots[fromIndex] = null;
    }

    // Put the previously equipped item back into the vacated slot
    if (previous) {
      if (slots[fromIndex] === null) {
        slots[fromIndex] = previous;
      } else {
        // Slot is still occupied (stackable item), find another spot
        this.addItem(previous.itemId, previous.quantity);
      }
    }

    this.emit("hotbar_changed");
    this.emit("backpack_changed");
    this.emit("equipment_changed");
    return previous;
  }

  /** Unequip an item from an equipment slot back to inventory. Returns false if inventory is full. */
  unequip(slot: EquipSlot): boolean {
    const item = this.equipment[slot];
    if (!item) return true;

    const overflow = this.addItem(item.itemId, item.quantity);
    if (overflow > 0) return false;

    this.equipment[slot] = null;
    this.emit("equipment_changed");
    return true;
  }

  // ── Durability ──

  /**
   * Reduce durability of the selected hotbar item by `amount`.
   * Returns true if the tool broke (was removed from inventory).
   * Returns false if durability was reduced normally or item has no durability.
   */
  damageSelectedTool(amount = 1): boolean {
    const stack = this.hotbar[this._selectedSlot];
    if (!stack || stack.durability === undefined) return false;

    stack.durability -= amount;
    if (stack.durability <= 0) {
      this.hotbar[this._selectedSlot] = null;
      this.emit("hotbar_changed");
      return true; // tool broke
    }
    this.emit("hotbar_changed");
    return false;
  }

  // ── Queries ──

  /** Count total quantity of an item across all inventory areas. */
  countItem(itemId: string): number {
    let count = 0;
    for (const slot of this.hotbar) {
      if (slot?.itemId === itemId) count += slot.quantity;
    }
    for (const slot of this.backpack) {
      if (slot?.itemId === itemId) count += slot.quantity;
    }
    for (const slot of Object.values(this.equipment)) {
      if (slot?.itemId === itemId) count += slot.quantity;
    }
    return count;
  }

  /** Check if there's room for at least `quantity` of the given item. */
  hasRoom(itemId: string, quantity = 1): boolean {
    const def = getItemOrThrow(itemId);
    let available = 0;

    // Existing stacks with room
    for (const slot of [...this.hotbar, ...this.backpack]) {
      if (slot === null) {
        available += def.maxStack;
      } else if (slot.itemId === itemId) {
        available += def.maxStack - slot.quantity;
      }
      if (available >= quantity) return true;
    }

    return available >= quantity;
  }

  // ── Events ──

  onChange(listener: InventoryListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(event: InventoryEventType): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
