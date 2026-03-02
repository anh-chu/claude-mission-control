/**
 * DDA (Digital Differential Analyzer) voxel raycasting.
 * Steps through a voxel grid one cell at a time along a ray,
 * using the Amanatides & Woo algorithm.
 */

import { VOXEL_SIZE } from "./chunk";

export interface VoxelRayHit {
  /** Voxel coordinates (world-space, in meters) of the hit block center */
  worldX: number;
  worldY: number;
  worldZ: number;
  /** Integer voxel indices (pre-VOXEL_SIZE) */
  voxelX: number;
  voxelY: number;
  voxelZ: number;
  /** Face normal of the hit face (which side was entered) */
  normalX: number;
  normalY: number;
  normalZ: number;
  /** Distance along the ray */
  distance: number;
  /** Block ID at this position */
  blockId: number;
}

/**
 * Cast a ray through the voxel world and find the first solid block hit.
 *
 * @param originX  Ray origin X (world meters)
 * @param originY  Ray origin Y (world meters)
 * @param originZ  Ray origin Z (world meters)
 * @param dirX     Normalized ray direction X
 * @param dirY     Normalized ray direction Y
 * @param dirZ     Normalized ray direction Z
 * @param maxDist  Maximum ray distance (world meters)
 * @param getBlock Function that returns block ID at world-space position
 * @returns The first solid block hit, or null if nothing was hit
 */
export function voxelRaycast(
  originX: number,
  originY: number,
  originZ: number,
  dirX: number,
  dirY: number,
  dirZ: number,
  maxDist: number,
  getBlock: (wx: number, wy: number, wz: number) => number
): VoxelRayHit | null {
  // Convert origin to voxel space
  const invVoxel = 1 / VOXEL_SIZE;
  const ox = originX * invVoxel;
  const oy = originY * invVoxel;
  const oz = originZ * invVoxel;

  // Current voxel position
  let ix = Math.floor(ox);
  let iy = Math.floor(oy);
  let iz = Math.floor(oz);

  // Step direction (+1 or -1)
  const stepX = dirX > 0 ? 1 : dirX < 0 ? -1 : 0;
  const stepY = dirY > 0 ? 1 : dirY < 0 ? -1 : 0;
  const stepZ = dirZ > 0 ? 1 : dirZ < 0 ? -1 : 0;

  // tDelta: how far along the ray (in voxel units) to cross one cell
  const tDeltaX = dirX !== 0 ? Math.abs(1 / dirX) : Infinity;
  const tDeltaY = dirY !== 0 ? Math.abs(1 / dirY) : Infinity;
  const tDeltaZ = dirZ !== 0 ? Math.abs(1 / dirZ) : Infinity;

  // tMax: distance to the next cell boundary in each axis
  let tMaxX = dirX !== 0
    ? ((stepX > 0 ? ix + 1 - ox : ox - ix) * tDeltaX)
    : Infinity;
  let tMaxY = dirY !== 0
    ? ((stepY > 0 ? iy + 1 - oy : oy - iy) * tDeltaY)
    : Infinity;
  let tMaxZ = dirZ !== 0
    ? ((stepZ > 0 ? iz + 1 - oz : oz - iz) * tDeltaZ)
    : Infinity;

  // Max steps (converted from world distance to voxel steps)
  const maxSteps = Math.ceil(maxDist * invVoxel) + 1;

  // Track which face we entered from
  let normalX = 0;
  let normalY = 0;
  let normalZ = 0;

  for (let step = 0; step < maxSteps; step++) {
    // Check current voxel (using world-space meters for getBlock)
    const wx = ix * VOXEL_SIZE;
    const wy = iy * VOXEL_SIZE;
    const wz = iz * VOXEL_SIZE;
    const blockId = getBlock(wx, wy, wz);

    if (blockId !== 0) {
      // Calculate world-space distance
      const t = Math.min(tMaxX - tDeltaX, tMaxY - tDeltaY, tMaxZ - tDeltaZ);
      const dist = Math.max(0, t) * VOXEL_SIZE;

      if (dist > maxDist) return null;

      return {
        worldX: wx,
        worldY: wy,
        worldZ: wz,
        voxelX: ix,
        voxelY: iy,
        voxelZ: iz,
        normalX,
        normalY,
        normalZ,
        distance: dist,
        blockId,
      };
    }

    // Step to next voxel boundary
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        ix += stepX;
        tMaxX += tDeltaX;
        normalX = -stepX;
        normalY = 0;
        normalZ = 0;
      } else {
        iz += stepZ;
        tMaxZ += tDeltaZ;
        normalX = 0;
        normalY = 0;
        normalZ = -stepZ;
      }
    } else {
      if (tMaxY < tMaxZ) {
        iy += stepY;
        tMaxY += tDeltaY;
        normalX = 0;
        normalY = -stepY;
        normalZ = 0;
      } else {
        iz += stepZ;
        tMaxZ += tDeltaZ;
        normalX = 0;
        normalY = 0;
        normalZ = -stepZ;
      }
    }
  }

  return null;
}
