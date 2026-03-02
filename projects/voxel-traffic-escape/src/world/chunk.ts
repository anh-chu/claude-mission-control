import { AIR } from "./block-registry";

export const CHUNK_SIZE = 32;
export const CHUNK_SIZE_SQ = CHUNK_SIZE * CHUNK_SIZE;
export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE;
export const VOXEL_SIZE = 0.5; // meters per voxel

export class ChunkData {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly voxels: Uint8Array;
  dirty = true;

  constructor(cx: number, cy: number, cz: number) {
    this.cx = cx;
    this.cy = cy;
    this.cz = cz;
    this.voxels = new Uint8Array(CHUNK_VOLUME);
  }

  private index(x: number, y: number, z: number): number {
    return x + y * CHUNK_SIZE + z * CHUNK_SIZE_SQ;
  }

  get(x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return AIR;
    }
    return this.voxels[this.index(x, y, z)];
  }

  set(x: number, y: number, z: number, blockId: number): void {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return;
    }
    this.voxels[this.index(x, y, z)] = blockId;
    this.dirty = true;
  }

  fill(blockId: number): void {
    this.voxels.fill(blockId);
    this.dirty = true;
  }

  /** World-space origin of this chunk in meters */
  worldX(): number { return this.cx * CHUNK_SIZE * VOXEL_SIZE; }
  worldY(): number { return this.cy * CHUNK_SIZE * VOXEL_SIZE; }
  worldZ(): number { return this.cz * CHUNK_SIZE * VOXEL_SIZE; }
}

/** Key string for a chunk coordinate triple */
export function chunkKey(cx: number, cy: number, cz: number): string {
  return `${cx},${cy},${cz}`;
}
