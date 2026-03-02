# Voxel Traffic Escape — Game Design Document (GDD)

> **Task:** task_VTE_001
> **Version:** 1.0
> **Date:** 2026-02-28
> **Status:** Foundational — north star for all development decisions

---

## Elevator Pitch

**Voxel Traffic Escape** is a comedic voxel destruction-survival game where you play as an Atlanta commuter who's had enough. Stuck in the worst gridlock on the planet, you abandon your car and fight your way home on foot — smashing through traffic, tunneling under highways, battling road-raging NPCs, and demolishing everything in your path across a fully destructible voxel Atlanta. It's Teardown meets Crossy Road meets the worst commute of your life.

---

## 1. Game Concept

### The Hook
You're trapped in Atlanta traffic. It's Friday at 5 PM. You're on Spaghetti Junction. Your GPS says "3 hours to destination." Your destination is 4 miles away. You snap.

You get out of the car. You're going home — through whatever's in your way.

### The Core Fantasy
The power fantasy of every frustrated commuter: destroying the traffic that traps you. Smash cars. Tunnel through highway overpasses. Swing a tire iron at road-raging NPCs. Build bridges over collapsed highways. Every block in the world is destructible, and every block between you and home is a personal insult.

### Genre
Action-survival with voxel destruction, light crafting, and comedic tone. Not a sandbox — there's a clear goal (get home) and a clear ending (your apartment).

### Tone
**Satirical comedy with escalating absurdity.** The game starts grounded in the real frustrations of Atlanta traffic (construction zones, confusing Peachtree signs, aggressive drivers) and escalates to full voxel chaos (highway collapses, MARTA trains jumping tracks, Waffle House as a fortified rest stop). Think: the "Rules of Driving in Atlanta" viral post became a playable game.

Loading screen tips are actual Atlanta driving memes:
- "The morning rush hour is from 5:00 AM to noon. The evening rush hour is from noon to 7:00 PM."
- "Friday's rush hour starts on Thursday morning."
- "If you get lost, look for a road named Peachtree. You are now somewhere in Atlanta."

---

## 2. Core Gameplay Pillars

These are the 5 non-negotiable principles that every design decision must support. If a feature doesn't serve at least one pillar, it doesn't belong in the game.

### Pillar 1: Total Destruction
Every block in the world is destructible. There is no invisible wall. If you can see it, you can break it. Cars, highways, buildings, signs, guardrails — everything shatters into satisfying voxel debris. Destruction isn't just cosmetic; it's the primary traversal and combat mechanic. Can't get past a traffic jam? Dig under it. Building in your way? Punch through it. This is the Teardown promise applied to an entire city.

### Pillar 2: The Commute From Hell
The game has a clear, relatable goal: get home. Every player understands the frustration of being stuck in traffic. The entire journey — from Spaghetti Junction to your apartment — is one continuous, escalating commute. There's no open-world aimlessness. You're always moving forward (or sideways, or underground), always getting closer to home. The world pulls you through it.

### Pillar 3: Atlanta Is the Character
The game isn't set in a generic city — it's set in Atlanta, and it leans hard into that identity. Spaghetti Junction, the 71 Peachtree Streets, Waffle House rest stops, MARTA trains, The Varsity, the perpetual construction — these aren't just set dressing, they're gameplay mechanics. The city's real absurdities are funnier than anything we could invent. This specificity is the game's moat: no competitor can replicate "the Atlanta traffic game."

### Pillar 4: Accessible Chaos
The game should be immediately fun. No 20-minute tutorial. No complex crafting trees to memorize. You punch a car, it explodes, blocks fly everywhere, you grab a tire iron, you keep moving. Depth comes from mastering destruction physics, finding creative routes, and discovering better loot — not from gating content behind systems. A casual player should be laughing within 30 seconds. A dedicated player should still be finding new routes and strategies after 10 hours.

### Pillar 5: Shareable Moments
Every session should produce a clip worth sharing. A highway overpass collapsing onto a traffic jam. A player speedrunning through a Waffle House. A perfectly timed MARTA train dodge. The voxel destruction + comedic tone + recognizable locations create inherently viral content. Design every zone to have at least one "did you see that?" moment.

---

## 3. Target Audience

