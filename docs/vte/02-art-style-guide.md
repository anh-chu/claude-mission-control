# Voxel Traffic Escape — Art Style & Voxel Aesthetic Guide

> **Task:** task_VTE_002
> **Version:** 1.0
> **Date:** 2026-02-28
> **Status:** Foundational — visual north star for all art and rendering decisions

---

## Design Decisions Summary

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Voxel style** | **Stylized chunky (0.5m cubes)** | 2x more detail than Minecraft per axis, recognizable vehicles/buildings, browser-performant |
| **Surface treatment** | **Flat color per voxel, no textures** | Clean aesthetic, zero texture memory, easy to author, matches comedic tone |
| **Color palette** | **Saturated & warm, Atlanta sunshine** | Comedy demands readability; warm tones match Southern setting |
| **Lighting model** | **Baked hybrid** (per-vertex AO + flood fill + 1 shadow map) | Best quality-per-cost for browser at 60fps |
| **Overall aesthetic** | **Crossy Road meets Teardown** | Crossy Road's vibrant flat-shaded charm + Teardown's destruction satisfaction |

---

## 1. Voxel Resolution

### Decision: 0.5m Cubes (50cm)

Each voxel in the world is a **0.5m x 0.5m x 0.5m cube**. This is a deliberate middle ground between Minecraft's 1m blocks and Teardown's 10cm micro-voxels.

### Rationale

| Factor | 1m (Minecraft) | 0.5m (Chosen) | 0.25m | 0.1m (Teardown) |
|--------|---------------|---------------|-------|-----------------|
| Voxels per m³ | 1 | 8 | 64 | 1,000 |
| Car model size | 4x2x1.5 = crude | 8x4x3 = recognizable | 16x8x6 = detailed | 40x20x15 = photo |
| Chunk 32³ covers | 32m³ | 16m³ | 8m³ | 3.2m³ |
| Browser performance | Trivial | Comfortable | Tight | Not viable |
| Destruction feel | Chunky/comedic | Satisfying | Granular | Realistic |
| Art authoring | Very fast | Fast | Moderate | Slow |

**Why 0.5m wins for this game:**
- **Recognizable objects**: A sedan at 0.5m is ~8 voxels long x 4 wide x 3 tall — clearly reads as a car with room for color detail (headlights, windows, bumper)
- **Destruction satisfaction**: Blocks are big enough to see flying individually as debris, small enough that destruction feels granular (not just removing huge chunks)
- **Browser budget**: At 32³ chunks covering 16m cubes, visible geometry stays manageable for WebGPU
- **Comedic tone**: Chunky-but-detailed matches the Crossy Road / Unturned visual register — playful, not trying to be realistic
- **Atlanta landmarks**: Buildings have enough resolution for silhouettes (downtown skyline recognizable) and signage (Waffle House sign as a few colored blocks)

### Chunk System

| Parameter | Value | Notes |
|-----------|-------|-------|
| Chunk size | 32x32x32 voxels | 16m x 16m x 16m real-world |
| View distance | 8 chunks (128m) | Adjustable in settings |
| Active chunks | ~200-400 | Frustum + occlusion culled |
| Voxel storage | 1 byte palette index + 2 bytes light | 3 bytes per voxel |
| Chunk memory | ~98 KB raw | ~32 KB with RLE compression |

### Object Scale Reference

All objects designed in whole or half-voxel multiples:

| Object | Size (voxels) | Real Size |
|--------|--------------|-----------|
| Player | 1w x 1d x 4h | 0.5m x 0.5m x 2m |
| Sedan car | 8L x 4W x 3H | 4m x 2m x 1.5m |
| SUV/Truck | 10L x 5W x 4H | 5m x 2.5m x 2m |
| Semi truck cab | 12L x 5W x 6H | 6m x 2.5m x 3m |
| Road lane width | 7 voxels | 3.5m |
| Sidewalk width | 4 voxels | 2m |
| Highway divider | 1 voxel | 0.5m |
| Door | 2W x 4H | 1m x 2m |
| Window | 2W x 2H | 1m x 1m |
| Waffle House sign | 6W x 4H x 1D | 3m x 2m x 0.5m |
| MARTA train car | 30L x 6W x 7H | 15m x 3m x 3.5m |
| Highway overpass | 14W x 2H (deck) | 7m wide, 1m thick |
| Traffic light | 1W x 1D x 6H | 0.5m x 0.5m x 3m |

