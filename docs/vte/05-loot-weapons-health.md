# Voxel Traffic Escape — Loot, Weapons & Health System Design

> **Task:** task_VTE_005
> **Version:** 1.0
> **Date:** 2026-02-28

---

## Design Decisions Summary

| Question | Decision | Rationale |
|----------|----------|-----------|
| Crafting | **Simple combine** — no workbench | Keeps scope manageable for MVP. Craft anywhere from 2-3 ingredients. |
| Inventory | **Hotbar + grid backpack** (hybrid) | Familiar to Terraria/Minecraft players. Hotbar for quick access, grid for storage. |
| Durability | **No durability** | Weapons don't break. Reduces frustration, rewards exploration. |
| Thematic items | **Yes — fully Atlanta-themed** | This is the game's identity. Every item should feel urban/Atlanta. |

---

## 1. Melee Weapons

Three tiers mapped to the three world zones. Higher tiers deal more damage and have faster mining speed against blocks.

### Tier 1 — Highway (Early Game)

| Item | Damage | Speed | Mining | How to Get | Notes |
|------|--------|-------|--------|------------|-------|
| Bare Fists | 3 | Fast | 1x | Default | Always available, last resort |
| Tire Iron | 8 | Medium | 2x | Highway loot | First real weapon, common drop |
| Broken Antenna | 6 | Fast | 1.5x | Highway loot | Quick but weak, good vs. fast enemies |
| Car Jack Handle | 10 | Slow | 2.5x | Highway loot (rare) | Heavy hitter, slow swing |
| Road Flare (melee) | 7 | Medium | 1x | Highway loot | Burns enemies on hit (DoT: 2 dmg/sec for 3s) |

### Tier 2 — Underground (Mid Game)

| Item | Damage | Speed | Mining | How to Get | Notes |
|------|--------|-------|--------|------------|-------|
| Rebar Sword | 14 | Medium | 3x | Underground loot | Solid all-rounder |
| Pipe Wrench | 16 | Slow | 4x | Underground loot | Great mining tool, slow combat |
| Sewer Gator Tooth | 12 | Fast | 2x | Rare drop from sewer creatures | Fast attack, good DPS |
| Sledgehammer | 20 | Very Slow | 5x | Underground chest (rare) | Massive damage, huge windup |
| Electric Cable Whip | 11 | Fast | 1x | Craft (cable + battery) | Chains lightning to nearby enemies (AoE) |

### Tier 3 — Street Level (Late Game)

| Item | Damage | Speed | Mining | How to Get | Notes |
|------|--------|-------|--------|------------|-------|
| Jackhammer | 25 | Medium | 8x | Street loot (rare) | Best mining tool in game |
| Rebar Mace | 22 | Medium | 4x | Craft (rebar sword + concrete chunk) | Upgraded rebar sword |
| Stop Sign Axe | 18 | Fast | 5x | Street loot | Fast and strong |
| Construction Saw | 28 | Slow | 6x | Boss drop / rare chest | Highest raw damage |
| Traffic Light Flail | 24 | Medium | 3x | Craft (traffic light + chain) | Knockback effect, sends enemies flying |

### Attack Speed Reference
| Label | Attacks/sec | Windup (ms) |
|-------|------------|-------------|
| Very Slow | 0.7 | 1400 |
| Slow | 1.0 | 1000 |
| Medium | 1.5 | 670 |
| Fast | 2.0 | 500 |

### DPS Comparison (damage * attacks/sec)
| Weapon | Tier | DPS |
|--------|------|-----|
| Bare Fists | 0 | 6.0 |
| Broken Antenna | 1 | 12.0 |
| Tire Iron | 1 | 12.0 |
| Car Jack Handle | 1 | 10.0 |
| Sewer Gator Tooth | 2 | 24.0 |
| Rebar Sword | 2 | 21.0 |
| Pipe Wrench | 2 | 16.0 |
| Sledgehammer | 2 | 14.0 |
| Electric Cable Whip | 2 | 22.0 |
| Stop Sign Axe | 3 | 36.0 |
| Traffic Light Flail | 3 | 36.0 |
| Jackhammer | 3 | 37.5 |
| Rebar Mace | 3 | 33.0 |
| Construction Saw | 3 | 28.0 |

