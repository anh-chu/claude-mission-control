# Route

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Route subsystem handles **99 routes** and touches: cache, auth, ai, queue, db.

## Routes

- `GET` `/api/activity-log` → out: { data, events, meta } [cache]
  `src/app/api/activity-log/route.ts`
- `POST` `/api/activity-log` → out: { data, events, meta } [cache]
  `src/app/api/activity-log/route.ts`
- `DELETE` `/api/activity-log` → out: { data, events, meta } [cache]
  `src/app/api/activity-log/route.ts`
- `GET` `/api/agents` → out: { data, agents, meta } [cache]
  `src/app/api/agents/route.ts`
- `POST` `/api/agents` → out: { data, agents, meta } [cache]
  `src/app/api/agents/route.ts`
- `PUT` `/api/agents` → out: { data, agents, meta } [cache]
  `src/app/api/agents/route.ts`
- `DELETE` `/api/agents` → out: { data, agents, meta } [cache]
  `src/app/api/agents/route.ts`
- `GET` `/api/assets/[...path]` → out: { error } [cache, upload]
  `src/app/api/assets/[...path]/route.ts`
- `PUT` `/api/assets/[...path]` → out: { error } [cache, upload]
  `src/app/api/assets/[...path]/route.ts`
- `POST` `/api/brain-dump/automate` → out: { error }
  `src/app/api/brain-dump/automate/route.ts`
- `GET` `/api/brain-dump` → out: { data, entries, meta } [cache]
  `src/app/api/brain-dump/route.ts`
- `POST` `/api/brain-dump` → out: { data, entries, meta } [cache]
  `src/app/api/brain-dump/route.ts`
- `PUT` `/api/brain-dump` → out: { data, entries, meta } [cache]
  `src/app/api/brain-dump/route.ts`
- `DELETE` `/api/brain-dump` → out: { data, entries, meta } [cache]
  `src/app/api/brain-dump/route.ts`
- `GET` `/api/chat/messages` → out: { error } [auth, ai]
  `src/app/api/chat/messages/route.ts`
- `GET` `/api/chat` [auth, queue, ai]
  `src/app/api/chat/route.ts`
- `POST` `/api/chat` [auth, queue, ai]
  `src/app/api/chat/route.ts`
- `POST` `/api/chat/session` → out: { ok } [auth]
  `src/app/api/chat/session/route.ts`
- `PATCH` `/api/chat/session` → out: { ok } [auth]
  `src/app/api/chat/session/route.ts`
- `DELETE` `/api/chat/session` → out: { ok } [auth]
  `src/app/api/chat/session/route.ts`
- `GET` `/api/claude/models` → out: { models } [db, cache, ai]
  `src/app/api/claude/models/route.ts`
- `GET` `/api/claude/slash-commands` → out: { commands } [db, cache, ai]
  `src/app/api/claude/slash-commands/route.ts`
- `GET` `/api/commands/activate` → out: { error }
  `src/app/api/commands/activate/route.ts`
- `POST` `/api/commands/activate` → out: { error }
  `src/app/api/commands/activate/route.ts`
- `GET` `/api/commands` → out: { error }
  `src/app/api/commands/route.ts`
- `POST` `/api/commands` → out: { error }
  `src/app/api/commands/route.ts`
- `PUT` `/api/commands` → out: { error }
  `src/app/api/commands/route.ts`
- `DELETE` `/api/commands` → out: { error }
  `src/app/api/commands/route.ts`
- `GET` `/api/daemon` → out: { status, config, isRunning } [auth, cache]
  `src/app/api/daemon/route.ts`
- `POST` `/api/daemon` → out: { status, config, isRunning } [auth, cache]
  `src/app/api/daemon/route.ts`
- `PUT` `/api/daemon` → out: { status, config, isRunning } [auth, cache]
  `src/app/api/daemon/route.ts`
- `GET` `/api/dashboard` → out: { stats } [cache]
  `src/app/api/dashboard/route.ts`
- `GET` `/api/decisions` → out: { data, decisions, meta } [cache, queue]
  `src/app/api/decisions/route.ts`
- `POST` `/api/decisions` → out: { data, decisions, meta } [cache, queue]
  `src/app/api/decisions/route.ts`
- `PUT` `/api/decisions` → out: { data, decisions, meta } [cache, queue]
  `src/app/api/decisions/route.ts`
- `DELETE` `/api/decisions` → out: { data, decisions, meta } [cache, queue]
  `src/app/api/decisions/route.ts`
- `POST` `/api/emergency-stop` → out: { ok, results }
  `src/app/api/emergency-stop/route.ts`
- `GET` `/api/inbox` → out: { data, messages, meta } [cache]
  `src/app/api/inbox/route.ts`
- `POST` `/api/inbox` → out: { data, messages, meta } [cache]
  `src/app/api/inbox/route.ts`
