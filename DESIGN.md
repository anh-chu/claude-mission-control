# CCMC Redesign: Design System & Token Registry

## 1. Philosophy

Mistral UI warm, European. Sunset vibes, not sterile blue tech. Every surface glows. Backgrounds fade cream to amber. Shadows carry golden undertones. Signature orange (`#fa520f`) burns like signal fire.

Maximalist warmth, minimalist structure. Huge display headlines. Aggressive negative tracking. Typography uses Arial at extreme sizes. Raw, unadorned voice. "We build frontier AI," no decoration needed.

Complete commitment to warm temperature. Gradient system: yellow (`#ffd900`) to burnt orange. Warm amber-tinted blacks for shadow. Dramatic landscape photography. Less tech company, more European luxury brand.

## 2. Token Registry

### Color
Light surfaces tier by *both* lightness and chroma: each lift drops saturation toward white. Dark surfaces tier by lightness alone (warm-brown base, lighter = elevated).

| Role | Variable | Light Value | Dark Value | Notes |
|---|---|---|---|---|
| Page Bg | `--background` | `#fdecbe` | `#1f1916` | Foundation canvas (deep honey-cream base, L=88) |
| Surface | `--card` | `#fff7df` | `#2a2218` | Cards, panels (mid tier, L=92) |
| Muted Surface | `--muted` | `#fdf5d4` | `#2f2820` | Empty/disabled states, header strips (L=95) |
| Secondary | `--secondary` | `#fff8e7` | `#3d2f22` | Inputs, buttons, lifted interactive surfaces (L=96). Sits between `--card` (92) and pure white so textareas inside cards still read as lifted, without going clinical-paper against the bare canvas. |
| Popover | `--popover` | `#ffffff` | `#473828` | Apex tier — modals, dropdowns (L=100 light / 23 dark, sits above `--secondary` so the inverse-by-lightness ladder holds) |
| Sidebar Bg | `--sidebar-background` | `#f4db9a` | `#251c12` | Structural chrome, parallel to bg (sunshine-yellow) |
| Text Base | `--foreground` | `#1f1f1f` | `#fffaeb` | Primary text |
| Text Muted | `--muted-foreground` | `hsl(0, 0%, 24%)` | `hsl(35, 18%, 60%)` | Secondary text |
| Border | `--border` | `#dfcc9f` | `hsl(28, 18%, 22%)` | Structural dividers (warm taupe) |
| Input Border| `--input` | `hsl(40, 25%, 80%)` | `hsl(28, 15%, 20%)` | Form borders |
| Primary Action| `--primary` | `#1f1f1f` | `#fa520f` | Main CTA bg |
| Primary Text| `--primary-foreground`| `#ffffff` | `#ffffff` | Main CTA text |
| Accent | `--accent` | `#fa520f` | `#fa520f` | Brand focus / active states |
| Warning | `--warning` | `#ffa110` | `#ffa110` | Warning fill (badges, status pills) |
| Destructive | `--destructive` | `#dc2626` | `#ef4444` | Danger actions |

#### Soft Semantic Tokens
Pre-mixed solid tints for state highlights, icon halos, status blocks, drag-over indicators. **Always solid hex values — never opacity-derived.** Use these instead of `bg-{color}/N`.

| Role | Variable | Tailwind | Light Value | Dark Value | Use For |
|---|---|---|---|---|---|
| Accent Soft | `--accent-soft` | `bg-accent-soft` | `#fbd9b4` | `#61331d` | Active state, icon halos, daemon-running highlights |
| Primary Soft | `--primary-soft` | `bg-primary-soft` | `#e8dcc4` | `#453c35` | Drag-over zones, board drop targets, primary halos |
| Success Soft | `--success-soft` | `bg-success-soft` | `#c4e8c8` | `#235233` | Success blocks, completed indicators |
| Destructive Soft| `--destructive-soft`| `bg-destructive-soft`| `#f5c4c4` | `#78212b` | Error blocks, error message boxes, DO status pills |
| Warning Soft | `--warning-soft` | `bg-warning-soft` | `#ffe8a8` | `#634b22` | Warning panels, scheduled-status indicators |
| Warning Ink  | `--warning-ink`  | `text-warning-ink`   | `#a85800` | `#ffa110` | Amber text/icon on light surfaces (Thinking, tool calls). Light mode uses deepened amber for AA on cream. |
| Quadrant Do Soft | `--quadrant-do-soft` | `bg-quadrant-do-soft` | `#fbd9b4` | `#702f1f` | Eisenhower DO halos |
| Quadrant Schedule Soft | `--quadrant-schedule-soft` | `bg-quadrant-schedule-soft` | `#ffd9a0` | `#755615` | Eisenhower SCHEDULE halos |
| Quadrant Delegate Soft | `--quadrant-delegate-soft` | `bg-quadrant-delegate-soft` | `#fdd9a8` | `#2f4f40` | Eisenhower DELEGATE halos |
| Quadrant Eliminate Soft| `--quadrant-eliminate-soft`| `bg-quadrant-eliminate-soft`| `#d8d0c4` | `#423e3b` | Eisenhower ELIMINATE halos |