---

## 2. Visual Style

### Aesthetic: "Chunky Pop"

The overall look is **flat-shaded, vibrant, and readable** — like a diorama made of colorful blocks, lit warmly by the Atlanta sun. Think Crossy Road's charm at a slightly higher fidelity, with Teardown's destruction physics applied.

### Style Pillars

1. **Flat Color, No Textures**: Every voxel is a single solid color. No face textures, no normal maps. The color palette and ambient occlusion do all the visual work. This keeps the look clean, the data small, and the authoring fast.

2. **Warm Southern Light**: The default lighting evokes late-afternoon Atlanta — golden directional light casting long shadows, warm ambient fill. Even the Underground zone gets warmth from artificial light sources (orange sodium lamps, flickering fluorescents).

3. **Readable Silhouettes**: Every object should be identifiable by shape alone at 50m distance. Cars look like cars. Buildings look like buildings. The player should never mistake a weapon for a healing item. Silhouette > surface detail.

4. **Exaggerated Scale for Comedy**: Proportions are slightly exaggerated to support the comedic tone. Traffic cones are a bit too big. Waffle House signs are slightly oversized. The player character's head is 1 voxel (half their width) — cartoonish, not realistic.

5. **Destruction Tells a Color Story**: When blocks break, they expose interior colors. A brick wall is red on the outside, gray concrete inside. A car hood is painted on top, gray metal underneath. Destruction reveals layers.

### Color Storage: Indexed Palette

Use a **256-color indexed palette** (1 byte per voxel), inspired by Teardown:

- Palette index 0 = air (empty)
- Indices 1-255 = material colors
- Each palette entry stores: RGB color + material type (solid/glass/metal/dirt/water)
- Material type determines: mining speed, debris particle effect, sound on break

**Advantages over storing full RGB per voxel:**
- 1 byte vs 3-4 bytes per voxel (75% memory savings)
- Guaranteed color consistency (no off-palette colors)
- Easy to swap palettes for time-of-day or accessibility modes
- Material properties are implicit from palette index

---

## 3. Color Palette by Zone

### Global Palette Rules

- **Primary colors** are warm and saturated (yellows, oranges, warm reds)
- **Secondary colors** are cooler accents (teal, purple, blue) used sparingly
- **Grays** are warm-tinted, never pure neutral gray
- **Black** is never true #000000 — use dark warm gray (#1A1714)
- **Highlights** pop against the zone's dominant hue

### Zone 1: Highway (Warm Asphalt & Metal)

The opening zone. Blazing sun, hot asphalt, acres of angry metal. The palette is dominated by grays and warm neutrals punctuated by bright car colors.

| Element | Hex | Swatch | Notes |
|---------|-----|--------|-------|
| Asphalt (road) | #3D3A38 | Dark warm gray | Base road surface |
| Asphalt (shoulder) | #4A4644 | Slightly lighter | Road edges |
| Lane marking (yellow) | #F5C518 | Bright yellow | Center dividers |
| Lane marking (white) | #E8E4DC | Warm white | Edge lines |
| Concrete (divider) | #9B9489 | Warm concrete | Jersey barriers, walls |
| Concrete (overpass) | #8A8378 | Darker concrete | Highway structures |
| Guardrail | #B8B0A4 | Light metal | Galvanized steel |
| Dirt/ground | #8B7355 | Warm brown | Shoulders, embankments |
| Grass | #5A8C3A | Warm green | Atlanta green |
| Tree trunk | #6B4E35 | Rich brown | Southern hardwoods |
| Tree leaves | #4D7A2E | Deep green | Dense canopy |
| Sky | #87CEEB → #F4A460 | Blue to golden | Gradient, late afternoon |
| **Car red** | #D94040 | Bright red | Common car color |
| **Car blue** | #3A7BD5 | Medium blue | Common car color |
| **Car white** | #E8E4DC | Warm white | Most common car color |
| **Car black** | #2A2724 | Warm black | SUVs, sedans |
| **Car yellow** | #E8B830 | Taxi yellow | Taxis, school buses |
| **Car silver** | #A8A29E | Warm silver | Very common |
| **Car green** | #4A8B5C | Forest green | Less common |
| Car interior | #5C5550 | Dark warm gray | Exposed when destroyed |
| Car metal (exposed) | #7A7470 | Medium gray | Under paint layer |
| Tire | #2A2724 | Near-black warm | Wheels |
| Glass (windshield) | #88C8E8 | Light blue, semi-transparent | Car windows |
| Construction orange | #F07830 | Bright orange | Cones, barrels, signs |
| Construction yellow | #F5D030 | Safety yellow | Caution tape, signs |
| Rust | #8B4513 | Rust brown | Damaged metal |

