/**
 * Win condition: player reaches their apartment door.
 *
 * Checks player world-space position against a trigger zone at the
 * apartment entrance. When triggered, fires a callback once.
 */

import * as THREE from "three";
import { VOXEL_SIZE } from "@/world/chunk";

// From terrain-gen.ts: APARTMENT_X = 576, door at relX 8-11, relZ 0 (wz=-12)
// Building spans wz=-12..+11 (relZ 0-23), front face at wz=-12
const APARTMENT_X = 576;
const DOOR_REL_X_MIN = 8;
const DOOR_REL_X_MAX = 11;
const DOOR_WZ = -12;  // front wall Z in voxel coords
const GROUND_Y_VOXEL = 8;

// Convert to world meters
const TRIGGER_MIN_X = (APARTMENT_X + DOOR_REL_X_MIN - 1) * VOXEL_SIZE;
const TRIGGER_MAX_X = (APARTMENT_X + DOOR_REL_X_MAX + 2) * VOXEL_SIZE;
const TRIGGER_MIN_Z = (DOOR_WZ - 1) * VOXEL_SIZE;
const TRIGGER_MAX_Z = (DOOR_WZ + 3) * VOXEL_SIZE;
const TRIGGER_MIN_Y = GROUND_Y_VOXEL * VOXEL_SIZE;
const TRIGGER_MAX_Y = (GROUND_Y_VOXEL + 4) * VOXEL_SIZE;

export class WinCondition {
  private _triggered = false;
  private _onWin: (() => void) | null = null;

  /** Register a callback for when the player wins */
  onWin(callback: () => void): void {
    this._onWin = callback;
  }

  /** Check player position each frame. Fires callback once. */
  update(playerPos: THREE.Vector3): void {
    if (this._triggered) return;

    if (
      playerPos.x >= TRIGGER_MIN_X && playerPos.x <= TRIGGER_MAX_X &&
      playerPos.z >= TRIGGER_MIN_Z && playerPos.z <= TRIGGER_MAX_Z &&
      playerPos.y >= TRIGGER_MIN_Y && playerPos.y <= TRIGGER_MAX_Y
    ) {
      this._triggered = true;
      if (this._onWin) {
        this._onWin();
      }
    }
  }

  get hasWon(): boolean {
    return this._triggered;
  }
}
