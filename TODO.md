# TODO

Deferred follow-ups from the conversation unification effort. None block normal operation; all are tracked for future cleanup.

## Conversation system follow-ups

### 1. Cross-process file locking (data integrity)

**Severity:** Medium (matches existing project norms — same pattern used for `tasks.json`, `decisions.json`, `active-runs.json`, etc.)

**Problem:** `src/lib/conversations.ts` uses `async-mutex` `Mutex` for synchronizing writes to `conversations.json`, `events.jsonl`, `turns.jsonl`, and `seq.txt`. These mutexes are process-local. The Next.js API routes and the daemon (`scripts/daemon/run-task.ts`) are separate processes, so concurrent writes from both are not actually synchronized.

**Real-world risk:** Small for single-user personal use. Daemon writes per-task; API routes write on user actions. Collision window is narrow but non-zero.

**Files:** `src/lib/conversations.ts:75-89,129-137,369-380` (and the same pattern in `src/lib/data.ts`)

**Fix when scaling:** Use `proper-lockfile` (already a transitive dep) or `flock`-based file locking for cross-process coordination. Apply consistently across all workspace JSON files, not just conversation files.

---

### 3. Stale continuation runs in conversation state

**Severity:** Low (cosmetic data debt, no behavior break)

**Problem:** When a task continuation spawns (timeout / max-turns), `scripts/daemon/run-task.ts` line ~1592-1612 skips `completeConversation` because `shouldContinue` is true. The next run-task invocation creates a new `ConversationRun` and updates `currentRunId`, but the previous run's `status` stays `"running"` forever. The reaper only checks `currentRunId`'s run, so old runs never get cleaned up.

**Files:** `scripts/daemon/run-task.ts:1592-1612, 1621-1643`

**Fix:** When `startConversationForTask` is called with `existingConversationId`, mark the previous `currentRunId`'s run as `completed` (or `timeout` if that's the reason) before creating the new run. Add this as the first step in `conversation-writer.ts` `startConversationForTask` when `existingConversationId` is provided.

---

### 4. EventSource leak under React StrictMode

**Severity:** Low (development-only annoyance; production builds don't double-mount)

**Problem:** `src/hooks/use-conversation-stream.ts` `init()` awaits `refresh()` then calls `connectSSE()`. Under React 19 StrictMode, the effect can be cleaned up between the two awaits, but `connectSSE()` still fires, leaking an EventSource and triggering state updates from a stale effect.

**Files:** `src/hooks/use-conversation-stream.ts:587-598`

**Fix:** Add a generation counter or `AbortController` at the top of the effect. Check `aborted` before `connectSSE()`. Increment on cleanup. Standard React pattern — about 10 lines.

---

### 7. Hardcoded `"default"` workspace in stop routes

**Severity:** Low (single-workspace personal use; won't manifest)

**Problem:** `src/app/api/tasks/[id]/stop/route.ts` and `src/app/api/projects/[id]/stop/route.ts` call `setConversationsWorkspace("default")` instead of resolving the active workspace via `applyWorkspaceContext()` like other routes do.

**Files:**
- `src/app/api/tasks/[id]/stop/route.ts:88-106`
- `src/app/api/projects/[id]/stop/route.ts:109-125`

**Fix:** Replace hardcoded `"default"` with proper workspace resolution. Look at `src/app/api/tasks/route.ts` for the pattern.

---

## Notes

- All four were flagged in the @oracle code review of the conversation unification work (see `docs/conversation-unification-plan.md`).
- Bugs #2 (blank assistant turns), #5 (stream tail final lines), and #6 (decision resume) from that review were fixed inline.
- Schema is at v1.1 after the #2 fix added optional snapshot fields to `turn.completed`. See `docs/conversation-event-schema.md`.

---

## Test cost / coverage follow-ups

### Enforce cheap/no external model usage in tests

**Status:** Partially done.

- `vitest.config.ts` now sets `MANDIO_DEFAULT_MODEL=haiku` and `MANDIO_ALLOW_AGENT_IN_TESTS=0`.
- `AgentRunner.spawnAgent()` now throws during Vitest unless `MANDIO_ALLOW_AGENT_IN_TESTS=1` is explicitly set.
- Chat defaults now use `haiku` instead of `sonnet`.
- Test fixtures no longer use `claude-sonnet-4-20250506`.

### Prune low-value tests

**Status:** Initial prune done.

- Removed duplicate scheduled reaper integration file; `reapStaleRuns` remains covered in `conversations.test.ts`.
- Removed runtime-only daemon type-shape tests; TypeScript covers those contracts.
- Merged read-only data getter shape checks and removed redundant JSON-validity tests.
- Merged duplicate terminal cancel variants and removed duplicate SSE replay query-param coverage.
- Removed redundant reducer edge cases while keeping bug #2 and full lifecycle coverage.
- Trimmed validation schema permutation tests from 86 to 58 representative cases.
- Current counted suite: 279 tests across 12 files (counted statically via `it`/`it.each`).
- Verified with `npx tsc --noEmit` only; full Vitest suite intentionally not run to avoid external/test-cost burn.

Remaining candidates if more pruning is needed:

1. `__tests__/validations.test.ts` (~86 tests)
   - Many one-field schema permutation tests.
   - Keep representative valid/invalid cases per schema; remove exact boundary duplicates unless they caught past bugs.

2. `__tests__/conversations.test.ts` (~46 tests)
   - Split across many single-assertion persistence cases.
   - Merge create/list/update/delete into fewer end-to-end persistence tests.
   - Keep concurrency, seq durability, stale-run reaper, and idempotency tests.

3. `__tests__/api-conversations-flow.test.ts` (~38 tests)
   - Several duplicate status variants (`completed`, `failed`, `cancelled`) can be table-driven or reduced to one terminal-state test.
   - Keep idempotency, running-conflict, SSE replay/live/dedup, and cancel-publishes-event tests.

4. `__tests__/use-conversation-stream.test.ts` (~31 tests)
   - Reducer coverage is useful, but many lifecycle events are direct field assignments.
   - Keep full turn lifecycle, tool buffering, dedup/reconnect, and bug-regression tests.
   - Merge simple lifecycle state tests into one table-driven test.

Do not prune blindly while behavior is still settling. Recommended next step: if more reduction is needed, trim `conversations.test.ts` persistence permutations and run only targeted affected test files once.
