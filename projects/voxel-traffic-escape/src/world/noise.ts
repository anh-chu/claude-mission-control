/**
 * Deterministic hash-based noise for world generation.
 * No external dependencies — uses integer hashing for reproducibility.
 */

/** Integer hash with good avalanche properties */
export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return (h ^ (h >> 16)) | 0;
}

export function hash3(x: number, y: number, z: number): number {
  return hash2(hash2(x, y), z);
}

/** Returns float in [0, 1) from 2D integer coords */
export function rand2(x: number, y: number): number {
  return (hash2(x, y) >>> 0) / 0x100000000;
}

/** Returns float in [0, 1) from 3D integer coords */
export function rand3(x: number, y: number, z: number): number {
  return (hash3(x, y, z) >>> 0) / 0x100000000;
}

/** 2D value noise with smoothstep interpolation */
export function noise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const v00 = rand2(ix, iz);
  const v10 = rand2(ix + 1, iz);
  const v01 = rand2(ix, iz + 1);
  const v11 = rand2(ix + 1, iz + 1);

  return v00 + (v10 - v00) * ux + (v01 - v00) * uz + (v00 - v10 - v01 + v11) * ux * uz;
}

/** Fractal Brownian Motion — layered noise for natural-looking terrain */
export function fbm(x: number, z: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
  let value = 0;
  let amp = 1;
  let freq = 1;
  let max = 0;

  for (let i = 0; i < octaves; i++) {
    value += amp * noise2D(x * freq, z * freq);
    max += amp;
    amp *= gain;
    freq *= lacunarity;
  }

  return value / max;
}
