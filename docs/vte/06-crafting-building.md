# Voxel Traffic Escape — Crafting & Building Mechanics Design

> **Task:** task_VTE_006
> **Version:** 1.0
> **Date:** 2026-02-28
> **Dependencies:** GDD (01), Art Style Guide (02), World Map (03), Loot System (05)

---

## Design Decisions Summary

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Structural integrity** | **No** — Minecraft-style floating blocks | GDD Pillar 4 (Accessible Chaos). Realistic collapse adds complexity without fun. Boss arenas use scripted collapse instead. |
| **Crafting scope** | **Minimal** — 10 recipes, 10 materials, 2 workbenches | GDD says "Simple crafting — combine 2-3 items anywhere. ~10 recipes." Already defined in loot doc. |
| **Block variety** | **30 block types**, 6 material classes | Enough variety for distinct zones without overwhelming the player or art pipeline. |
| **Building purpose** | **Tactical** — bridges, cover, reaching heights | This is an action game, not a sandbox. Building serves combat and traversal, not creative expression. |
| **Block drops** | **Every block drops itself** when mined | Simple 1:1 rule. Mine asphalt → get asphalt block. No separate "ore" system. |
| **Placement rules** | **Adjacent-surface only**, no floating placement | Player must place blocks on an existing surface. Prevents skybridge exploits while keeping it intuitive. |

---

## 1. Block Types

### Material Classes

Every block in the game belongs to one of 6 material classes. The material class determines mining speed, break sound, debris particle color, and what tool type is most effective.

| Material Class | Break Sound | Debris Color | Examples |
|---------------|-------------|-------------|----------|
| **Dirt** | Soft crunch | Brown particles | Dirt, mud, grass |
| **Stone** | Hard crunch | Gray particles | Concrete, asphalt, brick, sidewalk, tile |
| **Metal** | Metallic clang | Spark particles | Guardrail, pipe, rail, steel, scaffolding, crane metal |
| **Glass** | Shatter | Transparent shards | Car glass, window glass |
| **Wood** | Crack/splinter | Brown splinters | Wood planks, doors, old beams |
| **Organic** | Squelch/pop | Green particles | Bioluminescent fungus, moss, grass top |

> **Palette integration:** Each material class maps to a range in the 256-color indexed palette (see Art Style Guide §9). The palette index determines both the block's color AND its material class, so mining properties are implicit from the voxel data — zero additional storage needed.

### Complete Block Type Table

#### Zone 1: Highway

| Block Type | Material | Hardness | Palette Range | Tool Bonus | Drop | Notes |
|------------|----------|----------|---------------|------------|------|-------|
| Dirt | Dirt | 1 | 21-25 | Shovel-type +50% | Self | Common filler, fast to mine |
| Grass | Dirt | 1 | 26-28 | Shovel-type +50% | Dirt | Drops dirt, not grass (cosmetic layer) |
| Asphalt | Stone | 2 | 1-2 | Pickaxe-type +50% | Self | Road surface, everywhere |
| Concrete (road) | Stone | 3 | 3-5 | Pickaxe-type +50% | Self | Highway structures |
| Concrete (barrier) | Stone | 4 | 6-7 | Pickaxe-type +50% | Concrete (road) | Jersey barriers, thick walls |
| Car Metal | Metal | 2 | 41-55 | — | Scrap Metal | Vehicles — yields crafting material |
| Car Glass | Glass | 1 | 56-58 | — | Nothing | Shatters with no useful drop |
| Guardrail | Metal | 3 | 8-9 | — | Scrap Metal | Highway edges |
| Construction Scaffolding | Metal | 1 | 10-11 | — | Scrap Metal | Fast to mine, yields material |

#### Zone 2: Underground

| Block Type | Material | Hardness | Palette Range | Tool Bonus | Drop | Notes |
|------------|----------|----------|---------------|------------|------|-------|
| Concrete (sewer) | Stone | 3 | 101-103 | Pickaxe-type +50% | Self | Dark, wet variant |
| Brick (old) | Stone | 2 | 104-105 | Pickaxe-type +50% | Self | Classic Atlanta brick |
| Brick (new) | Stone | 3 | 106-107 | Pickaxe-type +50% | Self | Modern construction |
| Metal Pipe | Metal | 4 | 108-110 | — | Pipe | Yields crafting material |
| Stone (natural) | Stone | 3 | 111-112 | Pickaxe-type +50% | Self | Natural underground rock |
| Mud | Dirt | 1 | 113-114 | Shovel-type +50% | Self | Wet underground soil |
| Water | — | — | 115-116 | — | — | Cannot be mined. Slows movement 15% |
| Bioluminescent Fungus | Organic | 1 | 117-118 | — | Nothing | Glows, decorative. Emits block light |
| Tile (MARTA) | Stone | 2 | 119-121 | Pickaxe-type +50% | Self | Clean station walls |
| Rail | Metal | 5 | 122-123 | — | Scrap Metal | Train tracks, very hard |

