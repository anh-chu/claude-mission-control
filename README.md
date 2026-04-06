<p align="center">
  <img src="https://img.shields.io/badge/version-0.15-blue" alt="Version" />&nbsp;
  <img src="https://img.shields.io/github/license/MeisnerDan/mission-control" alt="License" />
</p>

<p align="center">
  <img src="mission-control/docs/rocket.svg" alt="Task Control" width="80" />
</p>

<h1 align="center">Task Control</h1>

<p align="center">
  <strong>Your AI agents work. You decide.</strong><br/>
  A local-first command center for autonomous AI agent execution —<br/>
  with real-time oversight, approval workflows, and crash-resilient background automation.
</p>

<p align="center"><img src="mission-control/docs/demo.gif" alt="Task Control Demo" width="800" /></p>

<div align="center">
<br/>

**Capture** &middot; &middot; &middot; **Prioritize** &middot; &middot; &middot; **Delegate** &middot; &middot; &middot; **Execute** &middot; &middot; &middot; **Review**

You capture an idea. Agents research, build, and deliver.<br/>
You review their work and make the decisions that matter.<br/><br/>
**They write the code, post the updates, call the APIs,<br/>and keep things running — even while you sleep.**<br/>
You stay in control without micromanaging.

<br/>
</div>

---

## What This Is

Task Control is a **local AI agent orchestration system**. It gives structure to autonomous AI work: agents have roles, operate on a shared task hierarchy, report back to your inbox, and pause for approval before taking consequential real-world actions.

The core idea: **you are the decision-maker, not the executor.** You define what needs doing, assign it to agents, and set how much autonomy they get. The Autopilot daemon runs in the background 24/7 — picking up tasks, spawning agent sessions, recovering from crashes, and routing human-input requests back to you.

Everything runs locally. Your data lives in `~/.cmc/` — no cloud, no telemetry, no API keys leaving your machine.

---

## The Mental Model

Work is organized in a four-level hierarchy:

```
Workspace
  └── Goals           (long-term outcomes you're working toward)
        └── Initiatives (projects grouping related work)
              ├── Tasks   (cognitive/execution work — agents run these)
              └── Actions (real-world side-effects — require your approval)
```

**Tasks** are things agents *do*: research, write code, analyze, plan. They execute as Claude Code or Codex CLI sessions, stream output live, and mark themselves done.

**Actions** are things agents *trigger in the world*: post to X, send ETH, call an API, send email. These flow through an approval queue — you approve or reject before anything happens.

**Autonomy levels** cascade from workspace → initiative → action. Set it once at the workspace level, override per initiative or per action as needed.

---

## Why Local-First

AI agent tools usually mean handing your tasks, credentials, and decisions to a cloud service. Task Control takes the opposite approach:

- **Data in `~/.cmc/`** — persists across app updates, never synced anywhere
- **No database** — plain JSON files you can read, edit, or back up directly
- **No vendor lock-in** — agents run via Claude Code or Codex CLI, both locally installed
- **Full audit trail** — every agent action logged in activity-log.json

Agents read and write the same JSON files the UI uses. There's no API translation layer between "what the agent sees" and "what you see."

---

## Autopilot

The daemon (`pnpm daemon:start`) is the engine. It runs as a detached background process — independent of the web server — and handles autonomous execution:

- **Polls for tasks** on a configurable interval (default: 5 min)
- **Spawns agent sessions** up to your concurrency limit
- **Persists across server restarts** — `autoStart: true` in daemon-config.json auto-relaunches on Next.js boot
- **Crash recovery** — on restart, orphaned in-progress tasks are reset; interrupted Claude sessions resume via `--resume <sessionId>` using the persisted conversation ID
- **Human-input pause** — when an agent needs a decision, it sets `awaiting-decision` status; Autopilot resumes automatically once you answer
- **Exponential retry** — failed tasks retry with backoff, up to a configurable limit
- **Scheduled commands** — runs `/daily-plan`, `/standup`, `/weekly-review` on cron schedules

---

## Features

### Work Management
- **Eisenhower Matrix** — Prioritize by importance × urgency; drag-and-drop between Do, Schedule, Delegate, Eliminate
- **Kanban Board** — Not Started → In Progress → Done (+ Awaiting Decision for paused agent tasks)
- **Workspaces** — Isolated data contexts; switch workspaces from the sidebar header
- **Goals + Initiatives** — Long-term goals broken into initiatives; each initiative owns its Tasks and Actions
- **Quick Capture** — Capture ideas instantly, triage into tasks later

