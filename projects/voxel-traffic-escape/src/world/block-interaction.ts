/**
 * Block interaction system — handles breaking and placing blocks.
 *
 * Breaking:
 * - Left click (hold): break the targeted block with progress
 * - Break speed depends on held tool's mining tier + speed multiplier
 * - Block hardness tiers: soft (dirt/glass) < medium (wood) < hard (stone) < tough (metal)
 * - Under-tier tools get a 3x penalty per tier gap
 * - Tool durability decreases on each block broken
 * - Mining chip particles while breaking, burst on destroy
 *
 * Placing:
 * - Right click: place a block on the adjacent face (from inventory)
 * - Ghost preview shows where the block will appear
 * - Must be adjacent to at least one solid block (structural integrity)
 * - Consumes 1 item from inventory on placement
 */

import * as THREE from "three";
import { Input } from "@/engine/input";
import { ChunkManager } from "./chunk-manager";
import { VOXEL_SIZE } from "./chunk";
import { AIR, getBlock as getBlockDef, isSolid, blockColorR, blockColorG, blockColorB } from "./block-registry";
import { voxelRaycast, type VoxelRayHit } from "./voxel-raycast";
import { calcBreakTime, getMiningStats } from "./mining-stats";
import type { Inventory } from "@/items/inventory";
import { getItem } from "@/items/item-registry";
import { MiningParticles } from "@/effects/mining-particles";

/** Max reach distance in world meters */
const REACH = 6;

/** Player AABB dimensions for overlap check (matches player-controller.ts) */
const PLAYER_WIDTH = 0.6;
const PLAYER_HEIGHT = 1.7;
const PLAYER_HALF_WIDTH = PLAYER_WIDTH / 2;
const PLAYER_EYE_HEIGHT = 1.6;

/** Interval (seconds) between mining chip particle spawns */
const CHIP_INTERVAL = 0.15;

/** Ghost block pulse animation speed and opacity range */
const GHOST_PULSE_SPEED = 3.0;
const GHOST_OPACITY_MIN = 0.2;
const GHOST_OPACITY_MAX = 0.4;

export class BlockInteraction {
  private input: Input;
  private chunkManager: ChunkManager;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private inventory: Inventory | null = null;
  private particles: MiningParticles;

  // Highlight wireframe
  private highlight: THREE.LineSegments;
  private highlightVisible = false;

  // Ghost block preview
  private ghost: THREE.Mesh;
  private ghostMaterial: THREE.MeshBasicMaterial;
  private ghostVisible = false;
  private ghostTime = 0;

  // Crack overlay (darkened faces showing break progress)
  private crackOverlay: THREE.Mesh;
  private crackMaterial: THREE.MeshBasicMaterial;

  // Breaking state
  private breakTarget: VoxelRayHit | null = null;
  private breakProgress = 0; // 0..1
  private breakTime = 1; // seconds to break current block
  private chipTimer = 0; // timer for mining chip particles

  // Currently selected block for placing (fallback when no inventory)
  placeBlockId = 5; // concrete default

  /** Called when a block is successfully broken */
  onBlockBroken: (() => void) | null = null;
  /** Called when a block is successfully placed */
  onBlockPlaced: (() => void) | null = null;
  /** Called each time mining chip particles spawn (for audio) */
  onMiningChip: (() => void) | null = null;

