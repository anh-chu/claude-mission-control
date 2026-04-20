# Routes

## CRUD Resources

- **`/api/activity-log`** GET | POST | DELETE/:id → Activity-log
- **`/api/agents`** GET | POST | PUT/:id | DELETE/:id → Agent
- **`/api/brain-dump`** GET | POST | PUT/:id | DELETE/:id → Brain-dump
- **`/api/checkpoints`** GET | POST | DELETE/:id → Checkpoint
- **`/api/daemon`** GET | POST | PUT/:id → Daemon
- **`/api/decisions`** GET | POST | PUT/:id | DELETE/:id → Decision
- **`/api/goals`** GET | POST | PUT/:id | DELETE/:id → Goal
- **`/api/inbox`** GET | POST | PUT/:id | DELETE/:id → Inbox
- **`/api/initiatives`** GET | POST | PUT/:id | DELETE/:id → Initiative
- **`/api/projects`** GET | POST | PUT/:id | DELETE/:id → Project
- **`/api/skills`** GET | POST | PUT/:id | DELETE/:id → Skill
- **`/api/tasks`** GET | POST | PUT/:id | DELETE/:id → Task
- **`/api/ventures`** GET | POST | PUT/:id | DELETE/:id → Venture
- **`/api/workspaces`** GET | POST | PUT/:id | DELETE/:id → Workspace

## Other Routes

- `POST` `/api/brain-dump/automate` → out: { error }
- `GET` `/api/checkpoints/export` → out: { error }
- `POST` `/api/checkpoints/import` → out: { error }
- `POST` `/api/checkpoints/load` → out: { error }
- `POST` `/api/checkpoints/new` → out: { ok }
- `GET` `/api/dashboard` [cache]
- `POST` `/api/emergency-stop` → out: { ok, results }
- `POST` `/api/inbox/respond` → out: { error }
- `GET` `/api/inbox/respond/status` → out: { runs }
- `POST` `/api/inbox/respond/stop` → out: { error }
- `GET` `/api/logs/app` → out: { lines, error }
- `GET` `/api/logs/daemon` → out: { lines, error }
- `GET` `/api/logs/stream` [cache, queue]
- `GET` `/api/missions` → out: { missions }
- `POST` `/api/projects/[id]/run` params(id) → out: { error, missionId } [queue]
- `POST` `/api/projects/[id]/stop` params(id) → out: { error }
- `GET` `/api/runs`
- `GET` `/api/runs/stream` [cache, queue]
- `GET` `/api/server-status` → out: { mode, uptimeSeconds, pid }
- `GET` `/api/sidebar` → out: { tasks, unreadInbox, pendingDecisions, agents } [cache]
- `POST` `/api/sync` → out: { ok, message } [ai]
- `POST` `/api/tasks/[id]/comment` params(id) → out: { error } [auth, upload]
- `DELETE` `/api/tasks/[id]/comment` params(id) → out: { error } [auth, upload]
- `POST` `/api/tasks/[id]/run` params(id) → out: { error }
- `POST` `/api/tasks/[id]/stop` params(id) → out: { error }
- `GET` `/api/tasks/archive` → out: { data, tasks, archived, meta, filtered }
- `POST` `/api/tasks/archive` → out: { data, tasks, archived, meta, filtered }
- `PUT` `/api/tasks/bulk` → out: { error }
- `DELETE` `/api/tasks/bulk` → out: { error }
- `POST` `/api/upload` → out: { error } [upload]
- `POST` `/api/ventures/[id]/run` params(id) → out: { error, missionId } [queue]
- `POST` `/api/ventures/[id]/stop` params(id) → out: { error }
- `GET` `/api/wiki/content` → out: { error }
- `PUT` `/api/wiki/content` → out: { error }
- `GET` `/api/wiki/file` → out: { error } [cache]
- `POST` `/api/wiki/folder` → out: { error }
- `POST` `/api/wiki/generate` → out: { runId, pid, workspaceId, startedAt }
- `POST` `/api/wiki/init` → out: { ok, workspaceId, pluginStatus }
- `POST` `/api/wiki/move` → out: { error }
- `GET` `/api/wiki/prompt` → out: { content, isDefault }
- `PUT` `/api/wiki/prompt` → out: { content, isDefault }
- `GET` `/api/wiki` → out: { error }
- `DELETE` `/api/wiki` → out: { error }
- `GET` `/api/wiki/run-stream` → out: { error }
- `GET` `/api/wiki/runs` → out: { runs }
- `POST` `/api/wiki/upload` → out: { error }
- `GET` `/uploads/[filename]` params(filename) → out: { error } [cache, upload]