**Zone 1 mood**: Hot, bright, claustrophobic metal jungle. The dominant warm grays of asphalt and concrete are broken by flashes of car color. Construction orange signals danger zones.

### Zone 2: Underground / Sewers (Dark & Damp)

The mid-game zone. Dark, wet, industrial. The palette shifts dramatically — muted greens and blues replace the highway's warm neutrals. Light sources (sodium lamps, bioluminescent algae, sparks) punctuate the darkness.

| Element | Hex | Swatch | Notes |
|---------|-----|--------|-------|
| Tunnel wall (brick) | #6B4A3A | Dark brick | Old Atlanta brick |
| Tunnel wall (concrete) | #4A4440 | Dark concrete | Modern tunnels |
| Tunnel ceiling | #3A3632 | Very dark | Overhead |
| Sewer water | #3A5C4A | Dark murky green | Shallow channels |
| Sewer water (deep) | #2A4438 | Darker green | Deep pools |
| Metal pipe | #5C6668 | Cool steel | Plumbing, infrastructure |
| Rust pipe | #7A4A30 | Rusty orange | Corroded metal |
| Tile (MARTA station) | #C8BEB0 | Warm beige | Station walls |
| Tile (accent) | #B85C40 | Terra cotta | Station accent strips |
| Concrete floor | #5A5550 | Medium dark | Walking surfaces |
| Grime/moss | #4A5A3A | Dark olive | Growing on walls |
| Sodium lamp light | #F0A830 | Warm orange | Main light source color |
| Fluorescent light | #D8E8D0 | Cool green-white | Flickering tube lights |
| Algae glow | #40C890 | Bright green | Bioluminescent accent |
| Electrical spark | #78D8F0 | Electric blue | Exposed wiring |
| MARTA sign | #0068A8 | MARTA blue | Station signage |
| MARTA rail | #888078 | Warm steel | Train tracks |
| Wood (old) | #5C4A38 | Dark wood | Support beams, crates |
| Dirt (underground) | #5A4A3A | Dark earth | Exposed ground |
| Bone/debris | #C8BCA8 | Off-white | Environmental storytelling |

**Zone 2 mood**: Oppressive darkness with pools of warm artificial light. The shift from bright highway to dark underground should feel dramatic. Warm sodium orange vs cool fluorescent green creates visual tension.

### Zone 3: Street Level (Urban & Colorful)

The late-game zone. Back on the surface but in the dense urban core — storefronts, apartment buildings, construction sites. The brightest, most colorful zone.

| Element | Hex | Swatch | Notes |
|---------|-----|--------|-------|
| Sidewalk | #B8AEA0 | Warm light gray | Concrete walkways |
| Brick building | #A0503C | Classic brick red | Atlanta brick |
| Brick (alt) | #8B6854 | Brown brick | Variety |
| Window glass | #6ABED8 | Sky reflection blue | Building windows |
| Window frame | #4A4440 | Dark frame | Window borders |
| Door (wood) | #7A5C42 | Medium wood | Residential |
| Door (metal) | #686460 | Gray metal | Commercial |
| Storefront awning | #D04848 | Red awning | Restaurants, shops |
| Storefront awning (alt) | #2878A8 | Blue awning | Variety |
| Neon sign | #FF4488 | Hot pink | Bar/restaurant signs |
| Neon sign (alt) | #44DDFF | Cyan | Variety |
| Waffle House yellow | #F5C518 | WH brand yellow | Waffle House buildings |
| Waffle House brown | #4A3828 | WH brand brown | Waffle House accent |
| Street asphalt | #3D3A38 | Same as highway | Visual continuity |
| Traffic light red | #E03030 | Bright red | Signal lights |
| Traffic light yellow | #E8B830 | Bright yellow | Signal lights |
| Traffic light green | #30B850 | Bright green | Signal lights |
| Traffic light pole | #5A5550 | Dark gray | Metal poles |
| Fire hydrant | #D04040 | Bright red | Street furniture |
| Mailbox | #3050A0 | USPS blue | Street furniture |
| Dumpster | #3A6838 | Dark green | Containers |
| Construction scaffold | #D88830 | Orange metal | Construction sites |
| Apartment balcony | #706860 | Concrete gray | Residential detail |
| Rooftop | #585250 | Dark gray | Building tops |
| AC unit | #A8A098 | Light gray | Rooftop equipment |

