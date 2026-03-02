# Voxel Traffic Escape — World Map Design

> **Task:** task_VTE_003
> **Version:** 1.0
> **Date:** 2026-02-28
> **Dependencies:** GDD (01), Loot System (05)

---

## Design Decisions Summary

| Question | Decision | Rationale |
|----------|----------|-----------|
| Linear or open? | **Linear with branching side paths** | GDD Pillar 2 ("The Commute From Hell") demands forward momentum. Side paths reward exploration without losing direction. |
| Vertical or horizontal? | **Primarily horizontal, with vertical depth** | Horizontal journey mirrors a real commute. Underground zone adds vertical depth. Buildings add vertical at the end. |
| How big? | **Medium (2-4 hour first playthrough)** | GDD scope boundary. Short enough for one session, long enough to feel substantial. |
| Procedural or handcrafted? | **Handcrafted** | GDD scope boundary. Enables scripted "shareable moments" (Pillar 5) and tighter difficulty tuning. |
| World structure? | **3 zones, 12 sub-areas** | 3 zones match the item tier system. Sub-areas provide variety within each zone. |

---

## 1. World Overview

The player's journey is a ~4-mile trek from **Spaghetti Junction** (I-85/I-285 interchange in northeast Atlanta) to their **apartment in Midtown**. The world is roughly 1600 blocks long (east-to-west) by 400 blocks wide, with the underground zone extending 80 blocks deep.

```
THE COMMUTE (bird's-eye view, not to scale)

  START                                                               END
    v                                                                  v
[SPAGHETTI JUNCTION] --> [HIGHWAY STRETCH] --> [HIGHWAY COLLAPSE]
                                                        |
                                                  (fall / dig down)
                                                        v
                              [MARTA STATION] <-- [STORM DRAINS]
                                    |
                                    v
                            [SEWER NETWORK] --> [UNDERGROUND ATLANTA]
                                                        |
                                                  (climb up / exit)
                                                        v
              [WAFFLE HOUSE HAVEN] --> [PEACHTREE GAUNTLET] --> [CONSTRUCTION ZONE]
                                                                        |
                                                                        v
                                                              [YOUR APARTMENT BUILDING]
                                                                        |
                                                                   (VICTORY)
```

### World Dimensions (in voxel blocks)

| Dimension | Size | Notes |
|-----------|------|-------|
| Total length (X) | ~1600 blocks | East-to-west journey |
| Total width (Z) | ~400 blocks | Allows flanking and side paths |
| Surface height (Y) | 64 blocks | Ground level with buildings up to 40 blocks tall |
| Underground depth (Y) | 80 blocks below surface | Storm drains, sewers, MARTA tunnels |
| Chunk size | 32x32x32 | Per GDD technical spec |
| Total chunks (estimated) | ~3,000-4,000 active | With LOD and culling |

---

## 2. Zone 1: The Highway (Tier 1)

**Theme:** Gridlocked hell. A sea of abandoned cars baking in the Georgia sun. Road rage, construction chaos, and the infrastructure literally falling apart around you.

**Playtime:** 40-60 minutes (first playthrough)
**Mood:** Frustration → empowerment. You start helpless in traffic, end by smashing through it.
**Lighting:** Bright daylight, harsh shadows. Orange construction cones and flashing hazard lights.
**Ambient sounds:** Honking horns (fading as you move away), distant sirens, helicopter overhead, construction machinery.

### Sub-Areas

#### 1A. Spaghetti Junction (Starting Area)
**Size:** ~200 x 400 blocks
**Description:** The I-85/I-285 interchange. A massive tangle of overlapping highway ramps and overpasses, 3-4 levels high. Cars gridlocked bumper-to-bumper in every lane. This is the tutorial area — the player gets out of their car and learns the basics.

**Landmarks:**
- **Player's car** — a beat-up sedan in the middle lane. Contains your Phone Flashlight (starting item) and a Gas Station Snack in the glove box
- **The Overpass Stack** — 3 highway levels stacked on top of each other. Demonstrates verticality and destructibility. Players can punch through guardrails to jump down, or find ramps between levels
- **Welcome to Atlanta sign** — iconic, partially destroyed. Breaking it reveals a hidden Gas Station Snack

**Gameplay purpose:** Tutorial. Player learns movement, punching, block breaking, item pickup. Low enemy density. Lots of loot in cars to build initial inventory.

**Enemies:** 2-3 Road Ragers (easy). They emerge from cars as you approach and swing weakly. Essentially punching bags to teach combat.

**Loot highlights:** Tire Iron (guaranteed in a truck bed near start), Hi-Vis Vest (in a construction vehicle), various snacks and scrap in car trunks.

**Side path:** Climbing to the top overpass level reveals a scenic overlook (moment for Pillar 5 — the player sees the distant Midtown skyline with their apartment building rendered on the horizon) and a hidden Car Jack Handle.

---

