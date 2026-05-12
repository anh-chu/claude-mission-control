# TODO

Deferred follow-ups from the conversation unification effort. None block normal operation.

## Conversation system

### 1. Cross-process file locking (data integrity)

**Severity:** Medium (matches existing project norms — same pattern used for `tasks.json`, `decisions.json`, `active-runs.json`, etc.)

**Problem:** `src/lib/conversations.ts` uses `async-mutex` `Mutex` for synchronizing writes to `conversations.json`, `events.jsonl`, `turns.jsonl`, and `seq.txt`. These mutexes are process-local. The Next.js API routes and the daemon (`scripts/daemon/run-task.ts`) are separate processes, so concurrent writes from both are not actually synchronized.

**Real-world risk:** Small for single-user personal use. Daemon writes per-task; API routes write on user actions. Collision window is narrow but non-zero.

**Files:** `src/lib/conversations.ts:75-89,129-137,369-380` (and the same pattern in `src/lib/data.ts`)

**Fix when scaling:** Use `proper-lockfile` (already a transitive dep) or `flock`-based file locking for cross-process coordination. Apply consistently across all workspace JSON files, not just conversation files.

---

### 5. Stale refresh dispatch after conversationId change

**Severity:** Low (race only visible on fast navigation between conversations)

**Problem:** `src/hooks/use-conversation-stream.ts` `init()` calls `await refresh()` before `connectSSE()`. If `conversationId` changes while `refresh()` is in-flight, the response resolves and dispatches state for the old conversation into the now-switched hook instance. The `aborted` flag guards the SSE connect but not the dispatch inside `refresh`.

**Files:** `src/hooks/use-conversation-stream.ts` (`init` function, `refresh` useCallback)

**Fix:** Pass an `AbortSignal` or generation counter into `refresh`. Inside `refresh`, skip `dispatch` if the signal is aborted or if `conversationIdRef.current` no longer matches the id that started the fetch.

---

## Critical Hardening (from deep review 2026-05-11)

### 6. SSE can miss events during initial connect

**Severity:** High

**Problem:** The hook does REST refresh first, then opens SSE without `lastEventId` when `lastSeqRef` is `0`. The server only replays when `lastEventId !== null`, and the watcher seeds its offset to EOF. Any event written between the REST fetch and SSE subscription is skipped forever.

**Files:** `src/hooks/use-conversation-stream.ts:591-593`, `src/app/api/conversations/[id]/events/route.ts:94-102`

**Fix:** Always connect with an explicit cursor. Use `?lastEventId=0` on first connect and replay from seq 0, with client dedup (already exists via `seenSeqsRef`).

---

### 7. File watcher can drop events while a read is in progress

**Severity:** High

**Problem:** `consumeNewEvents` returns immediately if already reading, but does not mark a pending reread. If `fs.watch` fires during `readFile`, the new append is missed until a later append triggers another read.

**Files:** `src/lib/conversation-event-bus.ts:82-84`

**Fix:** Add a pending flag and rerun after the current read completes, or read via `open/stat/read` from offset in a loop until file size stops changing.

---

### 8. conversations.json writes are not atomic

**Severity:** High

**Problem:** Writes use direct `writeFile`. A crash mid-write corrupts the file. Also, `getConversationsFile` catches ALL errors (including JSON parse errors) and returns an empty store, silently hiding corruption.

**Files:** `src/lib/conversations.ts:98-117, 125-132`

**Fix:** Atomic temp-write + `rename`. Only return empty on `ENOENT`; log/throw parse and permission errors.

---

### 9. PATCH accepts arbitrary Partial<Conversation>

**Severity:** Medium (security)

**Problem:** `PATCH /api/conversations/[id]` casts the request body directly to `Partial<Conversation>` and merges it. A client can mutate server-owned fields like `id`, timestamps, counters, `runCount`, `deletedAt`.

**Files:** `src/app/api/conversations/[id]/route.ts:66`

**Fix:** Whitelist patchable fields (`title`, `status`, `summary`, `agentId`, `model`). Reject or ignore unknown fields.

---

## Tests

### Prune low-value tests (remaining candidates)

Remaining after initial prune. Do not prune blindly while behavior is still settling.

1. `__tests__/validations.test.ts` (~86 tests) — many one-field schema permutation tests; keep representative valid/invalid cases per schema, remove exact boundary duplicates unless they caught past bugs
2. `__tests__/conversations.test.ts` (~46 tests) — merge create/list/update/delete into fewer end-to-end persistence tests; keep concurrency, seq durability, stale-run reaper, and idempotency tests
3. `__tests__/api-conversations-flow.test.ts` (~38 tests) — table-drive duplicate terminal-state variants; keep idempotency, running-conflict, SSE replay/live/dedup, and cancel-publishes-event tests
4. `__tests__/use-conversation-stream.test.ts` (~31 tests) — merge simple lifecycle state tests into one table-driven test; keep turn lifecycle, tool buffering, dedup/reconnect, and bug-regression tests
