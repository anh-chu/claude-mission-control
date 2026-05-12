# Chat Performance Optimization Plan

**Goal:** Reduce perceived latency from "Enter" to "response visible" and eliminate jank during streaming.

**Approach:** 5 targeted changes, ordered by user impact. No architecture changes, no new dependencies.

---

## Phase 1: Optimistic UI for user messages

**Why biggest impact:** Currently the user message doesn't appear until the POST to `/continue` returns 202 (~100-300ms). Show it instantly.

**Files:**
- `src/components/conversation/ConversationComposer.tsx`
- `src/components/conversation/ConversationView.tsx`
- `src/hooks/use-conversation-stream.ts`

**Changes:**
1. In `ConversationComposer.handleSend()`, before the `apiFetch` call, dispatch an optimistic `turn.started` + `turn.completed` event into the reducer with a temp turn ID
2. Add an `addOptimisticTurn(turn)` action to the reducer that appends a non-pending user turn
3. When the real `turn.started` event arrives from SSE with the same turn number, the reducer's existing dedup (`state.turns.some(t => t.id === turnId)`) prevents a duplicate
4. If the POST fails, dispatch a `removeOptimisticTurn(tempId)` action

**Success criteria:** User message appears in <16ms (one frame) after Enter. No double-render of the same message when SSE catches up.

---

## Phase 2: Cache conversations.json in-request

**Why:** The continue route parses `conversations.json` 5 times in sequence. Each parse is ~0.5-2ms for a small file, but it adds up and scales poorly.

**Files:**
- `src/lib/conversations.ts`

**Changes:**
1. Add a module-level `requestCache` Map: `Map<string, { data: ConversationsFile; mtime: number }>`
2. In `getConversationsFile()`, check if the file's mtime matches the cached entry. If yes, return cached. If no, read + parse + update cache.
3. Add `invalidateConversationsCache()` export, call it from `writeConversationsFile()`
4. The mtime check is a single `stat()` call (~0.01ms) vs full read+parse (~1-2ms)

**Alternative considered:** Per-request AsyncLocalStorage cache. Rejected because the mtime approach is simpler and also helps the daemon.

**Success criteria:** `getConversation()` called 5x in the continue route results in 1 file read + 4 stat-only cache hits.

---

## Phase 3: React.memo on TurnBlock + MarkdownContent

**Why:** During streaming, every SSE event creates a new `turns` array reference. Without memoization, React re-renders ALL turns and re-parses ALL markdown, even for turns that haven't changed.

**Files:**
- `src/components/conversation/TurnBlock.tsx`
- `src/components/conversation/ToolCallCard.tsx`
- `src/components/markdown-content.tsx`

**Changes:**
1. Wrap `TurnBlock` export in `React.memo`. Custom comparator: shallow compare `turn` object fields (id, content, parts, pending, toolCalls).
2. Wrap `ToolCallCard` in `React.memo`. Custom comparator: shallow compare `toolCall` fields.
3. Wrap `MarkdownContent` in `React.memo`. Since content is a string, default shallow compare works (string equality).
4. Hoist stable references out of render: move `remarkPlugins` and `components` objects to module scope in `markdown-content.tsx`.

**Success criteria:** During a streaming session with 20 turns, a `turn.delta` event on turn 20 re-renders only turn 20 (not turns 1-19).

---

## Phase 4: Replace 250ms polling with fs.watch in stream tail

**Why:** The daemon's `startStreamTail()` polls every 250ms. That's up to 250ms of dead time per token batch from Claude.

**Files:**
- `scripts/daemon/run-conversation.ts` (`startStreamTail` function)

**Changes:**
1. Replace `setInterval(doRead, 250)` with `fs.watch(file, doRead)` (watch the file itself, not the parent dir, since the file exists from the start)
2. Keep a 50ms debounce on the watcher callback to coalesce rapid writes
3. Keep the `stop()` cleanup to close the watcher
4. Add a fallback: if `fs.watch` throws (unsupported platform), fall back to 100ms polling

**Success criteria:** First assistant token appears within ~50ms of Claude writing it, instead of up to 250ms.

---

## Phase 5: Offset-based reads in file watcher

**Why:** `consumeNewEvents()` reads the entire `events.jsonl` on every `fs.watch` trigger, then slices by offset. For a conversation with 500 events, that's reading 500 events to find 1 new one.

**Files:**
- `src/lib/conversation-event-bus.ts` (`consumeNewEvents` function)

**Changes:**
1. Replace `readFile(filePath, "utf-8")` with `open()` + `stat()` + `read(buf, 0, size-offset, offset)` + `close()`
2. Only read the bytes between `offset` and current file size
3. Update `offset` to the new file size after reading
4. Keep the existing truncation detection (if `size < offset`, reset to 0)

**Success criteria:** For a conversation with 1000 events, adding event 1001 reads ~200 bytes instead of ~200KB.

---

## Execution Order

Phases are independent and can be done in any order. Recommended sequence by impact:

1. **Phase 1** (optimistic UI) -- biggest perceived latency win
2. **Phase 3** (React.memo) -- biggest streaming jank win
3. **Phase 2** (conversations.json cache) -- biggest server-side win
4. **Phase 5** (offset reads) -- simple, low risk
5. **Phase 4** (fs.watch in daemon) -- requires testing across platforms

## Not Included (and why)

- **Virtualization** -- memoization + pagination should be enough; add only if long conversations still lag
- **SSE event throttling** -- not needed yet since `turn.delta` isn't emitted; becomes relevant when real streaming is added
- **SQLite migration** -- overkill for local single-user app
- **Context compaction** -- Claude context management, not a UI perf issue
