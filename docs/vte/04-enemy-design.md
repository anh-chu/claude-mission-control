# Voxel Traffic Escape — Enemy Types, AI Behaviors & Progression

> **Task:** task_VTE_004
> **Version:** 1.0
> **Date:** 2026-02-28

---

## Design Decisions Summary

| Question | Decision | Rationale |
|----------|----------|-----------|
| Respawning | **Yes — distance-based** (3+ chunks away, 60s timer) | Keeps the world alive, doesn't punish exploration, prevents farming exploits |
| Enemy drops | **All drop scrap; specific types drop themed items** | Already defined in loot doc. Consistent reward loop without cluttering inventory |
| Bosses | **Zone-gate bosses (mandatory)** | Creates clear progression checkpoints. Must defeat to enter next zone |
| Comedic tone | **Comedic concepts, threatening mechanics** | Names and flavor are funny. Gameplay is genuinely challenging. Death anims are slapstick |

---

## 1. Enemy Design Philosophy

### Tone Ladder
The game starts grounded and escalates to absurd. Enemies follow the same arc:

| Zone | Tone | Examples |
|------|------|----------|
| Highway | **Relatable road rage** | Angry commuters, aggressive drivers — could happen on your commute |
| Underground | **Urban legends + weird** | Sewer gators (Atlanta myth!), abandoned robots, giant rats |
| Street | **Full urban chaos** | Rogue construction equipment, armed transit security, drone swarms |

### Combat Role Distribution
Each zone has enemies filling 4 combat roles to ensure varied encounters:

| Role | Purpose | Player Skill Tested |
|------|---------|-------------------|
| **Melee** | Standard combat | Attack timing, spacing |
| **Ranged** | Pressure from distance | Dodging, closing gaps |
| **Tank/Charger** | High-damage threat | Dodge timing, positioning |
| **Swarm/Special** | Overwhelm or area denial | Crowd control, awareness |

---

## 2. Highway Zone Enemies (Tier 1)

The highway is bumper-to-bumper gridlock on Spaghetti Junction. Enemies are angry commuters who've also snapped — but they're mad at YOU. These are early-game pushovers individually, threatening in groups.

### 2.1 Road Rager
> *"I HAD THE RIGHT OF WAY!"*

An angry commuter who abandoned their car same as you. Charges at the player swinging their fists, briefcase, or whatever they grabbed from the driver's seat.

| Stat | Value |
|------|-------|
| HP | 25 |
| Damage | 8 (melee) |
| Attack Speed | 1.2/sec |
| Move Speed | 0.8x (Medium) |
| Aggro Range | 12 blocks |
| Behavior | **Chase** |
| Drops | Scrap (3-8), 20% Gas Station Snack |

**AI Behavior — Chase:**
- Patrols a small area around their car (3-5 block radius)
- When player enters aggro range, yells a road rage quip and sprints toward them
- Attacks in melee range with 1-2 swing combo
- If player moves beyond 20 blocks, gives up and returns to car (de-aggro)
- No coordination — each Road Rager acts independently

**Visual:** Business casual commuter. Loosened tie, rolled-up sleeves. Some variants hold a briefcase (slightly more damage). Red-faced anger expression.

---

### 2.2 Coffee Tosser
> *"This is a GRANDE, you jerk!"*

A passive-aggressive commuter who stays near their car and hurls scalding coffee cups at passing players. They're the tutorial for dodging ranged attacks.

| Stat | Value |
|------|-------|
| HP | 15 |
| Damage | 5 + burn (2 dmg/sec for 2s = 9 total) |
| Attack Speed | 0.8/sec |
| Move Speed | 0.5x (Slow) |
| Aggro Range | 16 blocks |
| Range | 14 blocks |
| Behavior | **Ranged** |
| Drops | Scrap (2-5), 30% Coffee Cup (hot) |

**AI Behavior — Ranged:**
- Stands near or leans on their car, does not patrol
- When player enters aggro range, begins lobbing coffee cups (arcing projectile)
- Projectile has a 0.8s flight time with visible arc — telegraphed and dodgeable
- If player closes to within 4 blocks, panics and tries to retreat behind nearest car
- Will not chase; stays in their comfort zone
- Low HP makes them easy to dispatch once you close the gap

**Visual:** Commuter clutching an enormous coffee cup. Sunglasses, frustrated expression. Coffee cups leave a small brown splash on impact.

---

### 2.3 Bumper Brawler
> *"YOU SCRATCHED MY TRUCK!"*

A pickup truck driver who weaponized their vehicle. Revs up and charges at the player in short, aggressive dashes. The first "dodge or die" enemy — teaches timing.

| Stat | Value |
|------|-------|
| HP | 35 |
| Damage | 14 (charge), 6 (melee if out of truck) |
| Attack Speed | Charge every 4s, melee 1/sec |
| Move Speed | 2.0x during charge, 0.6x otherwise |
| Aggro Range | 18 blocks |
| Behavior | **Charge** |
| Drops | Scrap (5-10), 15% Battery, 10% Seat Cover |

