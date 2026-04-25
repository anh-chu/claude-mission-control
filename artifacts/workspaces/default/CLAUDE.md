# Solo Entrepreneur Workspace - Agent Operations Manual

## Quick Start for AI Agents
- Read `ai-context.md` in your workspace data directory FIRST for current state snapshot
- For full data, read the JSON files in the workspace data directory
- This workspace is designed for multi-agent operation via Claude Code and Claude Cowork
- **Communication**: All agent communication happens through JSON files - see Agent Communication Protocol below

## Entity Hierarchy
```
Workspace (fully isolated context)
└── Goals (strategic, long-term only)
    └── Initiatives (replaces: milestones + projects + missions)
        ├── Tasks (open-ended work, agent executes with discretion)
        └── Actions (typed, approval-gated, touches external services)
```

## Workspace Map
```
~/.cmc/
├── workspaces.json              — Registry of all workspaces (root-level, not workspace-scoped)
├── daemon-status.json           — Global daemon state
├── daemon.pid                   — Daemon process ID
└── workspaces/
    └── {workspace-id}/
        ├── CLAUDE.md            — This file (workspace-scoped agent manual)
        ├── ai-context.md        — Generated context snapshot
        ├── tasks.json           — Tasks (open-ended work items)
        ├── goals.json           — Strategic long-term goals
        ├── initiatives.json     — Initiatives (projects + milestones + missions combined)
        ├── actions.json         — Actions (typed, approval-gated external operations)
        ├── agents.json          — Agent definitions
        ├── skills-library.json  — Skill definitions
        ├── brain-dump.json      — Quick capture entries
        ├── activity-log.json    — Event history
        ├── inbox.json           — Agent messages
        ├── decisions.json       — Pending and answered decisions
        ├── services.json        — Connected external services
        ├── daemon-config.json   — Daemon configuration
        ├── commands/            — Claude Code slash commands (auto-generated from agent registry)
        └── skills/              — Auto-generated skill files from skills-library.json

                 — Task management + Agent orchestration app (Next.js 15)
scripts/         — Utility scripts (context generation, daemon)
scripts/daemon/  — Autonomous agent daemon (background process)
research/                        — Research notes (markdown)
docs/                            — Business plans, strategies, analysis
templates/                       — Project templates
```

## Data Schema Reference

### workspaces.json - `{ "workspaces": Workspace[] }` (root-level, not workspace-scoped)
| Field | Type | Description |
|-------|------|-------------|
| id | string | URL-safe slug |
| name | string | Workspace display name |
| description | string | What this workspace is for |
| color | string | Hex color for UI |
| isDefault | boolean | Whether this is the default workspace |
| settings.autonomyLevel | `"approve-all"` \| `"approve-high-risk"` \| `"auto"` | Default autonomy for this workspace |
| createdAt | ISO 8601 | When created |
| updatedAt | ISO 8601 | Last modification |

### tasks.json - `{ "tasks": Task[] }`
| Field | Type | Description |
|-------|------|-------------|
| id | string | `"task_{timestamp}"` |
| title | string | Short, action-oriented |
| description | string | What needs to be done |
| importance | `"important"` \| `"not-important"` | Eisenhower Y-axis |
| urgency | `"urgent"` \| `"not-urgent"` | Eisenhower X-axis |
| kanban | `"not-started"` \| `"in-progress"` \| `"done"` | Workflow status |
| initiativeId | string \| null | Links to initiative |
| assignedTo | AgentRole \| null | Lead agent assignment |
| collaborators | string[] | Additional team members (agent IDs) |
| subtasks | `Subtask[]` | Checkable sub-items: `{ id, title, done }` |
| blockedBy | string[] | Task IDs this depends on |
| estimatedMinutes | number \| null | Estimated work time |
| actualMinutes | number \| null | Actual work time |
| acceptanceCriteria | string | Definition of done (newline-separated) |
| tags | string[] | Freeform labels |
| notes | string | Additional context |
| createdAt | ISO 8601 | When created |
| updatedAt | ISO 8601 | Last modification |
| completedAt | ISO 8601 \| null | When marked done |

### goals.json - `{ "goals": Goal[] }`
| Field | Type | Description |
|-------|------|-------------|
| id | string | `"goal_{timestamp}"` |
| title | string | Goal description |
| timeframe | string | `"Q1 2026"` or `"YYYY-MM-DD"` |
| status | `"not-started"` \| `"in-progress"` \| `"completed"` | Progress |
| initiatives | string[] | Child initiative IDs |
| tasks | string[] | Linked task IDs |
| createdAt | ISO 8601 | When created |

