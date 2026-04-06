<p align="center">
  <img src="https://img.shields.io/badge/version-0.15-blue" alt="Version" />&nbsp;
  <img src="https://img.shields.io/github/license/MeisnerDan/mission-control" alt="License" />
</p>

<p align="center">
  <img src="mission-control/docs/rocket.svg" alt="Task Control Rocket" width="80" />
</p>

<h1 align="center">Task Control</h1>

<p align="center">
  <strong>Orchestrate AI agents. Ship what matters.</strong><br/>
  Open-source task orchestration hub for humans who delegate work to AI agents.<br/>
  <em>Forked from <a href="https://github.com/MeisnerDan/mission-control">Mission Control</a> with real-time streaming, multi-CLI support, and a general-purpose rebrand.</em>
</p>

<p align="center"><img src="mission-control/docs/demo.gif" alt="Task Control Demo" width="800" /></p>

<div align="center">
<br/>

**Capture** &middot; &middot; &middot; **Prioritize** &middot; &middot; &middot; **Delegate** &middot; &middot; &middot; **Execute** &middot; &middot; &middot; **Review**

You capture an idea. Agents research, build, and deliver.<br/>
You review their work and make the decisions that matter.<br/><br/>
**They write the code, post the updates, call the APIs,<br/>and keep things running.**<br/>
You stay in control without micromanaging.

<br/>
</div>

---

## What's New in This Fork

This fork adds significant features on top of the original Mission Control:

### 1. Workspace-Scoped IA (Workspaces → Goals → Initiatives → Tasks + Actions)

Full information architecture refactor for multi-client / multi-project use.

- **Workspaces** — isolated data contexts (separate data dirs per workspace); switch via the header switcher
- **Initiatives** — replace the old Projects/Milestones/Missions split; each initiative groups Tasks + Actions under one roof
- **Actions** — real-world side-effects (API calls, posts, payments) with a 3-tier autonomy cascade: action override → initiative override → workspace default
- **Inline editing** — title, description, status, and approval level all editable directly on the initiative page
- **Approvals queue** — cross-initiative pending actions with risk filtering, batch approve/reject, and vault unlock
- New API routes: `/api/workspaces`, `/api/initiatives`, `/api/actions`
- New components: WorkspaceSwitcher, AutonomySelector (colored shield buttons), GettingStartedCard

### 2. Real-Time Agent Streaming

See what your agents are doing **live**, not after the fact.

- **Live Console** -- expand any active session on the Automation page to watch agent output stream in real time (tool calls, responses, progress)
- **Server-Sent Events** -- `GET /api/runs/stream?runId=X` tails the agent's `.jsonl` stream file and pushes events to the browser
- **Stream-JSON output** -- the daemon uses `--output-format stream-json`, writing each event to `~/.cmc/agent-streams/<runId>.jsonl`
- **Auto-cleanup** -- stream files are pruned when completed runs expire (>1hr old)

### 3. @-Mention Agents in Comments

Tag any agent directly in a task or action comment to get their input.

- Type `@` in the comment box to see an autocomplete dropdown of available agents
- The mentioned agent receives the comment, reads the full task context, and responds with a new comment
- Works on **completed tasks** too -- if the agent determines rework is needed, it automatically reopens the task
- Agent responses appear inline in the comment thread with distinct styling (blue border + icon)
- Each mention spawns an independent agent session with live streaming support

### 4. Codex CLI Support (Optional)

Run agents on either **Claude Code** or **OpenAI Codex CLI**.

- Each agent has a `backend` field (`"claude"` or `"codex"`) configurable from the Agents UI
- The daemon auto-detects the correct binary (`claude` or `codex`) and spawns with appropriate flags
- Codex output is normalized to the same JSONL stream format for consistent live console display

### 5. File Attachments + Markdown Descriptions

Richer task and action detail panels.

- **File attachments** -- attach images and files to task descriptions and comments; stored in `~/.cmc/uploads/`
- **Markdown rendering** -- task descriptions render full markdown (headers, lists, code blocks); click to edit
- **Inline attachment previews** -- images display inline in comments; other files as download links
- **Auto-cleanup** -- orphaned uploads (unlinked files) removed on server start and via `pnpm cleanup:uploads`

### 6. Autopilot Resilience

The daemon survives server restarts and recovers from crashes automatically.

- **Auto-start on boot** -- if the daemon was running before a server restart, it restarts automatically via `instrumentation.ts`
- **Crash recovery sweep** -- on daemon startup, scans for `in-progress` tasks with no live process and resets them to `not-started`
- **Session resume** -- daemon captures Claude's session ID from stream-json output; on crash, attempts `--resume <sessionId>` so agents continue mid-task with full conversation history
- **Human-input pause** -- agents can pause execution and set `awaiting-decision` status when they need human input; daemon resumes automatically when the decision is answered

