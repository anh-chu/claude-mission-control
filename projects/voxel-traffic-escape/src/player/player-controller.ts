/**
 * First-person player controller with physics and AABB collision.
 *
 * Handles: pointer-lock mouse look, WASD movement with acceleration,
 * gravity, jumping, sprint, and voxel-terrain collision detection.
 */

import * as THREE from "three";
import { Input } from "@/engine/input";
import { ChunkManager } from "@/world/chunk-manager";
import { isSolid } from "@/world/block-registry";
import { VOXEL_SIZE } from "@/world/chunk";

// ── Player dimensions (meters) ──────────────────────────────────────

const PLAYER_WIDTH = 0.6;
const PLAYER_HEIGHT = 1.7;
const PLAYER_EYE_HEIGHT = 1.6;
const PLAYER_HALF_WIDTH = PLAYER_WIDTH / 2;

// ── Movement ────────────────────────────────────────────────────────

const WALK_SPEED = 5.0; // m/s
const SPRINT_SPEED = 8.0; // m/s
const GROUND_ACCEL = 25.0; // m/s²  — deliberate start, not twitchy
const GROUND_DECEL = 40.0; // m/s²  — crisp stop
const AIR_ACCEL = 8.0; // m/s²  — reduced air control
const AIR_DECEL = 4.0; // m/s²  — less drift in air

// ── Physics ─────────────────────────────────────────────────────────

const GRAVITY = -28.0; // m/s²  — snappier jumps
const JUMP_VELOCITY = 7.0; // m/s  — compensates higher gravity
const TERMINAL_VELOCITY = -40.0; // m/s

// ── Landing camera dip ──────────────────────────────────────────────

const LANDING_DIP_AMOUNT = -0.15; // meters (camera drops briefly)
const LANDING_DIP_DURATION = 0.12; // seconds to recover

// ── Mouse look ──────────────────────────────────────────────────────

const MOUSE_SENSITIVITY = 0.002;
const PITCH_LIMIT = Math.PI / 2 - 0.01; // just under 90°

// ── Collision epsilon ───────────────────────────────────────────────

const EPSILON = 0.001;

// ─────────────────────────────────────────────────────────────────────

export class PlayerController {
  private camera: THREE.PerspectiveCamera;
  private input: Input;
  private chunkManager: ChunkManager;

  /** Feet-center position in world space */
  readonly position = new THREE.Vector3();
  private velocity = new THREE.Vector3();

  /** Yaw (horizontal) and pitch (vertical) in radians */
  private yaw = 0;
  private pitch = 0;

  private _isOnGround = false;
  private _isPointerLocked = false;
  private _landingDipTimer = 0;

  constructor(
    camera: THREE.PerspectiveCamera,
    input: Input,
    chunkManager: ChunkManager,
    spawnPosition?: THREE.Vector3
  ) {
    this.camera = camera;
    this.input = input;
    this.chunkManager = chunkManager;

    if (spawnPosition) {
      this.position.copy(spawnPosition);
    } else {
      // Default: above the road at origin
      this.position.set(0, 6, 0);
    }

    // Face down the -Z axis (looking down the highway)
    this.yaw = Math.PI;

    this.setupPointerLock();
  }

  // ── Pointer Lock ────────────────────────────────────────────────────

  private setupPointerLock(): void {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    canvas.addEventListener("click", () => {
      if (!this._isPointerLocked) {
        canvas.requestPointerLock();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this._isPointerLocked = document.pointerLockElement === canvas;
    });

    document.addEventListener("mousemove", this.onMouseMove);
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this._isPointerLocked) return;
    this.yaw -= e.movementX * MOUSE_SENSITIVITY;
    this.pitch = Math.max(
      -PITCH_LIMIT,
      Math.min(PITCH_LIMIT, this.pitch - e.movementY * MOUSE_SENSITIVITY)
    );
  };

  // ── Public API ──────────────────────────────────────────────────────

  get isOnGround(): boolean {
    return this._isOnGround;
  }

  get isPointerLocked(): boolean {
    return this._isPointerLocked;
  }

  /** Call once per frame. */
  update(dt: number): void {
    this.updateMovement(dt);
    this.updateCamera(dt);
  }

