# Conversation Unification Plan

Unify chat and task execution into a single "Conversation" primitive. Tasks retain their project-management metadata but delegate execution to conversations.

**Status:** Draft (reviewed by council)
**Estimated effort:** 25-35 working days
**Risk:** Medium-high (daemon changes, data migration, UI replacement)

---

## Problem

Two completely separate systems for agent interaction:

**Chat path:**
- `@assistant-ui/react` + Vercel AI SDK
- Streams via fetch `UIMessageStreamResponse`
- Persisted in `chat-sessions.json` + Claude JSONL session logs
- No connection to tasks, decisions, or daemon
- No interactive follow-up after session ends
- Components: `AssistantThread.tsx`, `ChatSidebar.tsx`, `tool-uis.tsx`

**Task path:**
- Daemon-driven via `run-task.ts` + `spawnAgent()`
- JSONL stream files viewed via `DaemonRunViewer` + SSE
- Persisted in `tasks.json`, `active-runs.json`, `decisions.json`, stream files
- Rich PM metadata: kanban, blockers, subtasks, projects, milestones, missions
- No conversational follow-up on task runs

**Consequences:**
- Two streaming protocols to maintain
- Two persistence models to debug
- Two UI rendering paths to evolve
- Chat can't create decisions or integrate with task lifecycle
- Task runs can't be followed up conversationally
- Duplicated effort for every cross-cutting improvement

---

## Target Architecture

### Three-Layer Model

The plan separates three concepts that the current system conflates:

1. **Conversation** -- the durable thread (metadata, title, links, summary)
2. **ConversationRun** -- a single execution attempt (pid, process lifecycle, Claude session, tokens)
3. **Task** -- project management metadata (kanban, blockers, scheduling) that references a conversation

```
Conversation (durable thread)
├── id, title, status, mode
├── agentId, model, executionSource
├── turns (append-only JSONL, separate from metadata)
├── runs[] → execution attempts
├── currentRunId → active run (if any)
├── tokens (aggregate), artifacts, mentionedPaths
├── decisions (linked by conversationId)
├── SSE event channel
└── optional taskId → links to Task

ConversationRun (execution attempt)
├── id, conversationId
├── pid, status, exitCode
├── sessionHandle (Claude session ID for resume)
├── continuationIndex
├── source (manual, project-run, mission-chain, scheduled, etc.)
├── projectId, missionId (operational context)
├── tokens (per-run)
├── startedAt, completedAt
├── error, errorKind
└── requestId (idempotency)

Task (project management -- unchanged)
├── id, title, kanban, blockers, subtasks
├── projectId, milestoneId, tags, dueDate
├── assignedTo, scheduling config
└── conversationId → links to execution
     (null until first run)
```

### Why Three Layers?

A conversation can have multiple execution attempts:
- Daemon crashes mid-run → new run on restart
- Continuation after timeout → new run, same conversation
- Decision answered → new run resumes the Claude session
- Retry after failure → new run

Without `ConversationRun`, you'd flatten pid, session handle, and process state into the conversation itself, creating ambiguity about which attempt is current and making crash recovery unreliable.

### Lifecycle

```
User starts a chat        → creates Conversation (mode: foreground) + Run
User creates a task        → Task created (conversationId: null)
Daemon runs a task        → creates Conversation (mode: background, taskId linked) + Run
User follows up on task   → opens linked Conversation, sends turn via /continue → new Run
Agent needs human input   → Run completes, Conversation → awaiting-decision, decision created
Human answers decision    → new Run resumes Claude session from conversation.sessionHandle
User backgrounds a chat   → Conversation mode flips to background, daemon continues
Daemon crashes mid-run    → on restart, detect dead pid, mark Run failed, optionally auto-retry
Continuation (timeout)    → new Run appended to same Conversation, increments continuationIndex
```

### Streaming Strategy

Use BOTH streaming and SSE, not one or the other:

- **Content streaming** for live token-by-token generation in foreground mode (via SSE `turn.delta` events)
- **SSE events** for state transitions, approvals, completion, errors, turn boundaries, and orchestration

SSE handles the durable coordination layer. Content deltas within SSE handle the real-time UX. The SSE channel is the single transport for both orchestration and content, avoiding a split-brain between two different streaming mechanisms.

---

## Data Model

### Conversation Metadata

Stored in `conversations.json` (per workspace, like existing data files).

```ts
interface Conversation {
  id: string;
  title: string;
  agentId: string | null;
  model: string | null;
  status: ConversationStatus;
  mode: "foreground" | "background";
  executionSource: ConversationSource;

  // Linking
  taskId: string | null;
  parentConversationId: string | null;  // for branching/forking

  // Run tracking
  currentRunId: string | null;          // active ConversationRun, if any
  runCount: number;                     // total execution attempts

  // Aggregate metrics (across all runs)
  tokens: { input: number; output: number; cache?: number; total: number };
  turnCount: number;

  // State
  error: string | null;                 // last error message
  errorKind: ConversationErrorKind | null;
  pausedReason: string | null;          // why we're awaiting-decision
  pausedDecisionId: string | null;      // specific decision blocking progress
  summary: string | null;               // condensed state for long conversations

  // Artifacts
  artifactRefs: string[];               // file paths created/edited
  mentionedPaths: string[];             // files mentioned/read
  attachmentPaths: string[];            // user-uploaded attachments

  // Timestamps
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  archivedAt: string | null;            // soft archive (not hard delete)
  deletedAt: string | null;             // soft delete (not hard delete)
  pausedAt: string | null;              // when conversation entered awaiting-decision

  // Migration
  version: number;                      // schema version for future migrations
}

type ConversationStatus =
  | "idle"                              // created but not yet started (draft)
  | "queued"                            // waiting for daemon to pick up
  | "starting"                          // run created, process spawning
  | "running"                           // agent actively executing
  | "awaiting-decision"                 // paused for human input
  | "completed"                         // finished successfully
  | "failed"                            // finished with error
  | "cancelled";                        // cancelled by user

type ConversationSource =
  | "chat"                              // user started a chat
  | "task"                              // daemon ran a task
  | "manual"                            // manually triggered task run
  | "project-run"                       // part of a project run
  | "mission-chain"                     // mission continuation
  | "scheduled"                         // scheduled job
  | "webhook"                           // triggered by webhook
  | "inbox-respond"                     // responding to inbox message
  | "comment"                           // triggered by task comment
  | "wiki";                             // wiki processing

type ConversationErrorKind =
  | "cli_not_found"
  | "auth_expired"
  | "rate_limited"
  | "session_expired"
  | "context_exceeded"
  | "timeout"
  | "transport"
  | "unknown";
```