### 7. General-Purpose Rebrand

Renamed from founder/startup-specific terminology to general-purpose labels:

| Before | After |
|--------|-------|
| Mission Control | Task Control |
| Command Center | Dashboard |
| Ventures | Projects |
| Brain Dump | Quick Capture |
| Autopilot | Automation |
| Crew | Agents |
| Field Ops | Integrations / Actions |
| Comms | Messages |
| Activity | Logbook |

All route paths (`/ventures`, `/brain-dump`, etc.) are preserved for backwards compatibility.

---

## Why This Exists

AI agents are the greatest force multiplier you've ever had. But unleashing them without structure isn't leverage -- it's a liability. Credentials leak. Agents operate as black boxes. Nobody can tell you what's running, whether it finished, or if it went off the rails three hours ago.

**Task Control is the fenced playground where your AI agents can run wild -- but safely.** Agents get roles, inboxes, and reporting protocols. You capture ideas, agents research and execute, and Integrations launches actions into the world -- with approval workflows and spend limits at every step. You stay in control without micromanaging.

<table>
<tr>
<td align="center" width="25%">

**Prioritize**

Eisenhower matrix tells you what matters. Drag-and-drop tasks between Do, Schedule, Delegate, and Eliminate.

</td>
<td align="center" width="25%">

**Delegate**

Assign tasks to AI agents. They pick up work, execute, and post completion reports to your inbox.

</td>
<td align="center" width="25%">

**Supervise**

Dashboard, inbox, decisions queue. See every agent's workload, read their reports, answer their questions -- with live streaming.

</td>
<td align="center" width="25%">

**Execute**

Agents don't just manage tasks -- they execute real-world actions. Post to X, send ETH, call APIs. With approval workflows and spend limits.

</td>
</tr>
</table>

> **How is this different from Linear, Asana, or Notion?** Those tools were built for humans typing into forms. Task Control was built **agent-first** -- for a world where AI agents do the work and humans make the decisions. Agents read and write tasks through a token-optimized API, report progress to your inbox, and escalate when they need judgment. It runs locally -- no cloud dependency, no API keys leaked to third parties, no vendor lock-in.

---

## Features

### Core
- **Eisenhower Matrix** -- Prioritize by importance and urgency with drag-and-drop between quadrants
- **Kanban Board** -- Track work through Not Started, In Progress, and Done columns
- **Workspaces** -- Isolated data contexts for multi-client or multi-project use; switch via header
- **Goal → Initiative hierarchy** -- Long-term goals broken into initiatives; each initiative owns Tasks + Actions
- **Quick Capture** -- Capture ideas instantly, triage into tasks later
- **Agent Registry** -- 6 built-in agents + create unlimited custom agents with unique instructions
- **Skills Library** -- Define reusable knowledge modules and inject them into agent prompts
- **Multi-Agent Tasks** -- Assign a lead agent + collaborators for team-based work

### Agent Execution
- **Real-Time Streaming** -- Live console shows agent tool calls, responses, and progress as they happen
- **@-Mention in Comments** -- Tag agents in task or action comments to get their input; agents can reply or reopen tasks
- **Multi-CLI Backend** -- Run agents on Claude Code or OpenAI Codex CLI (per-agent configurable)
- **One-Click Execution** -- Press play on any task card to spawn an agent session
- **Autonomous Daemon** -- Background process that polls tasks, spawns sessions, enforces concurrency, with real-time dashboard
- **Auto-Start on Boot** -- Daemon auto-restarts when the Next.js server starts if it was running before
- **Crash Recovery** -- On daemon restart, orphaned in-progress tasks are reset; interrupted Claude sessions resume via `--resume`
- **Human-Input Pause** -- Daemon pauses agent execution when a decision is needed; resumes automatically when answered
- **Session Resilience** -- Agents that timeout or hit max turns auto-spawn continuation sessions
- **Continuous Missions** -- Run an entire project with one click; tasks auto-dispatch as dependencies resolve
- **Loop Detection** -- Auto-detects agents stuck in failure loops; escalates after 3 attempts

### Task & Action Detail
- **Markdown Descriptions** -- Task descriptions render full markdown; click to toggle edit mode
- **File Attachments** -- Attach images and files to task descriptions and action/task comments
- **Inline Previews** -- Images display inline; other files as download links
- **Comments on Actions** -- Full comment + @-mention support on Actions, not just Tasks

