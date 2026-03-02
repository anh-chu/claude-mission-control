/**
 * Loot containers — interactive world objects that contain items.
 *
 * Container types per zone (from GDD):
 *   Highway:     car trunks, glove boxes, road debris piles
 *   Underground: crates, lockers, pipe stashes
 *   Street:      dumpsters, construction crates, toolboxes
 *
 * Containers:
 * - Are placed at designed world locations
 * - Show an interact prompt when the player is nearby
 * - Open with the interact key (F)
 * - Roll their zone's loot table on first open
 * - Spawn loot drops that scatter from the container position
 * - Cannot be re-opened once looted
 */

import * as THREE from "three";
import { type ZoneId, rollContainerDrops, type LootDrop } from "./loot-tables";
import { ItemEntityManager } from "@/items/item-entity";

export type ContainerType =
  | "car_trunk"
  | "glove_box"
  | "debris_pile"
  | "crate"
  | "locker"
  | "pipe_stash"
  | "dumpster"
  | "construction_crate"
  | "toolbox"
  | "chest";

export interface LootContainerDef {
  type: ContainerType;
  zone: ZoneId;
  /** Display name shown in interact prompt. */
  label: string;
  /** Hex color for the container mesh. */
  color: string;
  /** Size of the container mesh [x, y, z]. */
  size: [number, number, number];
}

const CONTAINER_DEFS: Record<ContainerType, LootContainerDef> = {
  // Highway
  car_trunk: {
    type: "car_trunk",
    zone: "highway",
    label: "Car Trunk",
    color: "#A8A29E",
    size: [1.2, 0.6, 0.8],
  },
  glove_box: {
    type: "glove_box",
    zone: "highway",
    label: "Glove Box",
    color: "#5C5550",
    size: [0.5, 0.3, 0.4],
  },
  debris_pile: {
    type: "debris_pile",
    zone: "highway",
    label: "Road Debris",
    color: "#9B9489",
    size: [1.0, 0.5, 1.0],
  },

  // Underground
  crate: {
    type: "crate",
    zone: "underground",
    label: "Crate",
    color: "#7A5C42",
    size: [0.8, 0.8, 0.8],
  },
  locker: {
    type: "locker",
    zone: "underground",
    label: "Locker",
    color: "#5C6668",
    size: [0.6, 1.4, 0.5],
  },
  pipe_stash: {
    type: "pipe_stash",
    zone: "underground",
    label: "Pipe Stash",
    color: "#5C5C5C",
    size: [0.4, 0.4, 1.2],
  },

  // Street
  dumpster: {
    type: "dumpster",
    zone: "street",
    label: "Dumpster",
    color: "#3A5A4A",
    size: [1.5, 1.0, 1.0],
  },
  construction_crate: {
    type: "construction_crate",
    zone: "street",
    label: "Construction Crate",
    color: "#F07830",
    size: [1.0, 0.8, 1.0],
  },
  toolbox: {
    type: "toolbox",
    zone: "street",
    label: "Toolbox",
    color: "#D94040",
    size: [0.6, 0.4, 0.3],
  },

  // Special — used for rare/boss loot
  chest: {
    type: "chest",
    zone: "underground",
    label: "Chest",
    color: "#E8B830",
    size: [0.8, 0.6, 0.6],
  },
};

export interface LootContainer {
  id: string;
  type: ContainerType;
  zone: ZoneId;
  mesh: THREE.Group;
  position: THREE.Vector3;
  opened: boolean;
  /** Pre-rolled loot (null until opened). */
  loot: LootDrop[] | null;
}

const INTERACT_RADIUS = 2.0;

let nextContainerId = 0;

export class LootContainerManager {
  private scene: THREE.Scene;
  private itemEntityManager: ItemEntityManager;
  private containers: Map<string, LootContainer> = new Map();

  constructor(scene: THREE.Scene, itemEntityManager: ItemEntityManager) {
    this.scene = scene;
    this.itemEntityManager = itemEntityManager;
  }

  /**
   * Place a container in the world.
   * @param type Container type (determines zone + visuals).
   * @param position World position for the container.
   * @param zone Override zone (defaults to the container type's default zone).
   */
  place(
    type: ContainerType,
    position: THREE.Vector3,
    zone?: ZoneId
  ): LootContainer {
    const def = CONTAINER_DEFS[type];
    const containerZone = zone ?? def.zone;

    const group = this.createContainerMesh(def);
    group.position.copy(position);
    this.scene.add(group);

    const id = `container_${nextContainerId++}`;
    const container: LootContainer = {
      id,
      type,
      zone: containerZone,
      mesh: group,
      position: position.clone(),
      opened: false,
      loot: null,
    };

    this.containers.set(id, container);
    return container;
  }