> **Balance note:** Slow weapons compensate with higher per-hit damage (better vs. armored enemies), knockback, or mining speed. Fast weapons have better sustained DPS. Sledgehammer and Construction Saw trade DPS for utility/burst.

---

## 2. Ranged Weapons

Ranged weapons use ammo or have cooldowns. They let the player engage at distance but are weaker in sustained DPS than same-tier melee.

| Item | Tier | Damage | Range | Ammo | How to Get | Notes |
|------|------|--------|-------|------|------------|-------|
| Rock / Rubble | 1 | 5 | Short | Infinite (from blocks) | Break any block | Weak, always available, short arc |
| Coffee Cup (hot) | 1 | 4 + burn | Medium | Found in cars | Highway loot | Comedic. Burns: 2 dmg/sec for 2s |
| Hubcap Frisbee | 1 | 8 | Long | Consumable (found) | Highway loot | Bounces off walls once |
| Pipe Bomb | 2 | 30 (AoE) | Medium | Craft (pipe + gunpowder) | Underground | AoE explosion, destroys blocks too |
| Nail Gun | 2 | 10 | Long | Nails (found/crafted) | Underground chest | Semi-auto, 3 shots/sec. Best sustained ranged DPS |
| Manhole Cover | 2 | 18 | Short | Consumable (found) | Underground | Heavy throw, slow, huge knockback |
| Flare Gun | 3 | 12 + burn | Long | Flares (found) | Street loot | Sets area on fire (8 dmg/sec for 4s AoE zone) |
| Concrete Launcher | 3 | 22 | Long | Concrete chunks | Street rare | Slow fire rate, massive damage, breaks blocks |

### Ammo Sources
| Ammo Type | Found In | Craft Recipe |
|-----------|----------|-------------|
| Rocks/Rubble | Breaking any stone block | — |
| Nails | Underground containers, construction sites | Scrap metal (x3) |
| Flares | Street-level loot | — |
| Concrete Chunks | Breaking concrete blocks | — |
| Gunpowder | Underground rare loot | — |

---

## 3. Health System

### Core Stats

| Stat | Value | Notes |
|------|-------|-------|
| Starting HP | 100 | Max HP at game start |
| Max HP (upgraded) | 150 | Via Heart Container items (5 total, +10 each) |
| Passive Regen | None | No passive regen — keeps tension high |
| Death | Respawn at last checkpoint | Drop nothing (no corpse runs — keeps it accessible) |

### Checkpoints
- Auto-save at zone transitions (Highway -> Underground -> Street)
- Manual checkpoints: sleeping bags found/placed in the world
- Respawn costs 25% of carried currency (scrap) as penalty

### Healing Items

| Item | Heal | Type | How to Get | Notes |
|------|------|------|------------|-------|
| Gas Station Snack | 15 HP | Instant | Highway loot, common | Chips, candy bars — everywhere |
| Water Bottle | 20 HP | Instant | All zones, common | Basic reliable heal |
| Energy Drink | 30 HP + speed boost | Instant + 5s buff | All zones, uncommon | +20% move speed for 5 seconds |
| First Aid Kit | 50 HP | Instant | All zones, rare | Found in vehicles, buildings |
| Waffle House Plate | 75 HP | Over 10s | Street zone rare | Signature Atlanta heal. Sit-and-eat animation. |
| Sweet Tea Jug | Full heal | Instant | Boss reward / very rare | Fully restores HP. Trophy item. |

### Heart Containers (Permanent HP Upgrades)

5 Heart Containers hidden throughout the world. Each grants +10 max HP permanently.

| # | Location | Challenge |
|---|----------|-----------|
| 1 | Highway — hidden under overturned semi-truck | Requires Tier 1 mining |
| 2 | Underground — behind a locked gate in sewer maze | Requires finding 3 sewer keys |
| 3 | Underground — guarded by mini-boss | Combat challenge |
| 4 | Street — top of parking garage (platforming) | Platforming/exploration |
| 5 | Street — secret room in construction site | Destructible wall puzzle |

---

## 4. Armor & Defense Items

