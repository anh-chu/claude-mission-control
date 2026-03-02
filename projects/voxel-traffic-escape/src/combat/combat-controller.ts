/**
 * Combat controller — ties together the combat system, projectile system,
 * swing visuals, damage numbers, and input handling.
 *
 * This is the main entry point for combat in the game loop.
 * Enemy management (spawning, AI updates) is handled by EnemyManager.
 */

import * as THREE from "three";
import { Input } from "@/engine/input";
import { type Inventory } from "@/items/inventory";
import { ScreenShake } from "@/effects/damage-effects";
import { CombatSystem } from "./combat-system";
import { ProjectileSystem } from "./projectile";
import { SwingVisual } from "./swing-visual";
import { DamageNumbers } from "./damage-numbers";
import { type HitTarget } from "./hit-target";
import { getWeaponStats, getUnarmedStats } from "./weapon-stats";
import { WeaponViewmodel } from "./weapon-viewmodel";

export class CombatController {
  readonly combat: CombatSystem;
  readonly projectiles: ProjectileSystem;
  readonly swingVisual: SwingVisual;
  readonly damageNumbers: DamageNumbers;
  readonly viewmodel: WeaponViewmodel;

  private input: Input;
  private inventory: Inventory;
  private scene: THREE.Scene;
  private screenShake: ScreenShake;

  // Player state callbacks
  getPlayerPosition: () => THREE.Vector3 = () => new THREE.Vector3(0, 0.5, 0);
  getPlayerFacing: () => THREE.Vector3 = () => new THREE.Vector3(0, 0, -1);

  constructor(
    input: Input,
    inventory: Inventory,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    screenShake: ScreenShake
  ) {
    this.input = input;
    this.inventory = inventory;
    this.scene = scene;
    this.screenShake = screenShake;

    this.combat = new CombatSystem(inventory);
    this.projectiles = new ProjectileSystem(scene);
    this.swingVisual = new SwingVisual(scene);
    this.damageNumbers = new DamageNumbers(camera);
    this.viewmodel = new WeaponViewmodel(camera);

    // Update viewmodel when selected weapon changes
    inventory.onChange((type) => {
      if (type === "selected_changed" || type === "hotbar_changed") {
        const selected = inventory.getSelectedItem();
        this.viewmodel.setWeapon(selected?.itemId ?? null);
      }
    });

    // Wire up combat events
    this.combat.on((event) => {
      if (event.type === "attack_start") {
        // Start swing visual
        const pos = this.getPlayerPosition();
        const facing = this.getPlayerFacing();
        const duration = 1 / event.weapon.attackSpeed;
        this.swingVisual.start(event.weapon, pos, facing, duration);

        // Start viewmodel swing animation
        this.viewmodel.startSwing(event.weapon);
      }

      if (event.type === "attack_hit") {
        for (const hit of event.hits) {
          // Damage number
          const numPos = hit.target.position.clone();
          numPos.y += 1.8;
          this.damageNumbers.spawn(hit.damage, numPos, hit.lethal);

          // Screen shake proportional to damage
          const intensity = Math.min(0.3, hit.damage / 40);
          this.screenShake.shake(intensity, 0.15);
        }
      }
    });

    // Wire up projectile events
    this.projectiles.on((event) => {
      if (event.type === "projectile_hit") {
        for (const hit of event.hits) {
          const numPos = hit.target.position.clone();
          numPos.y += 1.8;
          this.damageNumbers.spawn(hit.damage, numPos, hit.lethal);

          const intensity = Math.min(0.2, hit.damage / 40);
          this.screenShake.shake(intensity, 0.1);
        }
      }
    });
  }

  /**
   * Register a HitTarget with both melee and projectile systems.
   */
  registerTarget(target: HitTarget): void {
    this.combat.registerTarget(target);
    this.projectiles.registerTarget(target);
  }

  /**
   * Unregister a target from both systems.
   */
  unregisterTarget(id: string): void {
    this.combat.unregisterTarget(id);
    this.projectiles.unregisterTarget(id);
  }

  /**
   * Update per frame. Handles attack input, combat system, projectiles,
   * swing visuals, and damage numbers.
   */
  update(dt: number): void {
    const playerPos = this.getPlayerPosition();
    const playerFacing = this.getPlayerFacing();

    // Update player state in combat system
    this.combat.setPlayerPosition(playerPos);
    this.combat.setPlayerFacing(playerFacing);

    // Attack input (left mouse button or dedicated key)
    if (this.input.isJustPressed("attack")) {
      this.handleAttack(playerPos, playerFacing);
    }

    // Update systems
    this.combat.update(dt);
    this.projectiles.update(dt);
    this.swingVisual.update(dt, playerPos, playerFacing);
    this.damageNumbers.update(dt);
    this.viewmodel.update(dt);
  }

  private handleAttack(playerPos: THREE.Vector3, playerFacing: THREE.Vector3): void {
    const selected = this.inventory.getSelectedItem();

    // Check if holding a ranged weapon
    if (selected) {
      const stats = getWeaponStats(selected.itemId);
      if (stats?.type === "ranged") {
        const weapon = this.combat.getRangedWeapon();
        if (weapon) {
          // Spawn projectile
          const firePos = playerPos.clone();
          firePos.y += 0.8; // Fire from chest height
          this.projectiles.fire(weapon, firePos, playerFacing);

          // Consume ammo if consumable
          if (weapon.consumable) {
            this.inventory.removeItem(selected.itemId, 1);
          }
        }
        return;
      }
    }

    // Melee attack
    this.combat.startAttack();
  }

  destroy(): void {
    this.swingVisual.destroy();
    this.damageNumbers.destroy();
    this.projectiles.destroy();
    this.viewmodel.destroy();
  }
}
