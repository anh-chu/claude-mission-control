# Work Section Restructure: Unified Tab Bar

## Scope

Replace the current double navigation on `/work` (sub-nav links + icon-only view toggle) with a single unified tab bar:

```
Work
├── Tasks        (Matrix | Board sub-toggle, Board default)
├── Projects     (existing /work/projects index)
├── Initiatives  (existing /work/initiatives index)
└── Map          (ReactFlow canvas, every node clickable)
```

What this plan does NOT cover:

- Restructuring `/work/projects/page.tsx` or `/work/initiatives/page.tsx` content (they keep their current layout, just gain the same tab bar at top).
- Touching task detail, project detail, or initiative detail pages.
- The dead `/priority-matrix/page.tsx` file (kept as a duplicate; cleanup is out of scope, redirect in `next.config.ts:35` already covers it).
- Changing the WorkMap status filter, collapse bubbles, RunButton wiring, or context menus.

## Approach

Single shared component `WorkTabs` (client) that lives at the top of every `/work*` page. It renders a 4-tab bar using the existing `Tabs` primitive (`/home/sil/ccmc/src/components/ui/tabs.tsx`) with manual navigation via `next/link` so each tab is a real route the browser address bar reflects.

- `/work`            -> Tasks tab active
- `/work/projects`   -> Projects tab active
- `/work/initiatives`-> Initiatives tab active
- `/work/map`        -> Map tab active (new route)

Why a route per tab, not query params:

- `/work/projects` and `/work/initiatives` already exist as routes and are linked to from `next.config.ts` redirects (`/projects` -> `/work/projects`, `/initiatives` -> `/work/initiatives`). Routes are the existing convention.
- Easier to deep-link and easier to share (no `?tab=` cruft).
- Keeps the Map heavy ReactFlow canvas out of the Tasks bundle.

Alternatives considered and rejected:

- One mega-page with internal tab state. Rejected: would force the ReactFlow canvas to load on every Tasks visit and would require collapsing three already-built routes back into one file.
- Query param state (`/work?tab=...`). Rejected: existing routes already work, and the redirect map in `next.config.ts` would have to be rewritten.

Tasks tab keeps its internal Matrix | Board sub-toggle (a normal segmented control inside the page body), with Board default. The current `?view=` query param stays so existing deep links keep working, default is `board` when absent.

## Constraints

- `next.config.ts` redirects `/priority-matrix -> /work`, `/projects -> /work/projects`, `/initiatives -> /work/initiatives`, `/map -> /work`, `/work/milestones -> /work`. None of these break.
- `top-nav.tsx:57` matches `["/work", "/priority-matrix", "/map", "/tasks"]`. Add `"/work/projects"`, `"/work/initiatives"`, `"/work/map"` so the Work nav item stays highlighted on every sub-route. Today these already match because `pathname.startsWith("/work/")` is true, so no change strictly required, but verify.
- `keyboard-shortcuts.tsx` lines 57-69 push `/work`. Unchanged.
- `BreadcrumbNav` is used on all three existing pages. Tab bar renders BELOW breadcrumb so the breadcrumb still answers "where am I in the hierarchy".
- The Map tab renders `WorkMapView` which mounts `ProjectInitiativeCanvas` dynamically (`ssr: false`). Keep that dynamic import. Don't import the canvas eagerly from any tab bar component.
- `ProjectInitiativeCanvasInner` already wires `onNodeClick` for collapse bubbles only. Adding navigation must NOT break the bubble click behavior, must NOT swallow drag interactions, and must NOT fire when a context menu is opening.
- The card-level "Run" button (`RunButton`) already calls `e.stopPropagation()` on pointerdown and click; navigation handler must respect that so clicking Run does not navigate.
- ReactFlow registers `onNodeClick` only on actual click events (after mouseup with no drag). So drags will not trigger it. Confirmed by reading `project-initiative-canvas.tsx` lines ~1600.

## Steps

These are grouped by parallelism. Steps inside the same group can run in parallel; later groups depend on earlier ones.

### Group A (parallel)

#### Step A1: Create `WorkTabs` shared component