#### 1B. The Highway Stretch
**Size:** ~400 x 300 blocks
**Description:** The long straightaway of I-85 heading toward downtown. Eight lanes of gridlocked traffic with occasional gaps. Cars are more damaged here — some flipped, some burning. The shoulder is semi-passable but blocked by concrete barriers and construction equipment.

**Landmarks:**
- **Gas Station (QT)** — just off the highway via an exit ramp. Functions as the first **Waffle House-style rest stop** (checkpoint). Contains a vending machine, healing items, and a sleeping bag (save point). Has a roof you can climb for a vantage point
- **Construction Zone Alpha** — a lane closure area with orange barrels, heavy equipment, and a partially demolished overpass. Source of construction-themed loot (Hard Hat, Scrap Metal). Also introduces destructible construction scaffolding
- **The Pile-Up** — a massive multi-car accident blocking all lanes. The player must find a way around, over, or through it. This is the first real "destruction puzzle" — smashing through cars and barriers to clear a path

**Gameplay purpose:** Core highway combat and exploration. Enemy density increases. Player should find their Tier 1 weapon loadout here.

**Enemies:** Road Ragers (common), Coffee Tossers (ranged, throw hot coffee), 1-2 Construction Workers (tougher, swing hard hats).

**Loot highlights:** Road Flares, Hubcap Frisbees, Coffee Cups, Seat Covers for crafting, Battery in cars.

**Side path:** An exit ramp leads to a small surface street area with a boarded-up convenience store. Breaking in reveals extra loot and **Heart Container #1** (hidden under a collapsed shelf).

---

#### 1C. Highway Collapse (Boss Arena)
**Size:** ~200 x 400 blocks
**Description:** The highway literally ends here. A massive section of I-85 has collapsed (referencing the real 2017 I-85 bridge collapse). Broken concrete, rebar jutting out, cars dangling over the edge. Below the collapse is a dark hole leading to Zone 2.

**Landmarks:**
- **The Collapse Edge** — a dramatic cliff where the highway drops away. Looking down, the player sees storm drains and darkness below. This is the zone transition point
- **Boss Arena: The Big Rig** — a flatbed of highway blockade. The Highway Boss spawns here: **"Road King" — a massive road rager in a forklift** who charges at the player, throwing car parts. The arena has destructible barriers the player can use for cover or knock onto the boss
- **MARTA Emergency Exit** — a side door in a highway support column leads to a maintenance stairwell going down. This is the "safe" transition to Zone 2 (vs. jumping into the collapse hole, which is faster but costs HP)

**Gameplay purpose:** Climax of Zone 1. Boss fight teaches the player that destruction is a combat tool (knock debris onto the boss, destroy his cover). After the boss, the player transitions underground.

**Enemies:** Road King boss (150 HP, 15 damage). A few Road Ragers during the approach.

**Boss drops:** 50 Scrap, Sledgehammer (guaranteed).

**Transition to Zone 2:** Two paths down:
1. **Jump into the collapse** — fast but you take 20 fall damage, land in the Storm Drains (2A)
2. **MARTA stairwell** — safe descent, leads to MARTA Station (2B). Slightly longer but no damage and introduces MARTA fast travel

---

## 3. Zone 2: The Underground (Tier 2)

**Theme:** Dark, industrial, and alien. You've left the surface world behind. Dripping water, echoing footsteps, flickering lights. The underground is a maze — but it's also a shortcut through the surface traffic. Atlanta's literal underground infrastructure becomes a dungeon.

**Playtime:** 50-80 minutes (first playthrough) — the longest zone, most exploration
**Mood:** Tension → mastery. Dark and disorienting at first, then the player learns to navigate and dominate.
**Lighting:** Near-dark. Player relies on Phone Flashlight initially, then Work Flashlight. Bioluminescent fungus provides ambient light in sewer sections. Flickering industrial lights in MARTA areas.
**Ambient sounds:** Dripping water, distant rumbling (MARTA trains), skittering (rats/creatures), echoing footsteps, occasional pipe groans.

### Sub-Areas

#### 2A. Storm Drains (Entry from Highway Collapse)
**Size:** ~300 x 200 blocks, 40 blocks tall
**Description:** Large concrete storm drain tunnels running under the highway. Partially flooded (shin-deep water that slows movement by 15%). Occasional shafts of light from grates above. This is the player's introduction to underground navigation.

**Landmarks:**
- **The Drop** — where the player lands if they jumped from the Highway Collapse. A pool of water breaks the fall (reduces fall damage to 10 instead of 20)
- **Drain Junction** — a large circular room where 4 drain tunnels converge. A natural hub. Contains a sleeping bag checkpoint and some supply crates
- **Surface Grate Lookout** — a few grates in the ceiling let the player peek up at the gridlocked surface above, reinforcing that going underground was the right choice

**Gameplay purpose:** Transition area. Teaches underground navigation, introduces darkness mechanic, and the importance of the flashlight. Lower enemy density — mostly rats.

