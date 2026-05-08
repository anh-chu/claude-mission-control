# Mandio UI Reorganization Plan

Status: draft, in flight (Phase 0 patch dispatched)
Author: working session, 2026-05-08
Companion artifacts:
- `docs/ui-map.md` — current state inventory
- `docs/ui-proposal.html` — visual before/after

---

## Findings recap

Three audit passes produced a coherent set of fixes.

| # | Hurdle | Source |
|---|---|---|
| 1 | Naming fractured across nav / route / title | Audit 1 |
| 2 | "Map" exists in two places (Work tab + `/map` route) | Audit 1 |
| 3 | Same item visible in 3+ places (runs, decisions, activity, brain dumps) | Audit 1 |
| 4 | Task launch fragmented (5 entry points, no "what's running" answer) | Audit 1 |
| 5 | Logs / Ops mixed into user dashboard | Audit 1 |
| 6 | Skills / Plugins / Commands buried 3 levels deep | Audit 1 |
| 7 | Documents init has 2 buttons, first-run guess | Audit 1 |
| 8 | Filters reinvented per page | Audit 1 |
| 9 | Settings is a junk drawer, **mixes global + workspace scope silently** | Audit 1 + 3 |
| 10 | Workspace creation in TopNav, deletion in Settings — asymmetric | Audit 1 |

Audit 3 (settings scope) is the highest-impact hurdle for multi-workspace users. It causes silent data confusion: changing daemon config in one workspace affects all workspaces, with no visual cue.

### Settings scope audit (full table)

| Card | Intended scope | Stored where | Effective today? |
|---|---|---|---|
| Appearance (theme) | Global / per-user | `localStorage` (next-themes) | Yes |
| Workspace Settings (name + color) | Workspace | `workspaces[id]` | Yes |
| Environment Variables | Workspace | `workspaces[id].settings.envVars` | Yes |
| Autopilot (daemon config) | **Workspace** | `workspaces[id]/daemon-config.json` | **No — see daemon bug below** |
| Danger Zone (delete) | Workspace | — | Yes |

### Daemon scope bug (uncovered during reviewer audit)

The Autopilot card *looks* per-workspace because the file lives at `workspaces/<id>/daemon-config.json`, but the runtime ignores workspace scope:

1. `/api/daemon/route.ts` does not call `applyWorkspaceContext()` (every other route does). Writes hit whatever `_currentWorkspaceId` happened to be set to by a prior request — racy.
2. `POST /api/daemon { action: "run-command" }` spawns `run-task.ts` without setting `MANDIO_WORKSPACE_ID`, so ad-hoc commands always run against `default`.
3. The daemon process is a singleton (one PID at `DATA_DIR/daemon.pid`). It calls `loadConfig(process.env.MANDIO_WORKSPACE_ID ?? "default")` once at startup and never re-reads. Other workspaces' configs are never observed.
4. Several other `loadConfig()` callers in `run-task.ts` (lines 862, 1165) and `runner.ts` (line 91) omit the workspace argument, silently reading `default`.

Result: the user model is workspace-scoped autopilot, the disk layout agrees, the runtime ignores all of it. Phase 1.5 (below) fixes this end-to-end.

### Cross-cutting concern (track separately)

`_currentWorkspaceId` is a module-global in `src/lib/data.ts:54-59` mutated by `applyWorkspaceContext()`. Even routes that call the helper can race under concurrent requests — request A sets the global, request B overwrites before A's data access runs. Long-term fix: pass `workspaceId` explicitly into data functions, or use `AsyncLocalStorage`. Out of scope for the daemon work, but worth a separate audit pass.

---

## Plan — 4 phases, low-risk first

### Phase 0 — Settings scope badges (single-file patch, done)

- Inline `ScopeBadge` component in `src/app/settings/page.tsx`
- Group cards under "Global" (Appearance) and "Workspace" (Workspace Settings, Autopilot, Environment Variables, Danger Zone) headings
- Autopilot card is badged `Workspace` to match storage intent. The runtime bug it exposes is fixed in Phase 1.5
- Reword Autopilot + Workspace Settings descriptions to spell out scope
- No route changes, no API changes
- Reversible in one revert