Goals are always long-term and strategic. Milestones and medium-term goals have been absorbed into Initiatives.

### initiatives.json - `{ "initiatives": Initiative[] }`
| Field | Type | Description |
|-------|------|-------------|
| id | string | `"init_{timestamp}"` |
| title | string | Initiative name |
| description | string | What this initiative covers |
| status | `"active"` \| `"paused"` \| `"completed"` \| `"archived"` | Lifecycle |
| parentGoalId | string \| null | Links to parent goal |
| color | string | Hex color for UI |
| teamMembers | string[] | Assigned agent IDs |
| autonomyLevel | `"approve-all"` \| `"approve-high-risk"` \| `"auto"` \| null | Override workspace default (null = inherit) |
| taskIds | string[] | Task IDs in this initiative |
| actionIds | string[] | Action IDs in this initiative |
| tags | string[] | Freeform labels |
| createdAt | ISO 8601 | When created |
| updatedAt | ISO 8601 | Last modification |
| completedAt | ISO 8601 \| null | When completed |

Initiatives replace the old concepts of projects, milestones, and field-ops missions. They are the primary container where work lives.

### actions.json - `{ "actions": Action[] }`
| Field | Type | Description |
|-------|------|-------------|
| id | string | `"action_{name}"` |
| initiativeId | string \| null | Parent initiative ID |
| title | string | Action name |
| description | string | What this action does |
| **type** | **ActionType** | **`"social-post"` \| `"email-campaign"` \| `"ad-campaign"` \| `"payment"` \| `"publish"` \| `"design"` \| `"crypto-transfer"` \| `"custom"`** |
| serviceId | string \| null | Which service executes this |
| assignedTo | AgentRole \| null | Agent assignment |
| status | ActionStatus | `"draft"` \| `"pending-approval"` \| `"approved"` \| `"executing"` \| `"awaiting-signature"` \| `"completed"` \| `"failed"` \| `"rejected"` |
| approvalRequired | boolean | Needs human approval? |
| autonomyOverride | `"approve-all"` \| `"approve-high-risk"` \| `"auto"` \| null | Override initiative/workspace default (null = inherit) |
| payload | object | Service-specific data - see payload formats below |
| result | object | Execution result (populated after execution) |
| attachments | ActionAttachment[] | File attachments |
| linkedTaskId | string \| null | Links to a regular task ID |
| blockedBy | string[] | Action IDs this depends on |
| rejectionFeedback | string \| null | Why it was rejected |
| approvedBy | string \| null | Who approved |
| rejectedBy | string \| null | Who rejected |
| createdAt | ISO 8601 | When created |
| updatedAt | ISO 8601 | Last modification |
| executedAt | ISO 8601 \| null | When executed |
| completedAt | ISO 8601 \| null | When completed |

**IMPORTANT - Valid ActionType values:** `"social-post"` | `"email-campaign"` | `"ad-campaign"` | `"payment"` | `"publish"` | `"design"` | `"crypto-transfer"` | `"custom"`. Do NOT invent types (e.g. `"email"` is invalid - use `"email-campaign"`).

**Autonomy cascade:** workspace default > initiative override > per-action override. A null value at any level means "inherit from parent."

**Payload formats by type:**
| Type | Payload Fields |
|------|---------------|
| `social-post` | `{ operation: "create-post", text, media? }` or `{ operation: "submit-post", subreddit, title, text }` |
| `email-campaign` | `{ to, subject, body }` |
| `crypto-transfer` | `{ operation: "send-usdc"\|"send-eth", to, amount }` |
| `ad-campaign` | `{ headline, body }` |
| `publish` | `{ title, content, url? }` |
| `design` | `{ prompt }` |
| `custom` | Any JSON object |

### agents.json - `{ "agents": AgentDefinition[] }`
| Field | Type | Description |
|-------|------|-------------|
| id | string | URL-safe slug (e.g. `"researcher"`) |
| name | string | Display name |
| icon | string | Lucide icon name |
| description | string | What this agent handles |
| instructions | string | Full system prompt (multi-line markdown) |
| skillIds | string[] | Links to skills-library entries |
| status | `"active"` \| `"inactive"` | Agent lifecycle |
| createdAt | ISO 8601 | When created |
| updatedAt | ISO 8601 | Last modification |

### skills-library.json - `{ "skills": SkillDefinition[] }`
| Field | Type | Description |
|-------|------|-------------|
| id | string | `"skill_{name}"` |
| name | string | Skill display name |
| description | string | When to use this skill |
| content | string | Full skill markdown (injected into agent prompts) |
| agentIds | string[] | Which agents have this skill |
| tags | string[] | Freeform labels |
| createdAt | ISO 8601 | When created |
| updatedAt | ISO 8601 | Last modification |

