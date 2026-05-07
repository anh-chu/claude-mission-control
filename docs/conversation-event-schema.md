# Conversation Event Schema (Locked)

**Status:** Locked v1.1 — updated 2026-05-07 (additive: `turn.completed` payload extended with optional content/parts/toolCalls)
**Owner:** Conversation unification effort
**Source of truth:** This document. All implementation must match.

This document is the contract between the daemon (event producer), API routes (event distributor), and UI (event consumer). Changes require version bump and migration plan.

---

## 1. Core Types

### Conversation

The durable thread record. Stored in `workspaces/<workspaceId>/conversations.json`.

```ts
export interface Conversation {
  id: string;                          // "conv_<random>"
  title: string;
  agentId: string | null;
  model: string | null;
  status: ConversationStatus;
  mode: "foreground" | "background";
  executionSource: ConversationSource;

  // Linking
  taskId: string | null;
  parentConversationId: string | null;

  // Run tracking
  currentRunId: string | null;
  runCount: number;

  // Aggregate metrics (across all runs)
  tokens: ConversationTokens;
  turnCount: number;

  // State
  error: string | null;
  errorKind: ConversationErrorKind | null;
  pausedReason: string | null;
  pausedDecisionId: string | null;
  summary: string | null;

  // Artifacts (deduped paths across runs)
  artifactRefs: string[];
  mentionedPaths: string[];
  attachmentPaths: string[];

  // Idempotency dedup window (last N requestIds, default 10)
  recentRequestIds: string[];

  // Timestamps (all ISO 8601 strings)
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  archivedAt: string | null;
  deletedAt: string | null;
  pausedAt: string | null;

  // Schema version
  version: number;                     // current = 1
}

export interface ConversationTokens {
  input: number;
  output: number;
  cache?: number;
  total: number;
}

export type ConversationStatus =
  | "idle"                             // created, not yet started (draft)
  | "queued"                           // waiting for daemon to pick up
  | "starting"                         // run created, process spawning
  | "running"                          // agent actively executing
  | "awaiting-decision"                // paused for human input
  | "completed"                        // finished successfully
  | "failed"                           // finished with error
  | "cancelled";                       // cancelled by user

export type ConversationSource =
  | "chat"
  | "task"
  | "manual"
  | "project-run"
  | "mission-chain"
  | "scheduled"
  | "webhook"
  | "inbox-respond"
  | "comment"
  | "wiki";

export type ConversationErrorKind =
  | "cli_not_found"
  | "auth_expired"
  | "rate_limited"
  | "session_expired"
  | "context_exceeded"
  | "timeout"
  | "transport"
  | "unknown";
```

### ConversationRun

A single execution attempt within a conversation. Stored alongside conversation metadata (top-level `runs` key in `conversations.json`, keyed by run id).

```ts
export interface ConversationRun {
  id: string;                          // "run_<random>"
  conversationId: string;
  status: RunStatus;

  // Process tracking
  pid: number | null;
  sessionHandle: string | null;        // Claude session ID for resume
  continuationIndex: number;           // 0 = first run

  // Context
  source: ConversationSource;
  projectId: string | null;
  missionId: string | null;

  // Metrics (per-run)
  tokens: ConversationTokens;
  numTurns: number;

  // Idempotency
  requestId: string | null;

  // Timestamps
  startedAt: string;
  completedAt: string | null;

  // Outcome
  exitCode: number | null;
  error: string | null;
  errorKind: ConversationErrorKind | null;

  // Model config snapshot
  model: string | null;
  noPrune?: boolean;
}

export type RunStatus =
  | "starting"
  | "running"
  | "completed"                        // finished successfully (incl. paused-for-decision)
  | "failed"
  | "stopped"                          // killed by user
  | "timeout";
```

### ConversationTurn

Append-only entries in `workspaces/<workspaceId>/conversations/<conversationId>/turns.jsonl`.