#### Zone 3: Streets

| Block Type | Material | Hardness | Palette Range | Tool Bonus | Drop | Notes |
|------------|----------|----------|---------------|------------|------|-------|
| Sidewalk | Stone | 2 | 71-72 | Pickaxe-type +50% | Self | Pedestrian walkways |
| Building Brick | Stone | 3 | 73-76 | Pickaxe-type +50% | Self | Building exteriors |
| Building Glass | Glass | 1 | 77-78 | — | Nothing | Windows, shatters |
| Steel (structural) | Metal | 5 | 79-80 | — | Scrap Metal | I-beams, supports |
| Drywall | Stone | 1 | 81-82 | Any +100% | Self | Interior walls, very fast |
| Wood | Wood | 2 | 83-84 | Axe-type +50% | Self | Doors, floors, furniture |
| Concrete (construction) | Stone | 4 | 85-86 | Pickaxe-type +50% | Self | Heavy construction |
| Scaffolding | Metal | 1 | 87-88 | — | Scrap Metal | Construction sites |
| Crane Metal | Metal | 6 | 89-90 | — | Scrap Metal | Cranes — nearly unbreakable |

#### Special Blocks

| Block Type | Material | Hardness | Notes |
|------------|----------|----------|-------|
| Bedrock / Zone Border | — | ∞ | Unbreakable. Zone boundaries, world floor. Never appears as a mineable block |
| TNT / Explosive Barrel | Metal | 1 | Explodes when hit. Destroys blocks in 4-block radius. Found in construction zones |
| Workbench | Wood | 3 | Cannot be picked up. Found at fixed locations (Pumping Station, Construction Office) |

**Total: 30 unique block types** across 3 zones + 3 special types.

---

## 2. Mining Mechanics

### Core Mining Loop

1. Player faces a block and holds the attack/mine button
2. A progress bar appears on the block face (crack overlay texture, 4 stages)
3. When progress reaches 100%, the block breaks
4. Debris particles fly (material-class dependent)
5. Dropped item appears as a floating pickup (auto-collected within 2 blocks)
6. Adjacent blocks check for support (for scripted collapse zones only)

### Mining Speed Formula

```
time_to_break (seconds) = block_hardness / (tool_mining_multiplier * material_bonus)

material_bonus = 1.5 if tool has the matching tool bonus for this block material
material_bonus = 1.0 otherwise
```

### Tool Mining Multipliers

From the loot system doc (05), every melee weapon has a Mining stat:

| Tool | Mining Multiplier | Best For |
|------|------------------|----------|
| Bare Fists | 1x | Desperation |
| Broken Antenna | 1.5x | — |
| Road Flare | 1x | — |
| Tire Iron | 2x | General early mining |
| Car Jack Handle | 2.5x | Slow but strong |
| Sewer Gator Tooth | 2x | Fast combat, decent mining |
| Rebar Sword | 3x | All-rounder |
| Pipe Wrench | 4x | Mining specialist |
| Sledgehammer | 5x | Heavy mining |
| Electric Cable Whip | 1x | Combat focus, not a mining tool |
| Stop Sign Axe | 5x | Fast + great mining |
| Rebar Mace | 4x | Combat + mining |
| Traffic Light Flail | 3x | Combat focus |
| Jackhammer | 8x | **Best mining tool in game** |
| Construction Saw | 6x | High raw damage + good mining |

### Mining Time Examples

| Block (Hardness) | Fists (1x) | Tire Iron (2x) | Rebar Sword (3x) | Jackhammer (8x) |
|-------------------|-----------|----------------|-------------------|------------------|
| Glass (1) | 1.0s | 0.5s | 0.33s | 0.13s |
| Dirt (1) | 1.0s | 0.5s | 0.33s | 0.13s |
| Drywall (1) | 1.0s | 0.5s | 0.33s | 0.13s |
| Scaffolding (1) | 1.0s | 0.5s | 0.33s | 0.13s |
| Asphalt (2) | 2.0s | 1.0s | 0.67s | 0.25s |
| Brick (2) | 2.0s | 1.0s | 0.67s | 0.25s |
| Concrete (3) | 3.0s | 1.5s | 1.0s | 0.38s |
| Concrete barrier (4) | 4.0s | 2.0s | 1.33s | 0.50s |
| Metal Pipe (4) | 4.0s | 2.0s | 1.33s | 0.50s |
| Steel structural (5) | 5.0s | 2.5s | 1.67s | 0.63s |
| Rail (5) | 5.0s | 2.5s | 1.67s | 0.63s |
| Crane Metal (6) | 6.0s | 3.0s | 2.0s | 0.75s |