### Primary Audience
| Segment | Age | Why They Play | Size |
|---------|-----|---------------|------|
| **Atlanta locals & diaspora** | 18-45 | Cultural recognition, catharsis, "I've BEEN on that highway" | ~6M metro + large diaspora |
| **Voxel/indie game fans** | 16-30 | Teardown/Minecraft/Crossy Road audience, love destruction physics | Tens of millions |
| **Comedy game fans** | 16-28 | Goat Simulator/Untitled Goose Game crowd, buy games for the laughs | 2.5M+ (Goat Sim sales alone) |

### Secondary Audience
| Segment | Why They Play |
|---------|---------------|
| **Southern US commuters** | Every Southern city has its own traffic hell. Universal relatability |
| **Content creators/streamers** | Destruction + comedy + recognizable locations = great clip content |
| **College students (GA Tech, Emory, etc.)** | Meme-savvy, know Atlanta traffic intimately, strong word-of-mouth |

### Age Rating
**Teen (T) / PEGI 12.** Comedic cartoon violence — voxel characters ragdoll, no blood or gore. Think Lego-style destruction. Mild language in NPC dialogue (road rage quips). No drugs, alcohol, or sexual content. The voxel aesthetic naturally keeps violence lighthearted.

### Player Profile
The core player is 18-30, comfortable with indie games, appreciates humor and memes, plays on PC (Steam) or browser. They don't need to know Atlanta to enjoy the game, but knowing Atlanta makes it 10x funnier.

---

## 4. Target Platforms

### Primary Platform: Web Browser (PC)
- **Engine:** Three.js + TypeScript + WebGPU (WebGL 2 fallback)
- **Why web-first:**
  - Zero friction — click a link, start playing. No download, no install
  - WebGPU reached ~95% browser coverage in late 2025 (Chrome, Firefox, Safari 26, Edge)
  - Matches existing tech stack knowledge (TypeScript, Next.js ecosystem)
  - Enables the itch.io pipeline: free browser demo → community → Steam wishlist → paid release
  - No commercially successful, polished browser voxel game exists yet — wide open space
  - Viral potential: someone shares a link, recipient is playing in 5 seconds

### Secondary Platform: Steam (PC)
- **Why Steam second:**
  - The itch.io-to-Steam pipeline is a proven indie strategy (see: The Roottrees Are Dead, NIMRODS)
  - Steam's discoverability and wishlist system drive paid sales
  - Modding support via Steam Workshop extends game life
  - Web demo serves as a free marketing funnel for Steam purchases
  - Target price: $10-15 (Early Access), $15-20 (Full Release)

### Deferred Platforms (Post-v1.0)
- **Mobile (iOS/Android):** The Crossy Road comparison suggests mass casual appeal. Consider after Steam launch if traction justifies the port effort
- **Nintendo Switch:** The Untitled Goose Game demographic lives here. Consider after proving the concept on PC

### Not Planned
- **PlayStation/Xbox:** Too much overhead for a solo dev. Revisit only if the game breaks out
- **Multiplayer:** Solo-only for v1. Architecture should not preclude co-op later, but it is explicitly out of scope for MVP

---

## 5. MVP Scope

### What's IN the MVP (v1.0)

| Feature | Description |
|---------|-------------|
| **3 zones** | Highway → Underground/Sewers → Streets/Apartment. Linear progression with light branching |
| **Full voxel destruction** | Every block breakable. Greedy meshing, chunk system, debris physics |
| **8+ enemy types** | Road ragers, construction workers, MARTA security, sewer creatures, etc. One boss per zone |
| **15+ weapons/items** | Melee (tire iron, antenna) + ranged (traffic cone launcher) + utility. Atlanta-themed throughout |
| **Simple crafting** | Combine 2-3 items anywhere. No workbenches. ~10 recipes |
| **Hotbar + grid inventory** | Familiar Minecraft/Terraria pattern |
| **Health + checkpoint system** | Health bar, Waffle House rest stops as checkpoints |
| **Win condition** | Reach your apartment. Clear ending with credits |
| **Loading screen tips** | Atlanta traffic memes and "Rules of Driving in Atlanta" jokes |
| **Speedrun timer** | Optional timer for replayability |
| **Settings** | Graphics quality, audio, controls, FOV |

### What's OUT of MVP (Stretch Goals / Post-Launch)