- File: `/home/sil/ccmc/src/components/work-tabs.tsx` (new)
- Change: Create a client component that renders 4 tab links using styles consistent with `Tabs`/`TabsList`/`TabsTrigger` from `/home/sil/ccmc/src/components/ui/tabs.tsx`. Implementation detail: use plain `<nav>` + `next/link` (NOT Radix `Tabs`, because Radix tabs are controlled and don't play well with route-driven activation). Match the visual language of `TabsTrigger` exactly: `inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-sm font-normal uppercase text-xs tracking-wider`. Active tab gets `bg-background text-foreground shadow-e-1`; inactive gets `text-muted-foreground`. Wrapper gets `inline-flex h-9 items-center justify-center rounded-sm bg-muted p-1`.
- Tabs (in order): Tasks (`/work`), Projects (`/work/projects`), Initiatives (`/work/initiatives`), Map (`/work/map`).
- Active matching: use `usePathname()` from `next/navigation`. Active rules:
  - Tasks: `pathname === "/work"`
  - Projects: `pathname === "/work/projects"` or `pathname.startsWith("/work/projects/")`
  - Initiatives: `pathname === "/work/initiatives"` or `pathname.startsWith("/work/initiatives/")`
  - Map: `pathname === "/work/map"` or `pathname.startsWith("/work/map/")`
- Export: `export function WorkTabs()`.
- Acceptance: Component renders 4 links, the one matching the current pathname has the active styling, others do not. Reviewer manually navigates through all four and checks the active tab updates.

#### Step A2: Add `loading.tsx` for the new map route

- File: `/home/sil/ccmc/src/app/work/map/loading.tsx` (new)
- Change: Mirror the structure of `/home/sil/ccmc/src/app/work/loading.tsx`. Render `BreadcrumbNav` (`items={[{ label: "Work" }]}` is fine), the `WorkTabs` component, and a `Skeleton` block sized like the canvas (`h-[calc(100vh-12rem)] w-full rounded-xl`).
- Acceptance: Hard-refresh of `/work/map` shows skeleton then the canvas, no layout shift on the tab bar.

### Group B (depends on A1)

#### Step B1: Refactor `/work/page.tsx` (Tasks tab)

- File: `/home/sil/ccmc/src/app/work/page.tsx`
- Change:
  1. H1 text: change `"Tasks"` to `"Work"` (line 295 area).
  2. Delete the entire current sub-navigation block (lines ~301-316, the `<div className="flex items-center gap-1 border-b pb-2 mb-2">` containing `Projects` and `Initiatives` links).
  3. Delete the icon-only view toggle inside the right-side action bar (lines ~321-373, the `<div className="flex items-center rounded-sm border bg-muted p-0.5">` with the three Tip-wrapped buttons for Matrix/Board/Map).
  4. Drop the Map view branch entirely from this page: remove the `<WorkMapView />` render (line ~422), remove the `WorkMapView` import (line 22), and remove `"map"` from the `ViewMode` union (line 34) so it becomes `type ViewMode = "matrix" | "board"`.
  5. Below the existing `<BreadcrumbNav items={[{ label: "Work" }]} />`, add `<WorkTabs />`.
  6. Replace the deleted icon toggle with a small Matrix | Board segmented control. Position: in the same right-side action row as `FilterBar` and the New Task button. Style: a `<div className="inline-flex items-center rounded-sm border bg-muted p-0.5">` with two buttons. Each button is `px-2.5 py-1 text-xs uppercase tracking-wider rounded-sm` and uses the existing active styling pattern (`bg-background shadow-e-1 text-foreground` vs `text-muted-foreground hover:text-foreground`). Labels: `Matrix` and `Board`.
  7. `useSearchParams().get("view")` stays. Default remains `"board"` (line 180). When user clicks Matrix or Board, push the new `?view=` param via `router.replace` so the URL stays in sync (use `router.replace(\`/work?view=${mode}\`, { scroll: false })`).
  8. Loading-skeleton helper `TasksSkeleton` only takes `viewMode: "matrix" | "board"` after the union narrows. The existing branches already handle both, no other change.
- Acceptance:
  - `/work` renders breadcrumb, then tab bar with Tasks active, then H1 "Work".
  - Right-side action row shows Matrix/Board toggle + filters + New Task.
  - Default view on first visit is Board (kanban).
  - Clicking Matrix updates the URL to `/work?view=matrix` and shows the four quadrants.
  - `/work?view=map` no longer renders the canvas (Map is its own route now). Acceptable to ignore the param (default to board).
  - `next dev` shows no warnings about missing imports for `WorkMapView` or `GitFork`/`Columns3`/`Grid2x2` lucide icons. Remove unused icon imports as part of cleanup.

#### Step B2: Add `WorkTabs` to `/work/projects/page.tsx`

- File: `/home/sil/ccmc/src/app/work/projects/page.tsx`
- Change: Import `WorkTabs` from `@/components/work-tabs`. Render `<WorkTabs />` immediately after the `<BreadcrumbNav ... />` (line ~115) and before the `<div className="flex items-center justify-between flex-wrap gap-2">` that contains the H1.
- No other content changes.
- Acceptance: `/work/projects` shows breadcrumb, then tab bar with Projects active, then existing H1 "Projects" + filters + cards.

#### Step B3: Add `WorkTabs` to `/work/initiatives/page.tsx`

- File: `/home/sil/ccmc/src/app/work/initiatives/page.tsx`
- Change: Import `WorkTabs` and render it between `<BreadcrumbNav .../>` (line ~244) and the H1 row.
- Acceptance: `/work/initiatives` shows breadcrumb, then tab bar with Initiatives active, then existing layout.

### Group C (depends on A1)

#### Step C1: Create `/work/map/page.tsx`

- File: `/home/sil/ccmc/src/app/work/map/page.tsx` (new)
- Change: Client component (`"use client"`). Render:
  1. `<BreadcrumbNav items={[{ label: "Work", href: "/work" }, { label: "Map" }]} />`.
  2. `<WorkTabs />`.
  3. The current `WorkMapView` body (the existing `WorkMapView` already includes its own header "Map" + "New Initiative" / "New Project" buttons + canvas). Use it as-is: `<WorkMapView />`.
- The page shell wrapper should be `<div className="space-y-4">` to match other Work pages.
- Acceptance: `/work/map` shows breadcrumb (Work > Map), tab bar with Map active, existing Map header with Plus buttons, canvas filling the height.

#### Step C2: Make canvas nodes navigational

- File: `/home/sil/ccmc/src/components/project-initiative-canvas.tsx`
- Change:
  1. Import `useRouter` from `next/navigation` at the top of the file (next to other hooks).
  2. Inside `ProjectInitiativeCanvasInner`, add `const router = useRouter();`.
  3. Extend the existing `handleNodeClick` callback (around line 1600). Current body handles only `collapseBubble`. New behavior, in this exact order:
     - If `node.type === "collapseBubble"`: call existing onExpand and return (unchanged).
     - If the click target was inside a button or a context-menu trigger, do not navigate. Detect via `event.target as HTMLElement` walking up: if `(event.target as HTMLElement).closest("button, [role='menuitem'], [data-no-nav]")` is truthy, return. This protects RunButton (already stops propagation but belt-and-braces) and any future buttons inside the cards.
     - Else, dispatch by node type and prefix:
       - `node.id` starts with `"project:"` -> `router.push(\`/projects/\${node.id.slice("project:".length)}\`)`
       - `node.id` starts with `"initiative:"` -> `router.push(\`/initiatives/\${node.id.slice("initiative:".length)}\`)`
       - `node.id` starts with `"task:"` -> `router.push(\`/tasks/\${node.id.slice("task:".length)}\`)`
  4. Add `cursor-pointer` to the root `<div>` of `ProjectNode`, `InitiativeNode`, and `TaskNode` so the affordance is visible. Project node root currently is the div with `relative w-[280px] rounded-xl border bg-card p-4 shadow-e-2 ...`; same pattern for initiative and task nodes.
- ReactFlow gotcha: ReactFlow only fires `onNodeClick` after a clean click (not after a drag). No extra drag-vs-click logic needed. Confirmed against the existing collapse-bubble click path which works the same way.
- Edge clicks: `handleEdgeClick` (~line 1585) already handles edge clicks for collapse. Do not touch.
- ContextMenu gotcha: `ContextMenuTrigger` from `/home/sil/ccmc/src/components/ui/context-menu.tsx` listens on `contextmenu` (right-click), so a right-click that opens the menu will not also fire a left-click `onNodeClick`. No additional guards needed.
- Acceptance:
  - Left-click on a project card on the map -> URL becomes `/projects/{id}`.
  - Left-click on an initiative card -> URL becomes `/initiatives/{id}`.
  - Left-click on a task card -> URL becomes `/tasks/{id}`.
  - Left-click on the small create-handle plus button below a project does NOT navigate (it stops propagation today; verify it still does).
  - Left-click on the RunButton inside a project card does NOT navigate.
  - Drag-to-move a node does NOT navigate.
  - Right-click on a node opens the context menu and does NOT navigate.
  - Click on a collapse-bubble still expands as before.

### Group D (depends on B1, C1)

#### Step D1: Update top-nav match list

- File: `/home/sil/ccmc/src/components/top-nav.tsx`
- Change: In the `Work` nav item (line 54-58), update `match` to `["/work", "/priority-matrix", "/map", "/tasks"]` -> `["/work", "/priority-matrix", "/map", "/tasks"]` (no change strictly needed because `isItemActive` already does `pathname.startsWith("/work/")`, but verify by clicking each tab and confirming the Work top-nav item stays active).
- Acceptance: Visiting `/work`, `/work/projects`, `/work/initiatives`, `/work/map`, `/tasks/[id]` all leave the Work top-nav item highlighted. No code change expected.

#### Step D2: Smoke pass on existing redirects

- Files: `/home/sil/ccmc/next.config.ts` (read only), no edits expected.
- Change: None. Verify these still resolve to a working tab:
  - `/priority-matrix` -> `/work` -> Tasks tab.
  - `/map` -> `/work` -> Tasks tab. NOTE: existing redirect points to `/work` not `/work/map`. After this restructure, consider updating that line to `{ source: "/map", destination: "/work/map", permanent: true }`. Treat as optional, flag in Open Questions.
  - `/projects` -> `/work/projects` -> Projects tab.
  - `/initiatives` -> `/work/initiatives` -> Initiatives tab.
- Acceptance: Manual visit to each old URL lands on the correct new tab.

## Risks

1. **Canvas node click swallowing drag intent** (medium). If our `onNodeClick` navigation handler runs after what the user perceived as a drag, they get yanked to a detail page. Mitigation: ReactFlow's own click filtering already prevents this. Verify by drag-moving a node and confirming no nav.
2. **Run button accidentally navigates** (medium). The RunButton lives inside the project card root. Today it calls `e.stopPropagation()` on `onPointerDown` and `onClick`. ReactFlow node-click should not fire because propagation is stopped. Belt-and-braces: the `closest("button")` guard in C2 covers it even if propagation regressed.
3. **Loading skeleton mismatch** (low). The new `/work/map/loading.tsx` must match shell height exactly to avoid jump. Mitigation: copy structure from `/home/sil/ccmc/src/app/work/loading.tsx`.
4. **Tab active styling vs Radix Tabs** (low). Using plain anchors styled like Radix tabs means the visual ends up close but not 1:1. Mitigation: copy class strings verbatim from `/home/sil/ccmc/src/components/ui/tabs.tsx`.
5. **`/work?view=map` deep links** (low). Old links pointing at `/work?view=map` will land on the Tasks tab in Board mode (since the union no longer accepts `map`). Acceptable; the Map tab is just one click away. Optionally add a server-side redirect later.
6. **WorkMapView reused at `/priority-matrix/page.tsx`** (low). That file still imports `WorkMapView`. Since `/priority-matrix` is redirected by `next.config.ts:35`, the file is dead but not removed. Out of scope.

## Open Questions

1. Should `next.config.ts` redirect `/map -> /work/map` instead of `/map -> /work`? Recommended yes, but optional. Decide before merging.
2. Should `/priority-matrix/page.tsx` be deleted now (it is unreachable)? Out of scope by default; flag for follow-up cleanup.
3. The Tasks tab still listens to `?view=map` from old bookmarks. Drop silently or 308 to `/work/map`? Default in this plan is "drop silently".

## Critical Files for Implementation

- `/home/sil/ccmc/src/app/work/page.tsx` - Tasks tab page; biggest delete + restructure here.
- `/home/sil/ccmc/src/components/work-tabs.tsx` - new shared tab bar, used by all four tab pages.
- `/home/sil/ccmc/src/app/work/map/page.tsx` - new route; thin shell over `WorkMapView`.
- `/home/sil/ccmc/src/components/project-initiative-canvas.tsx` - add navigation to `handleNodeClick`, set `cursor-pointer` on node roots.
- `/home/sil/ccmc/src/components/ui/tabs.tsx` - reference for tab styling tokens.
