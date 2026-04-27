# Plan: Converge Wiki Chat into Task Dispatcher

## Goal

Eliminate the parallel wiki system (daemon, job queue, run tracking, SSE) by making wiki generation a task type within the existing dispatcher. One system for "prompt → SDK → stream → UI".

## Decisions

- **Dispatch**: fs.watch in main daemon (sub-10ms pickup)
- **SDK**: Wiki uses SDK directly (warm via startup()). Tasks keep CLI spawn (need CLI flags, process isolation)
- **Retention**: Wiki runs kept indefinitely (no pruning). Tasks prune after 1hr
- **Serial execution**: Concurrency limit of 1 for source=wiki
- **firstMessage**: Stored as optional field on ActiveRunEntry metadata
- **Session resume**: sessionId stored on ActiveRunEntry, populated on run completion

## What Dies

- `scripts/daemon/wiki-daemon.ts`
- `scripts/daemon/run-wiki-generate.ts`
- Job file queue (fs.watch on `.jobs/`, atomic writes, retry parsing)
- Separate `.runs/{id}.json` tracking
- `src/app/api/wiki/run-stream/route.ts` (custom SSE)
- `src/app/api/wiki/runs/route.ts`
- `WikiRunRecord` type

## What Stays

- `startup()` warm SDK in shared module
- `prepareConsoleLines` + `StreamEntry` (already shared)
- Documents page UX (instant SSE, follow-up chat, run history)
- Plugin install/update in init route (minus daemon management)

---

## Phase 1: Extract Warm SDK into Shared Module

Lift `startup()` pre-warming out of `wiki-daemon.ts` into reusable module.

### 1.1 Create `scripts/daemon/warm-sdk.ts`

- Extract from `wiki-daemon.ts`: `preheatSdk()`, `warmHandle`/`warmOpts` state, `buildSdkOptions()`, `consumeStream()`
- Export `getWarmHandle()`, `preheatSdk()`, `consumeStream()`, `buildSdkOptions()`
- Keep "one warm handle, consumed on use, re-preheat after" pattern

### 1.2 Update wiki-daemon.ts to import from shared module

- Replace inline warm SDK code with imports from `warm-sdk.ts`
- Verify daemon still works identically

**Acceptance**: Module compiles. Wiki daemon behavior unchanged.

---

## Phase 2: Wiki Runs in Active Runs

Wiki runs appear in `active-runs.json` alongside task runs.

### 2.1 Extend ActiveRunEntry

File: `scripts/daemon/active-runs.ts`

Add optional fields:
```typescript
wikiRunId?: string;        // wiki run ID
sessionId?: string;        // Claude session ID for resume
firstMessage?: string;     // User's first message (display)
source: ... | "wiki";      // Add to source union
```

### 2.2 Generate route writes to active-runs

File: `src/app/api/wiki/generate/route.ts`

In addition to current job file, also write `ActiveRunEntry` to `active-runs.json` with `source: "wiki"`. Parallel tracking during transition.

### 2.3 Documents page reads from active-runs

File: `src/app/documents/page.tsx`

Replace `loadRuns` (calls `/api/wiki/runs`) with `/api/runs?source=wiki`. Run list uses `ActiveRunEntry` fields.

**Acceptance**: Documents page shows wiki runs from shared system. Both old and new tracking coexist.

---

## Phase 3: Consolidate Streaming

Wiki uses same `agent-streams/` dir and `/api/runs/stream` endpoint as tasks.

### 3.1 Move wiki stream files to agent-streams/

Files: `scripts/daemon/wiki-daemon.ts`, `scripts/daemon/run-wiki-generate.ts`

Write stream files to `{workspaceDir}/agent-streams/{runId}.jsonl` instead of `{wikiDir}/.runs/{runId}.stream.jsonl`.

### 3.2 Documents page uses shared SSE hook

File: `src/app/documents/page.tsx`

Replace custom fetch-based SSE parsing with `useAgentStream(streamRunId)` from `src/hooks/use-agent-stream.ts`.

### 3.3 Delete wiki SSE route

Delete: `src/app/api/wiki/run-stream/route.ts`

