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

### 3a. ~~Inbox + ActivityLog merge~~ API pagination dedup only

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

### ~~3b. Task field trim~~

~~**Types file**: `src/lib/types.ts` — `Task` interface, currently 21 fields.~~

Done. Removed `fieldTaskIds` (dead), `dailyActions`/`DailyAction` (always `[]`, never populated), changed `acceptanceCriteria: string[]` to `string`. Added `normalizeAcceptanceCriteria()` for persisted data compat. Time tracking fields kept (4 distinct concepts). See commit `refactor(types): trim dead Task fields`.

---

### ~~3c. Agent field consolidation~~

**Types file**: `src/lib/types.ts` — `Agent` interface, currently 11 fields.

Problems:
- `capabilities: string[]` and `skillIds: string[]` both describe what an agent can do — different data model, same intent. Pick one. `skillIds` ties to the skills registry; `capabilities` is free-text. Recommend keeping `skillIds`, dropping `capabilities`.
- `allowedTools: string[]`, `skipPermissions: 'inherit' | 'on' | 'off'`, `yolo: boolean` — execution-level knobs that belong in workspace or daemon config, not the agent definition. Only referenced in ~9 files. Move to `WorkspaceConfig` or daemon invocation options.
- After trim: 11 fields → ~7

Search usages before removing: `grep -r "allowedTools\|skipPermissions\|yolo\|capabilities" src/ scripts/`

---

### 3d. Missions route

- `src/app/api/missions/` — 367 LOC, handles multi-agent orchestration with reconciliation loops
- Only caller: `src/app/api/projects/[id]/run/route.ts`
- `ProjectRun` (simpler model) and `Mission` (adds reconciliation) overlap in `src/lib/types.ts`
- Options: inline mission logic into project run route, or add `ENABLE_MISSIONS=true` env flag
- Not surfaced in sidebar nav — already hidden from users

---

### 3e. Daemon executor consolidation

All scripts in `scripts/daemon/`:

| File | Size | Purpose |
|------|------|---------|
| `run-task.ts` | ~55 KB | execute a task via Claude |
| `run-inbox-respond.ts` | ~25 KB | respond to inbox message |
| `run-task-comment.ts` | ~19 KB | generate task comment |
| `run-brain-dump-triage.ts` | ~9 KB | triage brain dump input |
| `run-wiki-generate.ts` | ~9 KB | generate wiki content |

All 5 spawn a Claude Code subprocess with a prompt. Pattern is identical — load context, build prompt, spawn child, stream output, write result. Consolidate into `runner.ts` dispatcher with `{ actionType, payload }` input and a handler registry.

`scripts/daemon/runner.ts` and `scripts/daemon/security.ts` already exist as shared infra — build on top of those.

---

### 3g. notes + comments unification

**Types file**: `$T2` — `Task.notes: string` and `Task.comments: TaskComment[]`.

Both carry daemon-generated text about a task, built at different times with different shapes:
- `notes` — flat string, append-only scratchpad. Daemon writes mid-run progress, reads it back to resume. Also human-editable via form. No author, no timestamp.
- `comments` — structured `{ author, content, createdAt, attachments? }` array. Daemon pushes post-run summaries via `run-task-comment.ts`. Rendered as a thread in UI.

The split means users see two separate surfaces for daemon communication. A task has notes AND comments with no clear mental model for which is which.

Proposed unification: drop `notes: string`, extend comments with `type: 'note' | 'comment' | 'system'`. `note`-type comments replace the scratchpad role. Mid-run append in `run-task.ts` becomes a push-as-object instead of string concat. Daemon reads back the latest `note`-type comment instead of `task.notes`.

Files to update: `types.ts`, `validations.ts`, `tasks/route.ts`, `tasks/[id]/comment/route.ts`, `task-form.tsx`, `tasks/[id]/page.tsx`, `scripts/daemon/run-task.ts`, `scripts/daemon/run-task-comment.ts`, `scripts/daemon/prompt-builder.ts`.

Not urgent — both fields work. Design debt from incremental buildup.

---

### 3f. API action consolidation

Current task action routes (all thin wrappers, ~50 LOC each):
- `POST /api/tasks/[id]/run`
- `POST /api/tasks/[id]/stop`
- `POST /api/tasks/[id]/comment`

Consolidate into `POST /api/tasks/[id]/actions` with body `{ action: 'run' | 'stop' | 'comment', params?: {...} }`. Saves 3 route files, unifies auth/validation pattern.

Check all UI callers before merging: `grep -r "tasks.*run\|tasks.*stop\|tasks.*comment" src/`

---

### ~~3g. Dashboard lean pass~~

**Completed 2026-04-25.** Cut 6 widgets, crew status exceptions-only, attention required expanded with inline actions.

Result: 934 → 844 LOC (not 400 — inline actions added back ~176 LOC), 6 → 5 data fetches, 10 → 4 widgets. Net -90 LOC. Inline action UX (approve/reject decisions, ack reports, triage brain dump) justified the LOC trade-off over pure deletion.

Future: could drop inline actions and link out to `/decisions`, `/inbox`, `/brain-dump` to hit ~450 LOC if dashboard stays too heavy.

---

### 3h. Comms section lean pass

From product audit 2026-04-25. Sidebar groups Inbox, Decisions, Logs under "Messages" (subtitle: "Agent reports, decisions, and activity").

**Current state:**

| Page | LOC | What it renders |
|------|-----|-----------------|
| Inbox | ~500 | Full email client: thread grouping, compose dialog, reply/archive, agent auto-respond with SSE polling |
| Decisions | ~230 | Pending/answered queue with option buttons + custom text input |
| Logs | ~450 | 5 tabs: Daemon tail, App tail, Runs + consoles, Activity feed. SSE live stream. |

**Problems identified:**

1. **Grouping broken.** Logs mixes ops debugging (daemon tails, run consoles) with communications (activity events). Daemon log tails are not "messages."
2. **Inbox over-engineered.** Email metaphor wrong for AI agents. Threading, archive, unread, compose dialog, all model bilateral human communication. Agents respond to tasks/contexts, not mail threads. 500 LOC for a metaphor mismatch.
3. **Decisions redundant as standalone page.** If 3g's Attention Required gets inline actions (approve/reject), Decisions page has no reason to exist.
4. **Activity tab in Logs overlaps Inbox.** Both show "what agents did" in different shapes. Same data, two views.

**PR 1, cut pass:**
- Kill Inbox page (500 LOC). Agent communication already surfaces as activity events and decision requests.
- Kill Decisions page (230 LOC). Fold pending decisions into dashboard Attention Required per 3g.
- Extract ops tabs from Logs (Daemon, App, Runs) into dedicated Debug/Ops page.
- Remove sidebar "Messages" group.

**PR 2, restructure:**
- Create single Activity page: unified chronological stream of agent events + interactions.
  - Filters: by agent, by event type, by status.
  - Inline actions for decisions (from 3g's Attention Required pattern).
  - No threading, no email metaphor.
- Sidebar becomes: ops page (logs/runs/consoles) separate from activity page.
- Dashboard Attention Required pulls actionable items from same activity data.

**Prerequisite:** ~~3g PR 1 (dashboard cut pass) should land first.~~ Done. Attention Required inline actions landed. This restructure can proceed independently.

**Expected result:** ~730 LOC cut, cleaner nav grouping, one mental model for agent interactions instead of three overlapping ones.

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
