# Voxel Traffic Escape — Project Conventions

## Overview
A comedic voxel destruction-survival game set in Atlanta traffic. Browser-first (Three.js + TypeScript + WebGPU/WebGL 2). See `docs/vte/01-game-design-document.md` for full GDD.

## Tech Stack
- **Engine:** Three.js 0.172+
- **Language:** TypeScript (strict mode)
- **Bundler:** Vite 6
- **Package manager:** pnpm
- **Target:** ES2022, modern browsers with WebGPU (WebGL 2 fallback)

## Project Structure
```
src/
├── main.ts              — Entry point, game initialization
├── engine/              — Renderer, scene, camera, game loop
├── world/               — Chunk system, meshing, world generation
├── player/              — Player controller, input, first-person camera
├── entities/            — Enemies, NPCs, AI behaviors
├── items/               — Weapons, pickups, inventory, crafting
├── ui/                  — HUD, menus, loading screens
├── physics/             — Rigid body physics, collision, debris
├── audio/               — Sound system
└── utils/               — Shared utilities, math helpers
assets/
├── palette.json         — 256-color indexed palette (source of truth)
├── models/              — MagicaVoxel .vox files
└── sounds/              — Audio files
```

## Commands
```bash
pnpm dev          # Start dev server (port 3001, hot reload)
pnpm build        # TypeScript check + production build
pnpm preview      # Preview production build
pnpm typecheck    # TypeScript check only (tsc --noEmit)
```

## Code Conventions

### TypeScript
- Strict mode, no `any` types
- Prefer named exports over default exports
- Use `@/` path alias for imports (maps to `src/`)
- ES2022 target — use native `Map`, `Set`, `structuredClone`, etc.

### Three.js Patterns
- Dispose geometries, materials, and textures when removing objects
- Use `MeshStandardMaterial` with `flatShading: true` for all voxel rendering
- All colors come from `assets/palette.json` — never hardcode off-palette colors
- Performance budget: 16.67ms total frame time (60fps target)

### Voxel Engine
- Chunk size: 32x32x32 voxels (16m x 16m x 16m at 0.5m voxel size)
- Voxel data: 1 byte palette index per voxel
- Use greedy meshing to merge adjacent same-type faces
- Use Web Workers for off-thread chunk generation and meshing
- Per-vertex ambient occlusion (computed during meshing, zero GPU cost)

### Game Architecture
- First-person perspective (Minecraft-style)
- 3 zones: Highway → Underground → Streets
- Flat-shaded, no textures — color palette only
- Comedic/satirical tone — Atlanta traffic satire

## Performance Targets
- 60fps at 1080p on mid-range hardware (GTX 1060 / integrated GPU)
- 30fps minimum on low-end with reduced settings
- <5 second initial load
- <50MB total download size

## Design References
- `docs/vte/01-game-design-document.md` — Full GDD
- `docs/vte/02-art-style-guide.md` — Visual style, palette, lighting
- `docs/vte/03-world-map-design.md` — Zone layout
- `docs/vte/04-enemy-design.md` — Enemy types and AI
- `docs/vte/05-loot-weapons-health.md` — Items and systems