**Enemies:** Sewer Rats (20 HP, fast, low damage, attack in groups of 3-4).

**Loot highlights:** Cable/Wire, Scrap Metal, Pipe (crafting materials for Tier 2 gear).

**Connection:** South tunnel leads to MARTA Station (2B). East tunnel leads deeper into the Sewer Network (2C).

---

#### 2B. MARTA Station (Hub)
**Size:** ~200 x 150 blocks, 30 blocks tall
**Description:** An abandoned/partially operational MARTA rapid transit station. Fluorescent lights flicker. Turnstiles, ticket machines, platform edges. Occasional MARTA trains still rumble through at high speed (environmental hazard — stand on the tracks and you die instantly).

**Landmarks:**
- **Platform** — the train platform. A MARTA train roars through every 60 seconds. Timing your crossing is a mini-challenge (Pillar 5 moment — near-miss with a train)
- **Station Office** — a locked room (break the door) containing good loot: Rebar Sword, Nails, First Aid Kit
- **MARTA Map** — an interactive map on the wall. Activating it reveals the minimap for the underground zone and marks the locations of the other 2 MARTA stations
- **Vending Machines** — working vending machines sell healing items and ammo for Scrap
- **MARTA Pass Quest** — a MARTA security guard NPC (non-hostile) asks the player to clear the Sewer Network of creatures blocking a maintenance tunnel. Completing this gives the **MARTA Pass** (fast travel between the 3 MARTA stations)

**Gameplay purpose:** Safe hub area. Rest, shop, get bearings. MARTA Pass quest encourages thorough sewer exploration. The train timing challenge adds a memorable skill-check moment.

**Enemies:** None (safe zone). The MARTA security guard is an NPC, not an enemy.

**Connections:**
- Stairwell up → leads to Highway Collapse area (backtrack)
- Tunnel south → Storm Drains (2A)
- Maintenance tunnel east → Sewer Network (2C)
- Train tunnel (dangerous) → shortcut to MARTA Station #2 near Underground Atlanta (2D). Requires dodging trains.

---

#### 2C. Sewer Network (Boss Zone)
**Size:** ~400 x 300 blocks, 60 blocks tall (multi-level)
**Description:** The largest sub-area in the game. A sprawling network of sewer tunnels, pumping stations, and maintenance corridors beneath Atlanta. Multi-level — upper sewers are drier and more industrial, lower sewers are flooded and biological (bioluminescent fungus, organic growth). This is the game's dungeon.

**Landmarks:**
- **Pumping Station** — a large industrial room with machinery. Contains a **Workbench** (required for Rebar Mace and Traffic Light Flail crafting). Also has good loot crates
- **The Sewer Maze** — a section of branching tunnels that loops back on itself. Easy to get lost. The Walkie-Talkie utility item (reveals enemies on minimap) is hidden here, helping navigation
- **The Gator's Lair (Boss Arena)** — a massive underground cavern with a toxic green pool in the center. The Sewer Boss spawns here: **"Ol' Snaggletooth" — a giant mutant alligator** (Atlanta sewer legend). The arena has elevated pipe platforms the player can use to avoid the gator's charge attacks, and destructible pillars that can be collapsed onto it
- **3 Sewer Keys** — scattered through the maze. Collecting all 3 unlocks the gate to **Heart Container #2** (behind a locked gate in a dead-end tunnel)
- **Heart Container #3** — guarded by Ol' Snaggletooth (drops after boss defeat, in a chest behind the lair)

**Gameplay purpose:** Core Zone 2 content. Exploration-heavy with combat challenges. The sewer maze tests navigation skills. The boss fight is the game's mid-point climax. Multiple side paths reward thorough exploration.

**Enemies:** Sewer Rats (groups), Sewer Creatures (50 HP, harder), Mole Bots (40 HP, drill attacks, break blocks). Boss: Ol' Snaggletooth (300 HP, 20 damage).

**Boss drops:** 75 Scrap, Electric Cable Whip recipe, Sweet Tea Jug (full heal).

**Loot highlights:** Nail Gun (rare chest), Sewer Grate shield, Manhole Vest (rare), Grapple Hook (rare chest in deepest level), Metal Plates and materials for Sewer Plate Mail.

**Connections:**
- West → MARTA Station (2B)
- Up/East → Underground Atlanta (2D) — the exit from the sewers
- Down → deeper sewer levels (dead-end exploration branches with loot)

---

#### 2D. Underground Atlanta (Exit to Surface)
**Size:** ~250 x 250 blocks, 40 blocks tall
**Description:** The real Underground Atlanta — a network of streets and storefronts that were literally buried when viaducts were built over them in the early 1900s. Now it's a subterranean shopping district, but in the game it's half-abandoned and partially flooded. This is the transition zone back to the surface.