- `PUT` `/api/inbox` → out: { data, messages, meta } [cache]
  `src/app/api/inbox/route.ts`
- `DELETE` `/api/inbox` → out: { data, messages, meta } [cache]
  `src/app/api/inbox/route.ts`
- `GET` `/api/initiatives` → out: { data, meta } [cache]
  `src/app/api/initiatives/route.ts`
- `POST` `/api/initiatives` → out: { data, meta } [cache]
  `src/app/api/initiatives/route.ts`
- `PUT` `/api/initiatives` → out: { data, meta } [cache]
  `src/app/api/initiatives/route.ts`
- `DELETE` `/api/initiatives` → out: { data, meta } [cache]
  `src/app/api/initiatives/route.ts`
- `GET` `/api/logs/app` → out: { lines, error }
  `src/app/api/logs/app/route.ts`
- `GET` `/api/logs/daemon` → out: { lines, error }
  `src/app/api/logs/daemon/route.ts`
- `GET` `/api/logs/stream` [cache, queue]
  `src/app/api/logs/stream/route.ts`
- `GET` `/api/missions` → out: { missions }
  `src/app/api/missions/route.ts`
- `GET` `/api/plugins` → out: { plugins }
  `src/app/api/plugins/route.ts`
- `POST` `/api/projects/[id]/run` params(id) → out: { error, missionId } [queue]
  `src/app/api/projects/[id]/run/route.ts`
- `POST` `/api/projects/[id]/stop` params(id) → out: { error }
  `src/app/api/projects/[id]/stop/route.ts`
- `GET` `/api/projects` → out: { data, projects, meta } [cache]
  `src/app/api/projects/route.ts`
- `POST` `/api/projects` → out: { data, projects, meta } [cache]
  `src/app/api/projects/route.ts`
- `PUT` `/api/projects` → out: { data, projects, meta } [cache]
  `src/app/api/projects/route.ts`
- `DELETE` `/api/projects` → out: { data, projects, meta } [cache]
  `src/app/api/projects/route.ts`
- `GET` `/api/runs`
  `src/app/api/runs/route.ts`
- `GET` `/api/runs/stream` [cache, queue]
  `src/app/api/runs/stream/route.ts`
- `GET` `/api/server-status` → out: { status }
  `src/app/api/server-status/route.ts`
- `GET` `/api/sidebar` → out: { tasks, unreadInbox, pendingDecisions, agents } [cache]
  `src/app/api/sidebar/route.ts`
- `GET` `/api/skills/activate` → out: { error }
  `src/app/api/skills/activate/route.ts`
- `POST` `/api/skills/activate` → out: { error }
  `src/app/api/skills/activate/route.ts`
- `GET` `/api/skills` → out: { error }
  `src/app/api/skills/route.ts`
- `POST` `/api/skills` → out: { error }
  `src/app/api/skills/route.ts`
- `PUT` `/api/skills` → out: { error }
  `src/app/api/skills/route.ts`
- `DELETE` `/api/skills` → out: { error }
  `src/app/api/skills/route.ts`
- `POST` `/api/sync` → out: { ok, message } [ai]
  `src/app/api/sync/route.ts`
- `POST` `/api/tasks/[id]/comment` params(id) → out: { error } [auth, upload]
  `src/app/api/tasks/[id]/comment/route.ts`
- `DELETE` `/api/tasks/[id]/comment` params(id) → out: { error } [auth, upload]
  `src/app/api/tasks/[id]/comment/route.ts`
- `POST` `/api/tasks/[id]/run` params(id) → out: { error }
  `src/app/api/tasks/[id]/run/route.ts`
- `POST` `/api/tasks/[id]/stop` params(id) → out: { error }
  `src/app/api/tasks/[id]/stop/route.ts`
- `GET` `/api/tasks/archive` → out: { data, tasks, archived, meta, filtered }
  `src/app/api/tasks/archive/route.ts`
- `POST` `/api/tasks/archive` → out: { data, tasks, archived, meta, filtered }
  `src/app/api/tasks/archive/route.ts`
- `PUT` `/api/tasks/bulk` → out: { error }
  `src/app/api/tasks/bulk/route.ts`
- `DELETE` `/api/tasks/bulk` → out: { error }
  `src/app/api/tasks/bulk/route.ts`
- `GET` `/api/tasks` → out: { data, tasks, meta } [cache]
  `src/app/api/tasks/route.ts`
- `POST` `/api/tasks` → out: { data, tasks, meta } [cache]
  `src/app/api/tasks/route.ts`
- `PUT` `/api/tasks` → out: { data, tasks, meta } [cache]
  `src/app/api/tasks/route.ts`
- `DELETE` `/api/tasks` → out: { data, tasks, meta } [cache]
  `src/app/api/tasks/route.ts`
- `POST` `/api/upload/[...path]` → out: { error } [upload]
  `src/app/api/upload/[...path]/route.ts`
