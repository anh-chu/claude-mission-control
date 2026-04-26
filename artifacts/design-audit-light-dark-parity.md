# CCMC Redesign: Light vs. Dark Mode Design Audit

Audit evaluating visual consistency, accessibility, and parity across light and dark themes based on `DESIGN.md` specs.

## 1. Token Parity Gaps
**Status:** ✅ Good. No missing tokens. Every variable defined in `:root` has a direct `.dark` counterpart.
- Note: Light mode defines `--ring-width-input` and `--motion-*` tokens without dark equivalents, but these are dimension/motion values that do not require mode-specific overrides.

## 2. Contrast Parity Issues

| Issue | Mode | Tokens | Computed Ratio | WCAG AA Result |
|---|---|---|---|---|
| Primary Button Text | Dark | `--primary` (`#fa520f`) vs `--primary-foreground` (`#ffffff`) | ~3.37:1 | ❌ Fails (Requires 4.5:1 for normal text) |
| Accent Contrast | Both | `--accent` (`#fa520f`) vs `--accent-foreground` (`#ffffff`) | ~3.37:1 | ❌ Fails |
| Destructive Text | Dark | `--destructive` (`#ef4444`) vs `--destructive-foreground` (`#ffffff`) | ~4.00:1 | ❌ Fails |
| Hardcoded Pill | Both | `bg-amber-500` vs `text-white` (in `crew/page.tsx`) | ~3.00:1 | ❌ Fails |

## 3. Asymmetric Hardcoded Colors & Temperature Violations

- **Cold Gray Contamination**: `bg-slate-200 text-slate-800` used in `src/app/logs/page.tsx` for default status. Breaks the strict "warm European" temperature constraint.
- **Sterile Blue**: `bg-blue-600 text-white` used in `src/app/logs/page.tsx` for completed status. Violates the specific "not sterile blue tech" guideline.
- **Hardcoded Amber**: `bg-amber-500 hover:bg-amber-600 text-white` in `src/app/crew/page.tsx`.
- **Static Opacity Violations**: `bg-violet-500/5` (`agent-console.tsx`) and `bg-green-500/5` (`page.tsx`) use static opacity on container backgrounds, explicitly forbidden by `DESIGN.md`.

## 4. Visual Hierarchy Mismatches

### Dark Mode Semantic Collapse
In Light mode, semantic `-soft` backgrounds are visually distinct. In Dark mode, multiple distinct concepts map to the exact same hex code, destroying visual hierarchy:
- `--primary-soft` and `--accent-soft` and `--quadrant-do-soft` are all exactly `#3a2818`.
- `--warning-soft`, `--quadrant-schedule-soft`, and `--quadrant-delegate-soft` are all exactly `#3d3320`.
- **Visibility Failure**: `--destructive-soft` (`#3a2424`) against dark background (`#1f1916`) lacks sufficient luminance contrast to read as a distinct surface.

### Inset Highlight Failure (Light Mode)
Light mode `shadow-golden` uses `inset 0 1px 0 rgba(127, 99, 21, 0.18)` as a top highlight. A dark brown (`#7f6315`) inset on a cream (`#fffaeb`) background looks like a recessed inner border or a pressed state, rather than a top edge highlight. (Dark mode properly uses `rgba(255, 255, 255, 0.04)` for a bright top highlight).

### Elevation System Bypass
Despite `DESIGN.md` dictating the `shadow-golden` e-tier system, the codebase extensively uses standard Tailwind shadows (`shadow-sm`, `shadow-lg`). Most notably, `src/components/ui/card.tsx` uses `shadow-sm` and `border` instead of `shadow-golden` and `border-0`. Standard `shadow-lg` on warm cream surfaces looks muddy and gray, missing the golden glow spec.

## 5. Recommendations

### P0: Critical Contrast & Hierarchy Fixes
- **FIX:** Dark `-soft` Tokens. Remap dark soft tokens to ensure visual separation.
  - `--primary-soft`: `hsl(28, 15%, 25%)` (Warm gray/brown)
  - `--accent-soft`: `rgba(250, 82, 15, 0.15)` or deeper solid `#4a2211`
  - `--quadrant-schedule-soft` vs `--delegate-soft`: Ensure distinct hue/lightness offsets.
  - `--destructive-soft`: Brighten slightly to `#4a2020` for visibility against `#1f1916`.
- **FIX:** Contrast accessibility. Update `--primary-foreground` in Dark mode to `#1f1916` (inverse of light mode), OR deepen `--primary` to `#d93b00` to pass 4.5:1.

### P1: Component & System Alignment
- **FIX:** Refactor `src/components/ui/card.tsx` to strictly use `border-0 shadow-golden`.
- **FIX:** Replace all hardcoded standard shadows (`shadow-md`, `shadow-lg`) with `shadow-e-2`, `shadow-e-3`, etc., per the elevation token registry.
- **FIX:** Correct light mode `shadow-golden` top inset. Change `rgba(127, 99, 21, 0.18)` to a bright highlight like `rgba(255, 255, 255, 0.6)`.

### P2: Polish & Hardcoded Cleanups
- **FIX:** Migrate `bg-green-500/5` to `bg-success-soft`.
- **FIX:** Migrate `bg-violet-500/5` to `bg-accent-soft`.
- **FIX:** Replace `bg-slate-200 text-slate-800` in logs with `bg-muted text-muted-foreground`.
- **FIX:** Replace `bg-blue-600` in logs with a valid semantic color (`status-done` / `--success`).
- **FIX:** Fix contrast on `bg-amber-500 text-white` in Crew page by using `text-black` or `text-amber-950`.