| Feature | Why Deferred |
|---------|-------------|
| **Additional zones (4-6 total)** | More Atlanta neighborhoods: Buckhead, Midtown, Little Five Points |
| **Multiplayer/co-op** | Architectural complexity too high for v1 solo dev |
| **Procedural generation** | Handcrafted zones are higher quality for MVP; procedural adds replayability later |
| **Vehicle mechanics** | Driving through destruction would be amazing but doubles the physics scope |
| **Boss rush mode** | Post-launch content after all bosses are designed and tested |
| **Level editor** | Community content creation — ideal for Steam Workshop |
| **Mobile port** | Separate optimization pass and touch controls |
| **Leaderboards** | Online leaderboards for speedrun times |
| **New Game+** | Harder difficulty with remixed enemy placement |
| **Soundtrack** | Atlanta hip-hop/trap inspired original music (MVP uses royalty-free or generated) |

### Scope Boundaries (Hard Rules)
1. **No open world.** The game is a directed journey with a beginning and an end. Exploration happens within zones, not between them.
2. **No multiplayer in v1.** Period. This is the single biggest scope trap for indie games.
3. **No procedural world generation in v1.** Handcrafted zones ensure quality and allow for scripted "shareable moments."
4. **No story cutscenes.** Story is told through environment, item descriptions, and loading screen tips.
5. **Target playtime: 2-4 hours** for a first playthrough. Short enough to finish in one session, long enough to feel substantial.
6. **3 zones maximum.** Each zone should be polished and dense rather than sprawling and empty.

---

## 6. Competitive Positioning

### Why This Game Can Win

| Advantage | Detail |
|-----------|--------|
| **Unoccupied niche** | No game combines voxel destruction + urban traffic escape + city-specific satire. Teardown does destruction. Crossy Road does traffic. Goat Sim does comedy. Nobody does all three |
| **Browser-first** | No commercially successful, polished browser voxel game exists. WebGPU makes this technically viable as of 2025 |
| **Built-in virality** | Atlanta traffic memes already have millions of views. The game converts existing meme culture into playable content |
| **Cultural specificity as moat** | "The Atlanta traffic game" is an identity no competitor can replicate |
| **Solo dev viable** | Teardown was built by essentially one developer and earned $60M+. Voxel games have a strong solo-dev track record |

### Key Risks

| Risk | Mitigation |
|------|------------|
| **Voxel performance in browser** | Start with smaller chunks, lower view distance. Profile early. WebGPU compute shaders for meshing |
| **"Just another Minecraft clone" perception** | Strong visual identity (urban, not nature). Comedic tone. Clear goal (get home, not sandbox) |
| **Solo dev burnout** | Ruthless MVP scope. 3 zones, not 6. Ship a short, polished game over a long, broken one |
| **Atlanta-specific = niche?** | The Atlanta hook gets attention; the destruction gameplay keeps players. You don't need to know Atlanta to enjoy smashing a highway |

---

## 7. Technical Direction

### Engine: Three.js + TypeScript
- Largest voxel-specific ecosystem (tutorials, open-source engines, community)
- WebGPU production-ready since Three.js r171 (Sept 2025) with automatic WebGL 2 fallback
- Smallest bundle size of the three major options (tree-shakeable)
- Maximum control over custom chunk management, meshing, and LOD
- React Three Fiber available if UI layer benefits from React

### Core Architecture
- **Chunk-based world:** 32x32x32 voxel chunks
- **Greedy meshing:** Merge adjacent same-type faces for efficient rendering
- **Web Workers:** Off-thread chunk generation and meshing
- **Frustum + occlusion culling:** Only render visible chunks and faces
- **Simple rigid-body physics:** For debris, falling blocks, ragdolls

### Performance Targets
- 60fps at 1080p on mid-range hardware (GTX 1060 / integrated GPU equivalent)
- 30fps minimum on low-end hardware with reduced settings
- <5 second initial load time in browser
- <50MB total download size for web build

---

## 8. Go-To-Market Strategy

### Phase 1: Free Browser Demo (itch.io + own site)
- Playable demo: Zone 1 (Highway) only
- Zero barrier to play — click link, start smashing
- Validate the core loop: is the destruction fun? Is the comedy landing?
- Gather feedback, build community

### Phase 2: Community Building
- Share clips on TikTok, Reddit (r/Atlanta, r/indiegaming, r/webgames)
- Leverage existing Atlanta traffic meme culture
- Engage with every comment and suggestion
- Let streamers and the itch.io algorithm discover it