**Zone 3 mood**: Colorful urban energy. Storefronts and signage add splashes of bright color against the brick and concrete. This zone should feel alive and dense, contrasting with the desolate highway and dark underground.

### Zone 3.5: Apartment (Home — The Destination)

The final area. Small, intimate, warm. The player sees their apartment building from the street, fights through the lobby, and reaches their unit. The palette is cozy and personal.

| Element | Hex | Swatch | Notes |
|---------|-----|--------|-------|
| Apartment door | #6B4E35 | Rich brown wood | Your front door |
| Hallway carpet | #8B5A3C | Warm terracotta | Building hallways |
| Wall paint | #E8DDD0 | Warm off-white | Interior walls |
| Couch | #5A7848 | Olive green | Living room |
| TV | #1A1714 | Near-black | When off — turns on at ending |
| Kitchen counter | #B8AEA0 | Light stone | Kitchen |
| Floor (wood) | #A07850 | Warm hardwood | Apartment floor |
| Window (interior) | #87CEEB | Sky blue | Looking out = sunset |

---

## 4. Lighting Model

### Decision: Baked Hybrid (3-Tier System)

A three-tier lighting system that maximizes visual quality within the browser's 60fps budget.

### Tier 1: Per-Vertex Ambient Occlusion (Always On)

**Cost: 0ms GPU** — computed during mesh generation, stored as vertex colors.

For each vertex of a voxel face, examine the 3 adjacent voxels (2 side neighbors + 1 corner):

```
AO level = 3 - (side1 + side2 + corner)
// Returns 0 (fully occluded/dark) to 3 (fully lit)
```

- 4 AO levels per vertex, smoothly interpolated across faces by the GPU
- Re-computed only when chunks are re-meshed (on destruction)
- This single technique transforms flat-colored blocks into something with depth and contact shadows
- **Quad flip rule**: When vertex AO values are non-coplanar (a00 + a11 != a01 + a10), flip the triangle diagonal to prevent ugly interpolation artifacts
- Compatible with greedy meshing (faces only merge if all vertex AO values match)

**Visual impact**: The subtle darkening in corners and crevices gives the world solidity. This is the #1 highest-impact, lowest-cost visual technique for voxel rendering.

### Tier 2: Flood Fill Light Map (Always On)

**Cost: ~0.5-1ms CPU per frame** (amortized, incremental updates only).

Minecraft-style BFS light propagation with two channels:

| Channel | Bits | Purpose |
|---------|------|---------|
| Sky light | 4 bits | Daylight from above, 16 levels |
| Block light (R) | 4 bits | Red channel of emissive blocks |
| Block light (G) | 4 bits | Green channel of emissive blocks |
| Block light (B) | 4 bits | Blue channel of emissive blocks |

**Total: 2 bytes per voxel** for the light map.

- Sky light floods down at full intensity through air, decreases by 1 per horizontal/upward step
- Block light emits from light sources (fires, torches, sodium lamps, glowing algae) and decreases by 1 per step in all directions
- Colored light enables gameplay effects: orange explosion light, green sewer glow, blue electrical sparks
- On destruction: run BFS removal + re-propagation for affected area (sky light floods into new craters)
- Large explosions: spread BFS across 2-3 frames to stay within CPU budget

### Tier 3: Single Directional Shadow Map (Always On)

**Cost: ~1-2ms GPU.**

One `DirectionalLight` in Three.js with `PCFSoftShadowMap`:

| Parameter | Value |
|-----------|-------|
| Shadow map resolution | 2048 x 2048 |
| Shadow type | PCFSoftShadowMap |
| Shadow bias | -0.0005 |
| Shadow camera size | Follows player (64m x 64m frustum) |
| Light direction | ~45 degrees from west (late afternoon Atlanta sun) |
| Light color | #FFF0D8 (warm golden white) |
| Intensity | 1.5 |