### Agent Execution
- **Autonomous Daemon** — 24/7 background process with concurrency control, retry queue, and live dashboard at `/daemon`
- **One-Click Execution** — Press play on any task card to manually spawn an agent session
- **Real-Time Streaming** — Watch agent output live: tool calls, responses, progress — as it happens
- **Multi-CLI Backend** — Claude Code or Codex CLI, configurable per agent
- **@-Mention in Comments** — Tag any agent in a task or action comment; they read the context and respond inline
- **Continuous Missions** — Run an entire project; tasks auto-dispatch as dependencies resolve
- **Loop Detection** — Detects agents stuck in failure loops; escalates after 3 attempts

### Resilience
- **Auto-Start on Boot** — Daemon relaunches automatically when the Next.js server starts
- **Session Resume** — Claude session IDs captured from stream output; crashed sessions resume mid-conversation
- **Crash Recovery Sweep** — Orphaned in-progress tasks detected on startup and reset for redispatch
- **Persistent Retry Queue** — Survives daemon restarts; retries resume with correct backoff timing

### Actions & Integrations
- **Approval Queue** — Cross-initiative view of pending Actions; filter by risk, batch approve/reject
- **3-Tier Autonomy** — Action-level → initiative-level → workspace-level autonomy cascade
- **64-Service Catalog** — Pre-configured services across 16 categories
- **Working Adapters** — X/Twitter, Ethereum (+ MetaMask wallet signing), Reddit
- **Encrypted Vault** — AES-256-GCM, scrypt key derivation, session-locked
- **Financial Safety Controls** — Per-service + global spend limits, circuit breaker, emergency stop

### Rich Task Detail
- **Markdown Descriptions** — Full markdown rendering in task descriptions; click to edit
- **File Attachments** — Attach images and files to task descriptions and comments; stored in `~/.cmc/uploads/`
- **Inline Previews** — Images render inline in comments; other files as download links
- **Comments on Actions** — Full comment thread + @-mention support on Actions, not just Tasks

### Monitoring
- **Cost & Token Tracking** — Input, output, cache read/write tokens per session, cumulative totals
- **Live Session Console** — Expandable stream view for active sessions on the Automation page
- **SSE Stream API** — `GET /api/runs/stream?runId=X` for programmatic live output access
- **Activity Logbook** — Timestamped event log of all agent and system activity

---

## Quick Start

### Prerequisites