> **Soft gating via hardness:** Steel (5) and Crane Metal (6) take 5-6 seconds with fists and 2.5-3s even with a Tire Iron. Technically possible to mine, but painfully slow — discouraging early-game access to late-game areas without hard-blocking it.

### Mining Visual Feedback

| Progress | Visual | Sound |
|----------|--------|-------|
| 0-25% | First crack overlay on block face | Light tap sound |
| 25-50% | Second crack (crosses first) | Medium impact |
| 50-75% | Third crack (block face fragmented) | Heavier impact |
| 75-99% | Deep cracks, block wobbles slightly | Cracking intensifies |
| 100% | Block explodes into debris | Material-specific break sound |

### Block Drop Rules

| Block Material | Drops | Stack Size | Notes |
|----------------|-------|-----------|-------|
| Dirt blocks | 1x matching block | 99 | Standard |
| Stone blocks | 1x matching block | 99 | Standard |
| Wood blocks | 1x matching block | 99 | Standard |
| Metal blocks (infrastructure) | 1x Scrap Metal | 99 | Cars, guardrails, scaffolding, pipes |
| Glass blocks | Nothing | — | Shatters, no recovery |
| Organic blocks | Nothing | — | Decorative only |
| Water | — | — | Not mineable |
| Bedrock | — | — | Not mineable |

> **Design note:** Metal infrastructure blocks always drop Scrap Metal (crafting material) instead of the block itself. This means you can't pick up a guardrail and place it elsewhere, but you CAN use the scrap to craft things. This keeps the block palette manageable while feeding the crafting loop.

---

## 3. Crafting System

### Design Philosophy

Crafting is **minimal and immediate** per GDD Pillar 4 (Accessible Chaos). No complex crafting trees, no separate crafting screen. The player opens their inventory, and if they have the right materials, available recipes appear at the bottom. One click to craft.

### Crafting Rules

| Rule | Detail |
|------|--------|
| Craft location | **Anywhere** for basic recipes. **Workbench** for advanced recipes (2 in the game) |
| Craft time | **Instant** — click and done. No progress bars, no waiting |
| Discovery | Recipes are **always visible** when you have at least 1 ingredient. Greyed out if missing materials |
| UI | Bottom panel of inventory screen shows available recipes |
| Undo | No undo. Crafting consumes materials immediately |

### Crafting Materials (10 types)

| Material | Found In | Primary Sources | Stack Size |
|----------|----------|----------------|-----------|
| Scrap Metal | All zones | Mining car metal, guardrails, scaffolding; enemy drops | 99 |
| Concrete Chunk | All zones | Mining concrete blocks (any variant) | 99 |
| Cable/Wire | Underground, Street | Underground containers, construction sites | 99 |
| Battery | Highway, Underground | Cars, junction boxes, Mole Bot drops | 99 |
| Chain | Underground, Street | Underground areas, construction sites | 99 |
| Seat Cover | Highway | Highway cars | 99 |
| Metal Plates | Underground | Underground industrial areas, Sewer Gator drops | 99 |
| Pipe | Underground | Mining Metal Pipe blocks; underground plumbing | 99 |
| Gunpowder | Underground | Underground rare containers (uncommon) | 99 |
| Traffic Light | Street | Mining traffic light poles at street level | 99 |

### Crafting Recipes

#### Basic Recipes (Craft Anywhere)

| # | Result | Ingredients | Category | Notes |
|---|--------|-------------|----------|-------|
| 1 | Electric Cable Whip | Cable + Battery | Melee Weapon (T2) | AoE lightning chain, 11 dmg |
| 2 | Pipe Bomb | Pipe + Gunpowder | Ranged Weapon (T2) | 30 dmg AoE, destroys blocks |
| 3 | Seat Cover Padding | Seat Cover x2 | Armor (T1) | 15% damage reduction |
| 4 | Nails (x10) | Scrap Metal x3 | Ammo | Nail Gun ammo |
| 5 | Sewer Plate Mail | Metal Plates x4 | Armor (T2) | 25% DR, -5% move speed |
| 6 | Concrete Barricade | Concrete Chunk x4 | Building Block | 3x3 wall section, hardness 4 |
| 7 | Scrap Bridge Plank | Scrap Metal x2 | Building Block | 1x3 walkable plank, hardness 2 |
| 8 | Makeshift Ladder | Scrap Metal x2 + Wood x1 | Building Block | 1x4 climbable block |