#### Contrast Bar
Brand `#fa520f` and dark `--destructive` `#ef4444` against `#ffffff` measure ~3.4:1 and ~3.8:1 respectively. Both are evaluated against **WCAG 2.1 AA Large** (3:1 for graphical UI components and 18px+ / 14px+ bold text), not AA body (4.5:1). Buttons, badges, status pills, and icon glyphs sit on the Large bar. Never set `text-primary` or `text-destructive` for body paragraph copy on a white surface; use `--foreground` for body and reserve the brand reds/oranges for UI controls and icon strokes.

### Typography
- **Family**: `Arial, ui-sans-serif, system-ui`
- **Weight**: `400` globally. Hierarchy from size, not weight.
- **Scale**:
  - `text-display`: 82px / 1.00 / -2.05px tracking
  - `text-section`: 56px / 0.95 / tight tracking
  - `text-lg` (CardTitle/DialogTitle): 1.125rem / 1.20 / tight tracking
  - `text-sm` (Body): 0.875rem / 1.50 / normal
  - `text-xs` (Badge/Tip): 0.75rem / 1.50 / uppercase + wider tracking

### Spacing (8pt Base)
Strict 8pt scale for layout. 4pt for micro-adjustments.
- Micro: `p-0.5` (2px), `p-1` (4px)
- Tight: `p-2` (8px), `gap-2`
- Base: `p-4` (16px), `gap-4`
- Wide: `p-6` (24px) (Dialogs/Cards)
- Layout: `gap-8` (32px), `py-12` (48px)

### Radius
Near-zero rule. Architectural geometry.
- Base: `--radius: 0.125rem` (2px). Use `rounded-sm`.
- Card/Containers: `rounded-none`.
- Pills/Avatars: `rounded-full`.
- **Exception**: Nothing else. Kill `rounded-md`, `rounded-lg` (Audit 03-spacing: 15+ violations).

### Elevation
Map shadow + border + ring to semantic tiers. Use `shadow-e-{n}` utilities, never raw `shadow-sm/md/lg`.
| Tier | Name | Spec | Usage |
|---|---|---|---|
| `e-0` | Flat | `shadow-none` | Standard blocks, table rows |
| `e-1` | Input | `shadow-e-1` | Inputs, textareas, selects, switches |
| `e-2` | Card | `shadow-e-2` | Default in `Card` primitive — standalone cards on bg/muted surfaces |
| `e-3` | Pop | `shadow-e-3` | Hover-lifted cards, focused emphasis, task cards inside card-tier columns |
| `e-4` | Dialog | `shadow-e-4` | Dialogs, modals |
| `e-5` | Toast | `shadow-e-5` | High-priority alerts, toasts |
| `golden` | Dramatic | `shadow-golden` | Opt-in only — sidebar, dropdown, command, drag preview, hero project cards on hover |

*`shadow-e-*` in light is `rgba(127,99,21,x)` warm-brown multi-layer with white inset highlight. Dark is pure dark drop-shadow with subtle white inset. `shadow-golden` is the original 5-layer cone, reserved for elevated chrome where the dramatic look is intentional.*

**Var aliasing.** The `shadow-e-2/3/4/5` Tailwind utilities are var-backed in `tailwind.config.ts`:

| Tailwind utility | Backing CSS var |
|---|---|
| `shadow-e-2` | `--shadow-golden-card` |
| `shadow-e-3` | `--shadow-golden-pop` |
| `shadow-e-4` | `--shadow-golden-dialog` |
| `shadow-e-5` | `--shadow-golden-toast` |

