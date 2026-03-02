import * as THREE from "three";
import { ChunkData, VOXEL_SIZE } from "./chunk";
import { greedyMesh, type VoxelGetter } from "./greedy-mesh";

/** Shared material for all chunk meshes — MeshStandardMaterial adds specular
 *  highlights that reveal face orientation and depth. High roughness keeps the
 *  matte "chunky pop" voxel look while adding visual hierarchy. */
const sharedMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.85,
  metalness: 0.0,
});

/**
 * Build a Three.js mesh from chunk data using greedy meshing.
 * Positions are scaled by VOXEL_SIZE and offset to the chunk's world position.
 * When a cross-chunk voxelGetter is provided, faces at chunk boundaries are
 * properly culled against neighbor chunk data (no visible seams).
 */
export function buildChunkMesh(chunk: ChunkData, getVoxel?: VoxelGetter): THREE.Mesh | null {
  const meshData = greedyMesh(chunk.voxels, getVoxel);

  if (meshData.positions.length === 0) {
    return null; // empty chunk, no mesh needed
  }

  // Scale positions to world space in-place (greedyMesh returns owned copies)
  const positions = meshData.positions;
  const ox = chunk.worldX();
  const oy = chunk.worldY();
  const oz = chunk.worldZ();
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = positions[i] * VOXEL_SIZE + ox;
    positions[i + 1] = positions[i + 1] * VOXEL_SIZE + oy;
    positions[i + 2] = positions[i + 2] * VOXEL_SIZE + oz;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(meshData.normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(meshData.colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1));

  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, sharedMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}

/** Dispose of a chunk mesh's geometry (shared material is NOT disposed) */
export function disposeChunkMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
}