  /**
   * Camera position (eye level).
   * Use this for chunk loading, combat raycasts, etc.
   */
  get eyePosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.position.x,
      this.position.y + PLAYER_EYE_HEIGHT,
      this.position.z
    );
  }

  // ── Movement ────────────────────────────────────────────────────────

  private updateMovement(dt: number): void {
    // Forward/right vectors on the XZ plane (no vertical component)
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);
    const forwardX = -sinYaw;
    const forwardZ = -cosYaw;
    const rightX = cosYaw;
    const rightZ = -sinYaw;

    // Accumulate desired move direction from input
    let dirX = 0;
    let dirZ = 0;
    if (this.input.isHeld("moveForward")) {
      dirX += forwardX;
      dirZ += forwardZ;
    }
    if (this.input.isHeld("moveBack")) {
      dirX -= forwardX;
      dirZ -= forwardZ;
    }
    if (this.input.isHeld("moveRight")) {
      dirX += rightX;
      dirZ += rightZ;
    }
    if (this.input.isHeld("moveLeft")) {
      dirX -= rightX;
      dirZ -= rightZ;
    }

    // Normalize direction
    const dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ);
    if (dirLen > 0) {
      dirX /= dirLen;
      dirZ /= dirLen;
    }

    // Sprint only when moving forward on the ground
    const isSprinting =
      this.input.isHeld("sprint") &&
      this._isOnGround &&
      this.input.isHeld("moveForward");
    const maxSpeed = isSprinting ? SPRINT_SPEED : WALK_SPEED;
    const accel = this._isOnGround ? GROUND_ACCEL : AIR_ACCEL;
    const decel = this._isOnGround ? GROUND_DECEL : AIR_DECEL;

    if (dirLen > 0) {
      // Accelerate toward desired direction
      this.velocity.x += dirX * accel * dt;
      this.velocity.z += dirZ * accel * dt;

      // Clamp horizontal speed
      const hSpeedSq =
        this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z;
      if (hSpeedSq > maxSpeed * maxSpeed) {
        const scale = maxSpeed / Math.sqrt(hSpeedSq);
        this.velocity.x *= scale;
        this.velocity.z *= scale;
      }
    } else {
      // Decelerate (friction)
      const hSpeed = Math.sqrt(
        this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z
      );
      if (hSpeed > EPSILON) {
        const newSpeed = Math.max(0, hSpeed - decel * dt);
        const scale = newSpeed / hSpeed;
        this.velocity.x *= scale;
        this.velocity.z *= scale;
      } else {
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
    }

    // ── Jump ──────────────────────────────────────────────────────────

    if (this.input.isJustPressed("jump") && this._isOnGround) {
      this.velocity.y = JUMP_VELOCITY;
      this._isOnGround = false;
    }

    // ── Gravity ───────────────────────────────────────────────────────

    this.velocity.y += GRAVITY * dt;
    if (this.velocity.y < TERMINAL_VELOCITY) {
      this.velocity.y = TERMINAL_VELOCITY;
    }

    // ── Collision-resolved movement ───────────────────────────────────

    this.moveWithCollision(dt);
  }

  // ── Axis-separated collision resolution ─────────────────────────────

  /**
   * Move the player along each axis independently, resolving collisions
   * with solid voxels using AABB intersection tests.
   *
   * By handling each axis separately the player naturally slides along
   * walls instead of getting stuck.
   */
  private moveWithCollision(dt: number): void {
    // Before Y movement, record whether we were on ground
    const wasOnGround = this._isOnGround;

    // X axis
    this.moveAxis("x", this.velocity.x * dt);

    // Z axis
    this.moveAxis("z", this.velocity.z * dt);

    // Y axis (gravity / jumping)
    this._isOnGround = false;
    const deltaY = this.velocity.y * dt;
    this.position.y += deltaY;

    const yCollisions = this.collectSolidOverlaps();
    if (yCollisions.length > 0) {
      // Undo and resolve
      this.position.y -= deltaY;
      if (deltaY < 0) {
        // Falling — snap feet to the top of the highest blocking voxel
        let highestTop = -Infinity;
        for (const v of yCollisions) {
          const top = (v.vy + 1) * VOXEL_SIZE;
          if (top > highestTop) highestTop = top;
        }
        this.position.y = highestTop;
        this._isOnGround = true;
      } else {
        // Rising — snap head to the bottom of the lowest blocking voxel
        let lowestBottom = Infinity;
        for (const v of yCollisions) {
          const bottom = v.vy * VOXEL_SIZE;
          if (bottom < lowestBottom) lowestBottom = bottom;
        }
        this.position.y = lowestBottom - PLAYER_HEIGHT;
      }
      this.velocity.y = 0;
    }

    // Extra ground check: probe slightly below to detect ground even
    // when velocity.y is 0 (standing still)
    if (!this._isOnGround && wasOnGround && this.velocity.y <= 0) {
      this.position.y -= 0.02;
      if (this.collectSolidOverlaps().length > 0) {
        this._isOnGround = true;
      }
      this.position.y += 0.02;
    }

    // Trigger landing camera dip when transitioning from air to ground
    if (this._isOnGround && !wasOnGround) {
      this._landingDipTimer = LANDING_DIP_DURATION;
    }
  }

  /** Move along a horizontal axis with collision resolution. */
  private moveAxis(axis: "x" | "z", delta: number): void {
    if (Math.abs(delta) < EPSILON * 0.1) return;

    this.position[axis] += delta;
    const overlaps = this.collectSolidOverlaps();

    if (overlaps.length > 0) {
      // Undo
      this.position[axis] -= delta;

      // Resolve: push to nearest non-overlapping position
      if (delta > 0) {
        let nearest = Infinity;
        for (const v of overlaps) {
          const face =
            axis === "x" ? v.vx * VOXEL_SIZE : v.vz * VOXEL_SIZE;
          if (face < nearest) nearest = face;
        }
        this.position[axis] = nearest - PLAYER_HALF_WIDTH - EPSILON;
      } else {
        let farthest = -Infinity;
        for (const v of overlaps) {
          const face =
            axis === "x"
              ? (v.vx + 1) * VOXEL_SIZE
              : (v.vz + 1) * VOXEL_SIZE;
          if (face > farthest) farthest = face;
        }
        this.position[axis] = farthest + PLAYER_HALF_WIDTH + EPSILON;
      }

      // Zero velocity on this axis
      if (axis === "x") this.velocity.x = 0;
      else this.velocity.z = 0;
    }
  }

  // ── AABB overlap test against voxel terrain ─────────────────────────

  /**
   * Returns voxel coordinates of all solid blocks overlapping the
   * player's current AABB.
   */
  private collectSolidOverlaps(): { vx: number; vy: number; vz: number }[] {
    const minX = this.position.x - PLAYER_HALF_WIDTH;
    const minY = this.position.y;
    const minZ = this.position.z - PLAYER_HALF_WIDTH;
    const maxX = this.position.x + PLAYER_HALF_WIDTH;
    const maxY = this.position.y + PLAYER_HEIGHT;
    const maxZ = this.position.z + PLAYER_HALF_WIDTH;

    // Voxel coordinate range that could overlap
    const vxMin = Math.floor(minX / VOXEL_SIZE);
    const vyMin = Math.floor(minY / VOXEL_SIZE);
    const vzMin = Math.floor(minZ / VOXEL_SIZE);
    const vxMax = Math.floor((maxX - EPSILON) / VOXEL_SIZE);
    const vyMax = Math.floor((maxY - EPSILON) / VOXEL_SIZE);
    const vzMax = Math.floor((maxZ - EPSILON) / VOXEL_SIZE);

    const results: { vx: number; vy: number; vz: number }[] = [];

    for (let vy = vyMin; vy <= vyMax; vy++) {
      for (let vx = vxMin; vx <= vxMax; vx++) {
        for (let vz = vzMin; vz <= vzMax; vz++) {
          // getBlock takes world-space coords and floors to voxel
          const blockId = this.chunkManager.getBlock(
            vx * VOXEL_SIZE + EPSILON,
            vy * VOXEL_SIZE + EPSILON,
            vz * VOXEL_SIZE + EPSILON
          );
          if (isSolid(blockId)) {
            results.push({ vx, vy, vz });
          }
        }
      }
    }

    return results;
  }

  // ── Camera ──────────────────────────────────────────────────────────

  /** Sync Three.js camera to player position + look angles. */
  private updateCamera(dt: number): void {
    // Landing camera dip: brief downward offset that recovers linearly
    let eyeOffset = 0;
    if (this._landingDipTimer > 0) {
      this._landingDipTimer -= dt;
      if (this._landingDipTimer < 0) this._landingDipTimer = 0;
      const t = this._landingDipTimer / LANDING_DIP_DURATION; // 1→0
      eyeOffset = LANDING_DIP_AMOUNT * t;
    }

    this.camera.position.set(
      this.position.x,
      this.position.y + PLAYER_EYE_HEIGHT + eyeOffset,
      this.position.z
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  /**
   * Apply an additive offset to the camera (e.g. screen shake).
   * Call AFTER update() each frame.
   */
  applyShakeOffset(offset: THREE.Vector3): void {
    this.camera.position.add(offset);
  }
}