### Phase 3: Steam Early Access
- Full 3-zone game, $10-15
- Convert web demo players into purchasers
- Steam Workshop for community mods
- Continue updates based on community feedback

### Phase 4: Full Release
- $15-20 price point
- All zones polished, additional content from Early Access feedback
- Consider DLC or expansion packs if the game finds an audience

---

## 9. Design Decisions Log

These are the key design questions from the task notes, answered with rationale.

| Question | Decision | Rationale |
|----------|----------|-----------|
| **Perspective** | **First-person (Minecraft-style)** | First-person maximizes the visceral satisfaction of destruction. You FEEL the highway collapsing around you. Side-scrollers can't match the "in the chaos" feeling. Also simpler camera system for a solo dev |
| **Platform** | **Browser-first (Three.js + WebGPU)** | Zero-friction distribution, unoccupied market space, matches existing tech stack. Steam as secondary platform via itch.io pipeline |
| **Multiplayer** | **Solo-only for v1** | Hard scope boundary. Architecture should use ECS patterns that don't preclude future networking, but no multiplayer code in MVP |
| **Tone** | **Comedic/satirical** | The subject matter is inherently absurd. Voxel art signals playfulness. Comedy + destruction = viral clips. Proven by Goat Sim ($12M+), Untitled Goose Game (1M+ in 2 months) |

---

## 10. Success Metrics

| Metric | Target | Timeframe |
|--------|--------|-----------|
| Web demo plays | 10,000+ | First 3 months |
| Steam wishlists (pre-EA) | 5,000+ | Before Early Access |
| Steam Early Access sales | 1,000+ copies | First month |
| Steam reviews | 50+ reviews, 80%+ positive | First 3 months on Steam |
| Average playtime | 2+ hours | Ongoing |
| TikTok/YouTube clips | 50+ organic clips | First 6 months |

---

## Appendix A: Atlanta Content Reference

### Landmarks for Level Design
- Spaghetti Junction (Tom Moreland Interchange) — 300K vehicles/day
- The Downtown Connector (I-75/I-85 merge) — 243K vehicles/day
- I-285 "The Perimeter" — 64-mile loop, "nation's deadliest interstate"
- The Grady Curve — notorious tight curve, constant accidents
- Underground Atlanta — literal underground city, perfect for sewer/tunnel zone
- Waffle House — 2,000 locations, 24/7, the Southern institution (rest stops)
- The Varsity — world's largest drive-in (vehicle/upgrade station)
- MARTA stations — alternative routes, train-dodge obstacles
- 71 Peachtree Streets — navigation puzzle mechanic

### Real Atlanta Traffic Facts (Loading Screen Material)
- Drivers lose 75-87 hours/year to traffic
- Total metro congestion: 261M+ hours lost annually
- Economic cost: $7 billion/year, ~$2,000 per commuter
- The I-85 bridge literally collapsed from a fire in 2017 (zero injuries, rebuilt in 6 weeks)
- Average commute: 32.15 minutes (5th highest nationally)

### Cultural Touchpoints
- Outkast referenced Spaghetti Junction on *Stankonia*
- Atlanta hip-hop/trap scene gives the city massive cultural cachet
- The "Rules of Driving in Atlanta" viral post
- TikTok Atlanta traffic content has millions of views

---

## Appendix B: Competitive Landscape Summary

| Game | Relevance | Sales |
|------|-----------|-------|
| Minecraft | Voxel benchmark, sandbox | 325M+ copies |
| Terraria | 2D voxel survival, content depth | 23.8M+ (Steam) |
| Teardown | Voxel destruction, solo dev success | $60M+ revenue |
| Deep Rock Galactic | Voxel co-op, destructible terrain | 8M+ copies |
| Crossy Road | Voxel + traffic + humor | 200M+ downloads |
| Goat Simulator | Comedy destruction sandbox | 2.5M+ copies |
| Untitled Goose Game | Comedy + viral premise | 1M+ in 2 months |
| Voxel Turf | Urban voxel action (closest comp) | Small but loyal following |

**Key insight:** The intersection of voxel destruction + urban traffic + comedy is completely unoccupied.

---

*This document is the north star for Voxel Traffic Escape. Every design decision, feature request, and scope discussion should be evaluated against the 5 gameplay pillars and the MVP scope boundaries defined here.*
