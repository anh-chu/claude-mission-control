# Navigation Refactor Plan: Inbox as Dashboard Tab (Option A)

## Goal
Merge Brain Dump, Activity, and Logs into Dashboard as tabs. Remove standalone pages. Preserve all existing functionality.

## Final Nav Structure

```
Dashboard (/)
├── Overview — existing attention hub + project cards + agent status
├── Inbox — brain dump capture, triage, auto-process, archive
├── Activity — chronological feed of agent completions, decisions, etc.
└── Logs — daemon poll logs, debug output

Work (/priority-matrix)
├── Board — kanban
├── Matrix — Eisenhower quadrants
└── Map — project canvas

Wiki (/documents)
├── Files — wiki file tree + editor
└── Graph — document link graph (future)

Agents (/crew)
├── Crew — agent cards, task counts, status
├── Autopilot — daemon scheduler, active sessions
└── Skills — skill/command/plugin library
```

## Implementation Steps

### Step 1: Extract Dashboard into tabbed layout
- Create `DashboardTabs` component for tab navigation
- Create `DashboardOverview` — extract existing page.tsx content
- Create `DashboardInbox` — extract brain-dump page.tsx content (minus capture textarea since that's global now)
- Create `DashboardActivity` — extract activity page.tsx content
- Create `DashboardLogs` — extract logs page.tsx content
- Modify `src/app/page.tsx` — render tabs + selected content, use query param `?tab=` for tab state

### Step 2: Redirect standalone pages
- `src/app/brain-dump/page.tsx` — redirect to `/?tab=inbox` (or show "use capture bar" message)
- `src/app/activity/page.tsx` — redirect to `/?tab=activity`
- `src/app/logs/page.tsx` — redirect to `/?tab=logs`

### Step 3: Clean up
- Remove `/brain-dump`, `/activity`, `/logs` from any navigation references (already done in TopNav)
- Clean up unused imports
- Delete orphaned components if any

### Step 4: Commit

## Notes
- The global capture bar at top already handles quick capture. Inbox tab does NOT need a textarea — it shows the list of entries to triage.
- Inbox tab needs: unprocessed list, auto-process button, archive section, convert-to-task, edit, delete — same as current brain-dump page minus the capture textarea at top.
- Query param `?tab=inbox|activity|logs` for direct linking. Default tab is "overview".