**Outcome:** users can see at a glance which cards follow the workspace switcher.

**Status:** shipped 2026-05-08. Type-check clean.

### Phase 1 — Renames & redirects (cosmetic, reversible)

| Action | From | To |
|---|---|---|
| Add route alias | `/priority-matrix` | `/work` |
| Add route alias | `/documents` | `/brain` |
| Add nav item | — | `Ops` |
| Sync titles + breadcrumbs to nav labels | mismatched | unified |
| Add 301s for legacy paths | `/initiatives`, `/projects` | `/work?view=map` (interim, full merge in P2) |

Implementation: Next.js `redirects()` in `next.config.ts` + nav constant update. No component changes beyond label strings.

**Risk:** very low. Bookmarks keep working via 301.

### Phase 1.5 — Daemon workspace-scoping fix (must ship before P2)

The Autopilot card now claims `Workspace` scope; the runtime must honor it. Reviewer-recommended approach: ship a single multi-workspace orchestrator process ("Model 1.5"), not a supervisor + per-workspace children. The dangerous, long-running work already runs in per-task children (`run-task.ts`); poller loops are tiny and don't warrant their own processes yet.

#### Phase 1.5a — API correctness (mechanical)

- `/api/daemon/route.ts`: call `applyWorkspaceContext()` at the top of `GET`, `POST`, `PUT`.
- When `POST { action: "run-command" }` spawns `run-task.ts`, pass `MANDIO_WORKSPACE_ID` in the child env.
- Do **not** ship 1.5a alone. Without 1.5c the toggle still doesn't take effect at runtime, which is a worse footgun than the current state. Ship 1.5a + 1.5b + 1.5c together.

#### Phase 1.5b — `loadConfig()` default to env

- Update signature: `loadConfig(workspaceId = process.env.MANDIO_WORKSPACE_ID ?? "default")`.
- Audit all callers; the obvious offenders are `run-task.ts:862, 1165` and `runner.ts:91`. None should call `loadConfig()` argless once a workspace context exists.

#### Phase 1.5c — Orchestrator loop in `runner.ts`

Replace the singleton-startup behavior with a reconciliation loop:

