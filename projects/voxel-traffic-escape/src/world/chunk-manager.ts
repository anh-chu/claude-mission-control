import * as THREE from "three";
import { ChunkData, CHUNK_SIZE, VOXEL_SIZE, chunkKey } from "./chunk";
import { buildChunkMesh, disposeChunkMesh } from "./chunk-mesh";
import { generateTerrain } from "./terrain-gen";

interface LoadedChunk {
  data: ChunkData;
  mesh: THREE.Mesh | null;
}

/** Distance² from player chunk to a chunk key (for priority sorting) */
function chunkDistSq(key: string, pcx: number, pcy: number, pcz: number): number {
  const parts = key.split(",");
  const dx = parseInt(parts[0], 10) - pcx;
  const dy = parseInt(parts[1], 10) - pcy;
  const dz = parseInt(parts[2], 10) - pcz;
  return dx * dx + dy * dy + dz * dz;
}

export class ChunkManager {
  private chunks: Map<string, LoadedChunk> = new Map();
  private scene: THREE.Scene;
  private viewDistance: number; // in chunks
  private meshBudgetPerFrame = 8; // max meshes to build per update

  /** Chunks that need their mesh rebuilt — Set for O(1) dedup */
  private dirtySet: Set<string> = new Set();

  /** Shadow distance threshold in chunks (squared) */
  private readonly shadowDistSq: number;

  /** Cached player chunk position for distance sorting */
  private _pcx = 0;
  private _pcy = 0;
  private _pcz = 0;

  constructor(scene: THREE.Scene, viewDistance = 4) {
    this.scene = scene;
    this.viewDistance = viewDistance;
    // Chunks within 3 chunk radius cast shadows; beyond that, receive only
    this.shadowDistSq = 3 * 3;
  }

  /** Update which chunks are loaded based on a world-space position */
  update(playerX: number, playerY: number, playerZ: number): void {
    const pcx = Math.floor(playerX / (CHUNK_SIZE * VOXEL_SIZE));
    const pcy = Math.floor(playerY / (CHUNK_SIZE * VOXEL_SIZE));
    const pcz = Math.floor(playerZ / (CHUNK_SIZE * VOXEL_SIZE));
    this._pcx = pcx;
    this._pcy = pcy;
    this._pcz = pcz;

    const vd = this.viewDistance;

    // Load chunks within view distance + 1 border ring.
    // The extra ring provides voxel DATA for cross-chunk face culling
    // so visible boundary chunks have correct faces (no AIR artifacts).
    const loadDist = vd + 1;
    for (let cz = pcz - loadDist; cz <= pcz + loadDist; cz++) {
      for (let cx = pcx - loadDist; cx <= pcx + loadDist; cx++) {
        // Load y layers: -2 (deep underground) through 2 (tall buildings)
        for (let cy = -2; cy <= 2; cy++) {
          const key = chunkKey(cx, cy, cz);
          if (!this.chunks.has(key)) {
            this.loadChunk(cx, cy, cz);
          }
        }
      }
    }

    // Unload chunks outside view distance + 2 buffer
    const unloadDist = vd + 2;
    for (const [key, loaded] of this.chunks) {
      const dx = loaded.data.cx - pcx;
      const dz = loaded.data.cz - pcz;
      if (Math.abs(dx) > unloadDist || Math.abs(dz) > unloadDist) {
        this.unloadChunk(key, loaded);
      }
    }

    // Build meshes from dirty set (budgeted, distance-sorted).
    // All chunks in view distance load in a single frame (no load budget),
    // so by the time any chunk meshes, its in-range neighbors exist.
    // The cross-chunk getter returns AIR for out-of-range neighbors,
    // which correctly generates visible faces at the world boundary.
    if (this.dirtySet.size > 0) {
      // Sort by distance to player — nearby chunks get meshed first
      const sorted = [...this.dirtySet].sort(
        (a, b) =>
          chunkDistSq(a, pcx, pcy, pcz) - chunkDistSq(b, pcx, pcy, pcz)
      );

      let built = 0;
      for (const key of sorted) {
        if (built >= this.meshBudgetPerFrame) break;
        const loaded = this.chunks.get(key);
        if (!loaded || !loaded.data.dirty) {
          this.dirtySet.delete(key);
          continue;
        }
        this.rebuildMesh(key, loaded);
        this.dirtySet.delete(key);
        built++;
      }
    }
  }

  private loadChunk(cx: number, cy: number, cz: number): void {
    const data = new ChunkData(cx, cy, cz);
    generateTerrain(data);

    const key = chunkKey(cx, cy, cz);
    const loaded: LoadedChunk = { data, mesh: null };
    this.chunks.set(key, loaded);

    if (data.dirty) {
      this.dirtySet.add(key); // O(1) add, auto-deduped
    }

    // Mark adjacent already-loaded chunks as dirty so they rebuild
    // boundary faces against this newly available neighbor data.
    // Without this, chunks loaded before their neighbors have missing faces.
    this.markDirty(cx - 1, cy, cz);
    this.markDirty(cx + 1, cy, cz);
    this.markDirty(cx, cy - 1, cz);
    this.markDirty(cx, cy + 1, cz);
    this.markDirty(cx, cy, cz - 1);
    this.markDirty(cx, cy, cz + 1);
  }