### Conversation Runs

Stored alongside conversation metadata in `conversations.json` (as a separate top-level key) or in per-conversation directories: `conversations/<conversationId>/runs.json`

A run represents a single process execution attempt within a conversation.

```ts
interface ConversationRun {
  id: string;
  conversationId: string;
  status: "starting" | "running" | "completed" | "failed" | "stopped" | "timeout";

  // Process tracking
  pid: number | null;                   // OS process ID (for crash recovery)
  sessionHandle: string | null;         // Claude session ID (for resume)
  continuationIndex: number;            // 0 = first run, 1+ = continuation

  // Context
  source: ConversationSource;           // what triggered this run
  projectId: string | null;             // operational context from task
  missionId: string | null;             // mission context if applicable

  // Metrics (per-run)
  tokens: { input: number; output: number; cache?: number; total: number };
  numTurns: number;

  // Idempotency
  requestId: string | null;             // client-generated, for dedup

  // Timestamps
  startedAt: string;
  completedAt: string | null;

  // Outcome
  exitCode: number | null;
  error: string | null;
  errorKind: ConversationErrorKind | null;

  // Model config
  model: string | null;
  noPrune?: boolean;
}
```

### Conversation Turns

Stored in separate append-only JSONL files: `conversations/<conversationId>/turns.jsonl`

NOT inline in conversation metadata. This avoids bloating the metadata file and supports partial writes, replay, and long-running conversations.

```ts
interface ConversationTurn {
  id: string;
  turn: number;
  role: "user" | "assistant";
  ts: string;

  // Content -- preserve structured parts, not just flattened string
  content: string;                      // rendered text content
  parts?: MessagePart[];                // structured message parts (text, thinking, tool_use, tool_result)

  // Streaming state
  pending?: boolean;                    // true while still streaming

  // Metrics
  tokens?: { input: number; output: number; cache?: number };

  // Run association
  runId?: string;                       // which ConversationRun produced this turn

  // Completion
  exitCode?: number | null;
  error?: string;

  // Structured data
  toolCalls?: ToolCallRecord[];
  mentionedPaths?: string[];
  attachmentPaths?: string[];
  artifactRefs?: string[];
}

interface MessagePart {
  type: "text" | "thinking" | "tool_use" | "tool_result";
  content: string;
  toolName?: string;                    // for tool_use/tool_result
  toolCallId?: string;
  status?: "running" | "completed" | "error";
}

interface ToolCallRecord {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  result?: string;
  status: "running" | "completed" | "error";
  durationMs?: number;
}
```

### Conversation Events

Events drive real-time updates via SSE. Stored in append-only event log for replay: `conversations/<conversationId>/events.jsonl`

Events use **typed payloads** per event type, not generic records. This prevents correctness issues during replay and UI rendering.

```ts
// Base event shape
interface ConversationEventBase {
  conversationId: string;
  ts: string;
  seq: number;                          // monotonic per-conversation, durable across restarts
}

// Typed event union
type ConversationEvent =
  | TurnStartedEvent
  | TurnDeltaEvent
  | TurnCompletedEvent
  | ToolCallStartedEvent
  | ToolCallCompletedEvent
  | ConversationStartedEvent
  | ConversationUpdatedEvent
  | ConversationCompletedEvent
  | ConversationPausedEvent
  | ConversationResumedEvent
  | ConversationErrorEvent
  | ConversationCancelledEvent
  | DecisionCreatedEvent
  | DecisionAnsweredEvent;

interface TurnStartedEvent extends ConversationEventBase {
  type: "turn.started";
  payload: { turnId: string; turn: number; role: "user" | "assistant" };
}

interface TurnDeltaEvent extends ConversationEventBase {
  type: "turn.delta";
  payload: { turnId: string; delta: string; partType?: "text" | "thinking" };
}

interface TurnCompletedEvent extends ConversationEventBase {
  type: "turn.completed";
  payload: { turnId: string; tokens?: { input: number; output: number } };
}

interface ToolCallStartedEvent extends ConversationEventBase {
  type: "tool.started";
  payload: { turnId: string; toolCallId: string; tool: string; args: Record<string, unknown> };
}

interface ToolCallCompletedEvent extends ConversationEventBase {
  type: "tool.completed";
  payload: { turnId: string; toolCallId: string; tool: string; status: "completed" | "error"; result?: string };
}

interface ConversationStartedEvent extends ConversationEventBase {
  type: "conversation.started";
  payload: { runId: string; source: ConversationSource };
}

interface ConversationUpdatedEvent extends ConversationEventBase {
  type: "conversation.updated";
  payload: { fields: Partial<Pick<Conversation, "title" | "status" | "summary" | "tokens">> };
}

interface ConversationCompletedEvent extends ConversationEventBase {
  type: "conversation.completed";
  payload: { runId: string; exitCode: number | null; tokens: { input: number; output: number; total: number } };
}

interface ConversationPausedEvent extends ConversationEventBase {
  type: "conversation.paused";
  payload: { reason: string; decisionId: string };
}

interface ConversationResumedEvent extends ConversationEventBase {
  type: "conversation.resumed";
  payload: { runId: string; decisionId: string; answer: string };
}

interface ConversationErrorEvent extends ConversationEventBase {
  type: "conversation.error";
  payload: { runId: string; error: string; errorKind: ConversationErrorKind };
}

interface ConversationCancelledEvent extends ConversationEventBase {
  type: "conversation.cancelled";
  payload: { runId: string | null; reason?: string };
}

interface DecisionCreatedEvent extends ConversationEventBase {
  type: "decision.created";
  payload: { decisionId: string; question: string; options: string[] };
}

interface DecisionAnsweredEvent extends ConversationEventBase {
  type: "decision.answered";
  payload: { decisionId: string; answer: string };
}
```

