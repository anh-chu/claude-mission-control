# Routes

## CRUD Resources

- **`/api/activity-log`** GET | POST | DELETE/:id → Activity-log
- **`/api/agents`** GET | POST | PUT/:id | DELETE/:id → Agent
- **`/api/brain-dump`** GET | POST | PUT/:id | DELETE/:id → Brain-dump
- **`/api/chat/session`** POST | PATCH/:id | DELETE/:id → Session
- **`/api/commands`** GET | POST | PUT/:id | DELETE/:id → Command
- **`/api/daemon`** GET | POST | PUT/:id → Daemon
- **`/api/decisions`** GET | POST | PUT/:id | DELETE/:id → Decision
- **`/api/inbox`** GET | POST | PUT/:id | DELETE/:id → Inbox
- **`/api/initiatives`** GET | POST | PUT/:id | DELETE/:id → Initiative
- **`/api/projects`** GET | POST | PUT/:id | DELETE/:id → Project
- **`/api/skills`** GET | POST | PUT/:id | DELETE/:id → Skill
- **`/api/tasks`** GET | POST | PUT/:id | DELETE/:id → Task
- **`/api/workspaces`** GET | POST | PUT/:id | DELETE/:id → Workspace

## Other Routes

- `GET` `/api/assets/[...path]` → out: { error } [cache, upload]
- `PUT` `/api/assets/[...path]` → out: { error } [cache, upload]
- `POST` `/api/brain-dump/automate` → out: { error }
- `GET` `/api/chat/messages` → out: { error } [auth, ai]
- `GET` `/api/chat` [auth, queue, ai]
- `POST` `/api/chat` [auth, queue, ai]
- `GET` `/api/claude/models` → out: { models } [db, cache, ai]
- `GET` `/api/claude/slash-commands` → out: { commands } [db, cache, ai]
- `GET` `/api/commands/activate` → out: { error }
- `POST` `/api/commands/activate` → out: { error }
- `GET` `/api/dashboard` → out: { stats } [cache]
- `POST` `/api/emergency-stop` → out: { ok, results }
- `GET` `/api/logs/app` → out: { lines, error }
- `GET` `/api/logs/daemon` → out: { lines, error }
- `GET` `/api/logs/stream` [cache, queue]
- `GET` `/api/missions` → out: { missions }
- `GET` `/api/plugins` → out: { plugins }
- `POST` `/api/projects/[id]/run` params(id) → out: { error, missionId } [queue]
- `POST` `/api/projects/[id]/stop` params(id) → out: { error }
- `GET` `/api/runs`
- `GET` `/api/runs/stream` [cache, queue]
- `GET` `/api/server-status` → out: { status }
- `GET` `/api/sidebar` → out: { tasks, unreadInbox, pendingDecisions, agents } [cache]
- `GET` `/api/skills/activate` → out: { error }
- `POST` `/api/skills/activate` → out: { error }
- `POST` `/api/sync` → out: { ok, message } [ai]
- `POST` `/api/tasks/[id]/comment` params(id) → out: { error } [auth, upload]
- `DELETE` `/api/tasks/[id]/comment` params(id) → out: { error } [auth, upload]
- `POST` `/api/tasks/[id]/run` params(id) → out: { error }
- `POST` `/api/tasks/[id]/stop` params(id) → out: { error }
- `GET` `/api/tasks/archive` → out: { data, tasks, archived, meta, filtered }
- `POST` `/api/tasks/archive` → out: { data, tasks, archived, meta, filtered }
- `PUT` `/api/tasks/bulk` → out: { error }
- `DELETE` `/api/tasks/bulk` → out: { error }
- `POST` `/api/upload/[...path]` → out: { error } [upload]
- `POST` `/api/upload` → out: { error } [upload]
- `GET` `/api/wiki/content` → out: { error }
- `PUT` `/api/wiki/content` → out: { error }
- `GET` `/api/wiki/file` → out: { error } [cache]
- `POST` `/api/wiki/folder` → out: { error }
- `POST` `/api/wiki/generate` → out: { error } [auth]
- `POST` `/api/wiki/init` → out: { error } [cache]
- `POST` `/api/wiki/move` → out: { error }
- `POST` `/api/wiki/page` → out: { error }
- `GET` `/api/wiki` → out: { error }
- `DELETE` `/api/wiki` → out: { error }
- `GET` `/api/wiki/slugs` → out: { error } [cache]
- `GET` `/api/wiki/status` → out: { installed, version }
- `POST` `/api/wiki/upload` → out: { error }
- `GET` `/uploads/[filename]` params(filename) → out: { error } [cache, upload]