#### Advanced Recipes (Workbench Required)

| # | Result | Ingredients | Category | Notes |
|---|--------|-------------|----------|-------|
| 9 | Rebar Mace | Rebar Sword + Concrete Chunk | Melee Weapon (T3) | Upgraded rebar sword, 22 dmg |
| 10 | Traffic Light Flail | Traffic Light + Chain | Melee Weapon (T3) | Knockback effect, 24 dmg |

> **Scope note:** 10 recipes total for MVP. 7 carried over from the loot system doc + 3 new building-related recipes. The crafting UI shows all recipes the player has at least 1 ingredient for, with missing ingredients greyed out. Players discover recipes organically by collecting materials.

### Workbench Locations

| # | Location | Zone | Sub-Area | How to Find |
|---|----------|------|----------|-------------|
| 1 | Pumping Station | Underground | 2C Sewer Network | In the industrial room near the sewer maze |
| 2 | Construction Office Trailer | Street | 3C Construction Zone | In the trailer near the final boss arena |

Workbenches are fixed world objects (Wood material, hardness 3) that cannot be picked up, moved, or crafted. The player interacts with them to open the crafting UI with advanced recipes unlocked.

### Crafting UI

```
+------------------------------------------+
|  INVENTORY (top)                         |
|  [  ][  ][  ][  ][  ][  ][  ][  ]        |
|  [  ][  ][  ][  ][  ][  ][  ][  ]        |
|  [  ][  ][  ][  ][  ][  ][  ][  ]        |
+------------------------------------------+
|  AVAILABLE RECIPES (bottom)              |
|  [Cable Whip]  [Pipe Bomb]  [Nails x10]  |
|  [Barricade]   [Bridge Plank] ...        |
|  ─────────────────────────────────────── |
|  Selected: Pipe Bomb                     |
|  Needs: Pipe (1/1 ✓) + Gunpowder (0/1 ✗)|
|  [CRAFT] (greyed if missing ingredients)  |
+------------------------------------------+
```

- Recipes with all ingredients available show full-color icons
- Recipes with partial ingredients show greyed-out icons with a count overlay
- Recipes requiring a workbench show a wrench icon; greyed out if not near one
- Clicking a recipe shows the ingredient breakdown and a CRAFT button

---

## 4. Building System

### Design Philosophy

Building in VTE is **tactical, not creative**. The player places blocks to solve traversal problems (bridging gaps, creating cover) and tactical problems (blocking enemy paths, creating elevated positions). This is NOT Minecraft creative mode — it's closer to Fortnite's "panic wall" or Terraria's strategic bridging.

### What Can Be Placed

The player can place any **placeable block** from their inventory. Blocks are obtained by mining world blocks (which drop themselves or their material equivalent).

#### Placeable Block Types

| Block | Source | Hardness | Best Use |
|-------|--------|----------|----------|
| Dirt | Mining dirt | 1 | Quick fill, cheap cover (breaks fast) |
| Mud | Mining mud | 1 | Same as dirt |
| Asphalt | Mining asphalt | 2 | Road patching, moderate walls |
| Concrete (any variant) | Mining concrete | 3-4 | Strong walls, reliable cover |
| Brick (any variant) | Mining brick | 2-3 | Moderate walls |
| Stone | Mining stone | 3 | Underground building |
| Tile | Mining tile | 2 | Cosmetic, underground |
| Sidewalk | Mining sidewalk | 2 | Street-level building |
| Wood | Mining wood | 2 | Interior building, ladders |
| Drywall | Mining drywall | 1 | Fast interior walls (breaks fast) |
| **Concrete Barricade** | **Crafted** | **4** | **Best defensive wall — purpose-built** |
| **Scrap Bridge Plank** | **Crafted** | **2** | **Bridges gaps — 3 blocks long** |
| **Makeshift Ladder** | **Crafted** | **2** | **Vertical climbing — 4 blocks tall** |

> **Cannot be placed:** Scrap Metal (crafting material, not a block), Glass (shatters on placement — not useful), Metal infrastructure blocks (dropped as Scrap Metal, not recoverable as blocks), Water, Bedrock.

### Placement Rules

