# TODO

Near-term focus for Task Control. Not a full roadmap, just the next two bets.

## 1. Canvas automation workflow builder

A visual canvas where you compose automations by connecting nodes (triggers, agents, actions, decisions). Goal: let non-engineers assemble multi-step agent flows without touching JSON.

- Node types: task trigger, agent run, conditional, decision prompt, webhook, delay
- Drag/drop layout persisted per workspace
- Live execution overlay (nodes light up as the daemon runs them)
- Export flow to a runnable spec the daemon can dispatch
- Reuses existing Autopilot execution engine, no new runtime

Open questions: node spec format, storage location in `~/.cmc/workspaces/{id}/`, whether to reuse `@dnd-kit` or bring in a graph lib.

## 2. Second-brain evolving wiki

A living knowledge base that agents read from and write back to. Pages evolve as tasks complete. Goal: project memory that compounds instead of rotting.

- Markdown pages under `~/.cmc/workspaces/{id}/wiki/`
- Agents can read any page, propose edits through a diff-review flow
- Backlinks and tag index auto-maintained
- Daily digest agent summarizes what changed
- Surfaces in the UI as a left-nav tree, editable inline

Open questions: review/approval model for agent edits, conflict handling when multiple agents touch the same page, embedding search vs plain grep.

## 3. Minimalization — next targets

From codebase audit 2026-04-24. All types in `src/lib/types.ts`. All routes under `src/app/api/`.

---

### ~~3a. Inbox + ActivityLog merge / API pagination dedup~~

**Investigated 2026-04-25. Original goal revised.**

Original pitch (merge into single event stream) is not viable:
- Inbox is bilateral (from → to), ActivityLog is unidirectional (actor only). from/to is load-bearing for threading and reply-to logic.
- 5 daemon scripts bypass the API and write directly to inbox.json / activity-log.json. Merging storage = race conditions without a mutex-aware write layer first.
- "Triple-fetch" doesn't exist — dashboard does 2 parallel reads, not 3.
- Full merge requires daemon executor consolidation (3e) as prerequisite. Doing 3e to enable a low-value merge is backwards.

**Revised scope — what's actually safe:**
- Extract shared pagination/filter helper from `src/app/api/inbox/route.ts` and `src/app/api/activity-log/route.ts` — both have identical offset/limit/sort logic (~80 LOC saved)
- Leave storage, types, and UI untouched

**Do not merge** Inbox and ActivityLog at the data or UX layer — they serve different user mental models ("what needs my attention" vs "what happened") and different interaction patterns (threading + reply vs audit trail).

---

### ~~3g. notes + comments unification~~ done

Dropped `Task.notes`, added `TaskComment.type`. Daemon, API, UI, validation all updated.

---

### ~~3f. API action consolidation~~ done

Current task action routes (all thin wrappers, ~50 LOC each):
- `POST /api/tasks/[id]/run`
- `POST /api/tasks/[id]/stop`
- `POST /api/tasks/[id]/comment`

Consolidate into `POST /api/tasks/[id]/actions` with body `{ action: 'run' | 'stop' | 'comment', params?: {...} }`. Saves 3 route files, unifies auth/validation pattern.

Check all UI callers before merging: `grep -r "tasks.*run\|tasks.*stop\|tasks.*comment" src/`

---

### ~~3h. Comms section restructure~~ done

Sidebar grouping done (`c3e3aa0`). Structural cuts still pending.

**What remains:**
- Inbox page (~500 LOC): email metaphor doesn't fit agent communication. Agent outputs already surface via activity log and decisions.
- Decisions page (~230 LOC): redundant now that dashboard Attention Required has inline approve/reject.
- Logs: ops tabs (Daemon, App, Runs) should move to a dedicated debug page; Activity tab belongs with comms.

**Plan:**
- PR 1: Kill Inbox page, kill Decisions page, split Logs into ops vs. activity.
- PR 2: Single Activity page with agent event stream, filters by agent/type/status, inline decision actions.

Expected: ~730 LOC cut, one mental model for agent interactions.

---

### Verify before cutting

- `/api/brain-dump/automate` — route exists, daemon script exists. Confirm whether any UI surface triggers it. If not, cut both.
- `/api/sync` — already evaluated in previous audit, kept (called by daemon). Do not remove.

---

## 4. Simplification candidates (older audit)

Deferred cleanup items from the component audit. Low priority but worth tracking.

- [x] **Sidebar nav rationalization**: merged /activity into /logs (Activity tab), removed /initiatives duplicate, deleted empty stub dirs.
- [x] **Context menu shared wrapper**: 5 variants following same pattern. Extract shared wrapper.
- [x] **Dialog merge**: create/edit pairs that differ only by mode. Merge into single form dialog.
- [x] **Crew (agent) form merge**: `crew/new/page.tsx` (483 lines) and `crew/[id]/edit/page.tsx` (560 lines) are ~80% identical. Extract `AgentForm` component, thin create/edit page wrappers.
- [x] **Skills form merge**: `skills/new/page.tsx` (226 lines) and `skills/[id]/page.tsx` (277 lines) same pattern. Extract `SkillForm` component.
- [x] **Checkpoints system evaluation**: removed. File-based system means users can back up the data dir directly.

## Done

- ~~Task field trim~~: removed `fieldTaskIds`, `dailyActions`/`DailyAction`, narrowed `acceptanceCriteria`. Commit `refactor(types): trim dead Task fields`.
- ~~Dashboard lean pass~~: 934 → 844 LOC, 10 → 4 widgets, 6 → 5 data fetches. Inline decision/report/brain-dump actions in Attention Required.
- ~~Comms sidebar grouping~~: Inbox, Decisions, Logs grouped under Messages. Commit `c3e3aa0`.
- ~~Daemon executor consolidation~~: `getWorkspaceEnv()` → `workspace-env.ts`, shared JSON I/O → `runs-registry.ts`, `ActiveRunEntry`/active-runs I/O → `active-runs.ts`, `extractSummary()` → `spawn-utils.ts`, `readJSON<T>()` → `data-io.ts`. Net -62 LOC across 4 scripts.
- ~~Missions route evaluated~~ — kept. Polled by `use-active-runs.ts`.
- ~~Agent field consolidation~~: `capabilities` removed. `allowedTools`, `skipPermissions`, `yolo` kept on Agent type by design.
- ~~Remove ventures (duplicate of projects)~~
- ~~Remove status-board (subset of priority-matrix)~~
- ~~Remove objectives/goals system, link initiatives to projects~~
- ~~Remove guide page~~
- ~~Replace redirect stubs with next.config redirects~~
- ~~Remove ethers dependency~~
- ~~Remove unused checkbox component~~
- ~~Clean dead exports from data.ts, types.ts, validations.ts~~
- ~~Delete sidebar-nav.tsx, use-dashboard.ts, goal components~~
- ~~Evaluate sync route~~ (kept, still used by daemon)
- ~~Evaluate missions route~~ (kept, used by project runs)
- ~~Remove ventures, status-board, guide, objectives/goals, redirect stubs, dead code~~ (-3,900 LOC, 73 files)
- ~~Convert TaskDetailPanel slide-in to full page `/tasks/[id]`~~ (-716 LOC, consistent UX)
- ~~Skeleton consolidation: 14 variants → 3-4 generic loading placeholders~~
- ~~Onboarding dialog evaluation: removed, 239 lines of stale first-run flow~~

---

_Section 3 items don't require immediate action. Tackle them when refactoring the relevant area._
