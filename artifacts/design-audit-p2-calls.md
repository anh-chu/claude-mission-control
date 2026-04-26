# P2 Audit Calls

## 1. Typography: `text-2xl`
Tokens `text-section` (56px) and `text-display` (82px) exist in `tailwind.config.ts`.
- `src/app/logs/page.tsx:279`
- `src/app/page.tsx:328`
- `src/app/autopilot/page.tsx`
**Action:** FIX. Swap `text-2xl` -> `text-section`.
**Rationale:** Spec mandates huge display headlines. `text-2xl` (24px) weak.

## 2. CardContent `p-4`
- `src/app/brain-dump/page.tsx:219`
**Action:** FIX. Remove `p-4` (use default `p-6`).
**Rationale:** Normal input card. Needs `p-6` breathing room.

- `src/app/page.tsx:340,357,371`
**Action:** KEEP `p-4`.
**Rationale:** Compact interactive grid items. `p-6` wastes space. Tight layout good.

- `src/app/crew/[id]/page.tsx:305,313,321`
**Action:** FIX. Remove `p-4` (use default `p-6`).
**Rationale:** Stat cards. Big numbers need whitespace.

## 3. Empty-state Icons `h-6 w-6`
- `src/app/not-found.tsx:9`
- `src/app/error.tsx:55`
**Action:** FIX. Swap `h-6 w-6` -> `size-5`.
**Rationale:** Spec dictates `size-5` (20px) for empty states.

- `src/app/skills/page.tsx:29`
**Action:** FIX. Swap `h-6 w-6` -> `size-4`.
**Rationale:** Button icon, not empty state. Spec dictates `size-4` (16px) for buttons.

## 4. Dialog Overlay `z-50`
- `src/components/ui/dialog.tsx:20`
**Action:** FIX. Swap `z-50` -> `z-40`.
**Rationale:** Spec reserves `z-50` for floats. Backdrop sits below floats at `z-40`.

## 5. List Item Hover `hover:bg-muted/30`
- `src/app/autopilot/page.tsx:425`
**Action:** FIX. Swap `hover:bg-muted/30` -> `hover:bg-accent-soft`.
**Rationale:** Spec bans opacity-derived backgrounds. Raw `hover:bg-accent` harsh for list items. Semantic `-soft` token solid.