### Task Changes

Minimal changes to existing Task type:

```ts
interface Task {
  // ... all existing fields unchanged ...
  conversationId: string | null;        // NEW: link to current/latest conversation
  // Note: a task may have had previous conversations (retries).
  // conversationId points to the latest. Historical ones can be
  // queried by filtering conversations by taskId.
}
```

**`ActiveRun` is replaced by `ConversationRun`.** The `active-runs.json` file is eliminated, but this requires migrating all consumers first (see "active-runs.json Consumers" section below).

Decisions gain `conversationId` **alongside** `taskId` (not replacing it):

```ts
interface DecisionItem {
  // ... all existing fields unchanged ...
  conversationId: string | null;        // NEW: link to conversation (in addition to taskId)
  // taskId remains the primary key for backward compatibility.
  // conversationId enables decisions to work for non-task conversations (chat).
}
```

### Persistence Layout

```
workspaces/<workspaceId>/
├── conversations.json                  # conversation + run metadata records
├── conversations/
│   ├── <conversationId>/
│   │   ├── turns.jsonl                 # append-only turn log
│   │   ├── events.jsonl                # append-only event log
│   │   └── seq.txt                     # current sequence number (durable counter)
│   └── ...
├── tasks.json                          # unchanged (gains conversationId field)
├── decisions.json                      # gains conversationId field
├── projects.json                       # unchanged
├── inbox.json                          # unchanged
├── activity-log.json                   # unchanged
├── agents.json                         # unchanged
├── daemon-config.json                  # unchanged
└── ... (other existing files unchanged)
```

### Concurrency and File Locking

JSON + JSONL writes need per-conversation mutexes to prevent corruption under concurrent writes.

```ts
// Per-conversation lock (same pattern as existing per-file Mutex in data.ts)
const conversationLocks = new Map<string, Mutex>();

function getConversationLock(conversationId: string): Mutex {
  if (!conversationLocks.has(conversationId)) {
    conversationLocks.set(conversationId, new Mutex());
  }
  return conversationLocks.get(conversationId)!;
}

// All writes go through lock:
async function appendConversationTurn(conversationId: string, turn: ConversationTurn) {
  const lock = getConversationLock(conversationId);
  return lock.runExclusive(async () => {
    await appendJsonl(`conversations/${conversationId}/turns.jsonl`, turn);
  });
}
```

`conversations.json` (the metadata index) uses the existing workspace-level file mutex pattern from `data.ts`.

---

## Event Contract

### SSE Endpoint: `GET /api/conversations/[id]/events`

- Supports `Last-Event-ID` header for replay on reconnect
- Replays missed events from `events.jsonl` starting after the given seq
- Each SSE message includes `id: <seq>` for client tracking
- Sends heartbeat ping every 15 seconds
- Cleans up on request abort

### Replay Semantics

- **At-least-once delivery**: clients may receive duplicate events on reconnect
- **Client-side idempotency**: clients should deduplicate by `seq` number
- **Ordering guarantee**: events within a conversation are strictly ordered by `seq`
- **No cross-conversation ordering**: not needed, each conversation is independent
- `Last-Event-ID` is a client concern -- NOT stored on the Conversation record

### Event Bus Implementation: File-Watching (Cross-Process)

**Critical:** The daemon runs as a separate process from Next.js API routes. An in-process `EventEmitter` singleton cannot bridge them.

Instead, use **file-watching + in-process fan-out**:

```ts
// Daemon side: writes events to JSONL (append-only)
async function publishConversationEvent(event: Omit<ConversationEvent, "ts" | "seq">) {
  const seq = await nextSeq(event.conversationId);
  const full = { ...event, ts: new Date().toISOString(), seq };
  await appendEventLog(event.conversationId, full);
  // In-process listeners (if any) get notified via EventEmitter
  localBus.emit(`conversation:${event.conversationId}`, full);
}

// API side: SSE endpoint watches event log file for changes
// Uses fs.watch / chokidar on events.jsonl
// When new lines appear, parse and send to connected SSE clients
// Also maintains in-process EventEmitter for same-process producers
```

The event log file is the **source of truth** for cross-process coordination. The in-process EventEmitter is an optimization for same-process notifications (e.g., when the API route itself writes an event).

### Sequence Generation

Sequence numbers must be **durable and monotonic across process restarts**.

```ts
// Stored in conversations/<conversationId>/seq.txt
// Read-increment-write under file lock
async function nextSeq(conversationId: string): Promise<number> {
  const lock = getConversationLock(conversationId);
  return lock.runExclusive(async () => {
    const seqFile = `conversations/${conversationId}/seq.txt`;
    const current = parseInt(await readFile(seqFile, "utf-8").catch(() => "0"), 10);
    const next = current + 1;
    await writeFile(seqFile, String(next));
    return next;
  });
}
```