### brain-dump.json - `{ "entries": BrainDumpEntry[] }`
| Field | Type | Description |
|-------|------|-------------|
| id | string | `"bd_{timestamp}"` |
| content | string | Raw idea/note (keep short) |
| capturedAt | ISO 8601 | When captured |
| processed | boolean | Has been triaged? |
| convertedTo | string \| null | Task ID if converted |
| tags | string[] | Freeform labels |

### activity-log.json - `{ "events": ActivityEvent[] }`
| Field | Type | Description |
|-------|------|-------------|
| id | string | `"evt_{timestamp}"` |
| type | EventType | See types below |
| actor | AgentRole \| `"system"` | Who performed the action |
| taskId | string \| null | Related task |
| summary | string | Short description of what happened |
| details | string | Extended context |
| timestamp | ISO 8601 | When it happened |

**EventType**: `task_created` | `task_updated` | `task_completed` | `task_delegated` | `message_sent` | `decision_requested` | `decision_answered` | `brain_dump_triaged` | `initiative_completed` | `agent_checkin`

### inbox.json - `{ "messages": InboxMessage[] }`
| Field | Type | Description |
|-------|------|-------------|
| id | string | `"msg_{timestamp}"` |
| from | AgentRole \| `"system"` | Sender |
| to | AgentRole | Recipient |
| type | MessageType | See types below |
| taskId | string \| null | Related task |
| subject | string | Message subject |
| body | string | Full message content |
| status | `"unread"` \| `"read"` \| `"archived"` | Read state |
| createdAt | ISO 8601 | When sent |
| readAt | ISO 8601 \| null | When read |

**MessageType**: `delegation` | `report` | `question` | `update` | `approval`

### decisions.json - `{ "decisions": DecisionItem[] }`
| Field | Type | Description |
|-------|------|-------------|
| id | string | `"dec_{timestamp}"` |
| requestedBy | AgentRole \| `"system"` | Who needs the decision |
| taskId | string \| null | Related task |
| question | string | What needs to be decided |
| options | string[] | Available choices |
| context | string | Background info for the decision |
| status | `"pending"` \| `"answered"` | Decision state |
| answer | string \| null | The chosen answer |
| answeredAt | ISO 8601 \| null | When answered |
| createdAt | ISO 8601 | When requested |

### services.json - `{ "services": Service[] }`
| Field | Type | Description |
|-------|------|-------------|
| id | string | URL-safe slug (e.g. `"twitter"`, `"gmail"`) |
| name | string | Display name |
| mcpPackage | string | MCP package name (empty string if none) |
| status | `"saved"` \| `"connected"` \| `"disconnected"` \| `"error"` | Connection state |
| authType | `"oauth2"` \| `"api-key"` \| `"none"` | Authentication method |
| credentialId | string \| null | Links to encrypted credential in vault |
| riskLevel | `"high"` \| `"medium"` \| `"low"` | Risk classification |
| capabilities | string[] | What this service can do |
| allowedAgents | string[] | Which agents can use this service |
| config | object | Service configuration (credentials, settings) |
| catalogId | string \| null | Links to service-catalog.json entry |
| installedAt | ISO 8601 | When added |
| lastUsed | ISO 8601 \| null | Last execution time |

## Sidebar Navigation
```
[Workspace Switcher]
Workbench (task board, quick capture)
Goals (strategic layer)
Initiatives (where work lives - tasks + actions together)
Approvals (cross-initiative queue for pending Actions)
Services (connected services)
Vault (credentials)
Safety (limits config)
Messages (inbox, activity, decisions)
Crew (agents, skills)
```

## Eisenhower Matrix
- **DO** (important + urgent) - Work on immediately
- **SCHEDULE** (important + not-urgent) - Block time, protect from neglect
- **DELEGATE** (not-important + urgent) - Assign to an AI agent
- **ELIMINATE** (not-important + not-urgent) - Drop or defer

## Agent Registry (Dynamic)

Agents are managed through `agents.json` and the `/crew` UI. The 5 built-in agents are:

| Role | Handles | Assign when... |
|------|---------|----------------|
| **me** | Decisions, approvals, creative direction | Requires human judgment |
| **researcher** | Market research, competitive analysis, evaluation | Needs investigation |
| **developer** | Code, bug fixes, testing, deployment | Technical implementation |
| **marketer** | Copy, growth strategy, content, SEO | Marketing/content work |
| **business-analyst** | Strategy, planning, prioritization, financials | Analysis/strategy work |