| Rule | Detail |
|------|--------|
| **Adjacent surface required** | Block must be placed adjacent to an existing solid block (any of 6 faces). No floating placement. |
| **No self-intersection** | Cannot place a block where the player is standing. Player is pushed out if they'd be trapped. |
| **Ghost preview** | A translucent preview block shows where the block will go before placement. Green = valid, Red = invalid. |
| **Placement range** | 5 blocks from the player (same as mining range). |
| **Placement speed** | Instant — click and the block appears. No build animation delay. |
| **Block orientation** | Blocks are axis-aligned cubes. No rotation needed (all blocks are uniform). |
| **Maximum build height** | World ceiling (64 blocks above surface). Same as the world Y limit. |
| **Building in combat** | Allowed. Placing a block takes 0.2s (animation lock) during which the player cannot attack. |
| **Enemy interaction** | Enemies cannot break player-placed blocks (except bosses and Construction Bots with ground slam). Enemies pathfind around placed blocks. |

### Structural Integrity: None (Minecraft-Style)

**Decision: No structural integrity for player-placed blocks.**

Player-placed blocks float. If you place a dirt block in midair (adjacent to another block), then destroy the supporting block, the placed block stays. This is the Minecraft approach.

**Why no structural integrity:**
1. **GDD Pillar 4 (Accessible Chaos):** "No 20-minute tutorial. No complex systems to memorize." Structural integrity adds a physics simulation the player must learn and fight against
2. **Tactical building requires reliability:** If the player builds a bridge mid-combat, it must NOT collapse unpredictably
3. **Scope:** Structural integrity simulation (7 Days to Die style) is a major engineering effort that adds friction to the core loop
4. **Destruction already provides enough spectacle:** The scripted boss arena collapses provide all the "buildings falling down" moments the game needs

**Exception — Scripted Environmental Collapse:**
World-placed blocks in boss arenas and set pieces DO have scripted collapse behavior:
- Highway Collapse (1C): Scripted terrain failure triggers the zone transition
- Sewer platforms (2C boss): King Gator's tail sweep destroys platform edges (scripted block removal)
- Construction scaffolding (3C boss): The Foreman's ground slam destroys scaffolding in AoE radius (scripted)

These are NOT physics-based structural integrity — they are scripted destruction triggered by boss attacks or story events. The implementation is simple: "when boss uses attack X, remove blocks in radius Y."

### Building Controls

| Input | Action |
|-------|--------|
| **Right-click** (with block selected in hotbar) | Place block at ghost preview location |
| **Scroll wheel** | Cycle through hotbar slots (select different block types) |
| **Q** | Toggle between attack mode and build mode (switches right-click behavior) |
| **Ghost preview** | Automatically shown when a placeable block is selected in hotbar |

> **Mode toggle (Q key):** When a weapon is in the active hotbar slot, right-click = block/shield. When a placeable block is in the active hotbar slot, right-click = place block. The Q key or scrolling to a block slot switches context.

---

## 5. Building & Combat Integration

### Tactical Building Use Cases

Building is most useful in these gameplay situations:

| Situation | Building Solution | Blocks Needed |
|-----------|------------------|---------------|
| Gap in highway (cars, collapse) | Place Scrap Bridge Planks across the gap | 1-2 planks (3 blocks each) |
| Need to reach a high ledge | Place Makeshift Ladder against the wall | 1 ladder (4 blocks tall) |
| Under fire from ranged enemy | Place Concrete Barricade for cover | 1 barricade (3x3 wall) |
| Block enemy path during retreat | Place 2-3 dirt blocks in a doorway | 2-3 dirt |
| Create elevated sniper position | Stack concrete blocks 3-4 high | 3-4 concrete |
| Bridge over sewer water | Place asphalt or concrete across gap | 3-5 blocks |
| Seal a tunnel to prevent flanking | Fill tunnel opening with dirt | 4-6 dirt |

### Enemy Response to Player-Built Structures

| Enemy Type | Reaction to Placed Blocks |
|------------|---------------------------|
| Road Rager | Pathfinds around. Cannot break blocks. |
| Coffee Tosser | Ignores blocks (ranged over/around them) |
| Bumper Brawler | Charge destroys Hardness 1 blocks (dirt, drywall). Stops at Hardness 2+. |
| Horn Honker | Shockwave passes through blocks (AoE ignores obstacles) |
| Sewer Rat | Pathfinds around. Too small to break blocks. |
| Sewer Gator | Cannot break blocks. Stuck on land if player blocks water exits. |
| Mole Bot | **Burrows through placed blocks** (same as world blocks). Cannot be blocked. |
| Drain Spider | Climbs over blocks. Web passes over low walls. |
| Construction Bot | **Ground slam destroys blocks** in AoE radius (Hardness 1-3). Tank through walls. |
| Stray Dog | Pathfinds around. Cannot jump over blocks taller than 1. |
| MARTA Security | Pathfinds around. Cannot break blocks. |
| Crane Drone | Flies over all blocks. Debris drops ignore cover (aim for shadow). |
| **Bosses** | All bosses destroy blocks with their AoE attacks. Cannot wall off a boss fight. |