The `--shadow-golden-{tier}` vars are redefined in `.dark` to drop the warm-brown rgba in favor of neutral black depth. The naming legacy (`golden-{tier}`) does not mean the value is the dramatic 5-layer ambient; it is just the token series that backs the e-tier utilities. The dramatic ambient is the separate `shadow-golden` utility, hardcoded directly in the Tailwind config (not var-backed) and overridden in `.dark` via the `.dark .shadow-golden` selector.

### Surface Hierarchy
Light mode mirrors dark mode's structural shape: each lift moves *upward* (lighter). Light additionally drops chroma toward white at the apex so tiers separate visually, not just by lightness.

| Tier | Token | Light (L) | Dark (L) | Role |
|---|---|---|---|---|
| Base | `--background` | `#fdecbe` (88) | `#1f1916` (10) | Recessive canvas |
| Card | `--card` | `#fff7df` (92) | `#2a2218` (13) | Cards, panels, content surfaces |
| Muted | `--muted` | `#fdf5d4` (95) | `#2f2820` (15) | Header strips, empty/disabled, subdued surfaces |
| Secondary | `--secondary` | `#fff8e7` (96) | `#3d2f22` (19) | Inputs, buttons, lifted interactive surfaces |
| Apex | `--popover` | `#ffffff` (100) | `#473828` (23) | Modals, dropdowns |

Sidebar (`#f4db9a` light / `#251c12` dark) sits *parallel* to this stack as warm structural chrome — not part of the elevation ladder.

**Rules**
- Inputs and textareas bind to `bg-secondary` so they sit on the warm-lifted interactive tier in both modes (avoids clinical pure white in light).
- Never use `bg-white` or `bg-black` directly. Use `bg-popover` for the apex surface.
- `bg-card` and `bg-background` are *different* elevation tiers — never use them interchangeably.
- Soft semantic tokens (`bg-accent-soft`, `bg-warning-soft`, etc.) are tuned to sit *below* `--card` (L ≈ 83–88) so tinted halos remain visible against the new card surface.

**Card-on-card elevation**
When a card sits inside another card-tier surface (e.g. task cards inside a kanban column), the default `shadow-e-2` collapses against the matching warm-cream backdrop. Opt the inner card up one tier: `shadow-e-3` default, `shadow-e-4` on hover and while dragging.

**Metadata chips**
Small in-card metadata (assignee, tags, project labels) uses `Badge variant="outline"` with `text-muted-foreground` and `border-border`, not the filled secondary variant. Filled chips read as chunky UI buttons against the lifted card surface; outline chips read as thin typographic labels and avoid the contrast war between chip fill and card fill.

**Interactive card hover**
Three tiers, applied by role. All transitions `transition-all` (slow duration). Resting shadow is whatever the surface tier dictates (Card primitive default = `shadow-e-2`, card-on-card = `shadow-e-3`). Hover adds the lift on top.

| Tier | Used for | Recipe |
|---|---|---|
| **Entity** | Cards that navigate to a detail page and represent a domain object (project, initiative, agent, task list row) | `group cursor-pointer border border-transparent transition-all hover:shadow-e-4 hover:border-primary/30 hover:-translate-y-0.5` |
| **Widget** | Dashboard CTA tiles, banners, summary cards, quadrant tiles | `cursor-pointer border border-transparent transition-all hover:shadow-e-3 hover:border-primary/30` (no translate) |
| **Dashed CTA** | "Create your first…" empty placeholders with `border-dashed` | `cursor-pointer hover:border-primary/30` (already has dashed border, only color tint changes) |
| **Draggable card-on-card** | Task cards inside kanban columns | `cursor-grab select-none border border-transparent transition-all shadow-e-3 hover:shadow-e-4 hover:border-primary/20` |

Draggable card-on-card is intentionally not the entity recipe. It rests at `shadow-e-3` (already lifted off the column it sits in), bumps only to `e-4` on hover, uses a softer `/20` border tint, and never adds `-translate-y-0.5` because drag-start has its own visual (`opacity-50 rotate-1`) and a board of dozens of cards cannot afford glow-jitter on every hover.

The `border border-transparent` resting state matters: the `Card` primitive is `border-0`, so `hover:border-primary/30` alone sets only border-color and renders nothing. The transparent border reserves the 1px gutter and lets the tint fade in without layout shift.

Entity cards use `group` so nested affordances (overflow menus, action icons) can fade in on `group-hover:opacity-100`. The hover shadow is `shadow-e-4`, not the dramatic `shadow-golden` 5-stop ambient — entity cards live in dense grids where a 400px spread on hover would feel theatrical. Reserve `shadow-golden` for surfaces that are alone on screen (popovers, focused single-card states).