- `POST` `/api/upload` → out: { error } [upload]
  `src/app/api/upload/route.ts`
- `GET` `/api/wiki/content` → out: { error }
  `src/app/api/wiki/content/route.ts`
- `PUT` `/api/wiki/content` → out: { error }
  `src/app/api/wiki/content/route.ts`
- `GET` `/api/wiki/file` → out: { error } [cache]
  `src/app/api/wiki/file/route.ts`
- `POST` `/api/wiki/folder` → out: { error }
  `src/app/api/wiki/folder/route.ts`
- `POST` `/api/wiki/generate` → out: { error } [auth]
  `src/app/api/wiki/generate/route.ts`
- `POST` `/api/wiki/init` → out: { error } [cache]
  `src/app/api/wiki/init/route.ts`
- `POST` `/api/wiki/move` → out: { error }
  `src/app/api/wiki/move/route.ts`
- `POST` `/api/wiki/page` → out: { error }
  `src/app/api/wiki/page/route.ts`
- `GET` `/api/wiki` → out: { error }
  `src/app/api/wiki/route.ts`
- `DELETE` `/api/wiki` → out: { error }
  `src/app/api/wiki/route.ts`
- `GET` `/api/wiki/slugs` → out: { error } [cache]
  `src/app/api/wiki/slugs/route.ts`
- `GET` `/api/wiki/status` → out: { installed, version }
  `src/app/api/wiki/status/route.ts`
- `POST` `/api/wiki/upload` → out: { error }
  `src/app/api/wiki/upload/route.ts`
- `GET` `/api/workspaces` → out: { error }
  `src/app/api/workspaces/route.ts`
- `POST` `/api/workspaces` → out: { error }
  `src/app/api/workspaces/route.ts`
- `PUT` `/api/workspaces` → out: { error }
  `src/app/api/workspaces/route.ts`
- `DELETE` `/api/workspaces` → out: { error }
  `src/app/api/workspaces/route.ts`
- `GET` `/uploads/[filename]` params(filename) → out: { error } [cache, upload]
  `src/app/uploads/[filename]/route.ts`

## Source Files

Read these before implementing or modifying this subsystem:
- `src/app/api/activity-log/route.ts`
- `src/app/api/agents/route.ts`
- `src/app/api/assets/[...path]/route.ts`
- `src/app/api/brain-dump/automate/route.ts`
- `src/app/api/brain-dump/route.ts`
- `src/app/api/chat/messages/route.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/chat/session/route.ts`
- `src/app/api/claude/models/route.ts`
- `src/app/api/claude/slash-commands/route.ts`
- `src/app/api/commands/activate/route.ts`
- `src/app/api/commands/route.ts`
- `src/app/api/daemon/route.ts`
- `src/app/api/dashboard/route.ts`
- `src/app/api/decisions/route.ts`
- `src/app/api/emergency-stop/route.ts`
- `src/app/api/inbox/route.ts`
- `src/app/api/initiatives/route.ts`
- `src/app/api/logs/app/route.ts`
- `src/app/api/logs/daemon/route.ts`
- `src/app/api/logs/stream/route.ts`
- `src/app/api/missions/route.ts`
- `src/app/api/plugins/route.ts`
- `src/app/api/projects/[id]/run/route.ts`
- `src/app/api/projects/[id]/stop/route.ts`
- `src/app/api/projects/route.ts`
- `src/app/api/runs/route.ts`
- `src/app/api/runs/stream/route.ts`
- `src/app/api/server-status/route.ts`
- `src/app/api/sidebar/route.ts`
- `src/app/api/skills/activate/route.ts`
- `src/app/api/skills/route.ts`
- `src/app/api/sync/route.ts`
- `src/app/api/tasks/[id]/comment/route.ts`
- `src/app/api/tasks/[id]/run/route.ts`
- `src/app/api/tasks/[id]/stop/route.ts`
- `src/app/api/tasks/archive/route.ts`
- `src/app/api/tasks/bulk/route.ts`
- `src/app/api/tasks/route.ts`
- `src/app/api/upload/[...path]/route.ts`
- `src/app/api/upload/route.ts`
- `src/app/api/wiki/content/route.ts`
- `src/app/api/wiki/file/route.ts`
- `src/app/api/wiki/folder/route.ts`
- `src/app/api/wiki/generate/route.ts`
- `src/app/api/wiki/init/route.ts`
- `src/app/api/wiki/move/route.ts`
- `src/app/api/wiki/page/route.ts`
- `src/app/api/wiki/route.ts`
- `src/app/api/wiki/slugs/route.ts`
- `src/app/api/wiki/status/route.ts`
- `src/app/api/wiki/upload/route.ts`
- `src/app/api/workspaces/route.ts`
- `src/app/uploads/[filename]/route.ts`

---
_Back to [overview.md](./overview.md)_