**Landmarks:**
- **The Promenade** — a wide underground street lined with shuttered shops. Some can be broken into for loot. Atmospheric — brick walls, old signage, water pooling on the floor
- **MARTA Station #2** — a second MARTA station connecting to the underground. If the player has the MARTA Pass, they can fast-travel back to Station #1
- **The Stairwell Up** — a grand staircase leading up to the surface. Light pours down from above. This is the transition to Zone 3. The first surface light the player has seen in a while — a visual moment
- **Waffle House Underground** — a Waffle House that somehow still operates underground. Full checkpoint: sleeping bag, vending machines, and a Waffle House Plate heal (75 HP over 10s with sit-and-eat animation). This is the last safe haven before Zone 3

**Gameplay purpose:** Transition and reward zone. After the intensity of the Sewer Network and boss fight, this area is a breather. Good shopping, a checkpoint, and the visual payoff of seeing surface light again.

**Enemies:** Light enemy presence. A few Mole Bots and Sewer Rats. No major threats.

**Connections:**
- West/Down → Sewer Network (2C)
- Up → Zone 3: The Streets (3A Waffle House Haven)

---

## 4. Zone 3: The Streets (Tier 3)

**Theme:** Urban chaos on the surface. Construction everywhere, traffic still gridlocked, but now you're on foot in the streets of Atlanta. Buildings tower around you. Your apartment is visible in the distance — tantalizingly close. The final push home.

**Playtime:** 40-60 minutes (first playthrough)
**Mood:** Determination → triumph. The player is powerful now, with Tier 2-3 gear. Enemies are tougher but the player has mastered the systems. The apartment is always visible on the skyline, pulling the player forward.
**Lighting:** Late afternoon/sunset. Golden hour light with long shadows. Dramatic contrast between bright streets and dark building interiors.
**Ambient sounds:** Construction machinery, distant traffic, wind between buildings, radio chatter, birds.

### Sub-Areas

#### 3A. Waffle House Haven (Checkpoint)
**Size:** ~100 x 100 blocks
**Description:** The surface exit from Underground Atlanta leads right to a Waffle House parking lot. The Waffle House is a safe zone with full services. The player emerges, blinking, into the late-afternoon Atlanta sun. Midtown skyline visible ahead — the apartment building is RIGHT THERE, maybe 10 blocks away on the skyline. But between here and there...

**Landmarks:**
- **Waffle House** — full checkpoint, vending machines, sleeping bag, Waffle House Plate
- **MARTA Station #3** — above-ground station nearby. Completes the MARTA fast-travel triangle
- **The Varsity (visible in distance)** — the world's largest drive-in, visible a few blocks ahead. Foreshadowing

**Gameplay purpose:** Safe zone, gear check, and orientation. Player can see their destination and plan their approach. Last chance to stock up before the final stretch.

**Enemies:** None (safe zone).

---

#### 3B. Peachtree Gauntlet
**Size:** ~400 x 300 blocks, buildings up to 40 blocks tall
**Description:** The streets of Midtown Atlanta. The player must navigate through several blocks of city streets. The joke: EVERY street is named Peachtree (Peachtree Street, Peachtree Road, Peachtree Circle, Peachtree Avenue, West Peachtree...). Street signs are confusing. Buildings can be entered and climbed. Rooftop shortcuts exist for observant players.

**Landmarks:**
- **Peachtree Intersection** — a 5-way intersection where Peachtree Street crosses Peachtree Circle crosses West Peachtree. A comedic signpost with 5 "Peachtree" signs pointing different directions. Breaking the signpost reveals... another Peachtree sign underneath
- **The Varsity** — the world's largest drive-in restaurant. A large building the player can enter. Contains high-tier loot (Stop Sign Axe, Hard Hat Suit) and a mini-boss: **"Varsity Vanguard"** — a massive chef NPC. Optional fight for good rewards
- **Parking Garage** — a multi-story parking garage. Driving up the ramps on foot, each level has enemies and loot. The top floor has **Heart Container #4** (platforming challenge — jump across gaps between levels)
- **Rooftop Route** — an alternate path across building rooftops. Faster but requires the Grapple Hook to access. Fewer enemies, more platforming

**Gameplay purpose:** Dense urban combat and exploration. Multiple vertical layers (street level, building interiors, rooftops). The Peachtree name gag is a recurring joke. The Varsity is an optional challenge for gear-obsessed players.

**Enemies:** Construction Bots (60 HP, hard-hitting), Stray Dogs (30 HP, fast), Jaywalker Mobs (weak but numerous, 15 HP each, spawn in groups of 6-8).

**Loot highlights:** Stop Sign Axe, Flare Gun, Hard Hat Suit, Chain and Traffic Light (crafting materials for Tier 3 items).

**Side paths:**
- Building interiors — most buildings have a ground floor that can be entered. Random loot and occasional enemies
- Rooftop path — accessible via Grapple Hook or by destroying interior stairwells. Connects several buildings and bypasses street-level enemies

---

#### 3C. Construction Zone (Final Boss)
**Size:** ~300 x 300 blocks, 50 blocks tall
**Description:** A massive construction site surrounding and blocking the player's apartment building. Cranes, scaffolding, concrete barriers, heavy machinery everywhere. Atlanta's perpetual construction has literally barricaded your home. The final boss lurks here.

