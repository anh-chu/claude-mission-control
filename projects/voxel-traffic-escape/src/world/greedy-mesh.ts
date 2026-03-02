import { CHUNK_SIZE } from "./chunk";
import { isSolid, isTransparent, blockColorR, blockColorG, blockColorB } from "./block-registry";

/**
 * Face directions: +X, -X, +Y, -Y, +Z, -Z
 * Each face has a normal axis (d), and two tangent axes (u, v)
 */
const FACES = [
  { d: 0, u: 2, v: 1, nx: 1, ny: 0, nz: 0 },   // +X right
  { d: 0, u: 2, v: 1, nx: -1, ny: 0, nz: 0 },  // -X left
  { d: 1, u: 0, v: 2, nx: 0, ny: 1, nz: 0 },   // +Y top
  { d: 1, u: 0, v: 2, nx: 0, ny: -1, nz: 0 },  // -Y bottom
  { d: 2, u: 0, v: 1, nx: 0, ny: 0, nz: 1 },   // +Z front
  { d: 2, u: 0, v: 1, nx: 0, ny: 0, nz: -1 },  // -Z back
];

export interface ChunkMeshData {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

/**
 * Get a voxel from the chunk data, with neighbor chunk lookup for boundary faces
 */
export type VoxelGetter = (x: number, y: number, z: number) => number;

function defaultGetter(voxels: Uint8Array): VoxelGetter {
  return (x: number, y: number, z: number) => {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return 0; // air outside chunk
    }
    return voxels[x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE];
  };
}

/**
 * Compute per-vertex ambient occlusion for a face vertex.
 * Returns 0 (fully occluded) to 3 (no occlusion).
 * Based on the 0fps AO algorithm.
 */
function vertexAO(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) return 0;
  return 3 - (side1 ? 1 : 0) - (side2 ? 1 : 0) - (corner ? 1 : 0);
}

// ── Pre-allocated shared buffers ──
// Safe because meshing is single-threaded (main thread, no Web Workers)
const INIT_QUAD_CAP = 8192;
let _quadCap = INIT_QUAD_CAP;
let _posBuf = new Float32Array(_quadCap * 12);  // 4 verts * 3 floats per quad
let _normBuf = new Float32Array(_quadCap * 12);
let _colBuf = new Float32Array(_quadCap * 12);
let _idxBuf = new Uint32Array(_quadCap * 6);    // 2 tris * 3 indices per quad

function growBuffers(minQuads: number): void {
  const newCap = Math.max(_quadCap * 2, minQuads);
  const p = new Float32Array(newCap * 12); p.set(_posBuf); _posBuf = p;
  const n = new Float32Array(newCap * 12); n.set(_normBuf); _normBuf = n;
  const c = new Float32Array(newCap * 12); c.set(_colBuf); _colBuf = c;
  const x = new Uint32Array(newCap * 6);  x.set(_idxBuf); _idxBuf = x;
  _quadCap = newCap;
}

// Reusable per-call arrays (avoids per-quad/per-voxel allocations)
const _mask = new Int32Array(CHUNK_SIZE * CHUNK_SIZE);
const _ao: [number, number, number, number] = [3, 3, 3, 3];
const _corner = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
const _aoP = [0, 0, 0]; // reusable position for AO neighbor sampling