  constructor(
    input: Input,
    chunkManager: ChunkManager,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera
  ) {
    this.input = input;
    this.chunkManager = chunkManager;
    this.scene = scene;
    this.camera = camera;
    this.particles = new MiningParticles(scene);

    // --- Highlight wireframe (slightly larger than a voxel) ---
    const pad = 0.005; // small padding to prevent z-fighting
    const s = VOXEL_SIZE + pad * 2;
    const box = new THREE.BoxGeometry(s, s, s);
    const edges = new THREE.EdgesGeometry(box);
    this.highlight = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 })
    );
    this.highlight.visible = false;
    this.highlight.renderOrder = 999;
    this.scene.add(this.highlight);
    box.dispose();

    // --- Ghost block preview (semi-transparent colored block) ---
    const ghostBox = new THREE.BoxGeometry(
      VOXEL_SIZE - 0.01,
      VOXEL_SIZE - 0.01,
      VOXEL_SIZE - 0.01
    );
    this.ghostMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: GHOST_OPACITY_MIN,
      depthTest: true,
      side: THREE.FrontSide,
    });
    this.ghost = new THREE.Mesh(ghostBox, this.ghostMaterial);
    this.ghost.visible = false;
    this.ghost.renderOrder = 997;
    this.scene.add(this.ghost);

    // --- Crack overlay (semi-transparent dark box over the block) ---
    const crackBox = new THREE.BoxGeometry(
      VOXEL_SIZE + 0.001,
      VOXEL_SIZE + 0.001,
      VOXEL_SIZE + 0.001
    );
    this.crackMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthTest: true,
      side: THREE.FrontSide,
    });
    this.crackOverlay = new THREE.Mesh(crackBox, this.crackMaterial);
    this.crackOverlay.visible = false;
    this.crackOverlay.renderOrder = 998;
    this.scene.add(this.crackOverlay);
  }

  /** Connect inventory for block selection and item consumption. */
  setInventory(inventory: Inventory): void {
    this.inventory = inventory;
  }

  update(dt: number): void {
    this.ghostTime += dt;
    this.particles.update(dt);

    // Cast ray from camera center
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(this.camera.quaternion);

    const hit = voxelRaycast(
      this.camera.position.x,
      this.camera.position.y,
      this.camera.position.z,
      dir.x,
      dir.y,
      dir.z,
      REACH,
      (wx, wy, wz) => this.chunkManager.getBlock(wx, wy, wz)
    );

    // Update highlight
    if (hit) {
      const cx = hit.worldX + VOXEL_SIZE * 0.5;
      const cy = hit.worldY + VOXEL_SIZE * 0.5;
      const cz = hit.worldZ + VOXEL_SIZE * 0.5;

      this.highlight.position.set(cx, cy, cz);
      this.highlight.visible = true;
      this.highlightVisible = true;
    } else {
      this.highlight.visible = false;
      this.highlightVisible = false;
    }

    // --- Ghost block preview ---
    this.updateGhost(hit);

    // --- Block breaking (hold left click) ---
    this.updateBreaking(dt, hit);

    // --- Block placing (right click) ---
    if (hit && this.input.isJustPressed("place")) {
      this.placeBlock(hit);
    }
  }

  /** Resolve which block ID the player would place right now. */
  private getPlaceableBlockId(): number | null {
    if (!this.inventory) return this.placeBlockId;

    const selected = this.inventory.getSelectedItem();
    if (!selected) return null;

    const def = getItem(selected.itemId);
    if (!def || def.blockId === undefined) return null;

    return def.blockId;
  }

  /** Update the ghost block preview position, color, and visibility. */
  private updateGhost(hit: VoxelRayHit | null): void {
    const blockId = this.getPlaceableBlockId();

    if (!hit || blockId === null) {
      this.ghost.visible = false;
      this.ghostVisible = false;
      return;
    }

    // Compute placement position (adjacent face)
    const placeX = hit.worldX + hit.normalX * VOXEL_SIZE;
    const placeY = hit.worldY + hit.normalY * VOXEL_SIZE;
    const placeZ = hit.worldZ + hit.normalZ * VOXEL_SIZE;

    // Check if placement is valid
    if (!this.isPlacementValid(placeX, placeY, placeZ)) {
      this.ghost.visible = false;
      this.ghostVisible = false;
      return;
    }

    // Position the ghost
    const cx = placeX + VOXEL_SIZE * 0.5;
    const cy = placeY + VOXEL_SIZE * 0.5;
    const cz = placeZ + VOXEL_SIZE * 0.5;
    this.ghost.position.set(cx, cy, cz);

    // Set color from palette
    this.ghostMaterial.color.setRGB(
      blockColorR[blockId],
      blockColorG[blockId],
      blockColorB[blockId]
    );

    // Pulse opacity
    const pulse = Math.sin(this.ghostTime * GHOST_PULSE_SPEED);
    const t = (pulse + 1) * 0.5; // normalize to 0..1
    this.ghostMaterial.opacity =
      GHOST_OPACITY_MIN + t * (GHOST_OPACITY_MAX - GHOST_OPACITY_MIN);

    this.ghost.visible = true;
    this.ghostVisible = true;
  }

  private updateBreaking(dt: number, hit: VoxelRayHit | null): void {
    if (!hit || !this.input.isHeld("attack")) {
      // Not holding attack or no target — reset breaking
      if (this.breakProgress > 0) {
        this.resetBreaking();
      }
      return;
    }

    // Check if target changed
    if (
      this.breakTarget &&
      (this.breakTarget.voxelX !== hit.voxelX ||
        this.breakTarget.voxelY !== hit.voxelY ||
        this.breakTarget.voxelZ !== hit.voxelZ)
    ) {
      this.resetBreaking();
    }

    // Start or continue breaking
    if (!this.breakTarget) {
      this.breakTarget = hit;
      this.breakProgress = 0;
      this.chipTimer = 0;

      // Look up break time using held tool and block material
      const blockDef = getBlockDef(hit.blockId);
      const material = blockDef?.material ?? "none";

      // Water can't be broken
      if (material === "water") {
        this.breakTarget = null;
        return;
      }

      // Calculate break time based on currently held tool
      const selected = this.inventory?.getSelectedItem();
      const toolStats = getMiningStats(selected?.itemId ?? null);
      this.breakTime = calcBreakTime(material, toolStats);
    }

    // Advance progress
    if (this.breakTime > 0) {
      this.breakProgress += dt / this.breakTime;
    } else {
      this.breakProgress = 1;
    }

    // Spawn mining chip particles periodically
    this.chipTimer += dt;
    if (this.chipTimer >= CHIP_INTERVAL) {
      this.chipTimer -= CHIP_INTERVAL;
      this.particles.spawnChips(hit.worldX, hit.worldY, hit.worldZ, hit.blockId, 2);
      if (this.onMiningChip) this.onMiningChip();
    }

    // Update crack overlay
    const cx = hit.worldX + VOXEL_SIZE * 0.5;
    const cy = hit.worldY + VOXEL_SIZE * 0.5;
    const cz = hit.worldZ + VOXEL_SIZE * 0.5;
    this.crackOverlay.position.set(cx, cy, cz);
    this.crackOverlay.visible = true;
    this.crackMaterial.opacity = Math.min(this.breakProgress * 0.6, 0.6);

    // Block broken!
    if (this.breakProgress >= 1) {
      // Burst particles on break
      this.particles.spawnBreakBurst(hit.worldX, hit.worldY, hit.worldZ, hit.blockId);

      // Remove the block
      this.chunkManager.setBlock(hit.worldX, hit.worldY, hit.worldZ, AIR);

      // Damage tool durability
      if (this.inventory) {
        this.inventory.damageSelectedTool(1);
      }

      if (this.onBlockBroken) this.onBlockBroken();

      this.resetBreaking();
    }
  }

  private placeBlock(hit: VoxelRayHit): void {
    const blockId = this.getPlaceableBlockId();
    if (blockId === null) return;

    // Place on the adjacent face
    const placeX = hit.worldX + hit.normalX * VOXEL_SIZE;
    const placeY = hit.worldY + hit.normalY * VOXEL_SIZE;
    const placeZ = hit.worldZ + hit.normalZ * VOXEL_SIZE;

    // Validate placement
    if (!this.isPlacementValid(placeX, placeY, placeZ)) return;

    // Place the block
    this.chunkManager.setBlock(placeX, placeY, placeZ, blockId);

    if (this.onBlockPlaced) this.onBlockPlaced();

    // Consume item from inventory
    if (this.inventory) {
      const selected = this.inventory.getSelectedItem();
      if (selected) {
        this.inventory.removeFromHotbar(this.inventory.selectedSlot, 1);
      }
    }
  }

  /**
   * Check if a block placement at the given world position is valid.
   * Rules:
   *   1. Target must be air
   *   2. Must not overlap player AABB
   *   3. Must be adjacent to at least one solid block (structural integrity)
   */
  private isPlacementValid(
    placeX: number,
    placeY: number,
    placeZ: number
  ): boolean {
    // Rule 1: spot must be air
    const existing = this.chunkManager.getBlock(placeX, placeY, placeZ);
    if (existing !== AIR) return false;

    // Rule 2: don't place inside the player's AABB
    if (this.overlapsPlayerAABB(placeX, placeY, placeZ)) return false;

    // Rule 3: must be adjacent to at least one solid block
    if (!this.hasAdjacentSolid(placeX, placeY, placeZ)) return false;

    return true;
  }

  /**
   * Check if a voxel at the given world position overlaps the player's AABB.
   * Uses the camera position to derive player feet position.
   */
  private overlapsPlayerAABB(
    voxelWorldX: number,
    voxelWorldY: number,
    voxelWorldZ: number
  ): boolean {
    // Player feet position from camera
    const playerX = this.camera.position.x;
    const playerFeetY = this.camera.position.y - PLAYER_EYE_HEIGHT;
    const playerZ = this.camera.position.z;

    // Player AABB
    const pMinX = playerX - PLAYER_HALF_WIDTH;
    const pMaxX = playerX + PLAYER_HALF_WIDTH;
    const pMinY = playerFeetY;
    const pMaxY = playerFeetY + PLAYER_HEIGHT;
    const pMinZ = playerZ - PLAYER_HALF_WIDTH;
    const pMaxZ = playerZ + PLAYER_HALF_WIDTH;

    // Voxel AABB
    const vMinX = voxelWorldX;
    const vMaxX = voxelWorldX + VOXEL_SIZE;
    const vMinY = voxelWorldY;
    const vMaxY = voxelWorldY + VOXEL_SIZE;
    const vMinZ = voxelWorldZ;
    const vMaxZ = voxelWorldZ + VOXEL_SIZE;

    // AABB intersection test
    return (
      pMinX < vMaxX &&
      pMaxX > vMinX &&
      pMinY < vMaxY &&
      pMaxY > vMinY &&
      pMinZ < vMaxZ &&
      pMaxZ > vMinZ
    );
  }

  /**
   * Check if the voxel at the given world position has at least one
   * solid neighbor (6-connected: up/down/left/right/front/back).
   * This enforces basic structural integrity — no floating blocks.
   */
  private hasAdjacentSolid(wx: number, wy: number, wz: number): boolean {
    const vs = VOXEL_SIZE;
    return (
      isSolid(this.chunkManager.getBlock(wx + vs, wy, wz)) ||
      isSolid(this.chunkManager.getBlock(wx - vs, wy, wz)) ||
      isSolid(this.chunkManager.getBlock(wx, wy + vs, wz)) ||
      isSolid(this.chunkManager.getBlock(wx, wy - vs, wz)) ||
      isSolid(this.chunkManager.getBlock(wx, wy, wz + vs)) ||
      isSolid(this.chunkManager.getBlock(wx, wy, wz - vs))
    );
  }

  private resetBreaking(): void {
    this.breakTarget = null;
    this.breakProgress = 0;
    this.chipTimer = 0;
    this.crackOverlay.visible = false;
    this.crackMaterial.opacity = 0;
  }

  /** Whether the highlight is currently visible (for crosshair color changes) */
  get isTargeting(): boolean {
    return this.highlightVisible;
  }

  /** Whether the ghost placement preview is showing */
  get isShowingGhost(): boolean {
    return this.ghostVisible;
  }

  /** Current break progress 0..1 */
  get progress(): number {
    return this.breakProgress;
  }

  destroy(): void {
    this.scene.remove(this.highlight);
    this.highlight.geometry.dispose();
    (this.highlight.material as THREE.Material).dispose();

    this.scene.remove(this.ghost);
    this.ghost.geometry.dispose();
    this.ghostMaterial.dispose();

    this.scene.remove(this.crackOverlay);
    this.crackOverlay.geometry.dispose();
    this.crackMaterial.dispose();

    this.particles.destroy();
  }
}
