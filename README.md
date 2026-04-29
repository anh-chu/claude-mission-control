<p align="center">
  <img src="https://img.shields.io/badge/version-0.15-blue" alt="Version" />&nbsp;
  <img src="https://img.shields.io/github/license/MeisnerDan/mission-control" alt="License" />
</p>

<p align="center">
  <img src="docs/rocket.svg" alt="Mandio" width="80" />
</p>

<h1 align="center">Mandio</h1>

<p align="center"><img src="docs/demo.gif" alt="Mandio Demo" width="800" /></p>

---

## What This Is

A self-hosted task manager that runs your work through AI agents. You add tasks, set priorities, and Autopilot handles execution: it spawns Claude Code sessions, streams output live, and routes decisions back to you.

Runs entirely on your machine. Data in `~/.mandio/`. No cloud.

## Quick Start with `npx mandio`

```bash
npx mandio dev     # Start dev server at localhost:3000
npx mandio start  # Start production server
npx mandio stop    # Stop production server
npx mandio status  # Show running services
npx mandio version # Show version
```

**Requirements**
- Node.js >= 18
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) (required for agent execution)
  - Install: `npm install -g @anthropic-ai/claude-code`
  - Run `claude` once to authenticate

**Configuration**
- `MANDIO_API_TOKEN` — optional auth token for API endpoints (not required for local use)
- `MANDIO_DATA_DIR` — data directory (default: `~/.mandio/`)
- `PORT` — server port (default: `3000`)

---

## The Mental Model

```
Workspace
  ├── Projects            (group related work)
  │     └── Initiatives   (active execution units)
  │           └── Tasks   (work items; agents run these)
```

**Tasks** are things agents *do*: research, write code, analyze, plan. They execute as Claude Code sessions, stream output live, and mark themselves done.

---

## Why Local-First

AI agent tools usually mean handing your tasks, credentials, and decisions to a cloud service. Mandio takes the opposite approach:

- **Data in `~/.mandio/`:** persists across app updates, never synced anywhere
- **No database:** plain JSON files you can read, edit, or back up directly
- **No vendor lock-in:** agents run via Claude Code, locally installed
- **Full audit trail:** every agent action logged in activity-log.json

Agents read and write the same JSON files the UI uses. There's no API translation layer between "what the agent sees" and "what you see."

---

## Autopilot

The daemon (`pnpm daemon:start`) is the engine. It runs as a detached background process, independent of the web server, and handles autonomous execution:

- **Watches for tasks** via file system events; picks up new work immediately as tasks.json changes
- **Spawns agent sessions** up to your concurrency limit
- **Persists across server restarts:** `autoStart: true` in daemon-config.json auto-relaunches on Next.js boot
- **Crash recovery:** on restart, orphaned in-progress tasks are reset; interrupted Claude sessions resume via `--resume <sessionId>` using the persisted conversation ID
- **Human-input pause:** when an agent needs a decision, it sets `awaiting-decision` status; Autopilot resumes automatically once you answer
- **Permission escalation:** if an agent tries to use a tool outside its allowed list, it auto-generates a decision item rather than failing silently
- **Inbox loop:** Autopilot posts to your inbox when it picks up, completes, or fails a task — you stay informed without watching dashboards
- **Exponential retry:** failed tasks retry with backoff, up to a configurable limit
- **Scheduled commands:** runs `/daily-plan`, `/standup`, `/weekly-review` on cron schedules

---

## Features

### Work Management
- **Eisenhower Matrix:** Prioritize by importance x urgency; drag-and-drop between Do, Schedule, Delegate, Eliminate
- **Kanban Board:** Not Started → In Progress → Done (+ Awaiting Decision for paused agent tasks)
- **Workspaces:** Isolated data contexts; switch workspaces from the sidebar header
- **Projects + Initiatives:** Group related work into projects; break each project into initiatives that own their Tasks
- **Quick Capture:** Capture ideas instantly, triage into tasks later

### Agent Execution
- **Autonomous Daemon:** 24/7 background process with concurrency control, retry queue, and live dashboard at `/autopilot`
- **One-Click Execution:** Press play on any task card to manually spawn an agent session
- **Real-Time Streaming:** Watch agent output live: tool calls, responses, progress as it happens
- **Claude Code Backend:** task execution via Claude Code CLI
- **@-Mention in Comments:** Tag any agent in a task or action comment; they read the context and respond inline
- **Continuous Missions:** Run an entire project; tasks auto-dispatch as dependencies resolve
- **Loop Detection:** Agents that keep failing the same task are escalated after 3 attempts rather than burning tokens indefinitely — safe to leave running unattended