**AI Behavior — Charge:**
- Sits in truck, engine idling. Honks when player enters aggro range (1.5s warning)
- Revs engine for 1s (visible exhaust particles + audio cue), then charges in a straight line
- Charge covers 12-15 blocks at 2.0x speed. Cannot turn during charge
- If charge misses, truck skids to a stop (1.5s recovery = vulnerability window)
- If truck hits a wall/obstacle during charge, takes 5 self-damage and is stunned for 2s
- After truck is destroyed (HP reduced to 0), driver gets out as a weaker melee attacker (15 HP, 6 dmg)
- Charge can destroy Tier 1 blocks it hits (highway barriers, car parts)

**Visual:** Oversized pickup truck with lift kit. Driver wearing a trucker cap, screaming out the window. Truck has bumper stickers. During charge, tire smoke trails.

---

### 2.4 Horn Honker
> *[HOOOOONK]*

A commuter who never leaves their car but weaponizes their horn. Creates sonic shockwave blasts that push the player back and deal chip damage. Area denial enemy that forces the player to approach from angles.

| Stat | Value |
|------|-------|
| HP | 20 |
| Damage | 4 + knockback (3 blocks) |
| Attack Speed | Honk every 3s |
| Move Speed | 0x (stationary in car) |
| Aggro Range | 14 blocks |
| Blast Range | 8 blocks (frontal cone, 60 degrees) |
| Behavior | **Area Denial** |
| Drops | Scrap (3-6), 10% Scrap Metal |

**AI Behavior — Area Denial:**
- Stationary. Sits in car. Cannot move
- When player enters aggro range, begins honking in rhythmic pattern (every 3s)
- Honk creates a visible shockwave cone in front of the car (60-degree arc, 8 blocks range)
- Shockwave pushes player backward 3 blocks and deals 4 damage
- Player can approach from the sides or behind the car to avoid the blast
- Destroying the car destroys the honker (car has same HP as the enemy)
- Shockwave can push other enemies too (can be used tactically)
- Does not rotate — always faces the direction the car is parked

**Visual:** Sedan with a comically oversized horn mounted on the roof. Driver's face pressed into the steering wheel. Visible sound rings emanate from the horn during blasts.

---

## 3. Underground Zone Enemies (Tier 2)

The underground is Atlanta's sewer system, abandoned MARTA tunnels, and maintenance corridors. It's dark, wet, and things have been living down here. Enemies are weirder, tougher, and use the environment against you.

### 3.1 Sewer Rat
> *[skittering intensifies]*

Small, fast, individually weak — but they never come alone. Sewer Rats are the swarm enemy. A single rat is a nuisance; five rats can shred an unprepared player.

| Stat | Value |
|------|-------|
| HP | 10 |
| Damage | 4 (melee bite) |
| Attack Speed | 2.0/sec |
| Move Speed | 1.2x (Fast) |
| Aggro Range | 10 blocks |
| Pack Size | 3-5 |
| Behavior | **Swarm** |
| Drops | Scrap (2-4), 10% Scrap Metal |

**AI Behavior — Swarm:**
- Always spawns in packs of 3-5. Never found alone
- Patrol erratically in a cluster, moving through tunnels as a group
- When one rat detects the player, ALL rats in the pack aggro simultaneously
- Each rat approaches from a slightly different angle — they try to surround
- Individual rats alternate attacks: while one bites, others circle to the player's back
- Very fast, but low HP — AoE weapons (Electric Cable Whip, Pipe Bomb) are devastating
- If only 1 rat remains in a pack, it flees (deaggros and runs away)
- Pack leader (slightly larger) determines patrol route; if leader dies, pack becomes disorganized

**Visual:** Oversized voxel rats with glowing red eyes. The pack leader is slightly bigger with a distinctive scarred ear. They leave small splash particles in standing water.

---

### 3.2 Sewer Gator
> *"They said the Atlanta sewer gators were just a legend..."*

The iconic Atlanta urban legend brought to life. A large, powerful ambush predator that lurks beneath standing water and lunges when the player wades through.

| Stat | Value |
|------|-------|
| HP | 50 |
| Damage | 14 (lunge), 10 (bite), 8 (tail sweep) |
| Attack Speed | 0.8/sec |
| Move Speed | 0.4x on land, 1.5x in water |
| Aggro Range | 6 blocks (submerged), 14 blocks (surfaced) |
| Behavior | **Ambush** |
| Drops | Scrap (10-15), 5% Sewer Gator Tooth, 15% Metal Plates |

**AI Behavior — Ambush:**
- Hides completely submerged in standing water. Invisible until it attacks
- Subtle visual tell: bubbles rise from the water surface every 3-4 seconds
- When player enters 6-block range while in water, lunges out (14 dmg, unblockable)
- After initial lunge, fights on the surface with bite attacks (10 dmg) and tail sweep (8 dmg, AoE behind it)
- Tail sweep hits in a 180-degree arc behind the gator — punishes players who try to circle behind
- Extremely fast in water (1.5x), sluggish on dry ground (0.4x)
- If player retreats to dry ground, gator tries to stay near water's edge
- Returns to submerged ambush state if player moves beyond 20 blocks and water is available
- Can be spotted before ambush with the Walkie-Talkie utility item

**Visual:** Massive voxel alligator, 3x the size of a rat, 1.5x player height in length. Muddy green-brown coloring. Glowing yellow eyes visible for one frame when surfacing. Water displacement effect when moving underwater.

