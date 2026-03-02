/**
 * A* pathfinding through the voxel world.
 *
 * Works on the integer voxel grid. A voxel is "walkable" if:
 * - The voxel itself (and the 2 above it) are air (clearance for a ~1.5m tall entity)
 * - The voxel directly below is solid (a floor to stand on)
 *
 * Supports step-up/step-down of 1 voxel to handle stairs and gentle slopes.
 * Path is returned as an array of world-space waypoints (meters).
 */

import { VOXEL_SIZE } from "@/world/chunk";

/** Callback to check a block by world-space coordinates */
export type GetBlockFn = (wx: number, wy: number, wz: number) => number;

/** Callback to check if a block ID is solid */
export type IsSolidFn = (id: number) => boolean;

export interface PathNode {
  /** World-space position (meters) — center of the voxel's top face */
  x: number;
  y: number;
  z: number;
}

interface AStarNode {
  vx: number;
  vy: number;
  vz: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

function nodeKey(vx: number, vy: number, vz: number): number {
  // Pack 3 coords into a single number for fast Map lookups.
  // Supports coords from -2048 to 2047 on each axis (12 bits each).
  return ((vx + 2048) << 24) | ((vy + 2048) << 12) | (vz + 2048);
}

function heuristic(ax: number, az: number, bx: number, bz: number): number {
  // Manhattan distance on XZ plane (cheaper than euclidean, good enough for grid)
  return Math.abs(ax - bx) + Math.abs(az - bz);
}

// 4 cardinal directions (no diagonals — simpler, avoids corner-cutting issues)
const DIRS = [
  { dx: 1, dz: 0 },
  { dx: -1, dz: 0 },
  { dx: 0, dz: 1 },
  { dx: 0, dz: -1 },
];

/**
 * Check if a voxel position has enough clearance for an enemy to stand.
 * Requires: floor below, air at feet, air at body, air at head (3 voxels clearance).
 */
function isWalkable(
  vx: number,
  vy: number,
  vz: number,
  getBlock: GetBlockFn,
  isSolid: IsSolidFn
): boolean {
  const vs = VOXEL_SIZE;
  // Floor below must be solid
  if (!isSolid(getBlock(vx * vs, (vy - 1) * vs, vz * vs))) return false;
  // Feet, body, and head must be air
  if (isSolid(getBlock(vx * vs, vy * vs, vz * vs))) return false;
  if (isSolid(getBlock(vx * vs, (vy + 1) * vs, vz * vs))) return false;
  if (isSolid(getBlock(vx * vs, (vy + 2) * vs, vz * vs))) return false;
  return true;
}

/**
 * Find a path from start to end through the voxel world.
 *
 * @param startX  Start position X (world meters)
 * @param startY  Start position Y (world meters) — feet position
 * @param startZ  Start position Z (world meters)
 * @param endX    End position X (world meters)
 * @param endY    End position Y (world meters)
 * @param endZ    End position Z (world meters)
 * @param getBlock  Function to get block ID at world coords
 * @param isSolidFn Function to check if block ID is solid
 * @param maxNodes  Maximum nodes to explore (performance budget)
 * @returns Array of waypoints in world coords, or null if no path found
 */
export function findPath(
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  getBlock: GetBlockFn,
  isSolidFn: IsSolidFn,
  maxNodes = 200
): PathNode[] | null {
  // Convert world coords to voxel coords
  const svx = Math.floor(startX / VOXEL_SIZE);
  const svy = Math.floor(startY / VOXEL_SIZE);
  const svz = Math.floor(startZ / VOXEL_SIZE);
  const evx = Math.floor(endX / VOXEL_SIZE);
  const evy = Math.floor(endY / VOXEL_SIZE);
  const evz = Math.floor(endZ / VOXEL_SIZE);

  // If start === end, return empty path
  if (svx === evx && svz === evz && Math.abs(svy - evy) <= 1) {
    return [];
  }

  const startNode: AStarNode = {
    vx: svx,
    vy: svy,
    vz: svz,
    g: 0,
    h: heuristic(svx, svz, evx, evz),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;

  // Open list (simple array — for <200 nodes, a binary heap isn't worth the complexity)
  const open: AStarNode[] = [startNode];
  const closed = new Set<number>();
  const gScores = new Map<number, number>();
  gScores.set(nodeKey(svx, svy, svz), 0);

  let explored = 0;

  while (open.length > 0 && explored < maxNodes) {
    // Find node with lowest f-score
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open[bestIdx];
    open[bestIdx] = open[open.length - 1];
    open.pop();

    const key = nodeKey(current.vx, current.vy, current.vz);
    if (closed.has(key)) continue;
    closed.add(key);
    explored++;

    // Goal check — close enough on XZ plane and within 1 Y
    if (
      current.vx === evx &&
      current.vz === evz &&
      Math.abs(current.vy - evy) <= 1
    ) {
      return reconstructPath(current);
    }

    // Explore neighbors (4 cardinal + step-up + step-down)
    for (const dir of DIRS) {
      const nx = current.vx + dir.dx;
      const nz = current.vz + dir.dz;

      // Try same level
      if (isWalkable(nx, current.vy, nz, getBlock, isSolidFn)) {
        tryAddNode(open, closed, gScores, current, nx, current.vy, nz, evx, evz);
      }
      // Try step up (1 voxel higher)
      else if (isWalkable(nx, current.vy + 1, nz, getBlock, isSolidFn)) {
        // Check head clearance above current position for the step-up
        if (!isSolidFn(getBlock(current.vx * VOXEL_SIZE, (current.vy + 3) * VOXEL_SIZE, current.vz * VOXEL_SIZE))) {
          tryAddNode(open, closed, gScores, current, nx, current.vy + 1, nz, evx, evz, 1.4);
        }
      }
      // Try step down (1 voxel lower)
      if (isWalkable(nx, current.vy - 1, nz, getBlock, isSolidFn)) {
        tryAddNode(open, closed, gScores, current, nx, current.vy - 1, nz, evx, evz, 1.4);
      }
    }
  }

  // No path found
  return null;
}

function tryAddNode(
  open: AStarNode[],
  closed: Set<number>,
  gScores: Map<number, number>,
  current: AStarNode,
  nx: number,
  ny: number,
  nz: number,
  evx: number,
  evz: number,
  moveCost = 1.0
): void {
  const key = nodeKey(nx, ny, nz);
  if (closed.has(key)) return;

  const newG = current.g + moveCost;
  const existingG = gScores.get(key);
  if (existingG !== undefined && newG >= existingG) return;

  gScores.set(key, newG);
  const h = heuristic(nx, nz, evx, evz);
  open.push({
    vx: nx,
    vy: ny,
    vz: nz,
    g: newG,
    h,
    f: newG + h,
    parent: current,
  });
}

function reconstructPath(endNode: AStarNode): PathNode[] {
  const path: PathNode[] = [];
  let node: AStarNode | null = endNode;

  while (node) {
    path.push({
      x: (node.vx + 0.5) * VOXEL_SIZE,
      y: node.vy * VOXEL_SIZE,
      z: (node.vz + 0.5) * VOXEL_SIZE,
    });
    node = node.parent;
  }

  path.reverse();

  // Skip the first node (it's where the enemy already is)
  if (path.length > 1) {
    path.shift();
  }

  return path;
}

/**
 * Simple direct-line walkability check (no pathfinding needed).
 * Returns true if an enemy can walk in a straight line from A to B
 * without hitting any walls. Uses a simplified 2D raycast on the XZ plane.
 */
export function canWalkDirectly(
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endZ: number,
  getBlock: GetBlockFn,
  isSolidFn: IsSolidFn
): boolean {
  const dx = endX - startX;
  const dz = endZ - startZ;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < VOXEL_SIZE) return true;

  const steps = Math.ceil(dist / VOXEL_SIZE);
  const stepX = dx / steps;
  const stepZ = dz / steps;
  const vy = Math.floor(startY / VOXEL_SIZE);

  for (let i = 1; i <= steps; i++) {
    const wx = startX + stepX * i;
    const wz = startZ + stepZ * i;
    const vx = Math.floor(wx / VOXEL_SIZE);
    const vz = Math.floor(wz / VOXEL_SIZE);

    // Check if the position is walkable at the same height
    if (!isWalkable(vx, vy, vz, getBlock, isSolidFn)) {
      // Try 1 step up/down
      if (!isWalkable(vx, vy + 1, vz, getBlock, isSolidFn) &&
          !isWalkable(vx, vy - 1, vz, getBlock, isSolidFn)) {
        return false;
      }
    }
  }

  return true;
}