> **Balance note:** Building should give a tactical advantage, NOT trivialize encounters. Mole Bots burrow through walls. Construction Bots smash them. Drones fly over. Bosses obliterate them. The player can build cover against basic enemies and ranged threats, but the harder enemies counter building.

### Block HP in Combat

When enemies attack player-placed blocks, blocks take damage based on their hardness:

```
block_hp = hardness * 10
```

| Block | Hardness | Block HP | Bumper Brawler charge (14 dmg) | Construction Bot slam (20 dmg) |
|-------|----------|---------|-------------------------------|-------------------------------|
| Dirt | 1 | 10 | 1 hit | 1 hit |
| Asphalt | 2 | 20 | 2 hits | 1 hit |
| Brick | 3 | 30 | 3 hits | 2 hits |
| Concrete | 4 | 40 | 3 hits | 2 hits |
| Concrete Barricade (crafted) | 4 | 40 | 3 hits | 2 hits |
| Steel | 5 | 50 | 4 hits | 3 hits |

> **Note:** Only specific enemies attack blocks. Most enemies pathfind around them. Blocks are NOT indestructible walls — they buy time, not permanent safety.

---

## 6. Special Building Blocks (Crafted)

### Concrete Barricade

**Recipe:** Concrete Chunk x4 (craft anywhere)

A reinforced 1x3x3 wall section (1 block deep, 3 blocks wide, 3 blocks tall). Placed as a single unit, but each individual block can be mined or destroyed separately.

| Property | Value |
|----------|-------|
| Size | 1 x 3 x 3 (9 blocks total) |
| Hardness | 4 per block |
| Block HP | 40 per block |
| Placement | On ground only. Aligns to the direction the player faces |
| Use | Defensive wall, cover from ranged attacks, blocking doorways |

**Placement behavior:** When the player places a Concrete Barricade, 9 concrete blocks appear in a 3-wide, 3-tall wall facing the player. If any of the 9 positions are obstructed, placement fails (red ghost preview). Individual blocks can be mined out of the wall afterwards.

### Scrap Bridge Plank

**Recipe:** Scrap Metal x2 (craft anywhere)

A 3-block-long horizontal plank for bridging gaps.

| Property | Value |
|----------|-------|
| Size | 3 x 1 x 1 (3 blocks in a line) |
| Hardness | 2 per block |
| Block HP | 20 per block |
| Placement | Horizontal only. Extends in the direction the player faces |
| Use | Bridging gaps over collapsed highway, sewer channels, between rooftops |

