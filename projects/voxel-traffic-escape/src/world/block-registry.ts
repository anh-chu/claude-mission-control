import paletteData from "../../assets/palette.json";

export type MaterialType =
  | "none"
  | "stone"
  | "paint"
  | "metal"
  | "glass"
  | "dirt"
  | "wood"
  | "water"
  | "organic";

export interface BlockDef {
  index: number;
  name: string;
  hex: string;
  r: number;
  g: number;
  b: number;
  material: MaterialType;
  solid: boolean;
  transparent: boolean;
}

const registry: Map<number, BlockDef> = new Map();

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

for (const entry of paletteData.colors) {
  const { r, g, b } = hexToRgb(entry.hex);
  const mat = entry.material as MaterialType;
  registry.set(entry.index, {
    index: entry.index,
    name: entry.name,
    hex: entry.hex,
    r,
    g,
    b,
    material: mat,
    solid: entry.index !== 0 && mat !== "water",
    transparent: entry.index === 0 || mat === "glass" || mat === "water",
  });
}

export const AIR = 0;

// ── Pre-computed flat lookup tables for hot-path performance ──
// Direct array indexing is ~5x faster than Map.get() in tight loops
const SOLID_LUT = new Uint8Array(256);
const TRANSPARENT_LUT = new Uint8Array(256);
/** Pre-normalized (0–1) block colors for direct use in vertex buffers */
export const blockColorR = new Float32Array(256);
export const blockColorG = new Float32Array(256);
export const blockColorB = new Float32Array(256);

for (let i = 0; i < 256; i++) {
  const b = registry.get(i);
  SOLID_LUT[i] = b ? (b.solid ? 1 : 0) : (i !== 0 ? 1 : 0);
  TRANSPARENT_LUT[i] = b ? (b.transparent ? 1 : 0) : 0;
  if (b) {
    blockColorR[i] = b.r / 255;
    blockColorG[i] = b.g / 255;
    blockColorB[i] = b.b / 255;
  } else {
    blockColorR[i] = 1; // magenta = missing
    blockColorG[i] = 0;
    blockColorB[i] = 1;
  }
}
// AIR is always transparent, never solid
SOLID_LUT[0] = 0;
TRANSPARENT_LUT[0] = 1;

export function getBlock(id: number): BlockDef | undefined {
  return registry.get(id);
}

export function isSolid(id: number): boolean {
  return SOLID_LUT[id] === 1;
}

export function isTransparent(id: number): boolean {
  return TRANSPARENT_LUT[id] === 1;
}

export function getBlockColor(id: number): { r: number; g: number; b: number } {
  const b = registry.get(id);
  if (b) return { r: b.r, g: b.g, b: b.b };
  return { r: 255, g: 0, b: 255 }; // magenta = missing
}

export { registry as blockRegistry };