Custom agents can be created via `/crew/new`. Agent command files are auto-generated from the registry when agents are saved via the API.

### Multi-Agent Tasks
Tasks support a `collaborators` field alongside `assignedTo` (lead). When collaborators are assigned:
- All collaborators receive delegation messages in inbox
- Task cards show stacked collaborator avatars
- The orchestrator can spawn sub-agents for each team member

### Skills Library
Skills are managed through `skills-library.json` and the `/skills` UI. Skills contain markdown content that gets injected into agent system prompts when linked. Skill files (`skills/<id>/SKILL.md`) are auto-generated from the library.

## Agent Write Strategy

**Prefer API endpoints for writes.** The API routes include:
- Zod validation (prevents malformed data)
- Mutex locking (prevents concurrent write corruption)
- Side effects (auto-delegation, activity logging)

Available API routes: `/api/tasks`, `/api/goals`, `/api/initiatives`, `/api/actions`, `/api/workspaces`, `/api/agents`, `/api/inbox`, `/api/decisions`, `/api/activity-log`, `/api/brain-dump`, `/api/services`.

**Direct file reads are fine for speed.** Reading JSON files directly (e.g., `readFile("tasks.json")`) is safe and faster than API calls. Use this for situational awareness.

**Concurrent write safety:** The API uses per-file mutexes (`async-mutex`). Two simultaneous API writes to the same file will queue, not corrupt. However, direct file writes bypass the mutex - always use the API for writes when possible.

**Error recovery:** If a task fails mid-execution:
1. Mark the task as `in-progress` with a note explaining the failure
2. Post a partial report to inbox (type: `"report"`, subject: `"Blocked: <task-title>"`)
3. Log a `task_updated` event to activity-log with error details
4. Do NOT mark the task as done

## Agent Communication Protocol

Agents communicate through JSON files. The Mission Control UI reads these same files through API routes.

### How to Read Your Inbox
```
1. Read inbox.json from your workspace data directory
2. Filter messages where `to` matches your role
3. Filter by `status: "unread"` for new messages
4. Process delegations (type: "delegation") as new work assignments
5. Process questions (type: "question") by replying with answers
```

### How to Post a Completion Report
```
1. Read inbox.json
2. Add a new message:
   {
     "id": "msg_{Date.now()}",
     "from": "<your-role>",
     "to": "me",
     "type": "report",
     "taskId": "<task-id-if-applicable>",
     "subject": "Completed: <task-title>",
     "body": "<summary of work done, results, any follow-up needed>",
     "status": "unread",
     "createdAt": "<ISO timestamp>",
     "readAt": null
   }
3. Write the updated inbox.json back
```

### How to Log Activity
```
1. Read activity-log.json
2. Add a new event:
   {
     "id": "evt_{Date.now()}",
     "type": "<event-type>",
     "actor": "<your-role>",
     "taskId": "<task-id-if-applicable>",
     "summary": "<what happened>",
     "details": "<extended context>",
     "timestamp": "<ISO timestamp>"
   }
3. Write the updated activity-log.json back
```

### How to Request a Decision
```
1. Read decisions.json
2. Add a new decision:
   {
     "id": "dec_{Date.now()}",
     "requestedBy": "<your-role>",
     "taskId": "<task-id-if-applicable>",
     "question": "<what you need decided>",
     "options": ["Option A", "Option B", "Option C"],
     "context": "<background info>",
     "status": "pending",
     "answer": null,
     "answeredAt": null,
     "createdAt": "<ISO timestamp>"
   }
3. Write the updated decisions.json back
4. Also log a "decision_requested" event in activity-log.json
```

### How to Update Task Progress
```
1. Read tasks.json
2. Find the task by ID
3. Update fields (kanban, subtasks, actualMinutes, etc.)
4. Always update "updatedAt" to current ISO timestamp
5. If marking done: set "completedAt" to current timestamp
6. Write the updated tasks.json back
7. Log a "task_updated" or "task_completed" event in activity-log.json
```

### How to Check and Unblock Dependent Tasks
```
1. After completing a task, search tasks.json for tasks that have the completed task's ID in their "blockedBy" array
2. Those tasks are now potentially unblocked
3. If all their blockedBy dependencies are done, they can proceed
4. Post an update message to inbox.json notifying the assigned agent
```

## Workflow Rules