Armor uses a simple **damage reduction** model. Only one armor item equipped at a time (body slot). Shield is a separate slot (off-hand).

### Damage Reduction Formula
```
actual_damage = base_damage * (1 - armor_reduction)
```

### Armor (Body Slot)

| Item | Tier | Damage Reduction | How to Get | Notes |
|------|------|-----------------|------------|-------|
| Hi-Vis Vest | 1 | 10% | Highway loot | Construction worker vest. Looks goofy. |
| Seat Cover Padding | 1 | 15% | Highway craft (seat cover x2) | Makeshift padding |
| Sewer Plate Mail | 2 | 25% | Underground craft (metal plates x4) | Clanky, slightly reduces move speed (-5%) |
| Manhole Vest | 2 | 30% | Underground rare | Manhole covers strapped to chest |
| Hard Hat Suit | 3 | 35% | Street loot | Full construction armor |
| MARTA Riot Gear | 3 | 40% | Street rare / late boss | Best armor in game. Transit authority gear. |

### Shield (Off-Hand Slot)

Shields block frontal attacks when held up (hold right-click/block button). Blocking slows movement by 50%.

| Item | Tier | Block % | How to Get | Notes |
|------|------|---------|------------|-------|
| Car Door | 1 | 40% | Highway loot | Heavy, common |
| Traffic Cone Shield | 1 | 30% | Highway loot | Light, funny looking |
| Sewer Grate | 2 | 50% | Underground loot | Solid coverage |
| Dumpster Lid | 2 | 60% | Underground/Street | Great shield, heavy |
| Riot Shield | 3 | 75% | Street rare | Transparent, best block rate |

### Block Mechanic
- Hold block button to raise shield
- Blocks reduce incoming frontal damage by the shield's block %
- Block % stacks multiplicatively with armor: `actual = base * (1 - armor%) * (1 - block%)`
- Example: 40 base damage vs. Manhole Vest (30%) + Sewer Grate (50%) = 40 * 0.7 * 0.5 = 14 damage
- Cannot attack while blocking (drop block to swing)

---

## 5. Utility Items

Utility items go in dedicated utility slots (not competing with weapons/armor). The player has 3 utility slots.

| Item | Tier | Effect | How to Get | Notes |
|------|------|--------|------------|-------|
| Phone Flashlight | 1 | Illuminates dark areas (small radius) | Starting item | Battery drains, recharge at power sources |
| Work Flashlight | 2 | Large light radius | Underground loot | No battery drain |
| Grapple Hook | 2 | Hook to surfaces, swing across gaps | Underground chest (rare) | Key traversal tool, opens new paths |
| MARTA Pass | 2 | Fast travel between discovered MARTA stations | Underground quest reward | Atlanta signature item. 3 stations in game. |
| Hard Hat | 1 | Prevents falling debris damage | Highway/Underground loot | Niche but saves HP in crumbling areas |
| Boots of Hustle | 3 | +25% movement speed | Street rare | Permanent buff while equipped |
| Night Vision Goggles | 3 | Full visibility in dark areas | Street rare | Replaces flashlight entirely |
| Walkie-Talkie | 2 | Reveals enemy positions on minimap | Underground loot | Pings nearby enemies every 5 seconds |

---

## 6. Crafting Materials

Simple crafting: combine 2-3 materials from inventory. No workbench needed for basic recipes. A few advanced recipes require a **Workbench** (found in construction zones, not craftable).

### Materials

| Material | Found In | Used For |
|----------|----------|----------|
| Scrap Metal | All zones (from cars, pipes, debris) | Nails, metal plates, repairs |
| Concrete Chunk | Breaking concrete blocks | Rebar mace, concrete launcher ammo |
| Cable/Wire | Underground, construction sites | Electric cable whip, traps |
| Battery | Cars (highway), junction boxes | Electric cable whip, recharging |
| Chain | Underground, construction sites | Traffic light flail |
| Seat Cover | Highway cars | Seat cover padding armor |
| Metal Plates | Underground industrial areas | Sewer plate mail |
| Pipe | Underground (plumbing) | Pipe bomb |
| Gunpowder | Underground rare containers | Pipe bomb |
| Traffic Light | Street level | Traffic light flail |

