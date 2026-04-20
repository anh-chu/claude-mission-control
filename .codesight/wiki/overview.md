# ccmc — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**ccmc** is a typescript project built with next-app.

## Scale

100 API routes · 79 UI components · 37 library files · 4 middleware layers · 21 environment variables

## Subsystems

- **[Route](./route.md)** — 100 routes — touches: cache, auth, queue, ai, upload

**UI:** 79 components (react) — see [ui.md](./ui.md)

**Libraries:** 37 files — see [libraries.md](./libraries.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `mission-control/src/lib/paths.ts` — imported by **20** files
- `mission-control/scripts/daemon/logger.ts` — imported by **14** files
- `mission-control/scripts/daemon/types.ts` — imported by **10** files
- `mission-control/scripts/daemon/security.ts` — imported by **7** files
- `mission-control/scripts/daemon/runner.ts` — imported by **7** files
- `mission-control/scripts/daemon/config.ts` — imported by **6** files

## Required Environment Variables

- `API_KEY` — `mission-control/__tests__/daemon.test.ts`
- `APPDATA` — `mission-control/scripts/daemon/runner.ts`
- `CLAUDE_CODE_OAUTH_TOKEN` — `mission-control/scripts/daemon/security.ts`
- `CMC_DATA_DIR` — `mission-control/__tests__/helpers.ts`
- `CMC_WORKSPACE_ID` — `mission-control/scripts/daemon/run-brain-dump-triage.ts`
- `COMSPEC` — `mission-control/scripts/daemon/security.ts`
- `HOME` — `mission-control/scripts/daemon/runner.ts`
- `LOCALAPPDATA` — `mission-control/scripts/daemon/runner.ts`
- `MC_API_TOKEN` — `mission-control/src/middleware.ts`
- `NEXT_PUBLIC_MC_API_TOKEN` — `mission-control/src/lib/api-client.ts`
- `NEXT_RUNTIME` — `mission-control/src/instrumentation.ts`
- `NODE_ENV` — `mission-control/src/instrumentation.ts`
- _...9 more_

---
_Back to [index.md](./index.md) · Generated 2026-04-20_