| Requirement | Why | Install |
|-------------|-----|---------|
| [Node.js](https://nodejs.org) v20+ | Runtime | [nodejs.org](https://nodejs.org) |
| [pnpm](https://pnpm.io) v9+ | Package manager | `npm install -g pnpm` |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) *(recommended)* | Agent execution | `npm install -g @anthropic-ai/claude-code` |
| [Codex CLI](https://github.com/openai/codex) *(optional)* | Alternative agent backend | `npm install -g @openai/codex` |

> The web UI runs standalone for task management. Claude Code or Codex CLI is required to actually **execute** tasks via agents.

### Install & Run

```bash
git clone https://github.com/anh-chu/claude-mission-control.git
cd claude-mission-control/mission-control
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). On first run, click **"Load Demo Data"** to explore with sample tasks, agents, and messages.

Your workspace data is created at **`~/.cmc/`** on first launch — separate from the repo, so `git pull` never touches your data.

### Enable Autopilot

```bash
pnpm daemon:start
```

Or start it from **Settings → Autopilot** in the UI. Once started, Autopilot will automatically relaunch on server restart until you explicitly stop it.

### First Steps

1. Open the **Priority Matrix** — drag tasks into Do, Schedule, Delegate, or Eliminate
2. Click a task to open the detail panel — add a description, subtasks, or attach a file
3. Press **Launch** on a task assigned to an agent — watch it execute live on the Automation page
4. Check your **Inbox** for agent completion reports and questions
5. Go to **Integrations** to set up real-world actions with approval workflows

---

## How Execution Works

### The Autopilot Loop

```
Autopilot polls tasks.json every N minutes
  → Finds tasks: kanban=not-started, assignedTo≠me, unblocked
  → Spawns a Claude Code / Codex CLI session with agent persona + task context
  → Agent executes, streams output live to ~/.cmc/agent-streams/<id>.jsonl
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
      No session ID  → resets to not-started, picked up on next poll
```

### @-Mention Flow

```
You comment "@researcher check the API docs"
  → Task Control parses the mention, validates agent exists
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

```bash
# Actions & Integrations
POST /api/field-ops/execute       # Execute an approved Action
POST /api/field-ops/vault/setup   # Initialize encrypted vault
GET  /api/field-ops/catalog       # Browse service catalog
POST /api/field-ops/batch         # Bulk approve/reject Actions
```

All write endpoints use **Zod validation** and **async-mutex locking** for concurrent multi-agent safety.

---

## Built-In Agents

| Role | Handles |
|------|---------|
| **Me** | Decisions, approvals, creative direction — human only |
| **Researcher** | Market research, competitive analysis, evaluation |
| **Developer** | Code, bug fixes, testing, deployment |
| **Marketer** | Copy, growth strategy, content, SEO |
| **Business Analyst** | Strategy, planning, prioritization, financials |
| **Tester** | QA testing, bug reporting, performance analysis |
| **+ Custom** | Unlimited custom agents with unique instructions and skills |

Each agent can use Claude Code or Codex CLI as its backend — configurable from the Agents page.

---

## Data & Architecture

```
~/.cmc/                                  All persistent data — never inside the repo
  workspaces.json                        Workspace registry
  workspaces/{id}/
    tasks.json                           Tasks (Eisenhower + kanban + agent assignment)
    initiatives.json                     Initiatives (group Tasks + Actions)
    actions.json                         Actions (real-world side-effects + approval state)
    goals.json                           Long-term goals
    agents.json                          Agent registry (persona, instructions, backend)
    inbox.json                           Agent ↔ human messages
    decisions.json                       Pending decisions awaiting human input
    activity-log.json                    Full event log
    daemon-config.json                   Autopilot config (polling, concurrency, autoStart)
    daemon-session-recovery.json         Claude session IDs for crash resume
    field-ops/                           Services, vault, safety controls
  agent-streams/                         Live JSONL output per active agent session
  uploads/                               File attachments (served at /uploads/[filename])

mission-control/                         Next.js 15 app (source only — no data here)
  instrumentation.ts                     Boot hooks: upload cleanup + daemon auto-start
  scripts/daemon/
    index.ts                             Daemon start/stop/status + startup crash recovery
    dispatcher.ts                        Task polling, dispatch, retry queue, session resume
    runner.ts                            CLI runner (Claude Code + Codex, stream-json output)
    recovery.ts                          Orphan detection + session ID persistence
    health.ts                            Session tracking, PID checks, status persistence
    scheduler.ts                         Cron scheduled commands
  src/app/                               Pages + API routes
  src/components/                        React components (shadcn/ui)
  src/lib/                               Data layer, validation, adapters
```

### Design Principles

- **Local-first** — No database. No cloud. Plain JSON in `~/.cmc/`. Yours forever.
- **Agent-first API** — Every endpoint optimized for token-efficient agent reads and writes.
- **Daemon-first execution** — Autopilot is the default path, not an optional add-on.
- **Resilience by default** — Crash recovery, session resume, and retry queues built into the daemon.
- **Defense in depth** — Encrypted vault, spend limits, autonomy levels, approval workflows, emergency stop.

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
| Storage | Local JSON files (`~/.cmc/`) |
| Agent CLIs | [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Codex CLI](https://github.com/openai/codex) |

---

## Commands

Run from inside `mission-control/`:

```bash
pnpm dev              # Start dev server (http://localhost:3000)
pnpm build            # Production build
pnpm test             # Run test suite
pnpm verify           # Typecheck + lint + build + test
pnpm daemon:start     # Start Autopilot daemon
pnpm daemon:stop      # Stop Autopilot daemon
pnpm daemon:status    # Show daemon status + active sessions
pnpm gen:context      # Regenerate ~/.cmc/ai-context.md
pnpm cleanup:uploads  # Remove orphaned files from ~/.cmc/uploads
```

---

## Credits

Built on [Mission Control](https://github.com/MeisnerDan/mission-control) by Dan Meisner.

---

## License

[AGPL-3.0](LICENSE) — free to use, modify, and self-host. If you offer it as a hosted service, you must open-source your modifications under the same license.

---

<p align="center">
  <sub><strong>Your AI agents work. You decide.</strong></sub>
</p>