export function greedyMesh(voxels: Uint8Array, getVoxel?: VoxelGetter): ChunkMeshData {
  const get = getVoxel ?? defaultGetter(voxels);

  let vertCount = 0;
  let quadCount = 0;
  let posI = 0;   // position write cursor
  let normI = 0;  // normal write cursor
  let colI = 0;   // color write cursor
  let idxI = 0;   // index write cursor

  const pos = [0, 0, 0]; // reusable for (d,u,v) → (x,y,z) mapping

  for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
    const face = FACES[faceIdx];
    const { d, u, v, nx, ny, nz } = face;
    const backFace = faceIdx % 2 === 1;

    // Sweep through each slice along the normal axis
    for (let dSlice = 0; dSlice < CHUNK_SIZE; dSlice++) {
      // Build the mask for this slice
      let maskIdx = 0;
      for (let vv = 0; vv < CHUNK_SIZE; vv++) {
        for (let uu = 0; uu < CHUNK_SIZE; uu++) {
          pos[d] = dSlice;
          pos[u] = uu;
          pos[v] = vv;

          const x = pos[0], y = pos[1], z = pos[2];
          const block = get(x, y, z);

          // Neighbor in the face direction (inline — no array allocation)
          const neighbor = get(x + nx, y + ny, z + nz);

          // Face is visible if: block is solid AND neighbor is transparent
          if (isSolid(block) && isTransparent(neighbor)) {
            _mask[maskIdx] = block;
          } else {
            _mask[maskIdx] = 0;
          }
          maskIdx++;
        }
      }

      // Greedy merge the mask into quads
      for (let vv = 0; vv < CHUNK_SIZE; vv++) {
        for (let uu = 0; uu < CHUNK_SIZE;) {
          const idx = vv * CHUNK_SIZE + uu;
          const blockId = _mask[idx];

          if (blockId === 0) {
            uu++;
            continue;
          }

          // Find width (along u axis)
          let w = 1;
          while (uu + w < CHUNK_SIZE && _mask[vv * CHUNK_SIZE + uu + w] === blockId) {
            w++;
          }

          // Find height (along v axis)
          let h = 1;
          let done = false;
          while (vv + h < CHUNK_SIZE && !done) {
            for (let k = 0; k < w; k++) {
              if (_mask[(vv + h) * CHUNK_SIZE + uu + k] !== blockId) {
                done = true;
                break;
              }
            }
            if (!done) h++;
          }

          // Ensure buffer capacity
          if (quadCount >= _quadCap) {
            growBuffers(quadCount + 1);
          }

          // Color from pre-normalized LUTs (no object allocation)
          const cr = blockColorR[blockId];
          const cg = blockColorG[blockId];
          const cb = blockColorB[blockId];

          // Compute AO (writes to _ao)
          computeQuadAO(get, dSlice, uu, vv, w, h, face, backFace);

          // Compute quad corners (reuse _corner arrays)
          const cd = backFace ? dSlice : dSlice + 1;
          for (let ci = 0; ci < 4; ci++) {
            const cu = ci === 1 || ci === 2 ? uu + w : uu;
            const cv = ci === 2 || ci === 3 ? vv + h : vv;
            _corner[ci][d] = cd;
            _corner[ci][u] = cu;
            _corner[ci][v] = cv;
          }

          // Write 4 vertices directly to pre-allocated buffers
          for (let ci = 0; ci < 4; ci++) {
            const c = _corner[ci];
            _posBuf[posI++] = c[0];
            _posBuf[posI++] = c[1];
            _posBuf[posI++] = c[2];

            _normBuf[normI++] = nx;
            _normBuf[normI++] = ny;
            _normBuf[normI++] = nz;

            // Apply AO shading: 0 = 0.4, 1 = 0.6, 2 = 0.8, 3 = 1.0
            const aoFactor = 0.4 + _ao[ci] * 0.2;
            _colBuf[colI++] = cr * aoFactor;
            _colBuf[colI++] = cg * aoFactor;
            _colBuf[colI++] = cb * aoFactor;
          }

          // Flip quad diagonal based on AO to fix anisotropy
          if (_ao[0] + _ao[2] > _ao[1] + _ao[3]) {
            // Normal winding
            if (backFace) {
              _idxBuf[idxI++] = vertCount;
              _idxBuf[idxI++] = vertCount + 2;
              _idxBuf[idxI++] = vertCount + 1;
              _idxBuf[idxI++] = vertCount;
              _idxBuf[idxI++] = vertCount + 3;
              _idxBuf[idxI++] = vertCount + 2;
            } else {
              _idxBuf[idxI++] = vertCount;
              _idxBuf[idxI++] = vertCount + 1;
              _idxBuf[idxI++] = vertCount + 2;
              _idxBuf[idxI++] = vertCount;
              _idxBuf[idxI++] = vertCount + 2;
              _idxBuf[idxI++] = vertCount + 3;
            }
          } else {
            // Flipped winding to fix AO seam
            if (backFace) {
              _idxBuf[idxI++] = vertCount + 1;
              _idxBuf[idxI++] = vertCount + 3;
              _idxBuf[idxI++] = vertCount;
              _idxBuf[idxI++] = vertCount + 1;
              _idxBuf[idxI++] = vertCount + 2;
              _idxBuf[idxI++] = vertCount + 3;
            } else {
              _idxBuf[idxI++] = vertCount + 1;
              _idxBuf[idxI++] = vertCount;
              _idxBuf[idxI++] = vertCount + 3;
              _idxBuf[idxI++] = vertCount + 1;
              _idxBuf[idxI++] = vertCount + 3;
              _idxBuf[idxI++] = vertCount + 2;
            }
          }

          vertCount += 4;
          quadCount++;

          // Clear the merged region in the mask
          for (let dv = 0; dv < h; dv++) {
            for (let du = 0; du < w; du++) {
              _mask[(vv + dv) * CHUNK_SIZE + uu + du] = 0;
            }
          }

          uu += w;
        }
      }
    }
  }

  // Return sliced copies (fast typed array → typed array copy,
  // avoids the old number[] → Float32Array conversion entirely)
  return {
    positions: _posBuf.slice(0, posI),
    normals: _normBuf.slice(0, normI),
    colors: _colBuf.slice(0, colI),
    indices: _idxBuf.slice(0, idxI),
  };
}

/**
 * Compute AO for the 4 corners of a quad. Writes results to _ao[].
 */
function computeQuadAO(
  get: VoxelGetter,
  dSlice: number,
  uu: number,
  vv: number,
  w: number,
  h: number,
  face: typeof FACES[number],
  backFace: boolean
): void {
  const { d, u, v } = face;
  const dOff = dSlice + (backFace ? -1 : 1);

  for (let ci = 0; ci < 4; ci++) {
    const cu = (ci === 1 || ci === 2) ? uu + w : uu;
    const cv = (ci === 2 || ci === 3) ? vv + h : vv;

    const uDir = cu === uu ? -1 : 1;
    const vDir = cv === vv ? -1 : 1;

    // Side1: neighbor along u direction
    _aoP[d] = dOff; _aoP[u] = cu + uDir; _aoP[v] = cv;
    const side1 = isSolid(get(_aoP[0], _aoP[1], _aoP[2]));

    // Side2: neighbor along v direction
    _aoP[u] = cu; _aoP[v] = cv + vDir;
    const side2 = isSolid(get(_aoP[0], _aoP[1], _aoP[2]));

    // Corner: diagonal neighbor
    _aoP[u] = cu + uDir; _aoP[v] = cv + vDir;
    const corner = isSolid(get(_aoP[0], _aoP[1], _aoP[2]));

    _ao[ci] = vertexAO(side1, side2, corner);
  }
}
