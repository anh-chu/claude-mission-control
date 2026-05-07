# Architecture Log

Durable record of system-level design changes and follow-up decisions.

## 2026-05-07 — Conversation unification

### Goal

Replace split chat/session/run rendering with one durable conversation model shared by foreground chat, daemon task runs, decisions, cancellation, and streaming UI.

### Core design

- `Conversation` is the durable thread record, stored per workspace in `conversations.json`.
- `ConversationRun` tracks each foreground/background agent execution tied to a conversation.
- `ConversationTurn`, `MessagePart`, and `ToolCallRecord` represent UI-renderable transcript state.
- Append-only JSONL streams (`events.jsonl`, `turns.jsonl`) provide replayable event history.
- `seq.txt` gives each conversation a monotonic event sequence for SSE replay and dedupe.
- `docs/conversation-event-schema.md` is the locked event/API contract.

### Main modules

- `src/lib/conversations.ts` owns persistence, event append/replay, idempotency, soft delete, and stale-run reaping.
- `src/lib/conversation-event-bus.ts` bridges filesystem events to API SSE subscribers.
- `scripts/daemon/conversation-writer.ts` converts daemon lifecycle and Claude JSONL output into conversation events.
- `scripts/daemon/run-task.ts` dual-writes task execution into the conversation system and cleans per-run stream files after final parsing.
- `scripts/daemon/run-conversation.ts` runs foreground chat continuations outside the old assistant-ui stack.
- `src/hooks/use-conversation-stream.ts` hydrates conversation state and reduces live SSE events.
- `src/components/conversation/*` renders conversations, turns, tool calls, composer, status, and decision actions.

### API shape

- `/api/conversations` lists/creates conversations.
- `/api/conversations/[id]` reads/updates/deletes conversation state.
- `/api/conversations/[id]/events` streams replay + live events via SSE.
- `/api/conversations/[id]/continue` appends a user turn and dispatches foreground continuation.
- `/api/conversations/[id]/cancel` cancels active conversation runs.
- Task/project stop routes now cancel linked conversations.

### UI integration

- Chat sidebar now uses conversation list + conversation thread components.
- Home logs and crew autopilot now render conversation-backed activity instead of legacy daemon stream viewers.
- Task detail pages show linked conversation state through the new components.
- Legacy `@assistant-ui/react` thread, old daemon viewer, chat session storage, and run-stream route were removed.

### Cost and test safety

- Chat and conversation defaults now use `haiku`.
- Tests set `MANDIO_DEFAULT_MODEL=haiku` and block agent spawning unless `MANDIO_ALLOW_AGENT_IN_TESTS=1`.
- Test suite was pruned to remove low-value duplicate coverage while preserving conversation persistence, event bus, stream reducer, reaper, idempotency, and cancellation regressions.

### Known follow-ups

- Add cross-process file locking for workspace JSON/JSONL writes before scaling beyond single-user local operation.
- Mark stale continuation runs completed/failed when a new continuation run supersedes them.
- Harden `use-conversation-stream` against React StrictMode stale-effect EventSource leaks.
- Replace remaining hardcoded `"default"` workspace assumptions in stop routes with active workspace resolution.