### Motion
Semantic states tied to durations. All `ease-out`.
- `fast`: `duration-100` (Hover color shifts, focus rings)
- `base`: `duration-150` (Popover zoom/slide, dialog entrance)
- `slow`: `duration-300` (Card entrance, complex transitions)

### State Tokens
Consistent interactive feedback.
- **Hover**: `hover:bg-accent hover:text-accent-foreground` OR `hover:opacity-90`.
- **Focus**: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`. Form inputs use `ring-1`.
- **Disabled**: `disabled:opacity-50 disabled:pointer-events-none`.
- **Active**: Inherits hover + `scale-[0.98]` micro-transform.

### Z-Index
No arbitrary values.
- `z-10`: Sticky headers.
- `z-30`: Sidebar (`app-sidebar`).
- `z-40`: Modal backdrop (`DialogOverlay`).
- `z-50`: Floats (`Dropdown`, `Popover`).

### Iconography
- **Library**: Lucide React.
- **Size**:
  - `size-3` (12px): Micro badges.
  - `size-4` (16px): Default. Buttons, inputs.
  - `size-5` (20px): Section headers.
- **Stroke**: Always `2`.
- **Color**: Inherits text. Exceptions: Status icons.

---

## 3. Component Contract

| Primitive | Allowed Variants | Tokens / Spec | Forbidden |
|---|---|---|---|
| **Button** | `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` | `rounded-sm`. Focus: `ring-1 ring-ring`. Disabled: `opacity-50` (Standardize from 60%). | Custom colors inline. `rounded-md`. |
| **Badge** | `default`, `secondary`, `destructive`, `outline`, `accent` | `rounded-sm px-2.5 py-0.5 text-xs`. Focus: `ring-2 ring-ring ring-offset-2`. | Inconsistent padding. |
| **Input / Textarea** | N/A | `rounded-sm border-input shadow-sm`. Focus: `ring-1 ring-ring`. Disabled: `opacity-50`. | Custom borders. Hover backgrounds. |
| **Select** | N/A | Trigger: `shadow-sm ring-1`. Content: `shadow-golden`. | Custom dropdown arrows. |
| **Card** | N/A | `rounded-none border-0 shadow-e-2`. Subcomponents: `CardHeader p-6`. Interactive cards layer `border border-transparent` for hover-tint stability. | Resting border. CardTitle not inheriting `text-lg`. |
| **Dialog** | N/A | `max-w-lg p-6 shadow-golden rounded-sm`. Overlay `z-40 backdrop-blur-sm`. | Arbitrary width `w-[500px]`. |
| **Popover / Dropdown**| N/A | `shadow-golden z-50 p-4 border bg-popover`. | Missing animate-in/out. |
| **Tooltip** | N/A | `bg-primary text-primary-foreground`. No shadow. | Using `bg-popover`. |
| **Switch** | N/A | `shadow-xs`. Focus: `ring-2 ring-ring ring-offset-2`. | Raw outline. |
| **Checkbox** | N/A | Must match Switch focus spec. | Custom SVG overriding primitive. |
| **Tabs** | N/A | Trigger focus: `ring-2 ring-ring ring-offset-2`. Active: `shadow`. | Focus without offset. |

---

## 4. Page-Level Patterns

- **Page Header**: `div` containing `text-section` or `text-subheading-lg` + `text-muted-foreground` subtitle.
- **Danger Zone**: `Card` with `border-destructive/40` and `CardTitle text-destructive`.
- **Empty State**: `rounded-sm bg-muted p-3`. Lucide icon `size-5` + text.
- **Loading Skeleton**: `animate-pulse rounded-sm bg-muted`. No raw gray colors.
- **Command Bar**: Sticky `z-40`, `bg-background/80 backdrop-blur-md`.
- **Sidebar**: `z-30`. Uses semantic `bg-sidebar-background`.
- **Container**: Use `container mx-auto max-w-screen-lg`. No hardcoded `max-w-[1400px]`.

---

## 5. Usage Rules

- Primary action → `variant=default`.
- Destructive → `variant=destructive`.
- Tertiary/List item action → `variant=ghost`.
- Focus state → MUST use `--ring`. Never override ring color.
- Backgrounds → Use `--card` or `--background`. Never use `bg-mistral-orange/10` directly.

---

## 6. Dark Mode Rules

- **Strict Parity (color/surface only)**: Every color, surface, soft, foreground, and shadow-backing variable in `:root` MUST exist in `.dark`. Mode-invariant tokens (`--radius`, `--motion-*`, `--z-*`, `--state-*`, `--ring-width-*`) are defined once in `:root` and inherited; not parity violations.
- **No Hardcoding**: No `bg-mistral-orange` without `dark:` override.
- **Shadows**: `.dark` redefines `--shadow-golden-card/-pop/-dialog/-toast` with neutral black-alpha values. The `.dark .shadow-golden` selector additionally overrides the dramatic 5-stop ambient utility because that one is hardcoded in `tailwind.config.ts` rather than var-backed.
- **Luminance**: Status colors (`text-amber-500`) check for dark mode contrast or rely on `--status-warning`.

---

## 7. Migration Map (Audit Violations)

| Component / Pattern | Audit Source | Violation | Fix / Target Token |
|---|---|---|---|
| Dialog | 03-spacing | Hardcoded `max-w-md` vs `max-w-sm` | Unify to responsive classes `sm:max-w-sm md:max-w-md lg:max-w-lg`. |
| Card Padding | 03-spacing | Dialog `p-6` vs internal `p-4` | Unify all dialogs/cards to `p-6`. |
| Button Disabled | 06-components | `opacity-60` vs form `opacity-50` | Align to `opacity-50`. |
| CardTitle Size | 06-components | No explicit size. DialogTitle uses `text-lg`. | Update `CardTitle` to `text-lg`. |
| Focus Rings | 05-elevation | Badge/Tab uses `ring-offset-2`, Input `ring-1` | Standardize offset. Input/Select `ring-1`, Interactive `ring-2`. |
| Capture Button | 20-dark | `bg-mistral-orange` in brain-dump (bug) | Add `dark:bg-mistral-orange/85`. |
| Radii | 03-spacing | 15+ `rounded-md`, `rounded-lg` uses | Sweep. Replace with `rounded-sm`. |
| Magic Widths | 03-spacing | 3x `max-w-[1400px]` in Tasks | Replace with `max-w-screen-lg`. |

---

## 8. Anti-Patterns

- **NO** `rounded-md` or `rounded-lg`. System is sharp (`rounded-sm` or `rounded-none`).
- **NO** resting `border` color on `Card`. Cards rely on shadow for separation. Interactive cards may set `border border-transparent` so a hover tint can fade in without a layout shift, but never a visible resting border.
- **NO** hardcoded `text-red-500` for errors. Use `text-destructive`.
- **NO** `bg-white` or `bg-black`. Use `bg-background` or `bg-primary`.
- **NO** hardcoded arbitrary margins like `-mx-2` to cheat alignment. Fix padding root cause.
- **NO** form inputs floating with `shadow-md`. Inputs use `shadow-sm` and `border-input`.
- **NO** static opacity on container backgrounds. Cards, panels, boxes, pills, halos must be **solid**. No `bg-card/50`, `bg-muted/30`, `bg-accent/10` on rectangles.
  - Translucent surface = drop-shadow bleed-through bug + ambiguous tonal hierarchy.
  - Use solid `bg-card`, `bg-muted`, or the `-soft` semantic tokens (`bg-accent-soft`, `bg-destructive-soft`, etc.) for state tints.
  - **Allowed translucency**: `hover:bg-*` overlays, `bg-background/80 backdrop-blur` sticky headers, modal backdrop (`bg-black/50`), 1–2px decorative dots/dividers, progress-bar fills.
---

## 9. Token Appendix

The main Color and Soft Semantic tables list the surfaces and tints that drive most decisions. The full set of CSS variables in `globals.css` is below, grouped by role. Every entry has both a `:root` and `.dark` definition unless explicitly noted as mode-invariant.

### Foreground Pairs
Each surface has a paired foreground for text and icons.

| Surface | Foreground Var | Light | Dark |
|---|---|---|---|
| `--background` | `--foreground` | `#1f1f1f` | `#fffaeb` |
| `--card` | `--card-foreground` | `#1f1f1f` | `#fffaeb` |
| `--popover` | `--popover-foreground` | `#1f1f1f` | `#fffaeb` |
| `--primary` | `--primary-foreground` | `#ffffff` | `#ffffff` |
| `--secondary` | `--secondary-foreground` | `#1f1f1f` | `#fffaeb` |
| `--muted` | `--muted-foreground` | `hsl(0,0%,24%)` | `hsl(35,18%,60%)` |
| `--accent` | `--accent-foreground` | `#ffffff` | `#ffffff` |
| `--destructive`| `--destructive-foreground` | `#ffffff` | `#ffffff` |