### Resilience
- **Auto-Start on Boot:** Daemon relaunches automatically when the Next.js server starts
- **Session Resume:** Claude session IDs captured from stream output; crashed sessions resume mid-conversation
- **Crash Recovery Sweep:** Orphaned in-progress tasks detected on startup and reset for redispatch
- **Persistent Retry Queue:** Survives daemon restarts; retries resume with correct backoff timing

### Rich Task Detail
- **Markdown Descriptions:** Full markdown rendering in task descriptions; click to edit
- **File Attachments:** Attach images and files to task descriptions and comments; stored in `~/.mandio/uploads/`
- **Inline Previews:** Images render inline in comments; other files as download links
- **Comments:** Full comment thread and @-mention support on tasks

### Monitoring
- **Cost & Token Tracking:** Input, output, cache read/write tokens per session, cumulative totals
- **Live Session Console:** Expandable stream view for active sessions on the Automation page
- **SSE Stream API:** `GET /api/runs/stream?runId=X` for programmatic live output access
- **Activity Logbook:** Timestamped event log of all agent and system activity — accessible via the Activity tab in Logs

---

## Quick Start

### Prerequisites

| Requirement | Why | Install |
|-------------|-----|---------|
| [Node.js](https://nodejs.org) v20+ | Runtime | [nodejs.org](https://nodejs.org) |
| [pnpm](https://pnpm.io) v9+ | Package manager | `npm install -g pnpm` |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | Agent execution | `npm install -g @anthropic-ai/claude-code` |

> The web UI runs standalone for task management. Claude Code is required to actually **execute** tasks via agents.

### Install & Run

```bash
git clone https://github.com/anh-chu/mandio.git
cd mandio
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). On first run, click **"Load Demo Data"** to explore with sample tasks, agents, and messages.

Your workspace data is created at **`~/.mandio/`** on first launch, separate from the repo, so `git pull` never touches your data.

### Enable Autopilot

```bash
pnpm daemon:start
```

Or start it from **Settings → Autopilot** in the UI. Once started, Autopilot will automatically relaunch on server restart until you explicitly stop it.

### First Steps

1. Open the **Priority Matrix** and drag tasks into Do, Schedule, Delegate, or Eliminate
2. Click a task to open the detail panel and add a description, subtasks, or attach a file
3. Press **Launch** on a task assigned to an agent and watch it execute live on the Automation page
4. Check your **Inbox** for agent completion reports and questions

---

## How Execution Works

### The Autopilot Loop

```
Autopilot watches tasks.json for changes
  → Finds tasks: kanban=not-started, assignedTo≠me, unblocked
  → Spawns a Claude Code session with agent persona + task context
  → Agent executes, streams output live to ~/.mandio/agent-streams/<id>.jsonl
  → Agent marks task done, posts completion report to inbox.json
  → If agent needs human input → sets awaiting-decision, Autopilot pauses
  → You answer the decision → Autopilot resumes the task
```

### Crash Recovery

```
Server restarts (or crashes)
  → instrumentation.ts runs on Next.js boot
  → Reads daemon-config.json: if autoStart=true, spawns daemon
  → Daemon reads daemon-session-recovery.json for persisted session IDs
  → For each orphaned in-progress task:
      Has session ID → attempts claude --resume <sessionId> to continue mid-task
      No session ID  → resets to not-started, picked up on next file change
```

### @-Mention Flow

```
You comment "@researcher check the API docs"
  → Mandio parses the mention, validates agent exists
  → Spawns dedicated agent session with task context + your comment
  → Agent responds with a new comment (streams live)
  → If agent determines rework is needed on a done task, it reopens automatically
```

---

## Agent API

All endpoints are designed for minimal token consumption. Agents use these to read and write task data.

```bash
# Filtered task queries (much cheaper than fetching everything)
GET /api/tasks?assignedTo=developer&kanban=not-started&fields=id,title,description

# Eisenhower quadrant filter
GET /api/tasks?quadrant=do

# Live agent output stream (Server-Sent Events)
GET /api/runs/stream?runId=run_123

# Comment with @-mention (auto-spawns agent handler)
POST /api/tasks/:id/comment  { "content": "@researcher check this", "author": "me" }

# Manual task execution
POST /api/tasks/:id/run

# Project-wide execution (all eligible tasks)
POST /api/projects/:id/run
```

All write endpoints use **Zod validation** and **async-mutex locking** for concurrent multi-agent safety.

---

## Built-In Agents

| Role | Handles |
|------|---------|
| **Me** | Decisions, approvals, creative direction (human only) |
| **Researcher** | Market research, competitive analysis, evaluation |
| **Developer** | Code, bug fixes, testing, deployment |
| **Marketer** | Copy, growth strategy, content, SEO |
| **Business Analyst** | Strategy, planning, prioritization, financials |
| **Tester** | QA testing, bug reporting, performance analysis |
| **+ Custom** | Unlimited custom agents with unique instructions and skills |

Each agent uses Claude Code as its backend.

---

## Data & Architecture

```
~/.mandio/                                  All persistent data, never inside the repo
  workspaces.json                        Workspace registry
  workspaces/{id}/
    tasks.json                           Tasks (Eisenhower + kanban + agent assignment)
    initiatives.json                     Initiatives (group related tasks)
    goals.json                           Long-term goals
    agents.json                          Agent registry (persona, instructions, backend)
    inbox.json                           Agent <-> human messages
    decisions.json                       Pending decisions awaiting human input
    activity-log.json                    Full event log
    daemon-config.json                   Autopilot config (concurrency, autoStart, schedule)
    daemon-session-recovery.json         Claude session IDs for crash resume
  agent-streams/                         Live JSONL output per active agent session
  uploads/                               File attachments (served at /uploads/[filename])

                         Next.js 15 app (source only, no data here)
  instrumentation.ts                     Boot hooks: upload cleanup + daemon auto-start
  scripts/daemon/
    index.ts                             Daemon start/stop/status + startup crash recovery
    dispatcher.ts                        Task dispatch, retry queue, session resume, inbox notifications
    runner.ts                            CLI runner (Claude Code, stream-json output)
    recovery.ts                          Orphan detection + session ID persistence
    runs-registry.ts                     Shared JSON read/write/prune utilities for run-tracking modules
    workspace-env.ts                     Shared workspace env-var loader for daemon scripts
    health.ts                            Session tracking, PID checks, status persistence
    scheduler.ts                         Cron scheduled commands
  src/app/                               Pages + API routes
  src/components/                        React components (shadcn/ui)
  src/lib/                               Data layer, validation, adapters
```

### Design Principles

- **Local-first:** No database. No cloud. Plain JSON in `~/.mandio/`. Yours forever.
- **Agent-first API:** Every endpoint optimized for token-efficient agent reads and writes.
- **Daemon-first execution:** Autopilot is the default path, not an optional add-on.
- **Resilience by default:** Crash recovery, session resume, and retry queues built into the daemon.
- **Defense in depth:** Emergency stop, human-in-the-loop decisions.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [Next.js 15](https://nextjs.org) (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org) (strict mode) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Components | [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://www.radix-ui.com) |
| Drag & Drop | [@dnd-kit](https://dndkit.com) |
| Validation | [Zod](https://zod.dev) |
| Testing | [Vitest](https://vitest.dev) |
| Storage | Local JSON files (`~/.mandio/`) |
| Agent CLI | [Claude Code](https://docs.anthropic.com/en/docs/claude-code) |

---

## Commands

Run from inside ``:

```bash
pnpm dev              # Start dev server (http://localhost:3000)
pnpm build            # Production build
pnpm test             # Run test suite
pnpm verify           # Typecheck + lint + build + test
pnpm daemon:start     # Start Autopilot daemon
pnpm daemon:stop      # Stop Autopilot daemon
pnpm daemon:status    # Show daemon status + active sessions
pnpm gen:context      # Regenerate ~/.mandio/ai-context.md
pnpm cleanup:uploads  # Remove orphaned files from ~/.mandio/uploads
```

---

## Credits

Built on Mandio by Dan Meisner.

---

## License

[AGPL-3.0](LICENSE): free to use, modify, and self-host. If you offer it as a hosted service, you must open-source your modifications under the same license.

---

<p align="center">
  <sub><strong>Your AI agents work. You decide.</strong></sub>
</p>