---

### 3.3 Mole Bot
> *"BEEP. BORE. BEEP. BORE."*

An abandoned tunnel-boring robot from unfinished MARTA construction. Still running its excavation program, it treats anything in its path — including the player — as material to be processed.

| Stat | Value |
|------|-------|
| HP | 40 |
| Damage | 12 (drill), 8 (emerge slam) |
| Attack Speed | 1.0/sec (drill), emerge every 6s |
| Move Speed | 0.6x (surface), 1.0x (burrowed) |
| Aggro Range | 16 blocks (uses vibration, ignores darkness) |
| Behavior | **Burrow** |
| Drops | Scrap (8-12), 15% Nails (x5), 10% Battery |

**AI Behavior — Burrow:**
- Starts on the surface, patrolling a small area. Audible drill whirring sound
- When player enters aggro range, it dives underground (1s animation) and burrows toward the player
- While burrowed: visible particle trail on the ground showing its path. Moves at player speed
- Emerges 2 blocks from the player's position with an upward slam (8 dmg + small AoE block destruction)
- After emerging, attacks with drill in melee for 3-4 seconds, then burrows again
- **Destroys blocks** as it burrows — creates permanent tunnels/holes in the terrain
- This is both a threat and an opportunity: Mole Bots can accidentally create shortcuts
- Vulnerable during the 1s surface-to-burrow and burrow-to-surface transitions
- Cannot burrow through reinforced/metal blocks

**Visual:** Cylindrical robot with a spinning drill cone for a face. Treads instead of legs. Blinking yellow warning lights. Sparks fly when drilling through blocks. Rust and dirt-covered.

---

### 3.4 Drain Spider
> *"NOPE. NOPE. NOPE."*

Mutated spiders that inhabit the storm drain system. They cling to walls and ceilings, dropping down on unsuspecting players and shooting webbing to slow them. The dark areas make them especially dangerous.

| Stat | Value |
|------|-------|
| HP | 25 |
| Damage | 8 (bite), 0 (web — slow only) |
| Attack Speed | 1.5/sec (bite), web every 5s |
| Move Speed | 1.0x (ground), 0.8x (walls/ceiling) |
| Aggro Range | 12 blocks |
| Web Range | 10 blocks |
| Behavior | **Hit-and-Run** |
| Drops | Scrap (5-8), 10% Cable/Wire |

**AI Behavior — Hit-and-Run:**
- Clings to walls or ceilings, nearly invisible in dark areas
- When player enters aggro range, fires a web projectile (0 dmg, but **slows player by 50% for 3s**)
- While player is slowed, drops from ceiling and attacks with rapid bites (8 dmg, 1.5/sec)
- After 2-3 bites, retreats back to a wall/ceiling. Will not stay in melee for extended fights
- Prefers to kite: web → drop → bite → retreat → web again
- Extremely vulnerable during the retreat animation (climbing back to ceiling takes 1.5s)
- Flashlight/light sources reduce their aggro range to 6 blocks (they dislike light)
- Work Flashlight and Night Vision Goggles negate their dark-area advantage
- Can be knocked off walls/ceiling with a strong enough hit (any weapon above 10 damage)

**Visual:** Blocky spider, 2x2x1 voxels. Dark purple-brown. Multiple glowing red eyes. Web projectile is a visible white ball that expands on hit. Web on the ground shows as white voxel patches.

---

## 4. Street Zone Enemies (Tier 3)

The streets of Atlanta above ground: construction zones, busy intersections, parking garages, and the final stretch to the player's apartment. Enemies here are the toughest — industrial machines, organized security, and urban hazards.

### 4.1 Construction Bot
> *"WORK ZONE ACTIVE. ALL CIVILIANS MUST BE REMOVED."*

A heavy-duty construction robot gone haywire. Originally designed for demolition, it now treats the player as a structure to be demolished. Tanky, hard-hitting, and relentless.

| Stat | Value |
|------|-------|
| HP | 60 |
| Damage | 15 (girder swing), 20 (ground slam — AoE) |
| Attack Speed | 0.8/sec (swing), ground slam every 8s |
| Move Speed | 0.5x (Slow) |
| Aggro Range | 16 blocks |
| Behavior | **Tank** |
| Drops | Scrap (15-20), 10% Scrap Metal x2, 5% Chain |

**AI Behavior — Tank:**
- Slow, deliberate patrol through construction zones. Heavy footstep sounds
- When player enters aggro range, walks toward them. Does not run
- Primary attack: overhead girder swing (15 dmg, 1-block reach). Telegraphed with 0.5s windup
- Every 8 seconds: ground slam (20 dmg) in a 3-block radius AoE. 1s windup with visible "power up" glow. **Destroys blocks in the AoE radius**
- Cannot be staggered or knocked back by any weapon
- Rotates slowly — player can circle-strafe to stay behind it
- Weak point: exposed battery pack on its back. Hits from behind deal **1.5x damage**
- If player is above it (on a roof, ledge), it will ground-slam repeatedly to collapse the structure

**Visual:** Large humanoid robot (2x player size) made of construction equipment parts. Hard hat welded to its head. Orange safety vest stretched over metal frame. Carries an I-beam as a weapon. Glowing red eye slit. Sparks and steam from joints.