### Monitoring & Safety
- **Cost & Usage Tracking** -- Full token usage (input, output, cache) from every session
- **Live Session Console** -- Expandable live output view for each active session on the Automation page
- **SSE Stream API** -- `GET /api/runs/stream?runId=X` for programmatic access to live agent output
- **Failure Logging** -- Failed tasks generate events with error details, posted to inbox
- **Token-Optimized API** -- Filtered queries, sparse field selection, 92% context compression
- **193 Automated Tests** -- Vitest suite covering validation, data layer, daemon, agent flow, and security

### Integrations (Field Ops)
- **64-Service Catalog** -- Pre-configured services across 16 categories
- **3 Working Adapters** -- X, Ethereum (+ MetaMask wallet signing), Reddit
- **Encrypted Vault** -- AES-256-GCM encryption with scrypt key derivation
- **Financial Safety Controls** -- Per-service + global spend limits, circuit breaker
- **Approval Workflows** -- Risk classification + approval queue for high-risk actions
- **Emergency Stop** -- Kill switch that halts daemon, pauses missions, and locks the vault

---

## Quick Start

### Prerequisites

| Requirement | Why | Install |
|-------------|-----|---------|
| [Node.js](https://nodejs.org) v20+ | Runtime | [nodejs.org](https://nodejs.org) |
| [pnpm](https://pnpm.io) v9+ | Package manager | `npm install -g pnpm` |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) *(recommended)* | Agent execution | `npm install -g @anthropic-ai/claude-code` |
| [Codex CLI](https://github.com/openai/codex) *(optional)* | Alternative agent backend | `npm install -g @openai/codex` |

> The web UI works standalone for task management. Claude Code or Codex CLI is needed to **execute** tasks via agents.

### Install & Run

```bash
git clone https://github.com/anh-chu/claude-mission-control.git
cd claude-mission-control/mission-control
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and click **"Load Demo Data"** to explore with sample tasks, agents, and messages.

### What to Try First

1. **Explore the dashboard** -- task counts, agent workloads, recent activity
2. **Drag tasks** on the Priority Matrix between Do, Schedule, Delegate, and Eliminate
3. **Click a task card** to open the detail panel -- edit, add subtasks, or `@mention` an agent in comments
4. **Press the Launch button** on a task assigned to an agent -- watch the live console on the Automation page
5. **Open Claude Code** in this workspace and run `/daily-plan`

---

## How It Works

Task Control stores all data in local JSON files. No database, no cloud dependency. AI agents interact by reading and writing these files -- the same source of truth the web UI uses.

### The Agent Loop

```
1. You create a task          -->  Assign to an agent role (e.g., Researcher)
2. Press play (or daemon)     -->  Spawns a CLI session with agent persona
3. Agent executes             -->  Does the work, streams output live
4. Task Control completes     -->  Auto-marks done, posts report, logs activity
5. You review                 -->  Read reports in inbox, @mention agents for follow-up
```

Multiple agents can work in parallel. **Continuous missions** run all tasks in a project until done, auto-dispatching as dependencies resolve. The **daemon** (`pnpm daemon:start`) adds 24/7 background automation.

### @-Mention Flow

```
1. You comment "@researcher check the API docs"
2. Task Control parses the mention, validates the agent exists
3. Spawns a dedicated agent session with task context + your comment
4. Agent reads the task, your comment, and responds
5. Response appears as a new comment (with live streaming)
6. If the agent did work on a "done" task, it reopens automatically
```

---

## Agent API

Every endpoint is designed for minimal token consumption.

```bash
# Get only your in-progress tasks (~50 tokens vs ~5,400 for everything)
GET /api/tasks?assignedTo=developer&kanban=in-progress&fields=id,title,kanban

# Eisenhower DO quadrant only
GET /api/tasks?quadrant=do

# Live agent stream (Server-Sent Events)
GET /api/runs/stream?runId=run_123

# Post a comment with @-mention (spawns agent handler)
POST /api/tasks/:id/comment  { "content": "@researcher check this", "author": "me" }

# Run a single task
POST /api/tasks/:id/run

# Run all eligible tasks in a project
POST /api/projects/:id/run

# Stop a running task or project
POST /api/tasks/:id/stop
POST /api/projects/:id/stop
```

### Integrations API
```bash
POST /api/field-ops/execute          # Execute a field task
POST /api/field-ops/vault/setup      # Initialize encrypted vault
GET  /api/field-ops/catalog          # Browse 64-service catalog
POST /api/field-ops/batch            # Bulk approve/reject up to 50 tasks
```

All write endpoints use **Zod validation** and **async-mutex locking** for concurrent safety.

---

## Built-In Agents

| Role | Handles | Backend |
|------|---------|---------|
| **Me** | Decisions, approvals, creative direction | -- |
| **Researcher** | Market research, competitive analysis, evaluation | Claude / Codex |
| **Developer** | Code, bug fixes, testing, deployment | Claude / Codex |
| **Marketer** | Copy, growth strategy, content, SEO | Claude / Codex |
| **Business Analyst** | Strategy, planning, prioritization, financials | Claude / Codex |
| **Tester** | QA testing, bug reporting, performance analysis | Claude / Codex |
| **+ Custom** | Anything you define | Claude / Codex |

Each agent's backend (Claude Code or Codex CLI) is configurable from the Agents page.

---

## Architecture

```
~/.cmc/                                All persistent data (survives app updates)
  workspaces.json                      Workspace registry (id, name, color, autonomy default)
  workspaces/{id}/                     Per-workspace isolated data
    tasks.json                         Tasks with Eisenhower + Kanban + agent assignment
    initiatives.json                   Initiatives (group Tasks + Actions under a goal)
    actions.json                       Actions: real-world side-effects with approval workflow
    agents.json                        Agent registry (profiles, instructions, backend)
    goals.json                         Long-term goals
    projects.json                      Projects
    inbox.json                         Agent <-> human messages
    decisions.json                     Pending decisions requiring human judgment
    activity-log.json                  Timestamped event log
    daemon-config.json                 Autopilot config (polling, concurrency, autoStart)
    daemon-session-recovery.json       Persisted Claude session IDs for crash resume
    field-ops/                         Integrations data (services, vault, safety)
  agent-streams/                       Live JSONL stream files per active run
  uploads/                             File attachments (served via /uploads/[filename])
  ai-context.md                        Generated ~650-token workspace snapshot

mission-control/                       Next.js 15 web app (source only — no data here)
  instrumentation.ts                   Server startup hooks (upload cleanup, daemon auto-start)
  scripts/daemon/                      Agent daemon + execution scripts
    index.ts                           Daemon entry point (start/stop/status + crash recovery)
    dispatcher.ts                      Task polling, dispatch, retry queue, session resume
    runner.ts                          CLI runner (Claude Code + Codex CLI, stream-json)
    recovery.ts                        Crash recovery: orphan detection + session ID persistence
    health.ts                          Session tracking, stale PID cleanup, status persistence
    scheduler.ts                       Cron-based scheduled commands (daily-plan, standup, etc.)
  src/
    app/initiatives/                   Initiative list + detail pages
    app/approvals/                     Cross-initiative pending actions queue
    app/actions/activity/              Global actions activity log
    app/settings/                      Workspace settings + autopilot config
    app/api/workspaces/                Workspace CRUD
    app/api/initiatives/               Initiative CRUD (workspace-scoped)
    app/api/actions/                   Action CRUD (workspace-scoped)
    app/api/daemon/                    Autopilot start/stop/config (sets autoStart flag)
    components/autonomy-selector.tsx   Shield button autonomy toggle
    components/workspace-switcher.tsx  Workspace dropdown
    lib/action-adapter.ts              Maps Action → FieldTask for FieldTaskCard
    lib/autonomy.ts                    3-tier autonomy cascade resolver
    lib/workspace-context.ts           Reads x-workspace-id header in API routes
    lib/scheduled-jobs.ts              Upload cleanup scheduler
```

### Design Decisions

- **Local-first** -- No database, no cloud, no API keys. Plain JSON files on your machine.
- **Multi-CLI** -- Claude Code and Codex CLI as interchangeable agent backends.
- **Stream-first** -- All agent output is captured as JSONL and available via SSE for live monitoring.
- **Zod + Mutex** -- All API writes validated and serialized for concurrent multi-agent safety.
- **Defense in Depth** -- Encrypted vault, spend limits, autonomy levels, approval workflows, and master-password-protected safety controls.

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
| Testing | [Vitest](https://vitest.dev) (193 tests) |
| Storage | Local JSON files (no database) |
| Agent CLIs | [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Codex CLI](https://github.com/openai/codex) |

---

## Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm test             # Run all tests
pnpm verify           # Typecheck + lint + build + test
pnpm daemon:start     # Start autonomous daemon
pnpm daemon:stop      # Stop daemon
pnpm daemon:status    # Show daemon status + active sessions
pnpm gen:context      # Regenerate ai-context.md
pnpm cleanup:uploads  # Remove orphaned upload files from ~/.cmc/uploads
```

---

## Credits

Forked from [Mission Control](https://github.com/MeisnerDan/mission-control) by Dan Meisner. Original concept: an open-source command center for solo entrepreneurs delegating work to AI agents.

This fork generalizes the tool for any user orchestrating AI agent workflows, adds real-time streaming, multi-CLI support, and @-mention agent interactions.

---

## License

[AGPL-3.0](LICENSE) -- free to use, modify, and self-host. If you offer it as a hosted service, you must open-source your modifications under the same license.

---

<p align="center">
  <sub><strong>Orchestrate AI agents. Ship what matters.</strong></sub>
</p>
