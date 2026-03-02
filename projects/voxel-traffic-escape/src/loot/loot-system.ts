/**
 * LootSystem — top-level coordinator for all loot mechanics.
 *
 * Responsibilities:
 * - Spawns loot containers at designed world locations
 * - Spawns placed items at fixed locations (e.g., heart containers)
 * - Processes enemy death → rolls drop table → spawns loot drops
 * - Handles container interaction (delegates to LootContainerManager)
 * - Provides a single update() call for the game loop
 *
 * Usage in main.ts:
 *   const lootSystem = new LootSystem(scene, inventoryCtrl, input);
 *   // In game loop:
 *   lootSystem.update(dt);
 *   // On enemy death:
 *   lootSystem.onEnemyDeath("road_rager", enemyPosition);
 */

import * as THREE from "three";
import { Input } from "@/engine/input";
import { InventoryController } from "@/items/inventory-controller";
import { LootContainerManager, type ContainerType } from "./loot-container";
import { rollEnemyDrops, type LootDrop, type ZoneId } from "./loot-tables";

export interface WorldSpawnPoint {
  /** Item ID from item-registry. */
  itemId: string;
  quantity: number;
  position: THREE.Vector3;
}

export interface ContainerSpawnPoint {
  type: ContainerType;
  position: THREE.Vector3;
  zone?: ZoneId;
  /** Pre-set loot (bypasses random rolls). */
  fixedLoot?: LootDrop[];
}

export class LootSystem {
  readonly containers: LootContainerManager;
  private inventoryCtrl: InventoryController;
  private input: Input;
  private promptEl: HTMLDivElement | null = null;

  constructor(
    scene: THREE.Scene,
    inventoryCtrl: InventoryController,
    input: Input
  ) {
    this.inventoryCtrl = inventoryCtrl;
    this.input = input;
    this.containers = new LootContainerManager(
      scene,
      inventoryCtrl.worldItems
    );

    this.createPromptUI();
  }

  // ── Enemy death loot ──

  /**
   * Call when an enemy dies. Rolls the drop table and spawns loot at the
   * enemy's position as bouncing/glowing item entities.
   */
  onEnemyDeath(enemyType: string, position: THREE.Vector3): LootDrop[] {
    const drops = rollEnemyDrops(enemyType);
    if (drops.length > 0) {
      this.inventoryCtrl.worldItems.spawnDrops(drops, position);
    }
    return drops;
  }

  // ── World spawning ──

  /**
   * Spawn placed items at fixed world locations.
   * These are static items (no physics, no despawn) placed by level design.
   */
  spawnWorldItems(spawns: WorldSpawnPoint[]): void {
    for (const spawn of spawns) {
      this.inventoryCtrl.worldItems.spawn(
        spawn.itemId,
        spawn.quantity,
        spawn.position,
        "placed"
      );
    }
  }

  /**
   * Spawn loot containers at designed world locations.
   */
  spawnContainers(spawns: ContainerSpawnPoint[]): void {
    for (const spawn of spawns) {
      if (spawn.fixedLoot) {
        this.containers.placeWithLoot(spawn.type, spawn.position, spawn.fixedLoot);
      } else {
        this.containers.place(spawn.type, spawn.position, spawn.zone);
      }
    }
  }

  /**
   * Convenience: set up a demo scene with containers and items for testing.
   */
  spawnDemoWorld(): void {
    // Highway containers
    this.spawnContainers([
      { type: "car_trunk", position: new THREE.Vector3(-5, 0, -5) },
      { type: "glove_box", position: new THREE.Vector3(-3, 0, -6) },
      { type: "debris_pile", position: new THREE.Vector3(4, 0, -4) },
    ]);

    // Underground containers
    this.spawnContainers([
      { type: "crate", position: new THREE.Vector3(6, 0, 3) },
      { type: "locker", position: new THREE.Vector3(-6, 0, 4) },
    ]);

    // Street containers
    this.spawnContainers([
      { type: "dumpster", position: new THREE.Vector3(0, 0, 6) },
      { type: "toolbox", position: new THREE.Vector3(-4, 0, 6) },
    ]);

    // Special chest with guaranteed loot
    this.spawnContainers([
      {
        type: "chest",
        position: new THREE.Vector3(5, 0, 5),
        fixedLoot: [
          { itemId: "sledgehammer", quantity: 1 },
          { itemId: "scrap", quantity: 50 },
        ],
      },
    ]);

    // Fixed world items (heart containers, key items)
    this.spawnWorldItems([
      {
        itemId: "energy_drink",
        quantity: 1,
        position: new THREE.Vector3(-7, 0, 0),
      },
      {
        itemId: "first_aid_kit",
        quantity: 1,
        position: new THREE.Vector3(7, 0, 0),
      },
    ]);
  }

  // ── Per-frame update ──

  /**
   * Call once per frame. Handles container interaction and prompt display.
   */
  update(_dt: number): void {
    const playerPos = this.inventoryCtrl.getPlayerPosition();

    // Show/hide interact prompt for containers
    const prompt = this.containers.getInteractPrompt(playerPos);
    this.updatePromptUI(prompt);

    // Handle container interaction on interact key
    if (this.input.isJustPressed("interact")) {
      this.containers.tryOpen(playerPos);
    }
  }

  // ── Interact prompt UI ──

  private createPromptUI(): void {
    this.promptEl = document.createElement("div");
    this.promptEl.style.cssText = `
      position: fixed;
      bottom: 120px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      background: rgba(0, 0, 0, 0.7);
      color: #F5C518;
      font-family: monospace;
      font-size: 14px;
      border-radius: 4px;
      pointer-events: none;
      z-index: 100;
      display: none;
      text-align: center;
      border: 1px solid rgba(245, 197, 24, 0.3);
    `;
    document.body.appendChild(this.promptEl);
  }

  private updatePromptUI(prompt: string | null): void {
    if (!this.promptEl) return;

    if (prompt) {
      this.promptEl.textContent = prompt;
      this.promptEl.style.display = "block";
    } else {
      this.promptEl.style.display = "none";
    }
  }

  destroy(): void {
    this.containers.destroy();
    if (this.promptEl) {
      this.promptEl.remove();
      this.promptEl = null;
    }
  }
}