  /**
   * Place a container with pre-set loot (bypasses the random drop table).
   * Useful for quest rewards, boss loot, and designed encounters.
   */
  placeWithLoot(
    type: ContainerType,
    position: THREE.Vector3,
    loot: LootDrop[]
  ): LootContainer {
    const container = this.place(type, position);
    container.loot = loot;
    return container;
  }

  /**
   * Try to open the nearest container in interact range.
   * Returns the loot drops if a container was opened, null otherwise.
   */
  tryOpen(playerPosition: THREE.Vector3): LootDrop[] | null {
    const nearest = this.getNearestInteractable(playerPosition);
    if (!nearest) return null;

    return this.openContainer(nearest);
  }

  /**
   * Open a specific container, roll loot, and spawn drops.
   */
  openContainer(container: LootContainer): LootDrop[] | null {
    if (container.opened) return null;

    container.opened = true;

    // Roll loot if not pre-set
    if (!container.loot) {
      container.loot = rollContainerDrops(container.zone);
    }

    // Visual feedback: change material color to darker (opened look)
    this.setContainerOpened(container);

    // Spawn item entities that scatter from the container
    const spawnPos = container.position.clone();
    spawnPos.y += 0.5; // Items launch from top of container
    this.itemEntityManager.spawnDrops(container.loot, spawnPos);

    return container.loot;
  }

  /**
   * Get the nearest interactable (unopened) container within range.
   */
  getNearestInteractable(playerPosition: THREE.Vector3): LootContainer | null {
    let nearest: LootContainer | null = null;
    let nearestDist = Infinity;

    for (const container of this.containers.values()) {
      if (container.opened) continue;
      const dist = playerPosition.distanceTo(container.position);
      if (dist <= INTERACT_RADIUS && dist < nearestDist) {
        nearest = container;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  /**
   * Check if any unopened container is in interact range.
   * Used to show/hide the interact prompt.
   */
  hasInteractable(playerPosition: THREE.Vector3): boolean {
    return this.getNearestInteractable(playerPosition) !== null;
  }

  /**
   * Get the label of the nearest interactable container.
   * Returns null if no container is in range.
   */
  getInteractPrompt(playerPosition: THREE.Vector3): string | null {
    const container = this.getNearestInteractable(playerPosition);
    if (!container) return null;

    const def = CONTAINER_DEFS[container.type];
    return `[F] Open ${def.label}`;
  }

  /** Get all containers. */
  getAll(): LootContainer[] {
    return [...this.containers.values()];
  }

  /** Remove a container from the world. */
  remove(id: string): void {
    const container = this.containers.get(id);
    if (container) {
      this.scene.remove(container.mesh);
      container.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });
      this.containers.delete(id);
    }
  }

  /** Clean up all containers. */
  destroy(): void {
    for (const id of [...this.containers.keys()]) {
      this.remove(id);
    }
  }

  // ── Private helpers ──

  private createContainerMesh(def: LootContainerDef): THREE.Group {
    const group = new THREE.Group();

    // Main body
    const bodyGeom = new THREE.BoxGeometry(...def.size);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: def.color,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = def.size[1] / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Lid (slightly different shade, sits on top)
    const lidHeight = def.size[1] * 0.15;
    const lidGeom = new THREE.BoxGeometry(
      def.size[0] * 1.02,
      lidHeight,
      def.size[2] * 1.02
    );
    const lidColor = new THREE.Color(def.color);
    lidColor.multiplyScalar(0.85); // Slightly darker lid
    const lidMat = new THREE.MeshStandardMaterial({
      color: lidColor,
      roughness: 0.9,
      metalness: 0.15,
      flatShading: true,
    });
    const lid = new THREE.Mesh(lidGeom, lidMat);
    lid.position.y = def.size[1] + lidHeight / 2;
    lid.castShadow = true;
    group.add(lid);

    return group;
  }

  private setContainerOpened(container: LootContainer): void {
    // Rotate the lid (second child in the group) to look "opened"
    const lid = container.mesh.children[1];
    if (lid) {
      // Pivot the lid open by rotating it backward
      lid.rotation.x = -Math.PI / 3;
      lid.position.z -= 0.15;
      lid.position.y += 0.1;
    }

    // Darken the body material to indicate it's been looted
    const body = container.mesh.children[0];
    if (body instanceof THREE.Mesh && body.material instanceof THREE.MeshStandardMaterial) {
      body.material.color.multiplyScalar(0.6);
    }
  }
}