**Landmarks:**
- **The Crane** — a towering construction crane. Climbable. From the top, the player can see the entire world they've traversed (Pillar 5 moment — looking back at the highway in the distance)
- **Boss Arena: The Foundation** — an open construction pit in front of the apartment building. The Street Boss spawns here: **"Big Jim" — a massive construction foreman piloting a mechanized exo-suit** built from construction equipment (excavator arms, concrete mixer barrel, steel beam legs). The arena has destructible scaffolding, a crane hook that can be swung into the boss, and concrete blocks that can be knocked from above
- **Workbench #2** — in the construction office trailer. Last chance to craft Tier 3 items (Rebar Mace, Traffic Light Flail)
- **Heart Container #5** — hidden behind a destructible wall inside the construction site office. A puzzle: the wall looks different from surrounding blocks (subtle crack texture)

**Gameplay purpose:** Final boss encounter. The arena is designed for creative destruction — the player should use everything they've learned about the destruction system. The boss is the toughest enemy but the environment gives the player tools to even the odds.

**Enemies:** Construction Bots (patrols), Boss: Big Jim (500 HP, 25 damage).

**Boss drops:** 100 Scrap, Construction Saw (guaranteed).

**Boss mechanics:**
- Phase 1 (500-300 HP): Charges at player with excavator arms. Destroy scaffolding in his path to stagger him. Melee attacks between charges.
- Phase 2 (300-100 HP): Uses concrete mixer to launch AoE concrete blobs. Climb the crane to get above him. Drop steel beams from the crane for massive damage.
- Phase 3 (100-0 HP): Enraged. Faster attacks, destroys terrain aggressively. Arena becomes increasingly destroyed. Pure combat — dodge and hit.

---

#### 3D. Your Apartment (Victory)
**Size:** ~50 x 50 blocks, 30 blocks tall (the building)
**Description:** Your apartment building. A modest 6-story Midtown apartment complex. The front door is right there. You're home.

**Sequence:**
1. After defeating Big Jim, the path to the apartment building is clear
2. Player walks up to the front door and interacts with it
3. Quick first-person sequence: walking through the lobby, riding the elevator, opening your apartment door
4. You step inside. The apartment is cozy and intact — the one undestroyed space in the entire game
5. Player walks to the couch and sits down
6. Camera pulls back through the apartment window, showing the trail of destruction across Atlanta
7. Final stats screen: time, enemies defeated, blocks destroyed, items found, scrap collected
8. Credits roll with Atlanta traffic facts as loading-screen-style tips
9. **Speedrun timer** stops and final time is displayed prominently

**Post-credits:** A notification on the player's in-game phone: "TRAFFIC UPDATE: I-85 Northbound reopened. All lanes clear." The ultimate joke — if you'd waited, traffic would have cleared.

---

## 5. Progression Structure: Linear or Open?

### Decision: Linear Spine with Exploration Branches

The world uses a **linear spine** — the main path always moves forward through the 3 zones in order. However, each zone has **side branches** that reward exploration with better loot, heart containers, and optional content.

```
MAIN PATH (mandatory):
  1A → 1B → 1C (boss) → 2A → 2B → 2C (boss) → 2D → 3A → 3B → 3C (boss) → 3D (win)

SIDE BRANCHES (optional):
  1A: overpass climb (Car Jack Handle, skyline view)
  1B: exit ramp convenience store (Heart Container #1)
  2B: MARTA train tunnel shortcut (dangerous, skips 2A)
  2C: deep sewers (Grapple Hook, extra loot)
  2C: sewer maze (3 keys → Heart Container #2)
  2C: boss lair (Heart Container #3)
  3B: rooftop route (requires Grapple Hook)
  3B: The Varsity (mini-boss, loot)
  3B: parking garage (Heart Container #4)
  3C: construction office wall (Heart Container #5)
```

### Why Linear (Not Open World)

1. **GDD Pillar 2** ("The Commute From Hell") demands constant forward motion. Open world kills urgency
2. **Scope control** — handcrafted linear zones are feasible for solo dev; open world is not
3. **Difficulty curve** — linear progression ensures the player encounters enemies and loot in the intended order
4. **Story arc** — the journey has a beginning (stuck in traffic), middle (underground ordeal), and end (arriving home). This requires linearity
5. **Speedrun potential** — linear games have cleaner speedrun routes, supporting replayability

### Soft Gating (Not Hard Walls)

The player can't wander freely between zones, but gating is **environmental, not invisible walls**:

| Gate | From → To | How It Works |
|------|-----------|--------------|
| Highway Collapse | Zone 1 → Zone 2 | The highway literally ends. Must go down. |
| Sewer Exit | Zone 2 → Zone 3 | Stairwell up. Can't access surface streets from Zone 1 area. |
| Construction Barricade | Zone 3 entrance | Concrete barriers block backtracking to the collapse. One-way. |

