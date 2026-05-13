# mandio — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**mandio** is a typescript project built with next-app.

## Scale

102 API routes · 119 UI components · 63 library files · 7 middleware layers · 32 environment variables

## Subsystems

- **[Route](./route.md)** — 102 routes — touches: auth, cache, upload, db, ai

**UI:** 119 components (react) — see [ui.md](./ui.md)

**Libraries:** 63 files — see [libraries.md](./libraries.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `src/lib/utils.ts` — imported by **73** files
- `src/lib/types.ts` — imported by **69** files
- `src/lib/auth-guards.ts` — imported by **57** files
- `src/components/ui/button.tsx` — imported by **54** files
- `src/lib/paths.ts` — imported by **53** files
- `src/lib/workspace-context.ts` — imported by **40** files

## Required Environment Variables

- `API_KEY` — `__tests__/daemon.test.ts`
- `APPDATA` — `scripts/daemon/runner.ts`
- `AUTH_ALLOW_ALL_USERS` — `__tests__/auth-signin-callback.test.ts`
- `CLAUDE_CODE_EXECUTABLE` — `src/lib/claude-sdk.ts`
- `CLAUDE_CODE_OAUTH_TOKEN` — `scripts/daemon/security.ts`
- `COMSPEC` — `scripts/daemon/security.ts`
- `HOME` — `scripts/daemon/runner.ts`
- `LOCALAPPDATA` — `scripts/daemon/runner.ts`
- `MANDIO_ALLOW_AGENT_IN_TESTS` — `scripts/daemon/runner.ts`
- `MANDIO_BOOTSTRAP_STANDALONE` — `bin/bootstrap.ts`
- `MANDIO_DATA_DIR` — `__tests__/helpers.ts`
- `MANDIO_DEFAULT_MODEL` — `scripts/daemon/runner.ts`
- _...15 more_

---
_Back to [index.md](./index.md) · Generated 2026-05-13_