### Idempotency

- `POST /conversations/[id]/continue` must be idempotent:
  - If conversation already has a running run, reject with 409
  - Include a client-generated `requestId` to deduplicate
  - Store recent requestIds on the conversation for dedup window (e.g., last 10)
- `POST /conversations` for creation: use client-generated UUID to prevent duplicate conversations
- Decision answers: check `decision.status !== "pending"` before applying

### Crash Recovery

- On daemon restart: scan conversations with `status: "running"` or `status: "starting"`
- For each, check if the associated run's `pid` is still alive (using existing `isProcessRunning()` pattern)
- If dead: mark run as `failed`, mark conversation as `failed` with `errorKind: "unknown"`
- If alive: reattach by watching the event log file
- Conversation turns already persisted in JSONL survive process crashes
- Optionally auto-retry: create a new run that resumes the Claude session

### Cancellation

- `POST /conversations/[id]/cancel`:
  - Find active run (via `currentRunId`)
  - Send SIGTERM to `run.pid` (kill process tree, same as existing stop logic)
  - Mark run as `stopped`
  - Mark conversation as `cancelled`
  - Publish `conversation.cancelled` event

---

## API Routes

### New Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/conversations` | GET | List conversations. Filter by `taskId`, `status`, `mode`, `agentId`, `source` |
| `/api/conversations` | POST | Create conversation. Params: `userMessage`, `agentId`, `model`, `mode`, `taskId?`, `source` |
| `/api/conversations/[id]` | GET | Get conversation metadata + runs. `?withTurns=1` includes turns |
| `/api/conversations/[id]` | PATCH | Update metadata (title, summary). Soft-archive/soft-delete via `archivedAt`/`deletedAt` |
| `/api/conversations/[id]` | DELETE | **Soft delete only.** Sets `deletedAt`, does not remove files. Prevents broken references. |
| `/api/conversations/[id]/continue` | POST | Send follow-up turn. Returns 202. Params: `userMessage`, `requestId` |
| `/api/conversations/[id]/cancel` | POST | Cancel running conversation (kills active run) |
| `/api/conversations/[id]/events` | GET | SSE stream with `Last-Event-ID` replay |

### Routes to Remove (after migration)

| Route | Replaced by |
|---|---|
| `GET/POST /api/chat` | `/api/conversations` |
| `POST/PATCH/DELETE /api/chat/session` | `/api/conversations/[id]` |
| `GET /api/chat/messages` | `/api/conversations/[id]?withTurns=1` |
| `GET /api/runs/stream` | `/api/conversations/[id]/events` |
| `GET /api/runs` | List conversations with `status: running` |

### Routes Unchanged