- Provides the "hero" shadows that ground objects in the scene
- Combined with flood fill sky light, creates convincing outdoor illumination
- Shadow map follows the player to cover the active area
- In the Underground zone, disable the directional light and rely on flood fill + AO only (thematic darkness)

### Ambient Lighting

| Light | Type | Color | Intensity | Notes |
|-------|------|-------|-----------|-------|
| Sky fill | HemisphereLight | Sky: #87CEEB, Ground: #5A4A3A | 0.4 | Warm ground bounce |
| Zone 1 ambient | — | — | — | Sun + hemisphere is enough |
| Zone 2 ambient | — | — | 0.1 | Very dark, rely on block lights |
| Zone 3 ambient | — | — | — | Sun + hemisphere + neon |

### Optional Tier 4: Event Point Lights (Situational)

**Cost: ~1ms each, no shadows.**

Spawn 0-2 temporary unshadowed `PointLight` instances for dramatic moments:
- Explosions (bright orange flash, rapid falloff)
- Electrical sparks (blue-white strobe)
- Fires (flickering orange-red)
- Boss entrance effects

These are transient (1-3 second lifetime) and additive to the baked lighting. Do not cast shadows — too expensive for temporary effects.

### Post-Processing Stack

Applied in order, all optional and toggleable in settings:

| Effect | Cost | Quality Level |
|--------|------|---------------|
| N8AO (screen-space AO) | ~1ms | Medium+ only |
| Bloom (glow on emissives/fire) | ~0.5ms | Low+ |
| Tone mapping (ACES filmic) | ~0.1ms | Always |
| Color grading (warm shift) | ~0.1ms | Always |
| Vignette (subtle) | ~0.05ms | Medium+ |

**Total post-processing: ~2ms at Medium quality.**

### Frame Budget Breakdown (Target: 60fps = 16.67ms)

| Stage | Budget | Notes |
|-------|--------|-------|
| Game logic + physics | 2-3ms | JS main thread |
| Chunk re-meshing | 1-2ms | Web Worker, amortized |
| Light map updates | 0.5-1ms | CPU BFS, amortized |
| Geometry rendering | 3-5ms | Instanced chunk meshes |
| Shadow map pass | 1-2ms | 1 directional light |
| Post-processing | 1-2ms | AO + bloom + tonemap |
| UI overlay | 0.5ms | HUD elements |
| **Total** | **~10-15ms** | **2-7ms headroom** |

---

## 5. Mood Board — Reference Games

### Primary References (Borrow These Directly)

| # | Game | What to Borrow | Why It Matters |
|---|------|---------------|----------------|
| 1 | **Crossy Road** | Flat-shaded vibrant voxel models, traffic theme, comedic charm, mobile-friendly performance mindset | Closest tonal match — playful, colorful, traffic-based. Shows that flat color per voxel + no textures = charming, not cheap |
| 2 | **Teardown** | Destruction physics philosophy, indexed color palette, structural collapse, flat-color aesthetic | THE reference for voxel destruction. 10cm voxels with ray-traced lighting — we can't replicate the rendering, but the destruction feel and palette approach transfer directly |
| 3 | **Voxel Turf** | Urban sandbox with vehicles, destructible buildings, city environment | Closest gameplay reference. GTA meets Minecraft in a destructible city. Study what works and where it falls short |
| 4 | **Cloudpunk** | Dense voxel city atmosphere, multi-level highways, vehicle design in voxels | Most visually impressive voxel city. Shows how voxels create believable urban density with neon lighting |
| 5 | **The Touryst** | Proof that voxels + good lighting = premium feel, small-team art pipeline | MagicaVoxel models + sophisticated lighting. Demonstrates that chunky voxels can look high-end |

### Secondary References (Learn From These)