**Placement behavior:** Places 3 blocks in a horizontal line extending away from the player. Requires the first block to be adjacent to an existing surface. The remaining 2 blocks extend outward (floating is OK since there's no structural integrity). The ghost preview shows all 3 blocks.

### Makeshift Ladder

**Recipe:** Scrap Metal x2 + Wood x1 (craft anywhere)

A 4-block-tall vertical ladder that the player can climb.

| Property | Value |
|----------|-------|
| Size | 1 x 1 x 4 (4 blocks tall) |
| Hardness | 2 per block |
| Block HP | 20 per block |
| Placement | Against an existing wall only. Extends upward |
| Climbing | Player holds forward + jump to climb. Speed = 0.5x normal movement |
| Use | Reaching high ledges, scaling buildings, accessing rooftop routes |

**Placement behavior:** Must be placed against an existing wall (adjacent block required on the side facing the wall). Extends 4 blocks upward from the placement point. Cannot be placed in midair or without a wall backing.

**Climbing mechanic:** The ladder block is a special block type that the player can "climb" by pressing forward + jump while touching it. The player moves upward at half normal speed. Pressing backward descends. The player can jump off the ladder at any point.

---

## 7. Inventory Integration

### Block Stack Sizes

| Item Type | Stack Size | Notes |
|-----------|-----------|-------|
| Mined blocks (dirt, concrete, brick, etc.) | 99 | Same as crafting materials |
| Crafting materials (Scrap Metal, Cable, etc.) | 99 | Already defined in loot doc |
| Crafted building items (Barricade, Plank, Ladder) | 10 | Lower stack size — they're multi-block items |

### Inventory Pressure

Building creates an inventory management trade-off: blocks take up hotbar/backpack slots that could hold weapons, healing items, or utility items.

**Expected block usage per zone:**
| Zone | Blocks Needed | Why |
|------|--------------|-----|
| Highway | 5-15 | Bridge gaps in collapsed sections, occasional cover |
| Underground | 10-25 | Bridge sewer channels, seal tunnels, climb to high areas |
| Street | 5-20 | Cover from Construction Bots and Drones, reach rooftops |

> **Balance intent:** The player should never NEED more than ~20 blocks in inventory at once. Most building is opportunistic — "I have some concrete, might as well build cover." If the player hoards blocks, they sacrifice weapon/healing slots. This natural pressure prevents building from dominating the gameplay.

### Auto-Pickup for Blocks

When the player mines a block, it auto-collects into their inventory if there's space. If the inventory is full, the block item drops on the ground (despawns after 5 minutes, per loot doc rules).

Mined blocks stack with existing stacks of the same type. The player does NOT need to manually manage different concrete variants — all concrete (road, barrier, sewer, construction) stacks as "Concrete" in the inventory and places as a single generic concrete block type.

---

## 8. Explosion & AoE Destruction

### Pipe Bomb Destruction

The Pipe Bomb (crafted: Pipe + Gunpowder) is the player's primary tool for large-scale block destruction.

| Parameter | Value |
|-----------|-------|
| Blast radius | 4 blocks in all directions (sphere) |
| Block damage | Destroys all blocks up to Hardness 4. Hardness 5+ blocks take 50% HP damage. |
| Enemy damage | 30 HP (AoE) |
| Self-damage | 20 HP if player is within blast radius |
| Drops | Mined blocks drop normally from destroyed blocks |
| Debris | 15-20 debris particles (visual only, no physics collision) |

### Environmental Explosions

| Source | Radius | Damage | Triggers |
|--------|--------|--------|----------|
| Explosive Barrel (world object) | 4 blocks | 25 HP + block destruction | Any attack |
| Bumper Brawler crash into wall | 2 blocks | Block destruction only (Hardness 1) | Charge hits obstacle |
| Construction Bot ground slam | 3 blocks | 20 HP + block destruction (Hardness 1-3) | Every 8s |
| Boss attacks (various) | 4-6 blocks | Per boss doc | Per phase |
| Mole Bot emerge | 2 blocks | 8 HP + block destruction | Burrow-to-surface |

### Explosion Chain Reactions

If an explosion destroys an Explosive Barrel, that barrel also explodes with its own radius. Chain reactions are capped at 3 cascading explosions to prevent performance issues and unintended world destruction.

---

## 9. Block Placement in the Palette System

### How Placed Blocks Map to Palette

When the player places a block, it uses a generic palette index for that block type:

| Inventory Item | Placed Palette Index | Appearance |
|----------------|---------------------|------------|
| Dirt | index 21 (standard dirt) | Warm brown |
| Concrete | index 3 (road concrete) | Light gray |
| Brick | index 73 (building brick) | Classic red |
| Asphalt | index 1 (standard asphalt) | Dark gray |
| Stone | index 111 (natural stone) | Gray |
| Wood | index 83 (standard wood) | Brown |
| Sidewalk | index 71 (sidewalk) | Light gray |
| Tile | index 119 (MARTA tile) | Beige |
| Mud | index 113 (mud) | Dark brown |
| Drywall | index 81 (drywall) | White |
| Concrete Barricade | index 6 (barrier concrete) | Light gray + yellow stripe |
| Scrap Bridge Plank | index 8 (guardrail metal) | Silver metallic |
| Makeshift Ladder | index 83 (wood) + index 8 (metal) | Wood rungs, metal rails |

> **Simplification:** Even though the world has multiple variants of each material (e.g., road concrete vs sewer concrete vs barrier concrete), the player's inventory merges them all into one type. This keeps the inventory clean and avoids block-type overload.

---

## 10. Performance Considerations

### Chunk Re-Meshing on Build/Mine

Every block placement or removal requires the affected chunk to re-mesh (greedy meshing pass). This is already handled by the chunk system (see GDD §7 and Art Style Guide §2):

| Operation | Cost | Mitigation |
|-----------|------|------------|
| Single block place/remove | ~0.5ms mesh update | Re-mesh only the affected chunk |
| Multi-block place (Barricade) | ~1-2ms | Batch as single chunk update |
| Pipe Bomb (4-block radius) | ~2-4ms (2-3 chunks) | Spread across 2 frames |
| Boss AoE (6-block radius) | ~3-6ms (3-4 chunks) | Spread across 2-3 frames |

### Light Map Updates

Block changes trigger flood-fill BFS light updates:
- Placing a block: block light and sky light need to propagate/remove
- Removing a block: sky light may flood into new openings

Both operations run incrementally and are amortized across frames (see Art Style Guide §4).

### Block Entity Limit

To prevent players from building massive structures that tank performance:

| Limit | Value | Notes |
|-------|-------|-------|
| Max player-placed blocks per chunk | 128 | Prevents filling entire chunks |
| Max total player-placed blocks | 512 | Across all loaded chunks |
| Warning at | 400 blocks | "Running low on building capacity" message |
| Behavior at limit | Cannot place new blocks | Must remove existing ones first |

> **Note:** 512 blocks is generous for tactical building but prevents players from rebuilding the entire highway. At 99 blocks per stack and 37 inventory slots, the player physically cannot carry more than ~3,600 blocks anyway. The 512 limit is a performance safeguard, not a gameplay restriction.

---

## Appendix A: Block Type Quick Reference

| # | Block Type | Material | Hardness | Drop | Zone |
|---|-----------|----------|----------|------|------|
| 1 | Dirt | Dirt | 1 | Self | Highway |
| 2 | Grass | Dirt | 1 | Dirt | Highway |
| 3 | Asphalt | Stone | 2 | Self | Highway, Street |
| 4 | Concrete (road) | Stone | 3 | Self | Highway |
| 5 | Concrete (barrier) | Stone | 4 | Concrete | Highway |
| 6 | Car Metal | Metal | 2 | Scrap Metal | Highway |
| 7 | Car Glass | Glass | 1 | Nothing | Highway |
| 8 | Guardrail | Metal | 3 | Scrap Metal | Highway |
| 9 | Construction Scaffolding | Metal | 1 | Scrap Metal | Highway |
| 10 | Concrete (sewer) | Stone | 3 | Self | Underground |
| 11 | Brick (old) | Stone | 2 | Self | Underground |
| 12 | Brick (new) | Stone | 3 | Self | Underground |
| 13 | Metal Pipe | Metal | 4 | Pipe | Underground |
| 14 | Stone (natural) | Stone | 3 | Self | Underground |
| 15 | Mud | Dirt | 1 | Self | Underground |
| 16 | Water | — | ∞ | — | Underground |
| 17 | Bioluminescent Fungus | Organic | 1 | Nothing | Underground |
| 18 | Tile (MARTA) | Stone | 2 | Self | Underground |
| 19 | Rail | Metal | 5 | Scrap Metal | Underground |
| 20 | Sidewalk | Stone | 2 | Self | Street |
| 21 | Building Brick | Stone | 3 | Self | Street |
| 22 | Building Glass | Glass | 1 | Nothing | Street |
| 23 | Steel (structural) | Metal | 5 | Scrap Metal | Street |
| 24 | Drywall | Stone | 1 | Self | Street |
| 25 | Wood | Wood | 2 | Self | Street |
| 26 | Concrete (construction) | Stone | 4 | Self | Street |
| 27 | Scaffolding | Metal | 1 | Scrap Metal | Street |
| 28 | Crane Metal | Metal | 6 | Scrap Metal | Street |
| 29 | Explosive Barrel | Metal | 1 | — (explodes) | All |
| 30 | Workbench | Wood | 3 | — (fixed) | Underground, Street |

**Crafted building blocks (3):** Concrete Barricade, Scrap Bridge Plank, Makeshift Ladder

---

## Appendix B: Crafting Recipe Quick Reference

| # | Result | Ingredients | Location | Category |
|---|--------|-------------|----------|----------|
| 1 | Electric Cable Whip | Cable + Battery | Anywhere | Weapon |
| 2 | Pipe Bomb | Pipe + Gunpowder | Anywhere | Weapon |
| 3 | Seat Cover Padding | Seat Cover x2 | Anywhere | Armor |
| 4 | Nails (x10) | Scrap Metal x3 | Anywhere | Ammo |
| 5 | Sewer Plate Mail | Metal Plates x4 | Anywhere | Armor |
| 6 | Concrete Barricade | Concrete Chunk x4 | Anywhere | Building |
| 7 | Scrap Bridge Plank | Scrap Metal x2 | Anywhere | Building |
| 8 | Makeshift Ladder | Scrap Metal x2 + Wood x1 | Anywhere | Building |
| 9 | Rebar Mace | Rebar Sword + Concrete Chunk | Workbench | Weapon |
| 10 | Traffic Light Flail | Traffic Light + Chain | Workbench | Weapon |

---

*This document defines the complete crafting and building mechanics for Voxel Traffic Escape v1.0. Implementation should reference this alongside the GDD (01), Loot System (05), and World Map (03) documents. The crafting system is intentionally minimal; the building system is intentionally tactical. Both serve the game's core pillars — Accessible Chaos and Total Destruction.*