**Backtracking within zones** is possible and encouraged (side paths, missed loot). MARTA fast travel lets players revisit discovered stations within Zone 2.

---

## 6. Difficulty Curve

### Overall Philosophy
The difficulty curve follows a **sawtooth pattern**: difficulty rises through each zone, drops at checkpoints/rest areas, then rises again into the next zone. Boss fights are local peaks. The overall trend rises from Zone 1 to Zone 3.

```
DIFFICULTY

  High ─                                          ╱╲ Big Jim
        │                              ╱╲ Streets╱  ╲
        │                    ╱╲ Snag- ╱  ╲──────╱    ╲
  Med ──│        ╱╲ Road   ╱  ╲tooth╱    WH haven     ╲
        │  ╱╲  ╱  ╲King  ╱    ╲──╱                     ╲ Victory
  Low ──│╱  ╲╱    ╲────╱      UG Atlanta                 ╲
        │ Tutorial               (breather)
        └──────────────────────────────────────────────────────
         1A   1B    1C     2A  2B  2C     2D   3A  3B    3C  3D
         Spaghetti  Hwycol Storm MARTA Sewers  UGA  WH  Peach Const Apt
```

### Difficulty Parameters by Sub-Area

| Sub-Area | Enemy Density | Enemy HP | Enemy Damage | Loot Quality | Darkness | Navigation |
|----------|--------------|----------|-------------|-------------|----------|------------|
| 1A Spaghetti Junction | Very Low | 25 | 5-8 | Tier 1 common | None | Simple |
| 1B Highway Stretch | Low-Medium | 25 | 8 | Tier 1 full | None | Simple |
| 1C Highway Collapse | Medium (+ boss) | 25-150 | 8-15 | Tier 1 rare | None | Linear |
| 2A Storm Drains | Low | 20 | 6 | Tier 2 common | High | Moderate |
| 2B MARTA Station | None (safe) | — | — | Shop | Low | Hub |
| 2C Sewer Network | High | 20-50 | 6-12 (+ boss 20) | Tier 2 full | High | Complex maze |
| 2D Underground Atlanta | Low | 20-40 | 6-10 | Tier 2 rare | Medium | Moderate |
| 3A Waffle House Haven | None (safe) | — | — | Shop | None | Simple |
| 3B Peachtree Gauntlet | High | 30-60 | 8-15 | Tier 3 full | None (day) | Moderate (3D) |
| 3C Construction Zone | Very High (+ boss) | 60-500 | 15-25 | Tier 3 rare | None | Complex (vertical) |
| 3D Apartment | None | — | — | — | None | Linear |

### Expected Player Power vs. Enemy Power

| Point in Game | Player HP | Player DPS | Enemy HP Range | Enemy DPS | Player Advantage |
|---------------|-----------|-----------|---------------|----------|-----------------|
| 1A Start | 100 | 6 (fists) | 25 | 5-8 | Slight disadvantage |
| 1B Midpoint | 100 | 12 (tire iron) | 25 | 8 | Slight advantage |
| 1C Boss | 100-110 | 12 | 150 (boss) | 15 | Even (use arena) |
| 2A Entry | 110 | 12-14 | 20 | 6 | Clear advantage |
| 2C Mid-Sewers | 120-130 | 21-24 | 50 | 12 | Slight advantage |
| 2C Boss | 130 | 24 | 300 (boss) | 20 | Even (use arena) |
| 3B Streets | 140 | 33-37 | 60 | 15 | Slight advantage |
| 3C Boss | 140-150 | 37 | 500 (boss) | 25 | Slight disadvantage (use arena) |

> **Balance principle:** The player should feel powerful against regular enemies but challenged by bosses. Regular enemies are dispatched in 2-5 hits. Bosses require 15-30 hits and arena strategy. Bosses should never feel like HP sponges — arena mechanics (collapsing scaffolding, swinging crane hooks, terrain destruction) should deal supplementary damage.

---

## 7. Zone Connection Map