| # | Game | Lesson |
|---|------|--------|
| 6 | **Unturned** | Survival game with vehicles, buildings, and urban environments in chunky voxel style. Comedic survival tone with car/road design at low resolution |
| 7 | **BattleBit Remastered** | Large-scale voxel destruction in multiplayer FPS. 254 players with destructible environments — proves voxel destruction scales |
| 8 | **Cube World** | Warm, vivid color palette that makes chunky voxels feel charming rather than crude. Southern warmth vibe |
| 9 | **Voxel Tycoon** | Transport/logistics with voxel vehicles (trains, trucks, buses) and roads. How to handle the intersection of vehicles, roads, and buildings |
| 10 | **Astroneer** | Flat-shaded color philosophy — large solid-color areas with minimal texturing. Proves that flat shading reads as stylish, not lazy |
| 11 | **Minecraft (with shaders)** | Per-vertex AO + one shadow map transforms the look. The visual jump from vanilla to AO+shadows is exactly our Tier 1+3 approach |
| 12 | **Deep Rock Galactic** | Best-in-class destruction feedback — particles, sound, chunks breaking away. Study the "feel" of breaking terrain |

### Anti-References (Avoid These Approaches)

| Game/Style | What to Avoid | Why |
|------------|--------------|-----|
| Teardown (rendering) | Ray-traced voxel lighting | Way too expensive for browser. Borrow the palette, not the renderer |
| Minecraft RTX | Hardware ray tracing | Requires RTX GPU. Our target is mid-range hardware |
| Astroneer (geometry) | Smooth marching-cubes surfaces | Too expensive computationally, loses the blocky charm, wrong tone for comedy |
| Any photorealistic voxel | PBR materials, normal maps on voxels | Over-engineered for comedy. Flat shading IS the style |

---

## 6. Character & Entity Design Guidelines

### Player Character

- **Proportions**: 1W x 1D x 4H voxels (0.5m x 0.5m x 2m). Head is 1x1x1, body is 1x1x2, legs are 1x1x1
- **Style**: Simple, readable silhouette. Think Crossy Road human characters — minimal detail, maximum personality through color and animation
- **Color**: Bright, stands out from environment. Default: blue shirt, khaki pants (office worker who snapped)
- **Animation**: Blocky limb rotation (no skeletal deformation). Arms swing, legs walk, body bounces. Exaggerated for comedy

### Vehicles

