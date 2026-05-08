# Data Model

Where things are stored, what tracks what, and which files are current vs legacy.

## Current (source of truth)

| File / Store | Purpose | Schema |
|---|---|---|
| `workspaces/<id>/tasks.json` | Task board: titles, descriptions, kanban status, assigned agents, subtasks, comments | `{ tasks: TaskDef[] }` |
| `workspaces/<id>/agents.json` | Agent definitions: instructions, capabilities, linked skills | `{ agents: AgentDef[] }` |
| `workspaces/<id>/missions.json` | Project runs: batch task execution with chain dispatch | `{ missions: ProjectRun[] }` |
| `workspaces/<id>/decisions.json` | Pending decisions: agent questions that block task execution until answered | `{ decisions: DecisionItem[] }` |
| `workspaces/<id>/inbox.json` | Inbox messages: delegation, reports, updates from agents to user | `{ messages: InboxMessage[] }` |
| `workspaces/<id>/activity-log.json` | Activity events: task completions, failures, lifecycle events | `{ events: ActivityEvent[] }` |
| `workspaces/<id>/conversations/` (JSONL) | **Unified run tracking** for all agent execution: chat, tasks, scheduled commands, manual runs. Each conversation has turns, runs, and events. | `Conversation`, `ConversationRun`, `ConversationTurn` |
| `workspaces/<id>/daemon-config.json` | Autopilot configuration: polling, concurrency, schedule entries | `DaemonConfig` |
| `workspaces/<id>/ai-context.md` | Regenerated context snapshot for agents (read first before executing) | Markdown |

## Legacy (phased out, partially still read)

| File | Purpose | Migration status |
|---|---|---|
| `workspaces/<id>/active-runs.json` | **Old** task run tracking: PIDs, status, cost. Still dual-written by `run-task.ts` and read by the autopilot poller for recovery + concurrency counting. | **In progress.** Task runs also write to conversations. Once the poller uses conversation counts, this file and `scripts/daemon/active-runs.ts` can be deleted. |
| `workspaces/<id>/daemon-status.json` | **Old** daemon status: PID, uptime, session history, stats. No longer written by any process. The autopilot poller (`scheduled-jobs.ts`) replaces the old daemon. | **Dead.** The `/api/daemon` GET handler reads it for history but also merges conversation data. Remove once UI fully reads from conversations. |
| `workspaces/<id>/decision-sessions.json` | **Old** decision-to-session mapping. Replaced by `ConversationRun.sessionHandle`. | **Dead.** `consumeDecisionSession` in `run-task.ts` now deletes the file when empty. |

## Run entity types

Three different "run" concepts — don't confuse them:

| Entity | File | Key fields | Used for |
|---|---|---|---|
| `ActiveRun` | active-runs.json | taskId, agentId, pid, status, costUsd | **Legacy** task execution tracking |
| `ConversationRun` | conversations/ JSONL | conversationId, sessionHandle, pid, status | **Current** per-session execution within a conversation |
| `ProjectRun` (mission) | missions.json | projectId, completedTasks, taskHistory | Batch task execution across a project |

## Conversation execution sources

All agent runs create a conversation. The `executionSource` field distinguishes them:

| Source | Triggered by | Entrypoint |
|---|---|---|
| `chat` | User in chat sidebar | `run-conversation.ts <convId>` |
| `task` / `autopilot` / `project-run` / `mission-chain` | Task board dispatch | `run-task.ts <taskId>` |
| `scheduled` | Cron schedule in daemon-config | Pre-created conversation → `run-conversation.ts <convId>` |
| `manual` | "Run Now" button in autopilot page | Pre-created conversation → `run-conversation.ts <convId>` |
| `webhook` / `inbox-respond` / `comment` / `wiki` | (reserved, not yet implemented) | — |

## Key scripts

| Script | Purpose |
|---|---|
| `scripts/daemon/run-task.ts` | Execute a **task** (needs task ID, assigned agent, kanban validation). Writes to both active-runs.json and conversations. |
| `scripts/daemon/run-conversation.ts` | Execute a **conversation** (generic: chat, commands, manual runs). Reads latest user turn, spawns Claude, writes conversation events. No active-runs.json. |
| `scripts/daemon/runner.ts` | Low-level Claude spawn: `AgentRunner.spawnAgent()`. Takes a prompt string, returns exit code + output. |
| `src/lib/scheduled-jobs.ts` | In-process autopilot: recovery sweep, task dispatch, scheduled command dispatch. Runs inside the Next.js server via `cron.schedule`. |
| `src/lib/conversations.ts` | Conversation persistence: CRUD, turns, runs, locks, `reapStaleRuns`. |
| `scripts/daemon/conversation-writer.ts` | Daemon-side JSONL → conversation turn/event translation. Used by both `run-task.ts` and `run-conversation.ts`. |

## UI → route mapping

| UI page | Route | Key component |
|---|---|---|
| Autopilot (automation dashboard) | `/crew?tab=autopilot` | `AutopilotPage` (`src/components/autopilot-page.tsx`) |
| Agent management | `/crew/<id>` | Crew detail page |
| Tasks | `/tasks/<id>` | Task detail with embedded conversation |
| Chat sidebar | Overlay | `ChatSidebar` → `ConversationList` + `ConversationView` |
