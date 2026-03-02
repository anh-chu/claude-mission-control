/**
 * Minimap HUD — circular canvas element showing player, enemies,
 * and zone boundaries from a top-down perspective.
 *
 * Design:
 *   - 120x120px circular canvas, top-right (below zone indicator)
 *   - Player = white triangle at center (pointing forward based on yaw)
 *   - Enemies = red dots (scaled by distance)
 *   - Zone boundaries shown as colored vertical lines
 *   - Scale: ~1px per 2m (120px shows ~240m)
 *   - Rotates so player always faces up
 */

import { type Enemy } from "@/enemies/enemy";

// ── Constants ──

const SIZE = 120;
const HALF = SIZE / 2;
const SCALE = 0.5; // 1px = 2m → 0.5 px per meter

// Zone boundaries (world X coords)
const ZONE_COLLAPSE_X = 140;
const ZONE_STREETS_X = 176;

// Zone colors
const ZONE_COLORS = {
  highway: "#7A7A7A",   // gray
  collapse: "#B85C2F",  // orange
  streets: "#5A8A5A",   // green
};

// Player triangle size (pixels)
const PLAYER_SIZE = 6;

// Enemy dot radius range
const ENEMY_DOT_MIN = 1.5;
const ENEMY_DOT_MAX = 3;
const ENEMY_DOT_RANGE = 100; // meters — dots shrink beyond this

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLDivElement;

  constructor() {
    // Container for positioning + circular clipping
    this.container = document.createElement("div");
    Object.assign(this.container.style, {
      position: "fixed",
      top: "64px",
      right: "16px",
      width: `${SIZE}px`,
      height: `${SIZE}px`,
      borderRadius: "50%",
      overflow: "hidden",
      border: "2px solid rgba(255,255,255,0.2)",
      zIndex: "50",
      pointerEvents: "none",
      background: "rgba(0,0,0,0.5)",
    } satisfies Partial<CSSStyleDeclaration>);

    // Canvas
    this.canvas = document.createElement("canvas");
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.canvas.style.display = "block";
    this.container.appendChild(this.canvas);

    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Minimap: failed to get 2D context");
    this.ctx = ctx;
  }

  mount(): void {
    document.body.appendChild(this.container);
  }

  unmount(): void {
    this.container.remove();
  }

  /**
   * Redraw the minimap.
   * @param _dt        Delta time (unused, draw is unconditional)
   * @param playerX    Player world X
   * @param playerZ    Player world Z
   * @param playerYaw  Player yaw in radians (camera.rotation.y)
   * @param enemies    Active enemies array
   */
  update(
    _dt: number,
    playerX: number,
    playerZ: number,
    playerYaw: number,
    enemies: readonly Enemy[]
  ): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // The rotation to apply: negate yaw so the player's forward direction points up.
    // In Three.js, camera.rotation.y = 0 means looking along -Z.
    // We want "up" on the minimap to be the player's forward direction.
    const rot = playerYaw;

    // ── Zone boundary lines ──
    this.drawZoneLine(ctx, ZONE_COLLAPSE_X, playerX, playerZ, rot, ZONE_COLORS.collapse);
    this.drawZoneLine(ctx, ZONE_STREETS_X, playerX, playerZ, rot, ZONE_COLORS.streets);

    // Also draw the highway start (x=0) as gray
    this.drawZoneLine(ctx, 0, playerX, playerZ, rot, ZONE_COLORS.highway);

    // ── Enemy dots ──
    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;
      const ePos = enemy.position;
      const dx = (ePos.x - playerX) * SCALE;
      const dz = (ePos.z - playerZ) * SCALE;

      // Rotate around center
      const rx = dx * Math.cos(rot) - dz * Math.sin(rot);
      const ry = dx * Math.sin(rot) + dz * Math.cos(rot);

      const sx = HALF + rx;
      const sy = HALF + ry;

      // Skip if outside circle
      if (rx * rx + ry * ry > HALF * HALF) continue;

      // Scale dot size by distance
      const worldDist = Math.sqrt(
        (ePos.x - playerX) ** 2 + (ePos.z - playerZ) ** 2
      );
      const t = Math.min(1, worldDist / ENEMY_DOT_RANGE);
      const dotR = ENEMY_DOT_MAX - t * (ENEMY_DOT_MAX - ENEMY_DOT_MIN);

      ctx.beginPath();
      ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = "#FF4444";
      ctx.fill();
    }

    // ── Player triangle at center ──
    this.drawPlayerTriangle(ctx, rot);
  }

  // ── Private ──

  /**
   * Draw a vertical zone boundary line at worldX.
   * The line spans the full minimap height at the appropriate rotated position.
   */
  private drawZoneLine(
    ctx: CanvasRenderingContext2D,
    worldX: number,
    playerX: number,
    playerZ: number,
    rot: number,
    color: string
  ): void {
    const dx = (worldX - playerX) * SCALE;

    // Draw as a long line perpendicular to the X axis (i.e. along Z),
    // rotated into minimap space
    const lineHalf = HALF * 2; // long enough to span the circle

    const x0 = dx;
    const z0 = -lineHalf;
    const x1 = dx;
    const z1 = lineHalf;

    // Use playerZ offset = 0 since zone lines are infinite along Z
    void playerZ;

    const sx0 = HALF + (x0 * Math.cos(rot) - z0 * Math.sin(rot));
    const sy0 = HALF + (x0 * Math.sin(rot) + z0 * Math.cos(rot));
    const sx1 = HALF + (x1 * Math.cos(rot) - z1 * Math.sin(rot));
    const sy1 = HALF + (x1 * Math.sin(rot) + z1 * Math.cos(rot));

    ctx.beginPath();
    ctx.moveTo(sx0, sy0);
    ctx.lineTo(sx1, sy1);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /**
   * Draw the player as a white triangle pointing "up" (forward).
   * Since we rotate the world, the triangle always faces up.
   */
  private drawPlayerTriangle(ctx: CanvasRenderingContext2D, _rot: number): void {
    const cx = HALF;
    const cy = HALF;
    const s = PLAYER_SIZE;

    // Triangle pointing up (forward = -Y on canvas = up)
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);          // tip (forward)
    ctx.lineTo(cx - s * 0.6, cy + s * 0.5); // bottom-left
    ctx.lineTo(cx + s * 0.6, cy + s * 0.5); // bottom-right
    ctx.closePath();
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
  }
}
