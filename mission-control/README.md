# Task Control — Mission Control App

The Next.js web app and Autopilot daemon. See the [main README](../README.md) for full documentation, philosophy, and architecture.

## Quick Start

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Your workspace data is created at `~/.cmc/` on first launch — separate from this repo.

Click **"Load Demo Data"** on the welcome screen to explore with sample tasks, agents, and messages.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm tsc --noEmit` | TypeScript type check |
| `pnpm test` | Run test suite |
| `pnpm verify` | Typecheck + lint + build + test |
| `pnpm seed:demo` | Load sample demo data |
| `pnpm gen:context` | Regenerate `~/.cmc/ai-context.md` |
| `pnpm daemon:start` | Start Autopilot daemon |
| `pnpm daemon:stop` | Stop daemon |
| `pnpm daemon:status` | Show daemon status + active sessions |
| `pnpm cleanup:uploads` | Remove orphaned files from `~/.cmc/uploads` |

## Data

All persistent data lives in **`~/.cmc/`** — never inside this repo directory. The app reads and writes there automatically. You can back it up, inspect it, or edit it directly.

```
~/.cmc/
  workspaces.json              Workspace registry
  workspaces/{id}/             Per-workspace data
    tasks.json
    initiatives.json
    actions.json
    goals.json
    agents.json
    inbox.json
    decisions.json
    activity-log.json
    daemon-config.json         Autopilot config (includes autoStart flag)
    daemon-session-recovery.json
    field-ops/
  agent-streams/               Live JSONL output per agent session
  uploads/                     File attachments
```

## Autopilot (Daemon)

The daemon is a background process that polls tasks and autonomously dispatches agent sessions.

```bash
pnpm daemon:start   # Starts and persists autoStart=true in daemon-config.json
pnpm daemon:stop    # Stops and sets autoStart=false
pnpm daemon:status  # Shows PID, uptime, active sessions, stats
```

**Auto-start:** If the daemon was running when the server last stopped, it relaunches automatically on the next `pnpm dev` / `pnpm start` via `instrumentation.ts`.

**Crash recovery:** On startup, the daemon scans for orphaned in-progress tasks and either resumes interrupted Claude sessions via `--resume` or resets tasks to not-started for redispatch.

Dashboard available at `/daemon` in the UI.

## Project Structure

```
instrumentation.ts           Boot hooks (upload cleanup, daemon auto-start)
scripts/daemon/
  index.ts                   Daemon entry: start/stop/status + crash recovery
  dispatcher.ts              Task polling, dispatch, retry queue, session resume
  runner.ts                  CLI runner (Claude Code + Codex, stream-json)
  recovery.ts                Orphan detection + session ID persistence
  health.ts                  Session tracking, stale PID cleanup
  scheduler.ts               Cron scheduled commands
src/
  app/                       Next.js App Router pages + API routes
    (root)/                  Dashboard, tasks, projects, matrix
    initiatives/             Initiative list + detail (inline editing)
    approvals/               Pending Actions approval queue
    actions/activity/        Global actions activity log
    settings/                Workspace settings + Autopilot config
    daemon/                  Autopilot dashboard
    api/                     All API routes (workspace-scoped)
  components/                React components (shadcn/ui + custom)
    task-detail-panel.tsx    Task detail: markdown description, subtasks, comments, attachments
    action-detail-panel.tsx  Action detail: comments, attachments, approval state
    autonomy-selector.tsx    Shield button autonomy toggle
    workspace-switcher.tsx   Workspace dropdown
  hooks/                     SWR-based data hooks
  lib/
    data.ts                  File read/write with mutex locking
    validations.ts           Zod schemas for all API inputs
    autonomy.ts              3-tier cascade: action > initiative > workspace
    workspace-context.ts     x-workspace-id header resolver
    scheduled-jobs.ts        Upload cleanup scheduler
    adapters/                Service adapters (Twitter, Ethereum, Reddit)
```

## Claude Code Integration

Task Control is designed to work alongside [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Agents operate by reading and writing JSON files under `~/.cmc/workspaces/{id}/`. See [CLAUDE.md](../CLAUDE.md) for the full agent operations manual — data schemas, communication protocols, and slash commands.

## Troubleshooting

**Port 3000 stuck after crash:**
- Linux/macOS: `lsof -ti:3000 | xargs kill -9`
- Or use `pnpm daemon:stop` first if the daemon is holding connections

**Daemon won't start:**
- Check `~/.cmc/daemon.pid` for a stale PID file and delete it
- Run `pnpm daemon:status` to see the current state

## License

[AGPL-3.0](../LICENSE)