### Creating Tasks
1. Set importance AND urgency (required for Eisenhower matrix)
2. Set assignedTo based on work nature (see Agent Roles table)
3. Link initiativeId when task belongs to an initiative
4. Add subtasks for multi-step work
5. Add acceptanceCriteria to define "done"
6. Set estimatedMinutes when possible
7. Generate IDs as: `task_{Date.now()}`, `goal_{Date.now()}`, `init_{Date.now()}`, `action_{Date.now()}`, `bd_{Date.now()}`
8. Use valid JSON with 2-space indentation

### Updating Tasks
1. Always update `updatedAt` timestamp
2. When kanban -> `"done"`: set `completedAt` to current ISO timestamp
3. When kanban changes from `"done"`: set `completedAt` to null
4. Log activity events for significant changes
5. Post completion reports to inbox when finishing delegated work

### Daily Planning
1. Read `ai-context.md` for quick situational awareness
2. Check inbox for new delegations and messages
3. Check decisions for pending items needing your input
4. Focus on DO quadrant tasks first (important + urgent)
5. Protect SCHEDULE quadrant from neglect (important + not-urgent)
6. Triage unprocessed brain dump entries every session
7. Update kanban status as work begins and completes

### Brain Dump Triage
- Convert to task: set `processed=true`, create task, set `convertedTo=taskId`
- Archive: set `processed=true`, leave `convertedTo=null`
- Keep entries short; elaboration goes in the task description

### After Modifying Data Files
Run `pnpm gen:context` in `` to regenerate `ai-context.md`

## Tech Stack
- Node.js LTS + **pnpm** (NOT npm or yarn)
- Next.js 15 App Router + TypeScript strict + Tailwind CSS v4 + shadcn/ui
- Local JSON file storage - no external databases
- Path alias: `@/` maps to `src/` (inside )

## Code Conventions
- TypeScript strict mode, no `any` types
- Functional components with hooks
- `"use client"` only when needed (interactive pages, hooks)
- Prefer named exports
- After code changes: `pnpm tsc --noEmit` (in )

## Commands (run inside )
- Dev: `pnpm dev`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Typecheck: `pnpm tsc --noEmit`
- Test: `pnpm test`
- Full verify: `pnpm verify` (typecheck + lint + build + test)
- Generate AI context: `pnpm gen:context`
- Daemon start: `pnpm daemon:start`
- Daemon stop: `pnpm daemon:stop`
- Daemon status: `pnpm daemon:status`

## Agent Daemon

The daemon is an autonomous background process that polls tasks.json, spawns Claude Code sessions via `claude -p`, and monitors their health. It uses `node-cron` for scheduled commands and enforces concurrency limits.

### Configuration - `daemon-config.json`

| Section | Fields | Description |
|---------|--------|-------------|
| `polling` | `enabled`, `intervalMinutes` | How often to poll for new tasks (1-60 min) |
| `concurrency` | `maxParallelAgents` | Max simultaneous Claude Code sessions (1-10) |
| `schedule` | `Record<name, {enabled, cron, command}>` | Cron-based scheduled commands |
| `execution` | `maxTurns`, `timeoutMinutes`, `retries`, `retryDelayMinutes`, `skipPermissions` | Per-session limits |

### Dashboard - `/daemon`
- Live status (running/stopped), active sessions, recent history
- Start/stop controls, config summary, schedule display
- Auto-refreshes every 5 seconds via `useDaemon()` hook

### Security Model
- **No network listener** - pure local process, zero network attack surface
- **Credential scrubbing** - all stdout/stderr sanitized before logging
- **Prompt fencing** - task data wrapped in `<task-context>` delimiters
- **Binary whitelist** - only `claude`/`claude.cmd`/`claude.exe` can be spawned
- **Safe env** - child processes only receive PATH, HOME, TEMP (no API keys leak)
- **`skipPermissions`** defaults to `false` - logged with `[SECURITY]` warning when enabled

## AI Skills (slash commands)
| Command | Purpose |
|---------|---------|
| `/standup` | Daily standup from git + tasks + inbox + activity |
| `/daily-plan` | Top priorities + inbox check + decisions + brain dump triage |
| `/weekly-review` | Accomplishments + goal progress + stale items |
| `/brainstorm` | Generate creative ideas on a topic |
| `/research` | Web research -> structured markdown |
| `/plan-feature` | Break feature into tasks + create initiative |
| `/ship-feature` | Test/lint/commit + update task status + post report |
| `/pick-up-work` | Check inbox for new assignments, pick highest priority |
| `/report` | Post a status update or completion report |
| `/orchestrate` | Coordinate all agents - spawn sub-agents for pending tasks |
| `/researcher` | Activate researcher agent persona |
| `/marketer` | Activate marketer agent persona |
| `/business-analyst` | Activate business analyst persona |
