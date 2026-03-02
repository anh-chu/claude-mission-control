/**
 * Inventory controller — ties together input, inventory data,
 * UI (hotbar + inventory screen), and world item entities.
 *
 * Handles:
 *   - Hotbar slot selection (keys 1-8)
 *   - Inventory screen toggle (E)
 *   - Item pickup from world (F / walk-over)
 *   - Item dropping (Q)
 */

import * as THREE from "three";
import { Input } from "@/engine/input";
import { Inventory } from "./inventory";
import { ItemEntityManager } from "./item-entity";
import { CraftingSystem } from "./crafting";
import { HotbarUI } from "@/ui/hotbar-ui";
import { InventoryScreen } from "@/ui/inventory-screen";

export class InventoryController {
  readonly inventory: Inventory;
  readonly crafting: CraftingSystem;
  readonly worldItems: ItemEntityManager;
  private input: Input;
  private hotbarUI: HotbarUI;
  private inventoryScreen: InventoryScreen;

  /**
   * Function that returns the current player position.
   * Set this when the player entity is created.
   * Defaults to origin until a player exists.
   */
  getPlayerPosition: () => THREE.Vector3 = () => new THREE.Vector3(0, 0.5, 0);

  /**
   * Function that returns the direction the player is facing.
   * Used for item dropping (items land in front of player).
   */
  getPlayerDirection: () => THREE.Vector3 = () => new THREE.Vector3(0, 0, -1);

  /**
   * Called when an item is picked up from the world.
   * Provides (itemId, quantity) so the HUD can show floating pickup text.
   */
  onItemPickup: ((itemId: string, quantity: number) => void) | null = null;

  constructor(input: Input, scene: THREE.Scene) {
    this.input = input;
    this.inventory = new Inventory();
    this.crafting = new CraftingSystem(this.inventory);
    this.worldItems = new ItemEntityManager(scene);
    this.hotbarUI = new HotbarUI(this.inventory);
    this.inventoryScreen = new InventoryScreen(this.inventory, this.crafting);
  }

  /** Call once per frame. */
  update(dt: number): void {
    // Update world item animations
    this.worldItems.update(dt);

    // Hotbar selection (1-8)
    if (this.input.isJustPressed("hotbar1")) this.inventory.selectSlot(0);
    if (this.input.isJustPressed("hotbar2")) this.inventory.selectSlot(1);
    if (this.input.isJustPressed("hotbar3")) this.inventory.selectSlot(2);
    if (this.input.isJustPressed("hotbar4")) this.inventory.selectSlot(3);
    if (this.input.isJustPressed("hotbar5")) this.inventory.selectSlot(4);
    if (this.input.isJustPressed("hotbar6")) this.inventory.selectSlot(5);
    if (this.input.isJustPressed("hotbar7")) this.inventory.selectSlot(6);
    if (this.input.isJustPressed("hotbar8")) this.inventory.selectSlot(7);

    // Toggle inventory screen
    if (this.input.isJustPressed("inventory")) {
      this.inventoryScreen.toggle();
    }

    // Don't process gameplay actions while inventory is open
    if (this.inventoryScreen.isOpen) return;

    // Item pickup (F key — interact)
    if (this.input.isJustPressed("interact")) {
      this.tryPickup();
    }

    // Auto-pickup: walk-over nearby items
    this.autoPickup();

    // Item drop (Q key)
    if (this.input.isJustPressed("drop")) {
      this.dropSelectedItem();
    }
  }

  /** Try to pick up the nearest item in range. */
  private tryPickup(): void {
    const pos = this.getPlayerPosition();
    const nearby = this.worldItems.getItemsInRange(pos);

    for (const worldItem of nearby) {
      const originalQty = worldItem.quantity;
      const overflow = this.inventory.addItem(
        worldItem.itemId,
        worldItem.quantity
      );

      const pickedUp = originalQty - overflow;
      if (pickedUp > 0) {
        this.onItemPickup?.(worldItem.itemId, pickedUp);
      }

      if (overflow === 0) {
        // Fully picked up
        this.worldItems.remove(worldItem.id);
      } else if (overflow < originalQty) {
        // Partially picked up
        worldItem.quantity = overflow;
      }
      // Only pick up one item per interact press
      break;
    }
  }

  /** Auto-pickup items the player walks over (closer range). */
  private autoPickup(): void {
    const pos = this.getPlayerPosition();
    const nearby = this.worldItems.getItemsInRange(pos);

    for (const worldItem of nearby) {
      const dist = pos.distanceTo(worldItem.mesh.position);
      // Tighter radius for auto-pickup
      if (dist > 0.8) continue;

      if (!this.inventory.hasRoom(worldItem.itemId, worldItem.quantity)) continue;

      const originalQty = worldItem.quantity;
      const overflow = this.inventory.addItem(
        worldItem.itemId,
        worldItem.quantity
      );

      const pickedUp = originalQty - overflow;
      if (pickedUp > 0) {
        this.onItemPickup?.(worldItem.itemId, pickedUp);
      }

      if (overflow === 0) {
        this.worldItems.remove(worldItem.id);
      } else if (overflow < originalQty) {
        worldItem.quantity = overflow;
      }
    }
  }

  /** Drop the currently selected hotbar item into the world. */
  dropSelectedItem(): void {
    const slot = this.inventory.selectedSlot;
    const removed = this.inventory.removeFromHotbar(slot, 1);
    if (!removed) return;

    // Spawn item in front of the player
    const pos = this.getPlayerPosition().clone();
    const dir = this.getPlayerDirection();
    pos.add(dir.clone().multiplyScalar(1.5));
    pos.y = 0.3; // Ground level

    this.worldItems.spawn(removed.itemId, removed.quantity, pos);
  }

  /** Whether the inventory screen is currently open. */
  get isInventoryOpen(): boolean {
    return this.inventoryScreen.isOpen;
  }

  /** Close the inventory screen if open. */
  closeInventory(): void {
    this.inventoryScreen.close();
  }

  /** Spawn demo items for testing (call during development). */
  spawnDemoItems(): void {
    const demoItems = [
      { id: "tire_iron", qty: 1, x: -3, z: -2 },
      { id: "gas_station_snack", qty: 5, x: -1, z: -3 },
      { id: "scrap_metal", qty: 12, x: 1, z: -2 },
      { id: "hi_vis_vest", qty: 1, x: 3, z: -3 },
      { id: "car_door", qty: 1, x: -2, z: 2 },
      { id: "water_bottle", qty: 3, x: 2, z: 2 },
      { id: "rock_rubble", qty: 10, x: 0, z: -4 },
      { id: "road_flare", qty: 1, x: -4, z: 0 },
      { id: "coffee_cup", qty: 8, x: 4, z: 0 },
      { id: "scrap", qty: 50, x: 0, z: 3 },
      // Crafting materials for testing crafting system
      { id: "cable_wire", qty: 3, x: -5, z: -1 },
      { id: "battery", qty: 2, x: -5, z: 1 },
      { id: "pipe", qty: 2, x: 5, z: -1 },
      { id: "gunpowder", qty: 2, x: 5, z: 1 },
      { id: "seat_cover", qty: 4, x: -3, z: 4 },
      { id: "metal_plates", qty: 5, x: 3, z: 4 },
      { id: "concrete_chunk", qty: 6, x: 0, z: 5 },
    ];

    for (const { id, qty, x, z } of demoItems) {
      this.worldItems.spawn(id, qty, new THREE.Vector3(x, 0, z));
    }
  }

  destroy(): void {
    this.hotbarUI.destroy();
    this.inventoryScreen.destroy();
    this.worldItems.destroy();
  }
}
