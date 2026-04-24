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

These are deferred cleanup items that surfaced during the component audit. Low priority but worth tracking.

- **Sidebar navigation**: 12 hidden routes that never render, paired against 7 visible ones. Need to audit which ones are dead code and either expose or strip.
- **Skeleton components**: 14 component files that could collapse into 3-4 generic loading placeholders. Less to maintain, easier to theme.
- **Context menus**: 5 variants following the same pattern. Pull out a shared wrapper and delete the noise.
- **Dialog components**: Several create/edit pairs that differ only by mode. Merge into a single form dialog that handles both.
- **Onboarding dialog**: 253 lines for a first-run flow with a single import dependency. Worth evaluating if it still pulls its weight or can go.

---

*These don't require immediate action. Tackle them when refactoring the relevant area.*
