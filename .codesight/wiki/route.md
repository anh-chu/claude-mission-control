# Route

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Route subsystem handles **131 routes** and touches: auth, cache, queue, payment, db, ai.

## Routes

- `POST` `/api/actions/[id]/comment` params(id) → out: { error } [auth, upload]
  `mission-control/src/app/api/actions/[id]/comment/route.ts`
- `DELETE` `/api/actions/[id]/comment` params(id) → out: { error } [auth, upload]
  `mission-control/src/app/api/actions/[id]/comment/route.ts`
- `GET` `/api/actions` → out: { data, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/actions/route.ts`
- `POST` `/api/actions` → out: { data, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/actions/route.ts`
- `PUT` `/api/actions` → out: { data, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/actions/route.ts`
- `DELETE` `/api/actions` → out: { data, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/actions/route.ts`
- `GET` `/api/activity-log` → out: { data, events, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/activity-log/route.ts`
- `POST` `/api/activity-log` → out: { data, events, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/activity-log/route.ts`
- `DELETE` `/api/activity-log` → out: { data, events, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/activity-log/route.ts`
- `GET` `/api/agents` → out: { data, agents, meta, filtered, returned, limit, offset } [auth, cache]
  `mission-control/src/app/api/agents/route.ts`
- `POST` `/api/agents` → out: { data, agents, meta, filtered, returned, limit, offset } [auth, cache]
  `mission-control/src/app/api/agents/route.ts`
- `PUT` `/api/agents` → out: { data, agents, meta, filtered, returned, limit, offset } [auth, cache]
  `mission-control/src/app/api/agents/route.ts`
- `DELETE` `/api/agents` → out: { data, agents, meta, filtered, returned, limit, offset } [auth, cache]
  `mission-control/src/app/api/agents/route.ts`
- `POST` `/api/brain-dump/automate` → out: { error }
  `mission-control/src/app/api/brain-dump/automate/route.ts`
- `GET` `/api/brain-dump` → out: { data, entries, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/brain-dump/route.ts`
- `POST` `/api/brain-dump` → out: { data, entries, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/brain-dump/route.ts`
- `PUT` `/api/brain-dump` → out: { data, entries, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/brain-dump/route.ts`
- `DELETE` `/api/brain-dump` → out: { data, entries, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/brain-dump/route.ts`
- `GET` `/api/checkpoints/export` → out: { error }
  `mission-control/src/app/api/checkpoints/export/route.ts`
- `POST` `/api/checkpoints/import` → out: { error }
  `mission-control/src/app/api/checkpoints/import/route.ts`
- `POST` `/api/checkpoints/load` → out: { error }
  `mission-control/src/app/api/checkpoints/load/route.ts`
- `POST` `/api/checkpoints/new` → out: { ok }
  `mission-control/src/app/api/checkpoints/new/route.ts`
- `GET` `/api/checkpoints` → out: { error, details }
  `mission-control/src/app/api/checkpoints/route.ts`
- `POST` `/api/checkpoints` → out: { error, details }
  `mission-control/src/app/api/checkpoints/route.ts`
- `DELETE` `/api/checkpoints` → out: { error, details }
  `mission-control/src/app/api/checkpoints/route.ts`
- `GET` `/api/daemon` → out: { status, config, isRunning } [auth]
  `mission-control/src/app/api/daemon/route.ts`
- `POST` `/api/daemon` → out: { status, config, isRunning } [auth]
  `mission-control/src/app/api/daemon/route.ts`
- `PUT` `/api/daemon` → out: { status, config, isRunning } [auth]
  `mission-control/src/app/api/daemon/route.ts`
- `GET` `/api/dashboard` [cache]
  `mission-control/src/app/api/dashboard/route.ts`
- `GET` `/api/decisions` → out: { data, decisions, meta, filtered, returned, limit, offset } [cache, queue]
  `mission-control/src/app/api/decisions/route.ts`
- `POST` `/api/decisions` → out: { data, decisions, meta, filtered, returned, limit, offset } [cache, queue]
  `mission-control/src/app/api/decisions/route.ts`
- `PUT` `/api/decisions` → out: { data, decisions, meta, filtered, returned, limit, offset } [cache, queue]
  `mission-control/src/app/api/decisions/route.ts`
- `DELETE` `/api/decisions` → out: { data, decisions, meta, filtered, returned, limit, offset } [cache, queue]
  `mission-control/src/app/api/decisions/route.ts`
- `POST` `/api/emergency-stop` → out: { ok, results } [auth]
  `mission-control/src/app/api/emergency-stop/route.ts`
- `GET` `/api/field-ops/activity` → out: { data, events, meta }
  `mission-control/src/app/api/field-ops/activity/route.ts`
- `GET` `/api/field-ops/approval-config` → out: { data, config }
  `mission-control/src/app/api/field-ops/approval-config/route.ts`
- `PUT` `/api/field-ops/approval-config` → out: { data, config }
  `mission-control/src/app/api/field-ops/approval-config/route.ts`
- `POST` `/api/field-ops/batch` → out: { error } [auth]
  `mission-control/src/app/api/field-ops/batch/route.ts`
- `GET` `/api/field-ops/catalog` → out: { error }
  `mission-control/src/app/api/field-ops/catalog/route.ts`
- `POST` `/api/field-ops/execute/prepare` → out: { error } [payment]
  `mission-control/src/app/api/field-ops/execute/prepare/route.ts`
- `POST` `/api/field-ops/execute` → out: { error } [auth, db, cache, payment]
  `mission-control/src/app/api/field-ops/execute/route.ts`
- `POST` `/api/field-ops/execute/submit-signature` → out: { error }
  `mission-control/src/app/api/field-ops/execute/submit-signature/route.ts`
- `GET` `/api/field-ops/financials` → out: { vaultLocked, snapshots, availableIntegrations } [auth, payment]
  `mission-control/src/app/api/field-ops/financials/route.ts`
- `GET` `/api/field-ops/missions` → out: { data, missions, meta } [auth]
  `mission-control/src/app/api/field-ops/missions/route.ts`
- `POST` `/api/field-ops/missions` → out: { data, missions, meta } [auth]
  `mission-control/src/app/api/field-ops/missions/route.ts`
- `PUT` `/api/field-ops/missions` → out: { data, missions, meta } [auth]
  `mission-control/src/app/api/field-ops/missions/route.ts`
- `DELETE` `/api/field-ops/missions` → out: { data, missions, meta } [auth]
  `mission-control/src/app/api/field-ops/missions/route.ts`
- `GET` `/api/field-ops/safety-limits` → out: { ...data, spendSummary } [auth]
  `mission-control/src/app/api/field-ops/safety-limits/route.ts`
- `PUT` `/api/field-ops/safety-limits` → out: { ...data, spendSummary } [auth]
  `mission-control/src/app/api/field-ops/safety-limits/route.ts`
- `POST` `/api/field-ops/services/activate` → out: { error } [auth]
  `mission-control/src/app/api/field-ops/services/activate/route.ts`
- `GET` `/api/field-ops/services` → out: { data, services, meta } [auth]
  `mission-control/src/app/api/field-ops/services/route.ts`
- `POST` `/api/field-ops/services` → out: { data, services, meta } [auth]
  `mission-control/src/app/api/field-ops/services/route.ts`
- `PUT` `/api/field-ops/services` → out: { data, services, meta } [auth]
  `mission-control/src/app/api/field-ops/services/route.ts`
- `DELETE` `/api/field-ops/services` → out: { data, services, meta } [auth]
  `mission-control/src/app/api/field-ops/services/route.ts`
- `POST` `/api/field-ops/services/save-from-catalog` → out: { error } [auth]
  `mission-control/src/app/api/field-ops/services/save-from-catalog/route.ts`
- `POST` `/api/field-ops/services/test` → out: { error } [auth, payment]
  `mission-control/src/app/api/field-ops/services/test/route.ts`
- `GET` `/api/field-ops/tasks` → out: { data, tasks, meta } [auth]
  `mission-control/src/app/api/field-ops/tasks/route.ts`
- `POST` `/api/field-ops/tasks` → out: { data, tasks, meta } [auth]
  `mission-control/src/app/api/field-ops/tasks/route.ts`
- `PUT` `/api/field-ops/tasks` → out: { data, tasks, meta } [auth]
  `mission-control/src/app/api/field-ops/tasks/route.ts`
- `DELETE` `/api/field-ops/tasks` → out: { data, tasks, meta } [auth]
  `mission-control/src/app/api/field-ops/tasks/route.ts`
- `POST` `/api/field-ops/templates/instantiate` → out: { error }
  `mission-control/src/app/api/field-ops/templates/instantiate/route.ts`
- `GET` `/api/field-ops/templates` → out: { data, templates }
  `mission-control/src/app/api/field-ops/templates/route.ts`
- `POST` `/api/field-ops/templates` → out: { data, templates }
  `mission-control/src/app/api/field-ops/templates/route.ts`
- `DELETE` `/api/field-ops/templates` → out: { data, templates }
  `mission-control/src/app/api/field-ops/templates/route.ts`
- `POST` `/api/field-ops/vault/decrypt` → out: { error } [auth]
  `mission-control/src/app/api/field-ops/vault/decrypt/route.ts`
- `GET` `/api/field-ops/vault` → out: { data, credentials, meta } [auth]
  `mission-control/src/app/api/field-ops/vault/route.ts`
- `POST` `/api/field-ops/vault` → out: { data, credentials, meta } [auth]
  `mission-control/src/app/api/field-ops/vault/route.ts`
- `DELETE` `/api/field-ops/vault` → out: { data, credentials, meta } [auth]
  `mission-control/src/app/api/field-ops/vault/route.ts`
- `GET` `/api/field-ops/vault/session` → out: { error, retryAfterMs } [auth, cache]
  `mission-control/src/app/api/field-ops/vault/session/route.ts`
- `POST` `/api/field-ops/vault/session` → out: { error, retryAfterMs } [auth, cache]
  `mission-control/src/app/api/field-ops/vault/session/route.ts`
- `DELETE` `/api/field-ops/vault/session` → out: { error, retryAfterMs } [auth, cache]
  `mission-control/src/app/api/field-ops/vault/session/route.ts`
- `POST` `/api/field-ops/vault/setup` → out: { error } [auth]
  `mission-control/src/app/api/field-ops/vault/setup/route.ts`
- `GET` `/api/field-ops/wallet` → out: { error, wallets } [auth, db, cache]
  `mission-control/src/app/api/field-ops/wallet/route.ts`
- `GET` `/api/goals` → out: { data, goals, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/goals/route.ts`
- `POST` `/api/goals` → out: { data, goals, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/goals/route.ts`
- `PUT` `/api/goals` → out: { data, goals, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/goals/route.ts`
- `DELETE` `/api/goals` → out: { data, goals, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/goals/route.ts`
- `POST` `/api/inbox/respond` → out: { error }
  `mission-control/src/app/api/inbox/respond/route.ts`
- `GET` `/api/inbox/respond/status` → out: { runs }
  `mission-control/src/app/api/inbox/respond/status/route.ts`
- `POST` `/api/inbox/respond/stop` → out: { error }
  `mission-control/src/app/api/inbox/respond/stop/route.ts`
- `GET` `/api/inbox` → out: { data, messages, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/inbox/route.ts`
- `POST` `/api/inbox` → out: { data, messages, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/inbox/route.ts`
- `PUT` `/api/inbox` → out: { data, messages, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/inbox/route.ts`
- `DELETE` `/api/inbox` → out: { data, messages, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/inbox/route.ts`
- `GET` `/api/initiatives` → out: { data, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/initiatives/route.ts`
- `POST` `/api/initiatives` → out: { data, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/initiatives/route.ts`
- `PUT` `/api/initiatives` → out: { data, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/initiatives/route.ts`
- `DELETE` `/api/initiatives` → out: { data, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/initiatives/route.ts`
- `GET` `/api/logs/app` → out: { lines, error }
  `mission-control/src/app/api/logs/app/route.ts`
- `GET` `/api/logs/daemon` → out: { lines, error }
  `mission-control/src/app/api/logs/daemon/route.ts`
- `GET` `/api/logs/stream` [cache, queue]
  `mission-control/src/app/api/logs/stream/route.ts`
- `GET` `/api/missions` → out: { missions }
  `mission-control/src/app/api/missions/route.ts`
- `POST` `/api/projects/[id]/run` params(id) → out: { error, missionId } [queue]
  `mission-control/src/app/api/projects/[id]/run/route.ts`
- `POST` `/api/projects/[id]/stop` params(id) → out: { error }
  `mission-control/src/app/api/projects/[id]/stop/route.ts`
- `GET` `/api/projects` → out: { data, projects, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/projects/route.ts`
- `POST` `/api/projects` → out: { data, projects, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/projects/route.ts`
- `PUT` `/api/projects` → out: { data, projects, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/projects/route.ts`
- `DELETE` `/api/projects` → out: { data, projects, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/projects/route.ts`
- `GET` `/api/runs`
  `mission-control/src/app/api/runs/route.ts`
- `GET` `/api/runs/stream` [cache, queue]
  `mission-control/src/app/api/runs/stream/route.ts`
- `GET` `/api/server-status` → out: { mode, uptimeSeconds, pid }
  `mission-control/src/app/api/server-status/route.ts`
- `GET` `/api/sidebar` → out: { tasks, unreadInbox, pendingDecisions, pendingFieldApprovals, pendingActionApprovals, agents } [cache]
  `mission-control/src/app/api/sidebar/route.ts`
- `GET` `/api/skills` → out: { data, skills, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/skills/route.ts`
- `POST` `/api/skills` → out: { data, skills, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/skills/route.ts`
- `PUT` `/api/skills` → out: { data, skills, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/skills/route.ts`
- `DELETE` `/api/skills` → out: { data, skills, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/skills/route.ts`
- `POST` `/api/sync` → out: { ok, message } [ai]
  `mission-control/src/app/api/sync/route.ts`
- `POST` `/api/tasks/[id]/comment` params(id) → out: { error } [auth, upload]
  `mission-control/src/app/api/tasks/[id]/comment/route.ts`
- `DELETE` `/api/tasks/[id]/comment` params(id) → out: { error } [auth, upload]
  `mission-control/src/app/api/tasks/[id]/comment/route.ts`
- `POST` `/api/tasks/[id]/run` params(id) → out: { error }
  `mission-control/src/app/api/tasks/[id]/run/route.ts`
- `POST` `/api/tasks/[id]/stop` params(id) → out: { error }
  `mission-control/src/app/api/tasks/[id]/stop/route.ts`
- `GET` `/api/tasks/archive` → out: { data, tasks, archived, meta, filtered }
  `mission-control/src/app/api/tasks/archive/route.ts`
- `POST` `/api/tasks/archive` → out: { data, tasks, archived, meta, filtered }
  `mission-control/src/app/api/tasks/archive/route.ts`
- `PUT` `/api/tasks/bulk` → out: { error }
  `mission-control/src/app/api/tasks/bulk/route.ts`
- `DELETE` `/api/tasks/bulk` → out: { error }
  `mission-control/src/app/api/tasks/bulk/route.ts`
- `GET` `/api/tasks` → out: { data, tasks, meta } [cache]
  `mission-control/src/app/api/tasks/route.ts`
- `POST` `/api/tasks` → out: { data, tasks, meta } [cache]
  `mission-control/src/app/api/tasks/route.ts`
- `PUT` `/api/tasks` → out: { data, tasks, meta } [cache]
  `mission-control/src/app/api/tasks/route.ts`
- `DELETE` `/api/tasks` → out: { data, tasks, meta } [cache]
  `mission-control/src/app/api/tasks/route.ts`
- `POST` `/api/upload` → out: { error } [upload]
  `mission-control/src/app/api/upload/route.ts`
- `POST` `/api/ventures/[id]/run` params(id) → out: { error, missionId } [queue]
  `mission-control/src/app/api/ventures/[id]/run/route.ts`
- `POST` `/api/ventures/[id]/stop` params(id) → out: { error }
  `mission-control/src/app/api/ventures/[id]/stop/route.ts`
- `GET` `/api/ventures` → out: { data, projects, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/ventures/route.ts`
- `POST` `/api/ventures` → out: { data, projects, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/ventures/route.ts`
- `PUT` `/api/ventures` → out: { data, projects, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/ventures/route.ts`
- `DELETE` `/api/ventures` → out: { data, projects, meta, filtered, returned, limit, offset } [cache]
  `mission-control/src/app/api/ventures/route.ts`
- `GET` `/api/workspaces` → out: { error }
  `mission-control/src/app/api/workspaces/route.ts`
- `POST` `/api/workspaces` → out: { error }
  `mission-control/src/app/api/workspaces/route.ts`
- `PUT` `/api/workspaces` → out: { error }
  `mission-control/src/app/api/workspaces/route.ts`
- `DELETE` `/api/workspaces` → out: { error }
  `mission-control/src/app/api/workspaces/route.ts`
- `GET` `/uploads/[filename]` params(filename) → out: { error } [cache, upload]
  `mission-control/src/app/uploads/[filename]/route.ts`

## Source Files

Read these before implementing or modifying this subsystem:
- `mission-control/src/app/api/actions/[id]/comment/route.ts`
- `mission-control/src/app/api/actions/route.ts`
- `mission-control/src/app/api/activity-log/route.ts`
- `mission-control/src/app/api/agents/route.ts`
- `mission-control/src/app/api/brain-dump/automate/route.ts`
- `mission-control/src/app/api/brain-dump/route.ts`
- `mission-control/src/app/api/checkpoints/export/route.ts`
- `mission-control/src/app/api/checkpoints/import/route.ts`
- `mission-control/src/app/api/checkpoints/load/route.ts`
- `mission-control/src/app/api/checkpoints/new/route.ts`
- `mission-control/src/app/api/checkpoints/route.ts`
- `mission-control/src/app/api/daemon/route.ts`
- `mission-control/src/app/api/dashboard/route.ts`
- `mission-control/src/app/api/decisions/route.ts`
- `mission-control/src/app/api/emergency-stop/route.ts`
- `mission-control/src/app/api/field-ops/activity/route.ts`
- `mission-control/src/app/api/field-ops/approval-config/route.ts`
- `mission-control/src/app/api/field-ops/batch/route.ts`
- `mission-control/src/app/api/field-ops/catalog/route.ts`
- `mission-control/src/app/api/field-ops/execute/prepare/route.ts`
- `mission-control/src/app/api/field-ops/execute/route.ts`
- `mission-control/src/app/api/field-ops/execute/submit-signature/route.ts`
- `mission-control/src/app/api/field-ops/financials/route.ts`
- `mission-control/src/app/api/field-ops/missions/route.ts`
- `mission-control/src/app/api/field-ops/safety-limits/route.ts`
- `mission-control/src/app/api/field-ops/services/activate/route.ts`
- `mission-control/src/app/api/field-ops/services/route.ts`
- `mission-control/src/app/api/field-ops/services/save-from-catalog/route.ts`
- `mission-control/src/app/api/field-ops/services/test/route.ts`
- `mission-control/src/app/api/field-ops/tasks/route.ts`
- `mission-control/src/app/api/field-ops/templates/instantiate/route.ts`
- `mission-control/src/app/api/field-ops/templates/route.ts`
- `mission-control/src/app/api/field-ops/vault/decrypt/route.ts`
- `mission-control/src/app/api/field-ops/vault/route.ts`
- `mission-control/src/app/api/field-ops/vault/session/route.ts`
- `mission-control/src/app/api/field-ops/vault/setup/route.ts`
- `mission-control/src/app/api/field-ops/wallet/route.ts`
- `mission-control/src/app/api/goals/route.ts`
- `mission-control/src/app/api/inbox/respond/route.ts`
- `mission-control/src/app/api/inbox/respond/status/route.ts`
- `mission-control/src/app/api/inbox/respond/stop/route.ts`
- `mission-control/src/app/api/inbox/route.ts`
- `mission-control/src/app/api/initiatives/route.ts`
- `mission-control/src/app/api/logs/app/route.ts`
- `mission-control/src/app/api/logs/daemon/route.ts`
- `mission-control/src/app/api/logs/stream/route.ts`
- `mission-control/src/app/api/missions/route.ts`
- `mission-control/src/app/api/projects/[id]/run/route.ts`
- `mission-control/src/app/api/projects/[id]/stop/route.ts`
- `mission-control/src/app/api/projects/route.ts`
- `mission-control/src/app/api/runs/route.ts`
- `mission-control/src/app/api/runs/stream/route.ts`
- `mission-control/src/app/api/server-status/route.ts`
- `mission-control/src/app/api/sidebar/route.ts`
- `mission-control/src/app/api/skills/route.ts`
- `mission-control/src/app/api/sync/route.ts`
- `mission-control/src/app/api/tasks/[id]/comment/route.ts`
- `mission-control/src/app/api/tasks/[id]/run/route.ts`
- `mission-control/src/app/api/tasks/[id]/stop/route.ts`
- `mission-control/src/app/api/tasks/archive/route.ts`
- `mission-control/src/app/api/tasks/bulk/route.ts`
- `mission-control/src/app/api/tasks/route.ts`
- `mission-control/src/app/api/upload/route.ts`
- `mission-control/src/app/api/ventures/[id]/run/route.ts`
- `mission-control/src/app/api/ventures/[id]/stop/route.ts`
- `mission-control/src/app/api/ventures/route.ts`
- `mission-control/src/app/api/workspaces/route.ts`
- `mission-control/src/app/uploads/[filename]/route.ts`

---
_Back to [overview.md](./overview.md)_