---

### 4.2 Stray Dog
> *[angry barking]*

Feral dogs that roam the streets in pairs. Fast, aggressive, and they flank — one attacks from the front while the other circles behind. They're the speed threat of the street zone.

| Stat | Value |
|------|-------|
| HP | 20 |
| Damage | 10 (bite) |
| Attack Speed | 2.0/sec |
| Move Speed | 1.3x (Very Fast) |
| Aggro Range | 14 blocks |
| Pack Size | 2 (always paired) |
| Behavior | **Flanking Swarm** |
| Drops | Scrap (5-10) |

**AI Behavior — Flanking Swarm:**
- Always spawns in pairs. Roam together but attack from opposite sides
- When player enters aggro range, both dogs sprint toward the player
- Dog A engages from the front; Dog B circles to the player's back (takes ~2s to get behind)
- Attacks are fast (2.0/sec) — rapid bites that stagger the player's aim
- If one dog is killed, the surviving dog becomes enraged: +50% attack speed, +25% move speed
- Dogs cannot climb walls or obstacles taller than 1 block — use terrain to your advantage
- Dogs are vulnerable to knockback weapons (Traffic Light Flail sends them flying)
- Very low HP (20) means they die fast, but their DPS is extremely high for how squishy they are

**Visual:** Scrappy voxel dogs, medium-sized. Mix of brown/grey fur. One dog per pair is always slightly larger. Snarling animation with visible teeth. Dust trail when sprinting.

---

### 4.3 MARTA Security
> *"Sir! SIR! You need a valid fare!"*

MARTA transit authority security who've gone full authoritarian. Armed with a baton and riot shield, they block frontal attacks and require flanking or shield-breaking to defeat. The first true "tactics required" enemy.

| Stat | Value |
|------|-------|
| HP | 45 |
| Damage | 12 (baton), 6 (shield bash — knockback) |
| Attack Speed | 1.2/sec (baton), shield bash every 5s |
| Move Speed | 0.7x (Medium-Slow) |
| Aggro Range | 18 blocks |
| Shield Block | 60% frontal damage reduction |
| Behavior | **Tank (Shield)** |
| Drops | Scrap (12-18), 8% Dumpster Lid, 5% Energy Drink |

**AI Behavior — Tank (Shield):**
- Patrols near MARTA stations and transit infrastructure
- Always faces the player and advances with shield raised (60% frontal DR)
- Primary attack: baton swing around shield edge (12 dmg). Shield stays up during attack
- Shield bash (every 5s): lunges forward, bashes with shield (6 dmg + 4-block knockback)
- **Shield can be broken:** After taking 30 cumulative damage to the shield, it shatters. Security becomes vulnerable and panicked (attacks faster but no longer blocks)
- Alternative: hit from behind — no shield protection on flanks or rear
- Pipe Bombs and explosives bypass the shield entirely
- If another enemy hits the Security from behind, the Security will briefly turn to face that direction (exploitable)
- Calls for backup if other MARTA Security are within 20 blocks — they aggro simultaneously

**Visual:** MARTA transit police uniform — navy blue, badge, cap. Riot shield with MARTA logo. Baton in dominant hand. Stern expression. When shield breaks, visible panic face.

---

### 4.4 Crane Drone
> *"ALERT: UNAUTHORIZED PEDESTRIAN IN CONSTRUCTION ZONE"*

An autonomous construction survey drone repurposed as security. Flies above the player, dropping heavy debris (concrete blocks, rebar bundles) from above. The first aerial threat — melee weapons can't reach it at full altitude.

| Stat | Value |
|------|-------|
| HP | 30 |
| Damage | 12 (debris drop), 6 (dive attack) |
| Attack Speed | Drop every 4s, dive every 10s |
| Move Speed | 1.0x (hovering) |
| Flight Height | 6-10 blocks above ground |
| Aggro Range | 20 blocks |
| Behavior | **Ranged (Aerial)** |
| Drops | Scrap (10-15), 8% Battery, 5% Scrap Metal |

**AI Behavior — Ranged (Aerial):**
- Hovers 6-10 blocks above ground. Patrols in circular patterns over construction zones
- When player enters aggro range, tracks them from above and drops debris every 4s
- Debris drop: 1s shadow telegraph on the ground (visible dark circle), then block falls. 12 dmg + block destruction on impact
- Dive attack (every 10s): swoops down to 2 blocks above player height, slashes with rotor blades (6 dmg), then ascends back up. This is the melee vulnerability window
- Can be hit with ranged weapons at any time (Nail Gun, Concrete Launcher, thrown items)
- Can be hit with melee weapons ONLY during dive attacks (2s window)
- If player is indoors/under cover, drone circles the entrance and waits
- Grapple Hook can pull the drone down to melee range (stuns it for 2s)
- Destroyed drones crash into the ground, dealing 8 dmg AoE at impact point

**Visual:** Small quadcopter drone with construction company branding. Blinking red lights. Cargo claws underneath holding debris. When diving, rotors glow orange. Smoke trail when damaged.

---

## 5. Boss Enemies