```ts
export interface ConversationTurn {
  id: string;                          // "turn_<random>"
  turn: number;                        // monotonic per-conversation, starts at 1
  role: "user" | "assistant";
  ts: string;

  // Content
  content: string;                     // rendered text
  parts?: MessagePart[];               // structured parts (preferred for assistant turns)

  // Streaming state (only meaningful while live)
  pending?: boolean;

  // Metrics
  tokens?: { input: number; output: number; cache?: number };

  // Run association
  runId?: string;                      // null for user turns submitted via API outside of run

  // Completion
  exitCode?: number | null;
  error?: string;

  // Structured data
  toolCalls?: ToolCallRecord[];
  mentionedPaths?: string[];
  attachmentPaths?: string[];
  artifactRefs?: string[];
}

export interface MessagePart {
  type: "text" | "thinking" | "tool_use" | "tool_result";
  content: string;
  toolName?: string;
  toolCallId?: string;
  status?: "running" | "completed" | "error";
}

export interface ToolCallRecord {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  result?: string;
  status: "running" | "completed" | "error";
  durationMs?: number;
}
```

---

## 2. Event Schema

Append-only entries in `workspaces/<workspaceId>/conversations/<conversationId>/events.jsonl`.

### Base shape

```ts
export interface ConversationEventBase {
  conversationId: string;
  ts: string;                          // ISO 8601
  seq: number;                         // monotonic per-conversation, durable across restarts
}
```

### Event types (typed payloads)

All events extend `ConversationEventBase`. Payloads are strictly typed — generic `Record<string, unknown>` is forbidden.

```ts
export type ConversationEvent =
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

export interface TurnStartedEvent extends ConversationEventBase {
  type: "turn.started";
  payload: { turnId: string; turn: number; role: "user" | "assistant"; runId?: string };
}

export interface TurnDeltaEvent extends ConversationEventBase {
  type: "turn.delta";
  payload: { turnId: string; delta: string; partType?: "text" | "thinking" };
}

export interface TurnCompletedEvent extends ConversationEventBase {
  type: "turn.completed";
  payload: {
    turnId: string;
    tokens?: { input: number; output: number; cache?: number };
    // v1.1: optional snapshot fields for clients without refetch logic
    content?: string;
    parts?: MessagePart[];
    toolCalls?: ToolCallRecord[];
  };
}

export interface ToolCallStartedEvent extends ConversationEventBase {
  type: "tool.started";
  payload: {
    turnId: string;
    toolCallId: string;
    tool: string;
    args: Record<string, unknown>;
  };
}

export interface ToolCallCompletedEvent extends ConversationEventBase {
  type: "tool.completed";
  payload: {
    turnId: string;
    toolCallId: string;
    tool: string;
    status: "completed" | "error";
    result?: string;
    durationMs?: number;
  };
}

export interface ConversationStartedEvent extends ConversationEventBase {
  type: "conversation.started";
  payload: { runId: string; source: ConversationSource };
}

export interface ConversationUpdatedEvent extends ConversationEventBase {
  type: "conversation.updated";
  payload: {
    fields: Partial<Pick<
      Conversation,
      "title" | "status" | "summary" | "tokens" | "turnCount" | "currentRunId"
    >>;
  };
}

export interface ConversationCompletedEvent extends ConversationEventBase {
  type: "conversation.completed";
  payload: {
    runId: string;
    exitCode: number | null;
    tokens: ConversationTokens;
  };
}

export interface ConversationPausedEvent extends ConversationEventBase {
  type: "conversation.paused";
  payload: { reason: string; decisionId: string };
}

export interface ConversationResumedEvent extends ConversationEventBase {
  type: "conversation.resumed";
  payload: { runId: string; decisionId: string; answer: string };
}

export interface ConversationErrorEvent extends ConversationEventBase {
  type: "conversation.error";
  payload: { runId: string | null; error: string; errorKind: ConversationErrorKind };
}

export interface ConversationCancelledEvent extends ConversationEventBase {
  type: "conversation.cancelled";
  payload: { runId: string | null; reason?: string };
}

export interface DecisionCreatedEvent extends ConversationEventBase {
  type: "decision.created";
  payload: { decisionId: string; question: string; options: string[] };
}

export interface DecisionAnsweredEvent extends ConversationEventBase {
  type: "decision.answered";
  payload: { decisionId: string; answer: string };
}
```