  private unloadChunk(key: string, loaded: LoadedChunk): void {
    if (loaded.mesh) {
      this.scene.remove(loaded.mesh);
      disposeChunkMesh(loaded.mesh);
    }
    this.dirtySet.delete(key);
    this.chunks.delete(key);
  }

  /**
   * Create a voxel getter that reads across chunk boundaries.
   * For coordinates inside the chunk, reads directly from voxels[].
   * For coordinates outside (±1 during face neighbor checks), looks up
   * the adjacent chunk. Returns 0 (air) if the neighbor isn't loaded.
   * This eliminates visible seams / missing faces at chunk borders.
   */
  private createCrossChunkGetter(chunk: ChunkData): (x: number, y: number, z: number) => number {
    return (x: number, y: number, z: number): number => {
      // Fast path: within this chunk (the common case)
      if (x >= 0 && x < CHUNK_SIZE && y >= 0 && y < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
        return chunk.voxels[x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE];
      }
      // Slow path: look up neighbor chunk for boundary voxels
      const ncx = chunk.cx + Math.floor(x / CHUNK_SIZE);
      const ncy = chunk.cy + Math.floor(y / CHUNK_SIZE);
      const ncz = chunk.cz + Math.floor(z / CHUNK_SIZE);
      const neighbor = this.chunks.get(chunkKey(ncx, ncy, ncz));
      if (!neighbor) return 0; // air if neighbor not loaded
      const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      return neighbor.data.voxels[lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE];
    };
  }

  private rebuildMesh(key: string, loaded: LoadedChunk): void {
    // Remove old mesh
    if (loaded.mesh) {
      this.scene.remove(loaded.mesh);
      disposeChunkMesh(loaded.mesh);
      loaded.mesh = null;
    }

    // Cross-chunk getter eliminates visible seams at chunk boundaries
    const getVoxel = this.createCrossChunkGetter(loaded.data);
    const mesh = buildChunkMesh(loaded.data, getVoxel);
    if (mesh) {
      // LOD: disable castShadow on distant chunks to reduce shadow map cost
      const distSq = chunkDistSq(key, this._pcx, this._pcy, this._pcz);
      mesh.castShadow = distSq <= this.shadowDistSq;
      mesh.receiveShadow = true;

      this.scene.add(mesh);
      loaded.mesh = mesh;
    }

    loaded.data.dirty = false;
  }

  /** Get chunk data at chunk coordinates */
  getChunk(cx: number, cy: number, cz: number): ChunkData | undefined {
    return this.chunks.get(chunkKey(cx, cy, cz))?.data;
  }

  /** Get the block at a world-space position */
  getBlock(worldX: number, worldY: number, worldZ: number): number {
    const vx = Math.floor(worldX / VOXEL_SIZE);
    const vy = Math.floor(worldY / VOXEL_SIZE);
    const vz = Math.floor(worldZ / VOXEL_SIZE);

    const cx = Math.floor(vx / CHUNK_SIZE);
    const cy = Math.floor(vy / CHUNK_SIZE);
    const cz = Math.floor(vz / CHUNK_SIZE);

    const chunk = this.getChunk(cx, cy, cz);
    if (!chunk) return 0;

    const lx = ((vx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((vy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((vz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    return chunk.get(lx, ly, lz);
  }

  /** Set a block at a world-space position and mark chunk dirty */
  setBlock(worldX: number, worldY: number, worldZ: number, blockId: number): void {
    const vx = Math.floor(worldX / VOXEL_SIZE);
    const vy = Math.floor(worldY / VOXEL_SIZE);
    const vz = Math.floor(worldZ / VOXEL_SIZE);

    const cx = Math.floor(vx / CHUNK_SIZE);
    const cy = Math.floor(vy / CHUNK_SIZE);
    const cz = Math.floor(vz / CHUNK_SIZE);

    const chunk = this.getChunk(cx, cy, cz);
    if (!chunk) return;

    const lx = ((vx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((vy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((vz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

    chunk.set(lx, ly, lz, blockId);

    const key = chunkKey(cx, cy, cz);
    this.dirtySet.add(key); // O(1) — was O(n) with Array.includes()

    // If at chunk boundary, also dirty the neighbor
    if (lx === 0) this.markDirty(cx - 1, cy, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cy, cz);
    if (ly === 0) this.markDirty(cx, cy - 1, cz);
    if (ly === CHUNK_SIZE - 1) this.markDirty(cx, cy + 1, cz);
    if (lz === 0) this.markDirty(cx, cy, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cy, cz + 1);
  }

  private markDirty(cx: number, cy: number, cz: number): void {
    const key = chunkKey(cx, cy, cz);
    const loaded = this.chunks.get(key);
    if (loaded) {
      loaded.data.dirty = true;
      this.dirtySet.add(key); // O(1) — was O(n) with Array.includes()
    }
  }

  /** Get loaded chunk count for debug */
  get loadedCount(): number {
    return this.chunks.size;
  }

  /** Get mesh count for debug */
  get meshCount(): number {
    let count = 0;
    for (const loaded of this.chunks.values()) {
      if (loaded.mesh) count++;
    }
    return count;
  }

  /** Dispose all chunks */
  dispose(): void {
    for (const [key, loaded] of this.chunks) {
      this.unloadChunk(key, loaded);
    }
  }
}