Three mandatory zone-gate bosses. Each guards the transition to the next zone (or the end of the game). Bosses have multiple phases, unique mechanics, and guaranteed loot.

### 5.1 Highway Boss: Big Rig Bertha
> *"CONVOY COMIN' THROUGH! GET OFF MY ROAD!"*

A massive 18-wheeler whose driver has completely lost it. The truck itself is the boss — you fight it in a wide-open highway interchange arena. This is the player's first real test: can they dodge, damage, and adapt?

| Stat | Value |
|------|-------|
| HP | 150 |
| Damage | 18 (charge ram), 8 (trailer debris), 10 (Road Rager adds) |
| Move Speed | 2.5x (charging), 0.3x (turning) |
| Arena | Highway interchange — open area with wrecked cars as cover |
| Behavior | **Multi-phase boss** |
| Drops | 50 Scrap, Sledgehammer (guaranteed), Energy Drink x2 |

**Phase 1 (150-100 HP) — "THE CHARGE":**
- Big Rig drives in large figure-8 pattern around the arena
- Every 8s: targets the player and charges in a straight line (18 dmg, instant kill if player is at starting gear)
- Charge is heavily telegraphed: horn blast (2s), headlights flash, engine revs
- After each charge, truck skids to a stop (3s vulnerability window) — attack the cab or tires
- Wrecked cars in the arena serve as cover — the truck destroys them on impact, creating debris and opening new lanes
- Weak point: the tires. Each tire destroyed (4 tires, 20 HP each) reduces the truck's charge speed by 15%

**Phase 2 (100-50 HP) — "OPEN TRAILER":**
- Trailer doors burst open. While charging, the trailer spills Road Ragers (2 per charge, max 4 alive)
- Road Ragers are standard highway enemies but provide pressure during the dodge phase
- Truck also begins swerving during charges — less predictable path
- Debris flies from the trailer during movement (8 dmg, random spread)

**Phase 3 (50-0 HP) — "JACKKNIFE":**
- Truck starts jackknifing during charges — trailer swings wide in the turn, covering more area
- Charge speed increases by 25%
- The cab is now partially exposed (driver visible, yelling) — headshots deal 2x damage
- At 0 HP: cinematic jackknife. Truck flips, slides across the arena, and crashes into the zone exit barrier, clearing the path to the Underground

**Strategy:** Use wrecked cars as cover during charges. Attack during the post-charge skid. Take out tires to slow it down. Kill Road Rager adds between charges. Ranged weapons can chip damage during movement.

---

### 5.2 Underground Boss: King Gator
> *"The legends were true. The Atlanta Sewer Gator is real. And it is NOT happy to see you."*

A massive mutant alligator that rules the deepest part of the sewer system. The arena is a flooded chamber with raised platforms — water is the gator's domain, dry land is yours. Multi-phase fight that tests spacing, timing, and resource management.

| Stat | Value |
|------|-------|
| HP | 300 |
| Damage | 20 (lunge), 15 (bite), 12 (tail sweep AoE), 25 (death roll) |
| Move Speed | 0.3x (land), 2.0x (water) |
| Arena | Flooded sewer chamber — central pool with 4 raised stone platforms |
| Behavior | **Multi-phase boss** |
| Drops | 75 Scrap, Sweet Tea Jug (full heal), Electric Cable Whip recipe |

**Phase 1 (300-200 HP) — "THE LURKER":**
- King Gator circles in the central pool. Only its eyes and back ridges are visible
- Every 6s: lunges onto a random platform (20 dmg if player is on it). 1.5s telegraph — water bubbles violently near target platform
- After lunging, stays on platform for 4s to bite (15 dmg) — this is the damage window
- Returns to water after 4s. Player must jump between platforms to stay safe
- Destroying platform edges with weapons can change the geography

**Phase 2 (200-100 HP) — "SURFACED":**
- King Gator is too injured to fully submerge. Stays partially surfaced with back exposed
- Begins circling the platforms and attacking from the water's edge
- New attack: tail sweep (12 dmg AoE) — sweeps its tail across a platform, hitting everything on it. 1s wind-up
- Summons Sewer Rats (pack of 3) every 20s — they swim to platforms and attack the player
- Now vulnerable to ranged attacks while circling (back is exposed target)
- Takes 50% reduced damage from frontal attacks (armored head)

**Phase 3 (100-0 HP) — "DEATH ROLL":**
- King Gator goes berserk. Climbs fully onto the largest platform
- New attack: death roll (25 dmg) — grabs at the player, if it connects, ragdolls them for massive damage. 2s telegraph (snaps jaws twice before lunging)
- Moves faster on land than before (0.6x instead of 0.3x)
- No more rat summons — it's a pure 1v1 DPS race
- Tail sweep now destroys blocks on the platform — the arena shrinks
- At 0 HP: collapses, revealing a passage in the floor beneath it that leads to the Street zone

**Strategy:** Stay on platforms. Learn the lunge telegraph. Attack during the 4s land window in Phase 1. Use ranged weapons during Phase 2 when it surfaces. In Phase 3, dodge the death roll and burn it down before the platform crumbles. Electric weapons deal bonus damage (water + electricity).

---

### 5.3 Street Boss: The Foreman
> *"THIS IS A HARD HAT AREA! AND I'M THE HARDEST HAT HERE!"*