### Crafting Recipes

| Result | Ingredients | Location |
|--------|-------------|----------|
| Electric Cable Whip | Cable + Battery | Anywhere |
| Pipe Bomb | Pipe + Gunpowder | Anywhere |
| Seat Cover Padding | Seat Cover x2 | Anywhere |
| Nails (x10) | Scrap Metal x3 | Anywhere |
| Sewer Plate Mail | Metal Plates x4 | Anywhere |
| Rebar Mace | Rebar Sword + Concrete Chunk | **Workbench** |
| Traffic Light Flail | Traffic Light + Chain | **Workbench** |

> **Scope note:** 7 recipes total for MVP. This is intentionally minimal — add more recipes post-MVP based on playtesting. The crafting UI is just a "combine" button that shows available recipes from current materials.

---

## 7. Inventory System

### Layout

```
+------------------------------------------+
|  HOTBAR (always visible at bottom of HUD) |
|  [ 1 ][ 2 ][ 3 ][ 4 ][ 5 ][ 6 ][ 7 ][ 8 ] |
+------------------------------------------+

+------------------------------------------+
|  EQUIPMENT (left side of inventory screen)|
|  [  Armor  ]     [  Shield  ]            |
|  [ Util 1 ][ Util 2 ][ Util 3 ]         |
+------------------------------------------+

+------------------------------------------+
|  BACKPACK (main inventory grid)          |
|  [  ][  ][  ][  ][  ][  ][  ][  ]        |
|  [  ][  ][  ][  ][  ][  ][  ][  ]        |
|  [  ][  ][  ][  ][  ][  ][  ][  ]        |
+------------------------------------------+

+------------------------------------------+
|  CRAFTING (bottom of inventory screen)   |
|  [ Material ] + [ Material ] = [ Result ]|
|  Available recipes shown based on items  |
+------------------------------------------+
```

### Capacity
| Section | Slots | Notes |
|---------|-------|-------|
| Hotbar | 8 | Weapons, items for quick use. Number keys to select. |
| Backpack | 24 (8x3 grid) | General storage. Items stack (materials up to 99, consumables up to 20). |
| Equipment | 5 (1 armor + 1 shield + 3 utility) | Dedicated equip slots, not shared with inventory. |
| **Total** | **37 slots** | |

### Stacking Rules
| Item Type | Stack Size |
|-----------|-----------|
| Weapons | 1 (no stack) |
| Armor/Shields | 1 (no stack) |
| Utility Items | 1 (no stack) |
| Healing Items | 20 |
| Crafting Materials | 99 |
| Ammo (nails, flares, etc.) | 99 |
| Throwables (hubcap, rocks) | 30 |

### Inventory Interactions
- **Drag and drop** items between slots
- **Right-click** to use/consume an item
- **Shift-click** to move items quickly between hotbar and backpack
- **Drop** items on the ground (despawn after 5 minutes)
- **Auto-pickup** when walking over items (if inventory has space)
- Items that don't fit show a "Inventory Full" message — player must drop something

### HUD Elements
- Hotbar always visible at screen bottom with item icons + stack counts
- Selected hotbar slot highlighted
- HP bar (top-left) — red bar showing current/max HP
- Minimap (top-right) — shows explored areas, enemies (with walkie-talkie)
- Scrap counter (currency, below HP bar)

---

## 8. Currency: Scrap

**Scrap** is the universal currency. It drops from enemies and containers.

| Source | Amount |
|--------|--------|
| Highway enemies | 3-8 scrap |
| Underground enemies | 8-15 scrap |
| Street enemies | 15-25 scrap |
| Containers/chests | 5-30 scrap |
| Boss enemies | 50-100 scrap |

### What Scrap Buys
- **Vending machines** (found in each zone) sell healing items and ammo at fixed prices
- **Respawn penalty** — lose 25% of scrap on death

| Vending Machine Item | Cost |
|---------------------|------|
| Water Bottle | 10 scrap |
| Energy Drink | 25 scrap |
| First Aid Kit | 40 scrap |
| Nails (x10) | 15 scrap |
| Flares (x3) | 20 scrap |

---

## 9. Item Tier Progression Summary

The player should feel a clear power curve as they move through zones:

