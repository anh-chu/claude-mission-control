# mission-control — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**mission-control** is a typescript project built with next-app.

## Scale

77 API routes · 70 UI components · 42 library files · 2 middleware layers · 21 environment variables

## Subsystems

- **[Route](./route.md)** — 77 routes — touches: cache, db, ai, auth, queue

**UI:** 70 components (react) — see [ui.md](./ui.md)

**Libraries:** 42 files — see [libraries.md](./libraries.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `src/lib/types.ts` — imported by **57** files
- `src/lib/utils.ts` — imported by **51** files
- `src/lib/paths.ts` — imported by **41** files
- `src/components/ui/button.tsx` — imported by **36** files
- `src/components/breadcrumb-nav.tsx` — imported by **24** files
- `src/components/ui/badge.tsx` — imported by **24** files

## Required Environment Variables

- `API_KEY` — `__tests__/daemon.test.ts`
- `APPDATA` — `scripts/daemon/runner.ts`
- `CLAUDE_CODE_OAUTH_TOKEN` — `scripts/daemon/security.ts`
- `CMC_DATA_DIR` — `__tests__/helpers.ts`
- `MANDIO_WORKSPACE_ID` — `scripts/daemon/run-brain-dump-triage.ts`
- `COMSPEC` — `scripts/daemon/security.ts`
- `HOME` — `scripts/daemon/runner.ts`
- `LOCALAPPDATA` — `scripts/daemon/runner.ts`
- `MC_API_TOKEN` — `src/proxy.ts`
- `NEXT_PUBLIC_MC_API_TOKEN` — `src/lib/api-client.ts`
- `NEXT_RUNTIME` — `src/instrumentation.ts`
- `NODE_ENV` — `src/instrumentation.ts`
- _...9 more_

---
_Back to [index.md](./index.md) · Generated 2026-04-27_