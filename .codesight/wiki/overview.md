# mission-control — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**mission-control** is a typescript project built with next-app.

## Scale

100 API routes · 96 UI components · 37 library files · 3 middleware layers · 21 environment variables

## Subsystems

- **[Route](./route.md)** — 100 routes — touches: cache, auth, queue, ai, upload

**UI:** 96 components (react) — see [ui.md](./ui.md)

**Libraries:** 37 files — see [libraries.md](./libraries.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `src/lib/types.ts` — imported by **68** files
- `src/lib/utils.ts` — imported by **56** files
- `src/lib/paths.ts` — imported by **49** files
- `src/components/ui/button.tsx` — imported by **45** files
- `src/components/ui/badge.tsx` — imported by **31** files
- `src/components/breadcrumb-nav.tsx` — imported by **31** files

## Required Environment Variables

- `API_KEY` — `__tests__/daemon.test.ts`
- `APPDATA` — `scripts/daemon/runner.ts`
- `CLAUDE_CODE_OAUTH_TOKEN` — `scripts/daemon/security.ts`
- `CMC_DATA_DIR` — `__tests__/helpers.ts`
- `CMC_WORKSPACE_ID` — `scripts/daemon/run-brain-dump-triage.ts`
- `COMSPEC` — `scripts/daemon/security.ts`
- `HOME` — `scripts/daemon/runner.ts`
- `LOCALAPPDATA` — `scripts/daemon/runner.ts`
- `MC_API_TOKEN` — `src/proxy.ts`
- `NEXT_PUBLIC_MC_API_TOKEN` — `src/lib/api-client.ts`
- `NEXT_RUNTIME` — `src/instrumentation.ts`
- `NODE_ENV` — `src/instrumentation.ts`
- _...9 more_

---
_Back to [index.md](./index.md) · Generated 2026-04-24_