The final boss. A construction site foreman piloting a jury-rigged construction mech — a walking crane/excavator hybrid armored with concrete blocks and rebar. The fight takes place in a multi-level construction site with scaffolding, girders, and demolition equipment.

| Stat | Value |
|------|-------|
| HP | 500 |
| Damage | 25 (wrecking ball), 18 (crane grab), 15 (concrete rain AoE), 30 (overtime slam) |
| Move Speed | 0.4x |
| Arena | Multi-level construction site — ground floor, scaffolding, crane platform |
| Behavior | **Multi-phase boss** |
| Drops | 100 Scrap, Construction Saw (guaranteed), MARTA Riot Gear |

**Phase 1 (500-350 HP) — "DEMOLITION":**
- The Foreman stomps around ground level in the mech
- Primary attack: wrecking ball swing (25 dmg) — the mech's crane arm swings a wrecking ball in a 4-block radius arc. 1.5s windup
- Wrecking ball destroys any blocks it hits — scaffolding, walls, cover
- Secondary attack: concrete rain (15 dmg AoE) — drops concrete blocks from the crane in a 5-block radius. 2s telegraph (shadow circles on ground)
- The mech is heavily armored from the front. Weak point: hydraulic lines on the back (orange tubes, 2x damage)
- Player should use scaffolding to get above or behind the mech

**Phase 2 (350-150 HP) — "CRANE GRAB":**
- Mech extends its crane arm to reach upper scaffolding levels
- New attack: crane grab (18 dmg) — the crane claw reaches up to grab the player, lifts them, and throws them. 2s telegraph (claw opens and targets). Can be dodged by jumping off scaffolding
- Begins pulling down scaffolding sections — the safe upper areas become smaller
- Every 30s: stomps the ground, collapsing any scaffolding the player is standing on (forces them to keep moving)
- Spawns 2 Construction Bots from the construction site entrance (max 2 alive at once)

**Phase 3 (150-0 HP) — "OVERTIME":**
- Foreman activates "overtime mode" — mech glows orange, steam vents, moves 50% faster
- All attacks deal +5 damage
- New attack: overtime slam (30 dmg) — leaps into the air and crashes down, destroying everything in a 6-block radius. 2.5s telegraph (mech crouches, hydraulics hiss). This is devastating but heavily telegraphed
- Arena is mostly destroyed at this point — fight is on open ground
- Mech's armor plates are falling off — no longer takes reduced frontal damage
- At 0 HP: mech explodes in a shower of voxel debris. Foreman ejects and lands in a dumpster. Camera pans to reveal the player's apartment building one block away. Path is clear.

**Strategy:** Use scaffolding for elevation advantage in Phase 1. Attack the hydraulic weak point. Dodge the crane grab in Phase 2 by staying mobile. In Phase 3, it's a raw combat test — everything the player has learned about dodging, timing, and managing health comes together. Use the best weapons and armor saved for this fight.

---

## 6. Complete Enemy Stat Table

### Regular Enemies

| Enemy | Zone | HP | Damage | Atk Spd | Move Spd | Aggro | Behavior | Scrap Drop |
|-------|------|----|--------|---------|----------|-------|----------|------------|
| Road Rager | Highway | 25 | 8 | 1.2/s | 0.8x | 12 | Chase | 3-8 |
| Coffee Tosser | Highway | 15 | 5+burn | 0.8/s | 0.5x | 16 | Ranged | 2-5 |
| Bumper Brawler | Highway | 35 | 14/6 | charge/4s | 2.0x/0.6x | 18 | Charge | 5-10 |
| Horn Honker | Highway | 20 | 4+KB | 1/3s | 0x | 14 | Area Denial | 3-6 |
| Sewer Rat | Underground | 10 | 4 | 2.0/s | 1.2x | 10 | Swarm (3-5) | 2-4 |
| Sewer Gator | Underground | 50 | 14/10/8 | 0.8/s | 0.4x/1.5x | 6/14 | Ambush | 10-15 |
| Mole Bot | Underground | 40 | 12/8 | 1.0/s | 0.6x/1.0x | 16 | Burrow | 8-12 |
| Drain Spider | Underground | 25 | 8+slow | 1.5/s | 1.0x | 12 | Hit-and-Run | 5-8 |
| Construction Bot | Street | 60 | 15/20 | 0.8/s | 0.5x | 16 | Tank | 15-20 |
| Stray Dog | Street | 20 | 10 | 2.0/s | 1.3x | 14 | Flanking (x2) | 5-10 |
| MARTA Security | Street | 45 | 12/6 | 1.2/s | 0.7x | 18 | Tank (Shield) | 12-18 |
| Crane Drone | Street | 30 | 12/6 | drop/4s | 1.0x | 20 | Ranged (Aerial) | 10-15 |

### Boss Enemies

| Boss | Zone | HP | Max Damage | Phases | Guaranteed Drops |
|------|------|----|-----------|--------|-----------------|
| Big Rig Bertha | Highway→Underground | 150 | 18 (charge) | 3 | 50 Scrap, Sledgehammer, Energy Drink x2 |
| King Gator | Underground→Street | 300 | 25 (death roll) | 3 | 75 Scrap, Sweet Tea Jug, Cable Whip recipe |
| The Foreman | Street→Apartment | 500 | 30 (overtime slam) | 3 | 100 Scrap, Construction Saw, MARTA Riot Gear |