```
HIGHWAY (Tier 1)        UNDERGROUND (Tier 2)      STREET (Tier 3)
─────────────────       ────────────────────       ─────────────────
Tire Iron (8 dmg)   →   Rebar Sword (14 dmg)  →   Stop Sign Axe (18 dmg)
Hi-Vis Vest (10%)   →   Sewer Plate Mail (25%)→   Hard Hat Suit (35%)
Car Door shield     →   Sewer Grate shield    →   Riot Shield
Gas Station Snack   →   First Aid Kit         →   Waffle House Plate
Phone Flashlight    →   Work Flashlight       →   Night Vision Goggles
Rock throws         →   Nail Gun              →   Concrete Launcher
```

### Expected Player Power at Each Zone

| Zone | HP | DPS (melee) | Damage Reduction | Playtime |
|------|-----|------------|------------------|----------|
| Highway Start | 100 | 6 (fists) | 0% | 0 min |
| Highway End | 100-110 | 12 (tire iron) | 10-15% | ~15 min |
| Underground Mid | 110-130 | 21-24 (rebar/tooth) | 25-30% | ~30 min |
| Underground End | 130-140 | 24+ (with nail gun support) | 30-35% | ~45 min |
| Street Mid | 140-150 | 33-37 (tier 3 melee) | 35-40% | ~55 min |
| Final Area | 150 | 37+ (best gear) | 40%+ armor + 75% shield | ~65 min |

---

## 10. Loot Distribution

### Drop Tables by Zone

**Highway Containers (cars, trucks, road debris):**
| Item | Drop Rate |
|------|-----------|
| Gas Station Snack | 30% |
| Water Bottle | 20% |
| Scrap (3-8) | 40% |
| Tire Iron | 15% |
| Broken Antenna | 15% |
| Road Flare | 10% |
| Hi-Vis Vest | 8% |
| Car Door | 8% |
| Traffic Cone Shield | 10% |
| Coffee Cup (hot) | 12% |
| Hubcap Frisbee | 8% |
| Car Jack Handle | 5% |
| Hard Hat | 5% |
| Seat Cover | 10% |
| Battery | 8% |
| Heart Container #1 | Fixed location |

**Underground Containers (pipes, crates, lockers):**
| Item | Drop Rate |
|------|-----------|
| Water Bottle | 20% |
| First Aid Kit | 8% |
| Scrap (8-15) | 35% |
| Rebar Sword | 12% |
| Pipe Wrench | 10% |
| Nail Gun | 5% |
| Sewer Grate | 8% |
| Manhole Vest | 4% |
| Cable/Wire | 15% |
| Metal Plates | 12% |
| Pipe | 10% |
| Nails (x10) | 15% |
| Scrap Metal | 20% |
| Energy Drink | 10% |
| MARTA Pass | Quest reward |
| Grapple Hook | 3% (chests only) |
| Walkie-Talkie | 5% |
| Heart Container #2-3 | Fixed locations |

**Street Containers (dumpsters, construction crates, buildings):**
| Item | Drop Rate |
|------|-----------|
| First Aid Kit | 12% |
| Energy Drink | 15% |
| Scrap (15-25) | 30% |
| Stop Sign Axe | 8% |
| Jackhammer | 3% |
| Flare Gun | 5% |
| Concrete Launcher | 3% |
| Hard Hat Suit | 5% |
| Riot Shield | 3% |
| MARTA Riot Gear | 2% |
| Boots of Hustle | 3% |
| Night Vision Goggles | 3% |
| Flares | 12% |
| Concrete Chunks | 15% |
| Chain | 10% |
| Traffic Light | 8% |
| Waffle House Plate | 4% |
| Heart Container #4-5 | Fixed locations |

> **Note:** Drop rates are per-container and independent. A container rolls each item separately, so a single container can drop multiple items. Containers have a 1-3 item count range.

---

## 11. Enemy Drops