---

## 3. Delta vs Snapshot Semantics

Each event type has explicit delta or snapshot semantics. Mixing them is forbidden.

| Event | Semantics | Notes |
|---|---|---|
| `turn.started` | Snapshot | Full turn metadata; no content yet |
| `turn.delta` | Delta | Append `delta` to the turn's current `content` (or to the matching part by `partType`) |
| `turn.completed` | Snapshot | Final tokens; client should refetch turn from JSONL if it needs full final content. v1.1: payload may include `content`/`parts`/`toolCalls` snapshot for clients without refetch |
| `tool.started` | Snapshot | Tool call entry created; no result yet |
| `tool.completed` | Snapshot | Replaces the `tool.started` placeholder |
| `conversation.started` | Snapshot | Run created and started |
| `conversation.updated` | **Partial snapshot** | `payload.fields` is a partial Conversation; merge into local state |
| `conversation.completed` | Snapshot | Terminal state for run |
| `conversation.paused` | Snapshot | Conversation entered awaiting-decision |
| `conversation.resumed` | Snapshot | New run started after decision |
| `conversation.error` | Snapshot | Terminal error |
| `conversation.cancelled` | Snapshot | Terminal cancelled |
| `decision.created` | Snapshot | New decision created |
| `decision.answered` | Snapshot | Decision answered (resume happens via subsequent `conversation.resumed`) |

### Client merge rules
- For `turn.delta`: append text deltas in arrival order. If a `turn.delta` arrives with a `partType`, append to the matching part; otherwise append to the turn's main `content`.
- For `conversation.updated`: shallow merge `payload.fields` over local conversation state. Token totals are absolute, not deltas.
- For `tool.started` then `tool.completed`: replace by `toolCallId`.

---

## 4. Replay Semantics

### Delivery
- **At-least-once.** Clients may receive duplicate events on reconnect.
- **Per-conversation strict ordering** by `seq`. Events within a conversation are guaranteed delivered in seq order.
- **No cross-conversation ordering** guarantee.

### Sequence numbers
- Monotonic, durable, per-conversation.
- Starts at 1 for each conversation.
- Stored in `workspaces/<workspaceId>/conversations/<conversationId>/seq.txt`.
- Read-increment-write under the conversation's file lock.
- Survives process restarts.

### Reconnect
- Client sends `Last-Event-ID: <seq>` header (or `?lastEventId=<seq>` query param) on reconnect.
- Server replays from `events.jsonl` starting at the next seq after the given value.
- If the client's `Last-Event-ID` is older than the oldest retained event (after pruning), server sends a `conversation.updated` snapshot with full state and the client must reset its local state.

### Client deduplication
- Clients MUST deduplicate by `seq` (track highest seq seen, ignore lower or equal).
- Required because at-least-once may deliver duplicates around reconnect boundaries.

### Retention
- Event log files retained for **30 days** by default.
- Turn JSONL files retained indefinitely (compressed after 90 days).
- Pruning: rotate `events.jsonl` to `events.<timestamp>.jsonl.gz`; clients with older `Last-Event-ID` get full snapshot fallback.

---

## 5. Event Production Rules

### Who publishes what

| Event | Producer | When |
|---|---|---|
| `conversation.started` | Daemon | After spawn succeeds and pid is set |
| `turn.started` | Daemon | Before processing each model turn |
| `turn.delta` | Daemon | For each token chunk during streaming |
| `turn.completed` | Daemon | After turn finishes streaming |
| `tool.started` | Daemon | When agent invokes a tool |
| `tool.completed` | Daemon | When tool result is captured |
| `conversation.updated` | Daemon or API | Status transitions, title changes, summary updates |
| `conversation.completed` | Daemon | Run exits successfully |
| `conversation.paused` | Daemon | Decision detected, run completes |
| `conversation.resumed` | Daemon (after decision answered) | New run starts post-decision |
| `conversation.error` | Daemon | Run fails with error |
| `conversation.cancelled` | API (`/cancel` route) | After SIGTERM sent and run marked stopped |
| `decision.created` | Daemon | After decision written to decisions.json |
| `decision.answered` | API (`/api/decisions` PUT) | After decision marked answered |