All task PM routes stay as-is:
- `/api/tasks` (CRUD, but PATCH gains ability to link/unlink conversationId)
- `/api/tasks/[id]/run` (now creates a conversation + run and links it)
- `/api/tasks/[id]/stop` (now cancels the linked conversation's active run)
- `/api/decisions` (gains conversationId field, keeps taskId)
- `/api/projects`, `/api/missions`, `/api/inbox`, `/api/activity` -- all unchanged

---

## `active-runs.json` Consumer Migration

`active-runs.json` is used more broadly than just `run-task.ts`. All consumers must be migrated before it can be removed:

| Consumer | File | What it does | Migration |
|---|---|---|---|
| Run creation | `scripts/daemon/run-task.ts` | Creates/updates ActiveRun entries | Write ConversationRun instead |
| Run status API | `src/app/api/runs/route.ts` | Lists active runs, checks PID liveness | Query conversations with running status |
| Run stream API | `src/app/api/runs/stream/route.ts` | SSE tail of stream file | Replace with conversation SSE |
| Task run start | `src/app/api/tasks/[id]/run/route.ts` | Checks for existing active run | Check conversation.currentRunId |
| Task stop | `src/app/api/tasks/[id]/stop/route.ts` | Kills PID from active run | Kill PID from ConversationRun |
| Project run/stop | `src/app/api/projects/[id]/run/route.ts`, `stop/route.ts` | Manages runs for project tasks | Same pattern, query by taskId |
| Active runs provider | `src/providers/active-runs-provider.tsx` | React context for active runs | Replace with conversation status polling/SSE |
| Active runs hook | `src/hooks/use-active-runs.ts` | Client-side active run data | Replace with conversation query |
| Dashboard logs | `src/components/dashboard-logs.tsx` | Shows active run streams | Show conversation events |
| Wiki processor | `scripts/daemon/wiki-processor.ts` | Checks for running wiki tasks | Check conversation status |
| Task comment run | `scripts/daemon/run-task-comment.ts` | Creates run for comment-triggered tasks | Create conversation + run |
| Scheduled jobs | `src/lib/scheduled-jobs.ts` | Checks active runs for concurrency | Count running conversations |

---

## Decision Resume Flow

The existing decision flow pauses agent execution for human input. Here's exactly how it maps to conversations:

### Current Flow (task-only)
```
1. Agent detects it needs input → writes decision to decisions.json
2. run-task.ts detects pending decision → stops execution
3. Task moves to "awaiting-decision", Claude session ID saved to decision-sessions.json
4. Human answers decision via decision-dialog.tsx
5. Decision API marks decision as answered, task moves back to "not-started"
6. Daemon picks up task, resumes Claude session using saved session ID
```

### New Flow (conversation-based)
```
1. Agent detects it needs input → writes decision to decisions.json (with conversationId)
2. run-task.ts detects pending decision → marks Run as completed, Conversation as "awaiting-decision"
3. Claude session ID saved on Conversation.sessionHandle (replaces decision-sessions.json)
4. Publishes conversation.paused event (includes decisionId)
5. Human answers decision via decision-dialog.tsx (unchanged UI)
6. Decision API marks decision answered → publishes decision.answered event
7. Decision API (or daemon watcher) triggers new Run:
   - Creates ConversationRun with source context
   - Resumes Claude session using conversation.sessionHandle
   - Appends "Decision answered: <answer>" as user turn
   - Conversation status → "running"
8. Publishes conversation.resumed event
```

### Key Difference
`decision-sessions.json` is eliminated. The session handle lives on the Conversation record, which is the natural place for it since the session belongs to the conversation thread, not the task or the decision.

---

## Daemon Adaptation

### Changes to `run-task.ts`

Current flow:
```
1. Validate task → 2. Create ActiveRun → 3. Mark task in-progress
4. Build prompt → 5. Spawn agent → 6. Write JSONL to stream file
7. On decision: save to decisions.json, mark task awaiting-decision
8. On completion: mark task done, post inbox report
```

New flow:
```
1. Validate task
2. Create Conversation (if none linked) + ConversationRun
3. Mark task in-progress, link conversation
4. Build prompt → 5. Spawn agent (with run.pid tracked)
6. Parse JSONL output → write ConversationTurns + publish ConversationEvents
7. On decision: create decision (with conversationId), complete run, pause conversation
8. On completion: complete run, complete conversation, mark task done, post inbox report
```

### Key Changes

**Replace ActiveRun with Conversation + ConversationRun:**
```ts
// Before
const run = { id, taskId, agentId, pid, status: "running", streamFile, ... };
saveActiveRuns(runs);

// After
const conversation = createConversation({
  taskId, agentId, status: "starting", mode: "background",
  executionSource: source, // "task", "mission-chain", etc.
});
const run = createConversationRun({
  conversationId: conversation.id,
  pid: null, // set after spawn
  source, projectId, missionId,
  continuationIndex: 0,
});
updateConversation(conversation.id, { currentRunId: run.id });
// After spawn:
updateConversationRun(run.id, { pid: childProcess.pid, status: "running" });
updateConversation(conversation.id, { status: "running" });
publishConversationEvent({ type: "conversation.started", conversationId: conversation.id, payload: { runId: run.id, source } });
```

**Replace stream file writing with turn appending:**
```ts
// Before
appendFileSync(streamFile, JSON.stringify(line) + "\n");

// After
const turn = await appendConversationTurn(conversationId, {
  role: "assistant",
  content: accumulatedText,
  parts: structuredParts,
  toolCalls: parsedToolCalls,
  tokens: { input, output },
  runId: currentRunId,
});
await publishConversationEvent({
  type: "turn.completed",
  conversationId,
  payload: { turnId: turn.id, tokens: { input, output } },
});
```

**Decision creation links to conversation:**
```ts
// Before
decisions.push({ id, taskId, question, ... });

// After
decisions.push({ id, taskId, conversationId, question, ... });
updateConversationRun(currentRunId, { status: "completed" });
updateConversation(conversationId, {
  status: "awaiting-decision",
  pausedReason: question,
  pausedDecisionId: decisionId,
  pausedAt: new Date().toISOString(),
  currentRunId: null,
  sessionHandle: claudeSessionId, // saved here, not in decision-sessions.json
});
publishConversationEvent({ type: "conversation.paused", conversationId, payload: { reason: question, decisionId } });
```

**Continuation resumes same conversation with new run:**
```ts
// Before: spawns new process, new stream file, increments continuationIndex
// After: creates new ConversationRun with incremented continuationIndex, appends to same conversation
const newRun = createConversationRun({
  conversationId,
  continuationIndex: previousRun.continuationIndex + 1,
  source: previousRun.source,
  sessionHandle: conversation.sessionHandle, // resume same Claude session
});
updateConversation(conversationId, { currentRunId: newRun.id, status: "starting" });
```

### Unchanged Daemon Behavior

- `runner.ts` (Claude binary resolution, process spawning) -- unchanged
- `prompt-builder.ts` -- unchanged
- Scheduling logic (task picking, blockers, concurrency) -- unchanged except checking conversations instead of active-runs for concurrency
- Mission chaining -- unchanged (just links conversations to tasks via run's missionId/projectId)

---

## UI Components

### Phase 1: Keep @assistant-ui/react, unify data layer

Initially, keep the existing chat UI working while the backend unifies. The chat API adapter translates between the new conversation model and assistant-ui's expected format.

This lets us prove the backend unification without UI risk.

### Phase 2: Evaluate and likely replace @assistant-ui/react

After backend unification is stable, build custom conversation UI. The motivation: one rendering path for both foreground and background conversations, no impedance mismatch with assistant-ui's assumptions.

**New components:**

| Component | Purpose | Source |
|---|---|---|
| `ConversationView` | Main conversation renderer: turn list, composer, streaming state, decision panel | Adapted from cabinetai `task-conversation-page.tsx` |
| `TurnBlock` | Single turn: avatar, role, content, timestamp, tokens, tool calls, pending indicator | Adapted from cabinetai `turn-block.tsx` |
| `ConversationComposer` | Input with send, slash commands, mentions | Adapted from existing `AssistantThread` composer |
| `ToolCallCard` | Tool call display: Read, Edit, Bash, Grep, Write, Task | Keep existing `tool-uis.tsx` patterns |
| `ConversationList` | Sidebar list of conversations, filterable | Adapted from existing session list |
| `ConversationStatusBadge` | Running/completed/failed/awaiting-decision indicator | New |

**Data flow:**
1. Component subscribes to SSE `/api/conversations/[id]/events`
2. On `turn.started`: add placeholder turn to local state
3. On `turn.delta`: append text delta to current turn (live streaming UX)
4. On `turn.completed`: finalize turn with metrics
5. On `tool.started` / `tool.completed`: update tool call status in turn
6. On `conversation.updated`: refetch metadata
7. On `conversation.paused`: show decision panel
8. On `conversation.resumed`: resume streaming display
9. User input: POST `/api/conversations/[id]/continue` (returns 202)
10. Client deduplicates events by `seq` number on reconnect

**What we lose from @assistant-ui/react:**
- Automatic streaming token display → rebuild with SSE `turn.delta` events
- `ComposerPrimitive` niceties → standard textarea + submit handler
- `makeAssistantToolUI` registration → switch on tool name in `TurnBlock`
- Thread/message primitives → custom React components

**What we gain:**
- One rendering path for foreground and background conversations
- Follow-up on any conversation (chat or task)
- Decision dialog works identically in both contexts
- No framework constraints on how we display agent output
- Ability to add terminal, diff views, etc. without fighting the framework

### Components Removed After Migration

- `AssistantThread.tsx`
- `ChatSidebar.tsx` (replaced by `ConversationView` + `ConversationList`)
- `DaemonRunViewer.tsx` (replaced by `ConversationView` in background mode)

### Components Unchanged

- `tool-uis.tsx` patterns (adapted into `ToolCallCard`)
- `markdown-content.tsx` (reused as-is)
- `decision-dialog.tsx` (reused, linked via conversationId)
- All task PM components: `task-card.tsx`, `task-form.tsx`, etc.

---

## Future Enhancements (Post-Unification)

These become natural extensions once conversations are the universal primitive:

### Embedded Terminal
- Add `xterm.js` + WebSocket PTY endpoint to daemon
- `WebTerminal` component alongside `ConversationView`
- Conversations can have `runtimeMode: "terminal"` for PTY sessions
- ~1 week additional effort

### Inline Diff Rendering
- Show before/after for file edits in `ToolCallCard`
- Use `diff` or `diff2html` package
- Parse from tool call results already captured in turns
- ~2-3 days additional effort

### Conversation Branching
- `parentConversationId` enables forking conversations
- "Try a different approach" creates a branch from a specific turn
- Useful for exploratory agent work

### Conversation Compaction
- Long conversations get summarized
- Old turns archived, summary injected as context
- Keeps token usage manageable for resumed sessions

---

## Migration Plan

### Existing Chat Sessions

Options:
1. **Start fresh** -- old chat sessions are not migrated, remain accessible read-only via legacy endpoint during transition
2. **Migrate** -- convert `chat-sessions.json` entries to conversation records, reconstruct turns from Claude JSONL logs

Recommendation: option 1. Chat history is low-value compared to task execution history. Don't spend time migrating ephemeral chat sessions.

### Existing Task Runs

- Existing completed task runs: leave as-is in `tasks.json`. `conversationId: null` means "ran before unification."
- Active runs at migration time: drain the queue (let running tasks finish), then switch.
- `active-runs.json`: keep as read-only fallback during transition, remove after all consumers migrated.
- Stream files: keep for historical runs, new runs write conversation turns.

### Existing Decisions

- Add `conversationId: null` to all existing decisions (backward compatible).
- New decisions will have `conversationId` set.
- Decision API continues to work with `taskId` as primary key, `conversationId` as secondary.

### `decision-sessions.json` Migration

- Existing entries map `taskId → claudeSessionId`.
- On first conversation-based run of a task with a saved decision session:
  - Read session ID from `decision-sessions.json`
  - Store on new Conversation's `sessionHandle`
  - Remove entry from `decision-sessions.json`
- After all tasks have been migrated, remove `decision-sessions.json`.

### Rollback Plan

- Old routes remain available during transition (just not used by default)
- Feature flag `useConversations: boolean` in daemon config
- If issues arise, flip flag to revert to old task execution path
- Chat can fall back to assistant-ui route if conversation UI has issues

---

## Phased Implementation

### Phase 0: Freeze Event Schema (1-2 days)

**Goal:** Lock down event types, payloads, and replay semantics before building anything. The UI, API, and daemon all depend on this contract.

- [ ] Finalize `ConversationEvent` type union (all event types + typed payloads)
- [ ] Finalize `ConversationRun` type
- [ ] Document replay semantics (at-least-once, seq-based dedup, ordering guarantees)
- [ ] Document delta vs snapshot semantics for each event type
- [ ] Review with team before proceeding

**Risk:** None. This is pure design work. Getting it wrong here compounds through every subsequent phase.

### Phase 1: Conversation Data Model + Persistence (3-4 days)

**Goal:** New types, persistence layer, and file structure. No behavioral changes.

- [ ] Define `Conversation`, `ConversationRun`, `ConversationTurn`, `ConversationEvent` types
- [ ] Add persistence helpers: `getConversations()`, `saveConversation()`, `mutateConversation()`
- [ ] Add `ConversationRun` CRUD helpers
- [ ] Add turn append/read helpers for JSONL files (with per-conversation locks)
- [ ] Add event append/read helpers for JSONL files (with durable seq counter)
- [ ] Add `conversationId` field to `Task` type
- [ ] Add `conversationId` field to `DecisionItem` type
- [ ] Create directory structure for conversation files
- [ ] Write unit tests for persistence helpers
- [ ] Write unit tests for JSONL append + read + locking

**Risk:** Low. Additive only, nothing breaks.

### Phase 2: Event Bus + Conversation API (4-5 days)

**Goal:** Working API routes and SSE infrastructure. Chat and tasks still use old paths.

- [ ] Implement file-watching event bus (cross-process safe)
- [ ] Implement in-process EventEmitter for same-process optimization
- [ ] Implement `GET /api/conversations` (list with filters)
- [ ] Implement `POST /api/conversations` (create with idempotency via requestId)
- [ ] Implement `GET /api/conversations/[id]` (get with optional turns)
- [ ] Implement `PATCH /api/conversations/[id]` (update metadata, soft-delete, soft-archive)
- [ ] Implement `POST /api/conversations/[id]/continue` (follow-up turn, 202 response, 409 if running)
- [ ] Implement `POST /api/conversations/[id]/cancel` (kill active run PID)
- [ ] Implement `GET /api/conversations/[id]/events` (SSE with `Last-Event-ID` replay)
- [ ] Write integration tests for API routes
- [ ] Write tests for SSE replay + reconnect behavior
- [ ] Write tests for idempotency guards

**Risk:** Low-medium. New routes, no old routes affected.

### Phase 3: Daemon Adaptation (5-7 days)

**Goal:** Task execution writes to conversations. This is the switch-over point for tasks.

- [ ] Modify `run-task.ts` to create Conversation + ConversationRun on task run start
- [ ] Track `pid` on ConversationRun after spawn
- [ ] Replace stream file writing with conversation turn appending + event publishing
- [ ] Replace `active-runs.json` writes with conversation/run status updates
- [ ] Store Claude session ID in `conversation.sessionHandle` (not `decision-sessions.json`)
- [ ] Link decisions to conversations (conversationId field, keep taskId)
- [ ] Handle continuation: new ConversationRun with incremented continuationIndex
- [ ] Handle mission chaining: store projectId/missionId on ConversationRun
- [ ] Implement crash recovery: scan running conversations, check PIDs, mark dead runs failed
- [ ] Implement decision resume: new Run that resumes Claude session from conversation.sessionHandle
- [ ] Update `/api/tasks/[id]/run` to create conversation + run and link
- [ ] Update `/api/tasks/[id]/stop` to cancel linked conversation's active run
- [ ] Migrate `decision-sessions.json` reads to conversation.sessionHandle
- [ ] Add feature flag for gradual rollout
- [ ] Write daemon integration tests
- [ ] Test: normal completion, decision pause/resume, continuation, crash recovery, cancellation, mission chain

**Risk:** Medium-high. Daemon changes affect running agent execution. Needs thorough testing. Feature flag enables rollback.

### Phase 4: Migrate active-runs.json Consumers (3-4 days)

**Goal:** All code that reads `active-runs.json` now reads from conversation/run data.

- [ ] Migrate `src/app/api/runs/route.ts` → query running conversations
- [ ] Migrate `src/app/api/runs/stream/route.ts` → redirect to conversation SSE
- [ ] Migrate `src/app/api/projects/[id]/run/route.ts` and `stop/route.ts`
- [ ] Migrate `src/providers/active-runs-provider.tsx` → conversation status
- [ ] Migrate `src/hooks/use-active-runs.ts` → conversation query
- [ ] Migrate `src/components/dashboard-logs.tsx` → conversation events
- [ ] Migrate `scripts/daemon/wiki-processor.ts` → conversation status check
- [ ] Migrate `scripts/daemon/run-task-comment.ts` → create conversation + run
- [ ] Migrate `src/lib/scheduled-jobs.ts` → count running conversations for concurrency
- [ ] Task detail page loads linked conversation and renders turns
- [ ] Task card shows conversation status
- [ ] Decision dialog works with conversationId
- [ ] Dashboard pending decisions work with conversationId
- [ ] Activity log events reference conversations
- [ ] Test all task workflows end-to-end

**Risk:** Medium. Many files to touch, but each is a straightforward substitution.

### Phase 5: Chat UI Migration (4-6 days)

**Goal:** Drop @assistant-ui/react. Single conversation UI for both chat and tasks.

- [ ] Build `ConversationView` component (turn list, streaming via SSE deltas, status)
- [ ] Build `TurnBlock` component (role-aware turn rendering with structured parts)
- [ ] Build `ConversationComposer` (input, send, slash commands)
- [ ] Adapt `ToolCallCard` from existing `tool-uis.tsx`
- [ ] Build `ConversationList` for sidebar
- [ ] Build `ConversationStatusBadge`
- [ ] Wire chat sidebar to use `ConversationView` with `taskId: null` conversations
- [ ] Wire task detail to use `ConversationView` with linked conversation
- [ ] Implement live streaming (token display via `turn.delta` SSE events)
- [ ] Implement SSE reconnect with `Last-Event-ID` replay + client-side seq dedup
- [ ] Test: new chat, follow-up, slash commands, tool call display, streaming, reconnect
- [ ] Remove `@assistant-ui/react` and `@assistant-ui/react-ai-sdk` dependencies
- [ ] Remove `AssistantThread.tsx`, old `ChatSidebar.tsx`, `DaemonRunViewer.tsx`

**Risk:** Medium. Replacing working UI. Keep old components available until new UI is validated.

### Phase 6: Cleanup + Migration (2-3 days)

**Goal:** Remove old code paths, clean up.

- [ ] Remove `/api/chat/*` routes
- [ ] Remove `chat-sessions.ts`, `claude-session-log.ts`
- [ ] Remove `active-runs.json` management code
- [ ] Remove `decision-sessions.json` (after all entries migrated)
- [ ] Remove stream file writing
- [ ] Remove feature flags
- [ ] Remove `@assistant-ui/react` related code
- [ ] Update all imports and references
- [ ] Run migration script: add `conversationId: null` to existing decisions
- [ ] Final end-to-end test of all workflows
- [ ] Update AGENTS.md and documentation

**Risk:** Low. Just removing dead code.

---

## Success Criteria

- [ ] A user can start a chat and follow up on it
- [ ] A task can be run by the daemon and produce a conversation with runs
- [ ] A user can follow up on a task run conversationally (send new turn, get response)
- [ ] Decisions work in both chat and task contexts
- [ ] Decision resume correctly continues the Claude session
- [ ] The same `ConversationView` component renders both chat and task conversations
- [ ] SSE reconnect replays missed events correctly (seq-based dedup)
- [ ] Daemon crash recovery detects dead PIDs and marks runs/conversations as failed
- [ ] Continuation creates new run in same conversation (not a new conversation)
- [ ] Existing task PM features (kanban, blockers, scheduling) work unchanged
- [ ] No regression in mission chaining, inbox, or activity log
- [ ] All `active-runs.json` consumers migrated and working

---

## Resolved Design Decisions

Answers to questions raised during planning and review:

### Turn granularity
**Decision: One turn per assistant response.** Keep tool calls as structured data inside the turn (`toolCalls[]` and `parts[]`), with live progress via `tool.started` / `tool.completed` events. This is simpler than sub-turns and sufficient for the UI. Can be revisited if we need per-tool-call rendering fidelity.

### Conversation retention
**Decision: Soft-retain metadata indefinitely. Archive/compress old turns and events after 90 days.** Metadata is small. Turn JSONL files grow but can be gzipped or truncated for old conversations. Event logs can be pruned more aggressively (30 days) since they're only needed for SSE replay.

### Concurrent conversations per task
**Decision: One active conversation per task at a time.** Multiple historical conversations allowed (retries create new conversations). `task.conversationId` points to the latest. Previous conversations queryable by `taskId` filter. This avoids ambiguity about which conversation represents the task's current state.

### Chat-to-task promotion
**Decision: Later, not in initial scope.** Easy to add with the unified model (add task metadata, link conversationId). But adds UI complexity that shouldn't block the core unification.

### Background chat
**Decision: Later, not in initial scope.** The `mode` field supports it. But daemon orchestration for non-task background conversations adds complexity (what picks them up? how are they prioritized?). Defer until there's a clear use case.

### Hard vs soft delete
**Decision: Soft delete only.** Conversations are referenced by tasks, decisions, activity log, and inbox. Hard delete breaks those references. `deletedAt` field filters them from normal queries but preserves referential integrity.

---

## Dependencies

### npm packages to add
- None required for core unification
- Optional later: `xterm` + addons (terminal), `diff2html` (diff rendering)

### npm packages to remove (phase 6)
- `@assistant-ui/react`
- `@assistant-ui/react-ai-sdk`

### Files created
- `src/lib/conversations.ts` -- conversation + run persistence, event bus, JSONL helpers
- `src/app/api/conversations/route.ts` -- list + create
- `src/app/api/conversations/[id]/route.ts` -- get + patch + delete
- `src/app/api/conversations/[id]/continue/route.ts` -- follow-up
- `src/app/api/conversations/[id]/cancel/route.ts` -- cancellation
- `src/app/api/conversations/[id]/events/route.ts` -- SSE
- `src/components/conversation/ConversationView.tsx`
- `src/components/conversation/TurnBlock.tsx`
- `src/components/conversation/ConversationComposer.tsx`
- `src/components/conversation/ConversationList.tsx`
- `src/components/conversation/ConversationStatusBadge.tsx`
- `src/components/conversation/ToolCallCard.tsx`

### Files modified
- `src/lib/types.ts` -- add conversation/run types, add `conversationId` to Task and DecisionItem
- `src/lib/data.ts` -- add conversation persistence helpers
- `src/lib/validations.ts` -- add conversation/run schemas
- `scripts/daemon/run-task.ts` -- write conversations/runs instead of active-runs + stream files
- `scripts/daemon/run-task-comment.ts` -- create conversation + run
- `scripts/daemon/wiki-processor.ts` -- check conversation status
- `src/lib/scheduled-jobs.ts` -- check running conversations for concurrency
- `src/app/api/tasks/[id]/run/route.ts` -- create conversation + run on run
- `src/app/api/tasks/[id]/stop/route.ts` -- cancel conversation on stop
- `src/app/api/projects/[id]/run/route.ts` -- use conversations for project runs
- `src/app/api/projects/[id]/stop/route.ts` -- cancel conversations for project stop
- `src/app/api/decisions/route.ts` -- add conversationId handling, trigger resume
- `src/app/api/runs/route.ts` -- query running conversations (transitional)
- `src/providers/active-runs-provider.tsx` -- use conversation status
- `src/hooks/use-active-runs.ts` -- use conversation query
- `src/components/dashboard-logs.tsx` -- use conversation events
- `src/app/page.tsx` -- wire to conversation-aware components
- `src/components/chat/ChatSidebar.tsx` -- swap to ConversationView

### Files removed (phase 6)
- `src/components/chat/AssistantThread.tsx`
- `src/components/chat/DaemonRunViewer.tsx`
- `src/lib/chat-sessions.ts`
- `src/lib/claude-session-log.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/chat/messages/route.ts`
- `src/app/api/chat/session/route.ts`
- `src/app/api/runs/stream/route.ts`
- `src/app/api/runs/route.ts`

---

## References

- cabinetai conversation model: `~/cabinetai/src/types/conversations.ts`
- cabinetai event bus: `~/cabinetai/src/lib/agents/conversation-events.ts`
- cabinetai task adapter: `~/cabinetai/src/lib/agents/conversation-to-task-view.ts`
- cabinetai SSE endpoint: `~/cabinetai/src/app/api/agents/conversations/[id]/events/route.ts`
- Current chat implementation: `src/components/chat/AssistantThread.tsx`
- Current task execution: `scripts/daemon/run-task.ts`
- Current decision system: `src/app/api/decisions/route.ts`
- Current active runs: `scripts/daemon/active-runs.ts`, `src/app/api/runs/route.ts`