### Sidebar Family
Parallel chrome stack. Lives outside the main elevation ladder.

| Var | Light | Dark | Role |
|---|---|---|---|
| `--sidebar-background` | `#f4db9a` | `#251c12` | Sidebar canvas |
| `--sidebar-foreground` | `#1f1f1f` | `#fffaeb` | Sidebar text |
| `--sidebar-primary` | `#fa520f` | `#fa520f` | Brand accent inside sidebar |
| `--sidebar-primary-foreground` | `#ffffff` | `#ffffff` | On sidebar-primary |
| `--sidebar-accent` | `#fff7df` | `#2a2218` | Active nav pill (mirrors `--card` so the pill reads as a card-tier snippet on the sunshine chrome) |
| `--sidebar-accent-foreground` | `#1f1f1f` | `#fffaeb` | Active nav text |
| `--sidebar-border` | `hsl(40,30%,85%)` | `hsl(30,15%,18%)` | Sidebar dividers |
| `--sidebar-ring` | `#fa520f` | `#fa520f` | Sidebar focus ring |

### Charts
Warm palette ramp. `chart-5` flips per mode for label legibility.

| Var | Light | Dark |
|---|---|---|
| `--chart-1` | `#fa520f` | `#fa520f` |
| `--chart-2` | `#ffa110` | `#ffa110` |
| `--chart-3` | `#ffb83e` | `#ffb83e` |
| `--chart-4` | `#ffd06a` | `#ffd06a` |
| `--chart-5` | `#1f1f1f` | `#fffaeb` |