| Enemy Type | Zone | HP | Damage | Drops |
|------------|------|-----|--------|-------|
| Road Rager | Highway | 25 | 8 | Scrap (3-8), 20% Gas Station Snack |
| Coffee Tosser | Highway | 15 | 5 | Scrap (2-5), 30% Coffee Cup (hot) |
| Sewer Rat | Underground | 20 | 6 | Scrap (5-8), 10% Scrap Metal |
| Sewer Creature | Underground | 50 | 12 | Scrap (10-15), 5% Sewer Gator Tooth, 15% Metal Plates |
| Mole Bot | Underground | 40 | 10 | Scrap (8-12), 15% Nails (x5), 10% Battery |
| Construction Bot | Street | 60 | 15 | Scrap (15-20), 10% Scrap Metal x2, 5% Chain |
| Stray Dog | Street | 30 | 8 | Scrap (5-10) |
| **Highway Boss** | Highway | 150 | 15 | 50 Scrap, Sledgehammer (guaranteed) |
| **Sewer Boss** | Underground | 300 | 20 | 75 Scrap, Electric Cable Whip recipe, Sweet Tea Jug |
| **Street Boss** | Street | 500 | 25 | 100 Scrap, Construction Saw (guaranteed) |

---

## Appendix: All Items Index

**Total unique items: 50**

| # | Item | Category | Tier |
|---|------|----------|------|
| 1 | Bare Fists | Melee | 0 |
| 2 | Tire Iron | Melee | 1 |
| 3 | Broken Antenna | Melee | 1 |
| 4 | Car Jack Handle | Melee | 1 |
| 5 | Road Flare (melee) | Melee | 1 |
| 6 | Rebar Sword | Melee | 2 |
| 7 | Pipe Wrench | Melee | 2 |
| 8 | Sewer Gator Tooth | Melee | 2 |
| 9 | Sledgehammer | Melee | 2 |
| 10 | Electric Cable Whip | Melee | 2 |
| 11 | Jackhammer | Melee | 3 |
| 12 | Rebar Mace | Melee | 3 |
| 13 | Stop Sign Axe | Melee | 3 |
| 14 | Construction Saw | Melee | 3 |
| 15 | Traffic Light Flail | Melee | 3 |
| 16 | Rock / Rubble | Ranged | 1 |
| 17 | Coffee Cup (hot) | Ranged | 1 |
| 18 | Hubcap Frisbee | Ranged | 1 |
| 19 | Pipe Bomb | Ranged | 2 |
| 20 | Nail Gun | Ranged | 2 |
| 21 | Manhole Cover (throw) | Ranged | 2 |
| 22 | Flare Gun | Ranged | 3 |
| 23 | Concrete Launcher | Ranged | 3 |
| 24 | Gas Station Snack | Healing | 1 |
| 25 | Water Bottle | Healing | 1 |
| 26 | Energy Drink | Healing | 2 |
| 27 | First Aid Kit | Healing | 2 |
| 28 | Waffle House Plate | Healing | 3 |
| 29 | Sweet Tea Jug | Healing | 3 |
| 30 | Heart Container | Permanent | — |
| 31 | Hi-Vis Vest | Armor | 1 |
| 32 | Seat Cover Padding | Armor | 1 |
| 33 | Sewer Plate Mail | Armor | 2 |
| 34 | Manhole Vest | Armor | 2 |
| 35 | Hard Hat Suit | Armor | 3 |
| 36 | MARTA Riot Gear | Armor | 3 |
| 37 | Car Door | Shield | 1 |
| 38 | Traffic Cone Shield | Shield | 1 |
| 39 | Sewer Grate | Shield | 2 |
| 40 | Dumpster Lid | Shield | 2 |
| 41 | Riot Shield | Shield | 3 |
| 42 | Phone Flashlight | Utility | 1 |
| 43 | Hard Hat | Utility | 1 |
| 44 | Work Flashlight | Utility | 2 |
| 45 | Grapple Hook | Utility | 2 |
| 46 | MARTA Pass | Utility | 2 |
| 47 | Walkie-Talkie | Utility | 2 |
| 48 | Boots of Hustle | Utility | 3 |
| 49 | Night Vision Goggles | Utility | 3 |
| 50 | Scrap (currency) | Currency | — |

**Crafting materials (10):** Scrap Metal, Concrete Chunk, Cable/Wire, Battery, Chain, Seat Cover, Metal Plates, Pipe, Gunpowder, Traffic Light