### How Zones Connect

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ZONE 1: THE HIGHWAY                         │
│                                                                     │
│  [1A Spaghetti Junction]──→[1B Highway Stretch]──→[1C Collapse]    │
│       ↕ (overpass climb)      ↕ (exit ramp)          ↓    ↓        │
│    (side: skyline view)    (side: Heart #1)      (jump) (stairs)   │
│                                                     ↓      ↓       │
└─────────────────────────────────────────────────────┼──────┼────────┘
                                                      ↓      ↓
┌─────────────────────────────────────────────────────┼──────┼────────┐
│                      ZONE 2: THE UNDERGROUND        ↓      ↓       │
│                                                     ↓      ↓       │
│                                              [2A Storm]  [2B MARTA]│
│                                                Drains ←──→ Station │
│                                                   ↓                │
│                                           [2C Sewer Network]       │
│                                           (maze, 3 keys, boss)     │
│                                                   ↓                │
│                                       [2D Underground Atlanta]     │
│                                           (WH checkpoint)          │
│                                                   ↓                │
└───────────────────────────────────────────────────┼────────────────┘
                                                    ↓
┌───────────────────────────────────────────────────┼────────────────┐
│                      ZONE 3: THE STREETS          ↓                │
│                                                   ↓                │
│                                          [3A Waffle House]         │
│                                          (safe, MARTA #3)          │
│                                                   ↓                │
│                                       [3B Peachtree Gauntlet]      │
│                                       (streets, roofs, Varsity)    │
│                                                   ↓                │
│                                       [3C Construction Zone]       │
│                                            (final boss)            │
│                                                   ↓                │
│                                          [3D Your Apartment]       │
│                                             (VICTORY)              │
└────────────────────────────────────────────────────────────────────┘

FAST TRAVEL (MARTA Pass required):
  [2B MARTA Station #1] ←──→ [2D MARTA Station #2] ←──→ [3A MARTA Station #3]
```

### Transition Moments (Pillar 5: Shareable)

Each zone transition should be a memorable visual/gameplay moment:

| Transition | What Happens | Pillar 5 Moment |
|------------|-------------|-----------------|
| 1A → 1B | Drive past the gas station, road opens up | First big view of the highway gridlock stretching ahead |
| 1B → 1C | Highway damage increases, ominous rumbling | The ground shakes, cracks appear in the road |
| 1C → Zone 2 | Highway collapses, player falls/climbs down | Dramatic collapse sequence — debris flies, cars slide |
| 2A → 2B | Tunnel opens into lit MARTA station | Relief moment — first safe space after darkness |
| 2C → 2D | Sewer exit opens into Underground Atlanta | Atmospheric shift — industrial to abandoned commercial |
| 2D → Zone 3 | Climb stairwell, sunlight pours in | First daylight in 50+ minutes. Skyline visible. Emotional |
| 3A → 3B | Leave Waffle House, enter Atlanta streets | The apartment is visible on the skyline! So close! |
| 3B → 3C | Streets end at massive construction barricade | "You've got to be kidding me" — one last obstacle |
| 3C → 3D | Boss defeated, path to apartment clear | Quiet walk to the front door. The journey is over. |

---

## 8. Checkpoint & Save System

| Checkpoint | Location | Zone | Type |
|------------|----------|------|------|
| Auto-save #1 | Game start (player's car) | 1A | Auto |
| Checkpoint #1 | Gas station (QT) | 1B | Rest stop |
| Auto-save #2 | Zone 1→2 transition | 1C/2A | Auto |
| Checkpoint #2 | MARTA Station #1 | 2B | Rest stop |
| Auto-save #3 | Boss defeated (Ol' Snaggletooth) | 2C | Auto |
| Checkpoint #3 | Waffle House Underground | 2D | Rest stop |
| Auto-save #4 | Zone 2→3 transition | 2D/3A | Auto |
| Checkpoint #4 | Waffle House Haven | 3A | Rest stop |
| Auto-save #5 | Boss defeated (Big Jim) | 3C | Auto |
| Final save | Apartment reached | 3D | Victory |

**Sleeping bags** can also be found/placed as manual save points within zones, but the above are guaranteed checkpoints.

---

## 9. Playtime Breakdown

| Sub-Area | First Playthrough | Speedrun (estimated) |
|----------|-------------------|---------------------|
| 1A Spaghetti Junction | 10-15 min | 1-2 min |
| 1B Highway Stretch | 15-20 min | 2-3 min |
| 1C Highway Collapse (boss) | 10-15 min | 3-4 min |
| 2A Storm Drains | 10-15 min | 1-2 min |
| 2B MARTA Station | 5-10 min | 30 sec |
| 2C Sewer Network (boss) | 25-35 min | 5-7 min |
| 2D Underground Atlanta | 10-15 min | 1-2 min |
| 3A Waffle House Haven | 3-5 min | 15 sec |
| 3B Peachtree Gauntlet | 20-30 min | 3-5 min |
| 3C Construction Zone (boss) | 15-20 min | 4-6 min |
| 3D Apartment (victory) | 2-3 min | 30 sec |
| **Total** | **~2-3 hours** | **~20-30 min** |

> **Note:** The loot system doc estimated ~65 min. That was a power-progression estimate, not accounting for exploration, side paths, getting lost in sewers, and the learning curve. First playthrough should be 2-3 hours. Experienced replay should be ~60-90 min. Speedrun target is 20-30 min.

---

## 10. Block Types by Zone

Each zone uses a distinct palette of voxel block types, giving them unique visual identity and mining properties.

### Zone 1: Highway
| Block Type | Hardness | Mining Speed (fist) | Appearance |
|------------|----------|-------------------|------------|
| Asphalt | 2 | Slow | Dark gray, rough |
| Concrete (road) | 3 | Very slow | Light gray, smooth |
| Concrete (barrier) | 4 | Very slow | Light gray with yellow stripe |
| Car Metal | 2 | Slow | Various colors, metallic |
| Car Glass | 1 | Fast | Transparent blue-tint |
| Guardrail | 3 | Slow | Silver metallic |
| Dirt (shoulder) | 1 | Fast | Brown |
| Grass | 1 | Fast | Green top, brown sides |
| Construction Scaffolding | 1 | Fast | Orange metal |

### Zone 2: Underground
| Block Type | Hardness | Mining Speed (fist) | Appearance |
|------------|----------|-------------------|------------|
| Concrete (sewer) | 3 | Very slow | Dark gray, wet |
| Brick (old) | 2 | Slow | Red-brown |
| Brick (new) | 3 | Slow | Clean red |
| Metal Pipe | 4 | Very slow | Rusty brown |
| Stone | 3 | Very slow | Gray, natural |
| Mud | 1 | Fast | Dark brown |
| Water | — | Can't mine | Blue, transparent, slows player |
| Bioluminescent Fungus | 1 | Fast | Glowing green/blue |
| Tile (MARTA) | 2 | Slow | White/cream, clean |
| Rail | 5 | Extremely slow | Steel, gray |

### Zone 3: Streets
| Block Type | Hardness | Mining Speed (fist) | Appearance |
|------------|----------|-------------------|------------|
| Asphalt (road) | 2 | Slow | Dark gray |
| Sidewalk | 2 | Slow | Light gray, patterned |
| Building Brick | 3 | Slow | Various colors |
| Building Glass | 1 | Fast | Transparent, reflective |
| Steel (structural) | 5 | Extremely slow | Dark gray, strong |
| Drywall | 1 | Fast | White/cream |
| Wood | 2 | Slow | Brown, grain pattern |
| Concrete (construction) | 4 | Very slow | Rough gray |
| Scaffolding | 1 | Fast | Metal, open |
| Crane Metal | 6 | Nearly unbreakable | Yellow, heavy |

### Mining Speed Formula
```
time_to_break = block_hardness / (tool_mining_multiplier * 1.0)
```
Example: Concrete (hardness 3) with Tire Iron (2x mining) = 1.5 seconds. Same block with fists (1x) = 3 seconds. With Jackhammer (8x) = 0.375 seconds.

> **Soft gating via block hardness:** Steel (5) and Crane Metal (6) are nearly unbreakable with Tier 1 tools, naturally preventing early access to late-game areas. A player with a Tire Iron (2x) would take 2.5-3 seconds per steel block — technically possible but painfully slow, discouraging it without hard-blocking it.

---

## Appendix A: Atlanta Landmark Integration

| Real Landmark | In-Game Version | Zone | Gameplay Role |
|---------------|----------------|------|---------------|
| Spaghetti Junction (I-85/I-285) | Starting area | 1A | Tutorial, player's car |
| I-85 Bridge Collapse (2017) | Highway Collapse | 1C | Zone transition, boss arena |
| QT Gas Station | Gas Station rest stop | 1B | Checkpoint, vending |
| MARTA Rapid Transit | 3 MARTA stations | 2B, 2D, 3A | Fast travel, environmental hazard |
| Underground Atlanta | Subterranean shopping area | 2D | Transition zone, lore |
| Waffle House | Rest stops (2 locations) | 2D, 3A | Checkpoints, signature healing |
| The Varsity | Drive-in restaurant | 3B | Mini-boss, loot cache |
| 71 Peachtree Streets | Confusing intersection | 3B | Comedy moment, navigation |
| Perpetual Construction | Final construction zone | 3C | Final boss arena |

---

## Appendix B: Speedrun Route (Optimal)

For speedrun design — the shortest possible path through the game:

```
1A: Exit car, grab Tire Iron from truck → run straight through
1B: Skip gas station, skip exit ramp → straight to collapse
1C: Jump into collapse (take 20 dmg) → skip boss? No, boss blocks path. Fight Road King.
2A: Sprint through storm drains → south to MARTA
2B: Skip MARTA quest → head east to sewers
2C: Navigate sewer (memorized route) → fight Ol' Snaggletooth
2D: Sprint through Underground Atlanta → stairs up
3A: Skip Waffle House → straight to streets
3B: Rooftop route (if Grapple Hook found) OR street sprint → to construction
3C: Fight Big Jim → enter apartment
3D: Victory

Estimated: 20-25 minutes (expert player, memorized layout)
```

**Speedrun-friendly design choices:**
- Jump into collapse (skip stairs) saves ~30 seconds
- MARTA quest is optional (MARTA Pass not needed for completion)
- Rooftop route in 3B is faster but requires Grapple Hook RNG
- Boss fights cannot be skipped — they block progression
- All side paths are optional

---

*This document defines the complete world layout for Voxel Traffic Escape v1.0. All zones, connections, difficulty curves, and progression are mapped. Implementation should reference this alongside the GDD (01) and Loot System (05) documents.*