---

## 7. AI Behavior Patterns

### Behavior Definitions

| Behavior | Description | Used By |
|----------|-------------|---------|
| **Chase** | Aggro on sight → sprint to melee range → attack combo → de-aggro at max distance | Road Rager |
| **Ranged** | Aggro on sight → maintain distance → fire projectiles → retreat if player closes | Coffee Tosser, Crane Drone |
| **Charge** | Aggro → telegraph (1-2s) → high-speed straight-line dash → recovery window | Bumper Brawler |
| **Area Denial** | Stationary → periodic AoE attack → forces player to approach from specific angles | Horn Honker |
| **Swarm** | Group aggro → surround target → stagger attacks → flee if last survivor | Sewer Rat |
| **Ambush** | Hidden → trigger on proximity → burst damage → transition to normal combat | Sewer Gator |
| **Burrow** | Surface patrol → dive underground → track target → emerge near target → surface combat → re-burrow | Mole Bot |
| **Hit-and-Run** | Ranged opener → close for quick melee → retreat to safety → repeat | Drain Spider |
| **Tank** | Slow advance → heavy attacks with telegraph → weak point on back → immune to stagger | Construction Bot |
| **Flanking Swarm** | Pairs coordinate → one engages front, one circles rear → enrage if partner dies | Stray Dog |
| **Tank (Shield)** | Shield raised → frontal DR → baton attacks around shield → shield breakable → panics when broken | MARTA Security |
| **Ranged (Aerial)** | Fly above → drop projectiles → occasional dive for melee → vulnerable during dive | Crane Drone |

### Shared AI Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Aggro memory | 10 seconds | Time enemy "remembers" player after line-of-sight breaks |
| De-aggro distance | 1.5x aggro range | Enemy gives up chase at this distance |
| Hurt stagger | 0.3s | Most enemies stagger briefly when hit (exceptions: Construction Bot, bosses) |
| Path recalculation | Every 0.5s | A* pathfinding update frequency while chasing |
| Stuck timeout | 3s | If enemy can't reach player for 3s, tries alternate path or de-aggros |
| Vertical awareness | 4 blocks | Enemies notice player up to 4 blocks above/below their Y level |
| Friendly fire | Off | Enemies don't damage each other (except Horn Honker knockback) |

### Detection System

| Detection Type | Used By | Notes |
|----------------|---------|-------|
| **Line-of-sight** | Most enemies | Standard vision cone, blocked by walls |
| **Proximity** | Sewer Gator, Sewer Rat | Triggers when player is within range, ignores walls |
| **Vibration** | Mole Bot | Detects player movement through blocks (ignores walls, blocked by air gaps) |
| **Sound** | Drain Spider | Detects player actions (mining, attacking) at extended range |

---

## 8. Difficulty Progression

### Enemy Power Curve vs. Player Power Curve

```
PLAYER DPS:  6 ──── 12 ──── 21-24 ──── 33-37
             │       │        │          │
ZONE:    HIGHWAY   (end)   UNDERGROUND  STREET
             │       │        │          │
ENEMY HP:  15-35  (boss 150) 10-50   (boss 300) 20-60  (boss 500)
ENEMY DMG:  4-14    (18)      4-14     (25)     10-20    (30)
```

### Time-to-Kill Reference (player vs. enemy)

| Matchup | Player Weapon | Enemy | TTK |
|---------|--------------|-------|-----|
| Early Highway | Fists (6 DPS) | Road Rager (25 HP) | 4.2s |
| Early Highway | Fists (6 DPS) | Coffee Tosser (15 HP) | 2.5s |
| Mid Highway | Tire Iron (12 DPS) | Bumper Brawler (35 HP) | 2.9s |
| Mid Highway | Tire Iron (12 DPS) | Road Rager (25 HP) | 2.1s |
| Early Underground | Rebar Sword (21 DPS) | Sewer Rat pack (10 HP each) | 0.5s each |
| Mid Underground | Rebar Sword (21 DPS) | Sewer Gator (50 HP) | 2.4s |
| Mid Underground | Rebar Sword (21 DPS) | Mole Bot (40 HP) | 1.9s |
| Early Street | Stop Sign Axe (36 DPS) | Construction Bot (60 HP) | 1.7s |
| Mid Street | Stop Sign Axe (36 DPS) | MARTA Security (45 HP) | 1.3s (flanked) |
| Late Street | Best gear (37+ DPS) | Crane Drone (30 HP) | 0.8s (if you can hit it) |

### Time-to-Kill Reference (enemy vs. player)

