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

## 3. Simplification candidates from minimalization audit

Deferred cleanup items from the component audit. Low priority but worth tracking.

- [ ] **Sidebar nav rationalization**: 12 hidden vs 7 visible routes. Rebalance.
- [x] **Skeleton consolidation**: 14 variants → 3-4 generic loading placeholders.
- [ ] **Context menu shared wrapper**: 5 variants following same pattern. Extract shared wrapper.
- [ ] **Dialog merge**: create/edit pairs that differ only by mode. Merge into single form dialog.
- [ ] **Onboarding dialog evaluation**: 253 lines for a first-run flow with a single import. Evaluate if it still pulls its weight.
- [ ] **Checkpoints system evaluation**: 5 API routes (~400 LOC) for snapshot/restore. Only used by Settings backup/restore. Consider removal.

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

---

_Section 3 items don't require immediate action. Tackle them when refactoring the relevant area._