### Status / Semantic Singletons
Solid colors for status text, icons, and indicator strokes. These are *not* surface fills — for tinted surfaces use the `-soft` family.

| Var | Light | Dark | Role |
|---|---|---|---|
| `--success` | `#22c55e` | `#22c55e` | Success ink (icon, dot, text) |
| `--warning` | `#ffa110` | `#ffa110` | Warning ink |
| `--info` | `#fa520f` | `#fa520f` | Info ink (uses brand orange) |
| `--status-not-started` | `hsl(30,10%,55%)` | `hsl(30,8%,40%)` | Idle state ink |
| `--status-in-progress` | `#ffa110` | `#ffa110` | In-progress ink |
| `--status-done` | `#22c55e` | `#22c55e` | Done ink |
| `--quadrant-do` | `#fa520f` | `#fa520f` | Eisenhower DO ink |
| `--quadrant-schedule` | `#ffa110` | `#ffa110` | Eisenhower SCHEDULE ink |
| `--quadrant-delegate` | `#ffb83e` | `#ffb83e` | Eisenhower DELEGATE ink |
| `--quadrant-eliminate` | `hsl(30,10%,60%)` | `hsl(30,8%,45%)` | Eisenhower ELIMINATE ink |

### Structure
| Var | Light | Dark | Role |
|---|---|---|---|
| `--border` | `#dfcc9f` | `hsl(28,18%,22%)` | Structural dividers, taupe |
| `--input` | `hsl(40,25%,80%)` | `hsl(28,15%,20%)` | Form-control borders |
| `--ring` | `#fa520f` | `#fa520f` | Focus-visible ring color |

### Mode-Invariant Tokens
Defined once in `:root`. No `.dark` counterpart by design.

| Var | Value | Role |
|---|---|---|
| `--radius` | `0.125rem` | Base corner radius |
| `--state-disabled-opacity` | `0.5` | Disabled element opacity |
| `--state-active-scale` | `0.98` | Active-state micro-transform |
| `--ring-width-input` | `1px` | Input/select focus ring |
| `--ring-width-interactive` | `2px` | Button/badge/tab focus ring |
| `--motion-fast` | `100ms` | Hover color shifts |
| `--motion-base` | `150ms` | Popover/dialog entrance |
| `--motion-slow` | `300ms` | Card entrance, complex |
| `--motion-easing` | `cubic-bezier(0,0,0.2,1)` | Global ease-out |
| `--z-sticky` / `--z-sidebar` / `--z-overlay` / `--z-float` | `10 / 30 / 40 / 50` | Layer ladder |
| `--state-hover-overlay` | `0 0 0 / 0.05` light, `255 255 255 / 0.10` dark | Hover overlay rgba (mode-aware exception) |