| Matchup | Enemy | Player HP/DR | Hits to Kill | Approx Time |
|---------|-------|-------------|-------------|-------------|
| Early Highway | Road Rager (8 dmg) | 100 HP, 0% DR | 13 hits | ~11s |
| Early Highway | 3x Road Ragers | 100 HP, 0% DR | ~4 hits each | ~4s |
| Mid Highway | Bumper Brawler charge (14 dmg) | 100 HP, 10% DR | 8 charges | ~32s (safe) |
| Mid Underground | Sewer Gator lunge (14 dmg) | 120 HP, 25% DR | 12 hits | ~15s |
| Mid Underground | 5x Sewer Rats (4 dmg each) | 120 HP, 25% DR | 40 total hits | ~10s (dangerous!) |
| Late Street | Construction Bot (15 dmg) | 140 HP, 35% DR | 15 hits | ~19s |
| Late Street | Stray Dog pair (10 dmg each) | 140 HP, 35% DR | 22 total hits | ~6s (very fast!) |

### Encounter Design Guidelines

| Zone | Solo Enemy Feel | Group Encounter Feel | Notes |
|------|----------------|---------------------|-------|
| Highway | Easy — player is learning | Moderate — 2-3 enemies | Groups of 2-3 are common. Bumper Brawler always solo |
| Underground | Moderate — each enemy has a gimmick | Hard — mixed enemy types | Rat pack + Gator ambush = deadly combo |
| Street | Hard — requires tactics | Very Hard — use all tools | MARTA Security + Stray Dogs = shield + flank nightmare |

---

## 9. Spawning & Respawn Rules

### Spawn Rules
- Enemies spawn at predefined points within each zone (handcrafted placement)
- Spawn points have a type (which enemy) and an optional group size
- Enemies are active when the player's chunk + adjacent chunks are loaded
- Enemies beyond loaded chunks are "frozen" — they don't consume CPU

### Respawn Rules
| Rule | Value | Notes |
|------|-------|-------|
| Respawn trigger | Player moves 3+ chunks from spawn point | Distance-based, not timer-based |
| Respawn cooldown | 60 seconds after trigger | Prevents instant respawn on backtrack |
| Boss respawn | **Never** | Bosses are one-time encounters |
| Rat pack respawn | Full pack respawns together | Individual rat deaths don't trigger partial respawn |
| Max active enemies | 12 per loaded area | Performance budget. Oldest/farthest despawn first |

### Spawn Density by Zone

| Zone | Enemies per chunk | Encounters per minute (walking pace) |
|------|-------------------|-------------------------------------|
| Highway | 2-3 spawn points | ~1 encounter every 30s |
| Underground | 3-4 spawn points | ~1 encounter every 20s |
| Street | 3-5 spawn points | ~1 encounter every 15s |

---

## 10. Special Interactions

### Environmental Interactions
| Interaction | Effect |
|-------------|--------|
| Knock enemy into traffic (Highway) | Moving cars deal 20 dmg to enemies pushed into them |
| Lure enemy into Horn Honker blast | Knockback affects enemies too |
| Mole Bot tunnels | Can be used as shortcuts by the player |
| Sewer Gator in dry areas | Gator moves at 0.4x and cannot ambush — much easier |
| Drop blocks on enemies | Falling voxels deal damage based on fall distance (2 dmg per block fallen) |
| Crane Drone crash | Destroyed drone deals 8 AoE dmg — lure it near other enemies |
| MARTA Security friendly fire | Shield bash knocks back ALL characters in range |

### Weapon Effectiveness Bonuses
| Weapon Effect | Bonus Against | Rationale |
|---------------|--------------|-----------|
| Fire (Road Flare, Flare Gun) | Sewer Rat, Drain Spider | +50% damage. Bugs and rats hate fire |
| Electric (Cable Whip) | Sewer Gator, Mole Bot | +50% damage. Water conducts, bots short-circuit |
| AoE (Pipe Bomb, ground slam) | Sewer Rat pack, Stray Dog pair | Hits multiple targets |
| Knockback (Traffic Light Flail) | Stray Dog, Road Rager | Pushes them away, breaks flank formation |
| Mining weapons (Jackhammer) | Mole Bot | Can dig after them or collapse their tunnels |

---

## Appendix: Enemy Index

**Total unique enemy types: 15** (12 regular + 3 bosses)

| # | Enemy | Zone | Role | HP | Primary Damage |
|---|-------|------|------|----|---------------|
| 1 | Road Rager | Highway | Melee/Chase | 25 | 8 |
| 2 | Coffee Tosser | Highway | Ranged | 15 | 5+burn |
| 3 | Bumper Brawler | Highway | Charger | 35 | 14 |
| 4 | Horn Honker | Highway | Area Denial | 20 | 4+KB |
| 5 | Sewer Rat | Underground | Swarm | 10 (x3-5) | 4 |
| 6 | Sewer Gator | Underground | Ambush | 50 | 14 |
| 7 | Mole Bot | Underground | Burrow | 40 | 12 |
| 8 | Drain Spider | Underground | Hit-and-Run | 25 | 8+slow |
| 9 | Construction Bot | Street | Tank | 60 | 15 |
| 10 | Stray Dog | Street | Flanking | 20 (x2) | 10 |
| 11 | MARTA Security | Street | Tank (Shield) | 45 | 12 |
| 12 | Crane Drone | Street | Aerial Ranged | 30 | 12 |
| 13 | **Big Rig Bertha** | Highway Boss | Multi-phase | 150 | 18 |
| 14 | **King Gator** | Underground Boss | Multi-phase | 300 | 25 |
| 15 | **The Foreman** | Street Boss | Multi-phase | 500 | 30 |