**Acceptance**: Documents page streams from `/api/runs/stream`. No custom SSE code remains.

---

## Phase 4: Consolidate Run State

Eliminate separate wiki run tracking entirely.

### 4.1 Wiki daemon writes to active-runs only

Files: `scripts/daemon/wiki-daemon.ts`, `scripts/daemon/run-wiki-generate.ts`

`processJob` writes/updates `ActiveRunEntry` in `active-runs.json`. No more individual `.runs/{id}.json` files.

### 4.2 Update documents page run model

File: `src/app/documents/page.tsx`

Replace `WikiRunRecord` with `ActiveRunEntry`. Follow-up chat reads `sessionId` from `ActiveRunEntry`.

### 4.3 Delete wiki runs route

Delete: `src/app/api/wiki/runs/route.ts`

### 4.4 Remove WikiRunRecord type

Remove all references. `grep -rn "WikiRunRecord" src/ scripts/` → zero hits.

**Acceptance**: All wiki state in `active-runs.json`. Old `.runs/` dir no longer written to.

---

## Phase 5: Eliminate Wiki Daemon

Main daemon handles wiki. Separate daemon process dies.

### 5.1 Add wiki job processing to main daemon

File: `scripts/daemon/index.ts`

Add fs.watch on `{wikiDir}/.jobs/` within main daemon loop. Process wiki jobs serially using warm SDK from shared module. Check: if wiki run already active, skip.

### 5.2 Enforce serial execution

File: `scripts/daemon/index.ts`

Simple guard: `if (activeRuns.some(r => r.source === "wiki" && r.status === "running")) skip`

### 5.3 Simplify generate route

File: `src/app/api/wiki/generate/route.ts`

Remove all daemon PID management (`getDaemonPid`, `isDaemonAlive`, `startDaemon`). Route just:
1. Creates `ActiveRunEntry` with `source: "wiki"`, `status: "running"`
2. Writes job file (fs.watch picks it up)
3. Returns 202

### 5.4 Delete wiki daemon files

Delete: `scripts/daemon/wiki-daemon.ts`, `scripts/daemon/run-wiki-generate.ts`
Remove esbuild entries from `package.json`.

### 5.5 Clean up init route

File: `src/app/api/wiki/init/route.ts`

Remove `killWikiDaemon()` and daemon PID management. Keep plugin install/update + `.plugin-path` caching. Warm SDK invalidation: write sentinel file that main daemon watches → re-preheat.

**Acceptance**: No separate wiki daemon. Main daemon handles wiki runs. `grep -rn "wiki-daemon\|run-wiki-generate" scripts/` → zero.

---

## Phase 6: Migrate Existing State

### 6.1 Migration script

File: `scripts/migrate-wiki-runs.ts` (one-shot)

- Read all `.runs/{id}.json` from wiki dir
- Convert `WikiRunRecord` → `ActiveRunEntry` format
- Move stream files to `agent-streams/`
- Append to `active-runs.json`
- Delete old `.runs/` directory

**Acceptance**: Historical wiki runs visible in shared system. Old files cleaned up.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Session resume wiring | Medium | sessionId on ActiveRunEntry, test follow-up sends each phase |
| active-runs.json contention | Low | Already uses atomic write (tmp + rename). Wiki is serial = max 1 writer |
| Stream format (SDK vs CLI) | Low | `prepareConsoleLines` already handles both formats |
| Warm SDK stale after plugin update | Low | Init route writes sentinel → daemon re-preheats |

## File Impact Summary

| Action | Files |
|---|---|
| NEW | `scripts/daemon/warm-sdk.ts`, `scripts/migrate-wiki-runs.ts` |
| MODIFY | `scripts/daemon/active-runs.ts`, `scripts/daemon/index.ts`, `src/app/api/wiki/generate/route.ts`, `src/app/api/wiki/init/route.ts`, `src/app/documents/page.tsx` |
| DELETE | `scripts/daemon/wiki-daemon.ts`, `scripts/daemon/run-wiki-generate.ts`, `src/app/api/wiki/run-stream/route.ts`, `src/app/api/wiki/runs/route.ts` |
