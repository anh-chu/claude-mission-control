# TODO

Near-term focus for Mandio. Not a full roadmap, just the next two bets.

## 1. Canvas automation workflow builder

A visual canvas where you compose automations by connecting nodes (triggers, agents, actions, decisions). Goal: let non-engineers assemble multi-step agent flows without touching JSON.

- Node types: task trigger, agent run, conditional, decision prompt, webhook, delay
- Drag/drop layout persisted per workspace
- Live execution overlay (nodes light up as the daemon runs them)
- Export flow to a runnable spec the daemon can dispatch
- Reuses existing Autopilot execution engine, no new runtime

Open questions: node spec format, storage location in `~/.cmc/workspaces/{id}/`, whether to reuse `@dnd-kit` or bring in a graph lib.

## Done

- ~~Component simplification pass~~: sidebar nav rationalized, context menu wrapper extracted, dialog create/edit pairs merged, AgentForm and SkillForm extracted, checkpoints system removed.
- ~~Verify brain-dump/automate~~: called by `brain-dump/page.tsx` (lines 68, 83). Keep route and daemon script.
- ~~Inbox/ActivityLog pagination dedup~~: shared pagination helper extracted. Full stream merge ruled out (bilateral vs unidirectional, daemon bypasses API).
- ~~Notes + comments unification~~: dropped `Task.notes`, added `TaskComment.type`. Daemon, API, UI, validation all updated.
- ~~API action consolidation~~: `run`, `stop`, `comment` sub-routes consolidated into shared task route helpers. Commit `30cd06a`.
- ~~Comms section restructure~~: Inbox and Decisions pages removed, Logs split into ops/activity, single Activity page with inline decision actions. Commit `c87dc96`.
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