### Cross-process coordination
- Daemon writes events to `events.jsonl` (durable).
- API routes watch `events.jsonl` via `fs.watch` / `chokidar`.
- Same-process producers also emit on in-process EventEmitter for low-latency local fanout.
- The file is the source of truth. The EventEmitter is an optimization.

---

## 6. Idempotency Rules

### POST /conversations
- Client sends `requestId` (UUID) in body.
- If a conversation already exists with that requestId in `recentRequestIds`, return existing conversation (200) instead of creating a new one.

### POST /conversations/[id]/continue
- Client sends `requestId`.
- If conversation has an active run (currentRunId set, status running/starting), return 409 with the active run details.
- If requestId is in `recentRequestIds`, return 200 idempotent (no-op).
- Otherwise: create new run, push requestId to `recentRequestIds` (cap at 10).

### Decision answers
- API checks `decision.status !== "pending"` before applying.
- Returns 409 if decision already answered.

---

## 7. Crash Recovery Contract

On daemon startup:
1. Load all conversations with `status` in `{starting, running}`.
2. For each, check `currentRunId`'s `pid` via `kill -0 <pid>`.
3. If pid is dead or null:
   - Mark run as `failed` with `errorKind: "unknown"`, `error: "Daemon crash detected"`.
   - Mark conversation as `failed`.
   - Clear `currentRunId`.
   - Publish `conversation.error` event.
4. If pid is alive:
   - Reattach by watching `events.jsonl` (no new events published — process continues).

Conversations in `awaiting-decision` are NOT touched on recovery — they're already in a stable paused state.

---

## 8. Persistence Layout (Locked)

```
workspaces/<workspaceId>/
├── conversations.json
│   { conversations: Conversation[], runs: Record<runId, ConversationRun> }
├── conversations/
│   └── <conversationId>/
│       ├── turns.jsonl          # append-only ConversationTurn entries
│       ├── events.jsonl         # append-only ConversationEvent entries
│       └── seq.txt              # current max seq number (string integer)
├── tasks.json                   # gains conversationId field
├── decisions.json               # gains conversationId field (taskId stays primary)
└── ...                          # all other files unchanged
```

### Concurrency
- Per-conversation `Mutex` for all writes to that conversation's files.
- Workspace-level mutex (existing pattern in `data.ts`) for `conversations.json`.
- All append operations use `appendFile` with `O_APPEND` semantics; do not rewrite the file.

---

## 9. Migration Notes (for Phase 1+)

- Add `version: 1` to all new conversations.
- Future schema changes:
  - Additive (new optional fields): no migration needed.
  - Breaking changes: bump `version`, add migration script that reads old `version` and rewrites.
- `conversationId` field on Task and DecisionItem starts as `null` for existing records.
- `decision-sessions.json` migration: on first conversation-based run for a task with an existing entry, copy session ID to `conversation.sessionHandle` and remove the entry.

---

## 10. Out of Scope (Locked Decisions)

These were considered and explicitly excluded from v1.0:

- **Cross-conversation event ordering.** Each conversation is independent.
- **Multiple concurrent runs per conversation.** One active run at a time.
- **Hard delete.** Soft delete only (`deletedAt` field).
- **Background chat orchestration.** `mode: "background"` is reserved on the type but daemon does not pick up non-task background conversations in v1.0.
- **Sub-turns per tool call.** One turn per assistant response; tool calls are structured data inside the turn.
- **Conversation branching.** `parentConversationId` is reserved on the type but no branching API in v1.0.

---

## Sign-off

- Schema reviewed against council feedback (2026-05-06).
- Type definitions match `docs/conversation-unification-plan.md`.
- Locked. Phase 1 will implement these as TypeScript source files.