- **Sedans**: 8L x 4W x 3H. Two-tone (body color + window glass blue). Clear front/back distinction
- **SUVs/Trucks**: 10L x 5W x 4H. Taller, wider. Darker colors skew toward SUVs
- **Semi trucks**: Cab (12L x 5W x 6H) + trailer (24L x 5W x 8H). Biggest obstacles
- **MARTA bus**: 20L x 5W x 6H. Distinct MARTA blue (#0068A8)
- **Destruction layers**: Paint (outer) → Metal (middle) → Interior (inner). Breaking a car exposes these layers

### Enemies (NPC Style)

- Same proportions as player (1x1x4 voxels) but with distinguishing accessories:
  - Road Rager: Red face voxel, fist raised
  - Construction Worker: Orange hard hat (extra voxel on head), hi-vis vest
  - MARTA Security: Blue uniform, baton
  - Sewer Creatures: Green/brown, 2x wider, lower to ground

### Items & Pickups

- Weapons/tools: 3-5 voxels long, held in front of player
- Healing items: Small (2-3 voxels), float and rotate slowly when on ground
- Pickup glow: Items on the ground emit 2-3 levels of colored block light to draw attention
- Item rarity signaled by glow color: white (common), blue (uncommon), orange (rare)

---

## 7. Environmental Effects

### Destruction VFX

When blocks are destroyed:
1. **Debris particles**: 4-8 small cubes (0.125m, quarter-voxel size) fly outward with physics
2. **Dust cloud**: Billboard particle (warm gray for concrete, brown for dirt, none for metal)
3. **Sound**: Material-specific break sound (crunch for concrete, clang for metal, crack for wood)
4. **Screen shake**: Subtle, scales with explosion size. Stronger in first-person
5. **Interior exposure**: Destroyed outer blocks reveal inner-layer colors (see color palette — each object has an "inside" color)

### Weather / Atmosphere

| Effect | Implementation | Performance |
|--------|---------------|-------------|
| Atlanta haze | Fog plane at view distance, warm tint | ~0ms (built-in Three.js fog) |
| Heat shimmer (highway) | UV distortion post-process on ground plane | ~0.5ms, optional |
| Dripping water (underground) | Particle emitters at ceiling positions | ~0.2ms |
| Dust motes (underground) | Few billboard particles in light beams | ~0.1ms |
| Construction dust (street) | Billboarding near construction sites | ~0.1ms |

### Time of Day

The game uses a **fixed late-afternoon time** (around 5:30 PM) — this is when Atlanta traffic is worst and the lighting is most dramatic. No day/night cycle in MVP.

| Parameter | Value |
|-----------|-------|
| Sun angle | ~30 degrees above horizon, from the west |
| Sun color | #FFF0D8 (warm golden) |
| Sky gradient | #87CEEB (zenith) to #F4A460 (horizon) |
| Shadow length | Long (dramatic late-afternoon shadows) |
| Ambient warmth | High — everything has a golden tint |

---

## 8. UI Art Direction

### HUD Style

- **Blocky/voxel-themed UI**: Borders made of 1-pixel "blocks", slight 3D emboss effect
- **Font**: Monospace or pixel font (e.g., Press Start 2P or similar). Readable at all sizes
- **Colors**: UI elements use the same warm palette as the game world. Dark semi-transparent backgrounds (#1A1714 at 80% opacity)
- **HP bar**: Red (#D94040) on dark background, chunky segments (each segment = 10 HP)
- **Hotbar**: Bottom-center, 8 slots with block-style borders. Selected slot glows white

### Loading Screens

- Solid color background (#3D3A38 asphalt gray)
- Atlanta traffic tip in white pixel font, centered
- Simple voxel car animation (driving across bottom of screen)
- Progress bar styled as a road with lane markings

---

## 9. Technical Art Pipeline

### Authoring Tools

| Step | Tool | Output |
|------|------|--------|
| Voxel modeling | MagicaVoxel (free) | .vox files |
| Palette management | Shared .vox palette file | 256-color indexed |
| Export | MagicaVoxel → JSON/binary | Voxel grid data |
| In-engine | Custom importer | Three.js InstancedMesh or greedy-meshed geometry |

### Palette File

Maintain a single `palette.json` that all assets reference:

```json
{
  "version": 1,
  "colors": [
    { "index": 0, "hex": "#000000", "name": "air", "material": "none" },
    { "index": 1, "hex": "#3D3A38", "name": "asphalt", "material": "stone" },
    { "index": 2, "hex": "#F5C518", "name": "lane_yellow", "material": "paint" },
    { "index": 3, "hex": "#E8E4DC", "name": "lane_white", "material": "paint" },
    ...
  ]
}
```

Each index maps to: RGB color, human-readable name, material type (determines mining speed, break sound, debris color).

### Performance Guidelines for Artists

1. **Avoid hollow interiors** unless the player will see inside (sealed rooms = solid fill, saves mesh faces)
2. **Use palette colors only** — never introduce off-palette colors
3. **Test at view distance** — if detail isn't visible at 32m (64 voxels), it's wasted
4. **Maximum model size**: Individual models (vehicles, props) should fit within a 32x32x32 bounding box
5. **Destruction layers**: Design objects with at least 2 color layers (exterior + interior) so destruction reveals something

---

## Appendix: Full Palette Index Map

Reserved palette index ranges:

| Range | Category | Example Colors |
|-------|----------|---------------|
| 0 | Air | Transparent |
| 1-20 | Road & Infrastructure | Asphalt, concrete, lane markings, guardrails |
| 21-40 | Natural | Grass, dirt, tree trunk, leaves, water |
| 41-70 | Vehicle Colors | Car paints, glass, tire, metal interior |
| 71-100 | Building Materials | Brick, tile, wood, window glass, doors |
| 101-120 | Underground | Sewer brick, pipe metal, rust, grime, algae |
| 121-140 | Street Furniture | Signs, lights, hydrants, mailboxes, dumpsters |
| 141-160 | Interior / Apartment | Walls, floors, furniture, appliances |
| 161-180 | Enemy Colors | Skin tones, uniforms, creature colors |
| 181-200 | Item / Pickup Colors | Weapon metals, food items, glow colors |
| 201-220 | VFX / Emissive | Fire, sparks, neon, explosion flash |
| 221-240 | UI / Special | Debug colors, zone boundary markers |
| 241-255 | Reserved | Future use |

---

*This document defines the visual identity of Voxel Traffic Escape. All art assets, rendering decisions, and visual effects should be evaluated against the principles defined here: flat color, warm light, readable silhouettes, and chunky pop charm.*