- Every 5–10s, list workspaces from `workspaces.json` (don't rely on file watchers; cross-platform watchers are lossy).
- For each enabled workspace: read its `daemon-config.json`, if `polling.enabled` is true, run a poll cycle. Spawn `run-task.ts` with `MANDIO_WORKSPACE_ID`.
- Wrap each workspace's poll cycle in a try/catch; one workspace's failure must not stop the loop.
- Always-on by default: the orchestrator never exits unless explicitly stopped. "Pause" in the UI flips `polling.enabled` per workspace; the orchestrator skips that workspace's poll the next reconciliation tick.
- Concurrency caps: enforce both a global cap (machine/API budget) and a per-workspace cap (prevents one workspace stampede). Round-robin or weighted-fair scheduling across enabled workspaces.

#### Phase 1.5d — UI honesty + safety

- Autopilot card status badge reads from a per-workspace running indicator (the orchestrator publishes `workspaces/<id>/daemon-status.json`).
- Add a global "Daemon process: running / stopped" indicator at `/ops` for operator-level health.
- Workspace deletion: tombstone flow. Mark workspace `disabled`, signal orchestrator to drain in-flight agents, grace-kill remaining, then remove the directory. Without this, `loadConfig()` recreating defaults at `scripts/daemon/config.ts:193-196` can resurrect a deleted workspace.

#### Phase 1.5e (deferred) — Supervisor + per-workspace children

Only revisit if poller logic ever leaks state, hangs, or proves CPU-heavy. YAGNI until evidence.

#### Out of scope for Mandio code

Process supervision ("daemon survives reboots") is an ops concern, not an app concern. Document the recommendation: systemd / launchd / PM2 / Windows service, depending on deployment.

**Risk:** medium. Behavior change. Needs a smoke test that toggling polling in workspace A leaves workspace B's poll cycle untouched.

### Phase 2 — Consolidation (cut/paste, light coupling)

1. **`/ops` shell** — new layout, hosts:
   - Logs (lifted from Home → Logs tab; delete that tab)
   - Autopilot scheduler (lifted from `/crew` → Autopilot tab)
   - Plugins, Commands (flattened from `/crew/skills` sub-tabs)
   - Skills stays under `/crew/skills` (user-facing, not operator-only)
2. **Merge `/map`** into `/work` as a view toggle. Drop the standalone `/map` page; the P1 redirect now points at the merged view.
3. **Settings split** — graduate the Phase-0 grouping into proper routes:
   - `/settings` keeps **global** cards: Appearance, Daemon, (future) Profile, Install
   - New `/settings/workspaces` lists workspaces, with `/settings/workspaces/[id]` for General / Environment / Danger zone per workspace
   - Move "+ New workspace" creation out of TopNav-only into `/settings/workspaces` (TopNav keeps its dialog as a shortcut)
4. **Documents → Brain** rename complete: route, page title, breadcrumb, empty-state copy. Collapse the dual-init-button to one primary CTA.
5. **`<FilterBar />`** shared component, used by Work, Activity, Logs, Runs.

**Risk:** medium. Needs careful link audit (`grep "/priority-matrix\|/documents\|/map\|/initiatives\|/projects"` across the repo).

### Phase 3 — RunStore (structural, highest value)

The 5-way duplication of "what is currently running" is the most expensive hurdle for power users. Fix it by introducing a single source of truth.

#### Schema sketch

```ts
type Run = {
  id: string;
  workspaceId: string;
  taskId: string | null;        // null for ad-hoc chat runs
  agentId: string;
  conversationId: string | null;
  status: "queued" | "running" | "completed" | "failed" | "timeout";
  source: "ui-button" | "deploy-dropdown" | "autopilot" | "chat-sidebar";
  startedAt: string;
  endedAt: string | null;
  pid: number | null;
  error: string | null;
};
```

#### API

- `GET /api/runs?taskId=&agentId=&status=` — index
- `GET /api/runs/[id]` — detail (includes log tail)
- `GET /api/runs/[id]/stream` — SSE for live tail
- `POST /api/runs` — create (called by all 5 sources)
- `POST /api/runs/[id]/stop`

#### UI consumers (all read the same store)

- `/ops/runs` — global feed (replaces Home → Logs tab's run list)
- Task detail → "Runs" tab — filtered by taskId
- Crew/[id] → "Runs" tab — filtered by agentId
- ChatSidebar — filtered by conversationId
- Home → Automation card — count summary only

**Migration path:** add the store + new endpoints; switch consumers one at a time; remove legacy code paths last.

**Risk:** high (state migration, daemon coordination). Highest reward.

---

## Sequencing

```
Phase 0   (done, 1 file)         ← Settings scope badges ✓
   ↓
Phase 1   (1 PR)                 ← Renames, redirects, nav additions
   ↓
Phase 1.5 (1–2 PRs)               ← Daemon workspace-scoping (a + b + c shipped together; d follows)
   ↓
Phase 2   (3–5 PRs)               ← /ops shell, map merge, settings split, brain rename, FilterBar
   ↓
Phase 3   (multi-PR sprint)      ← RunStore + 5 consumer migrations
```

**Why 1.5 must precede 2:** the `/ops` shell in Phase 2 will surface per-workspace daemon status. Building that UI on top of a runtime that ignores workspace scope guarantees re-work.

---

## Open decisions

1. **Brain vs Wiki vs Documents** — pick one canonical name. Proposed "Brain" because the existing breadcrumb already says it. If "Wiki" is the team's spoken word, use that.
2. **`/ops` access** — should it be hidden behind a "developer mode" toggle for end users, or always visible? Today the daemon log tail and PIDs are exposed to everyone.
3. **Workspace shortcut in TopNav** — keep "+ New workspace" dialog, or only deep-link to `/settings/workspaces`? Keeping it preserves muscle memory.
4. **Skills location** — stay under `/crew/skills` (current proposal) or move to `/ops/skills`? Skills feel user-configurable, not operator-only, so leaning `/crew/skills`.

---

## Files I'll touch (estimate)

### Phase 1
- `next.config.ts`
- `src/components/top-nav.tsx`
- `src/lib/paths.ts`
- breadcrumb usages (~6 files)

### Phase 1.5
- `src/app/api/daemon/route.ts` (apply workspace context, pass env on spawn)
- `scripts/daemon/config.ts` (loadConfig default to env)
- `scripts/daemon/runner.ts` (orchestrator loop, drop singleton-startup binding)
- `scripts/daemon/run-task.ts` (audit `loadConfig()` callers)
- `src/lib/paths.ts` (per-workspace `daemon-status.json` path; revisit `daemon.pid` location)
- new: workspace tombstone helper in `src/lib/data.ts` or `src/lib/workspaces.ts`
- `src/hooks/use-daemon.ts` (read per-workspace status)
- smoke test: `__tests__/daemon-multi-workspace.test.ts`

### Phase 2
- new `src/app/ops/**`
- edits to `src/app/page.tsx` (Logs tab removal)
- edits to `src/app/crew/page.tsx` (Autopilot tab removal)
- new `src/app/settings/workspaces/**`
- rename `src/app/documents` → `src/app/brain`
- link audit (~30 files)

### Phase 3
- new `src/lib/run-store.ts`
- new `src/app/api/runs/**`
- edits to `scripts/daemon/runner.ts`
- 5 consumer rewrites (Logs tab, ChatSidebar, task detail, agent detail, Home Automation card)

---

## Proposed sitemap (target)

```
/home
├── Overview
├── Inbox            (brain dumps)
└── Activity         (user events only — no logs)

/work                (was /priority-matrix; absorbs /map, /initiatives, /projects)
├── Matrix · Board · Map · List
├── /work/tasks/[id]
├── /work/projects/[id]
└── /work/initiatives/[id]

/brain               (was /documents)
└── tree + viewer

/crew
├── /crew (list)
├── /crew/[id]
└── /crew/skills     (flattened, no sub-tabs)

/ops                 (NEW — operator surface)
├── Runs             (live + history, single source)
├── Logs             (daemon + app tails)
├── Autopilot        (scheduler + commands)
└── Plugins · Commands

/settings            (global)
├── Appearance
├── Daemon
├── Profile          (future)
└── Install

/settings/workspaces (workspace registry)
├── + New workspace
└── [id]
    ├── General
    ├── Environment
    └── Danger zone
```

---

## Change summary table

| Action | From | To | Why |
|---|---|---|---|
| RENAME | `/priority-matrix` | `/work` | Match nav label, drop jargon |
| RENAME | `/documents` ("Brain") | `/brain` | Title and route already disagree |
| MERGE | `/map`, `/initiatives`, `/projects` | `/work` Map view | One canvas, multi-zoom |
| NEW | — | `/ops` | Separate operator tooling from end-user surfaces |
| MOVE | Home → Logs tab | `/ops/logs` | Was mixed with user dashboard |
| MOVE | Crew → Autopilot tab + Settings → Autopilot | `/ops/autopilot` (single) | Two configs in two places caused drift |
| MOVE | Crew → Skills → Plugins/Commands sub-tabs | `/ops/plugins`, `/ops/commands` | Was 3 levels deep |
| NEW | 5 places showing runs | `/ops/runs` + Runs tab on task/agent | RunStore = single source of truth |
| MOVE | TopNav "New Workspace" only | `/settings/workspaces` (TopNav keeps shortcut) | Symmetry with delete |
| KEEP | CommandBar (Cmd+K), Search, ChatSidebar, KeyboardShortcuts | same | Cross-cutting components are fine |
| DEDUPE | Documents empty state: 2 init buttons | 1 primary CTA, footer status only | First-run guess removed |
| UNIFY | Per-page filter bars (Matrix, Activity, Logs) | Shared `<FilterBar />` | Consistent placement, persistence, behavior |
