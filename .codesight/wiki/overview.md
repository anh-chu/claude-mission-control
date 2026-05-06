# mandio — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**mandio** is a typescript project built with next-app.

## Scale

99 API routes · 102 UI components · 58 library files · 1 middleware layers · 24 environment variables

## Subsystems

- **[Route](./route.md)** — 99 routes — touches: cache, upload, auth, ai, queue

**UI:** 102 components (react) — see [ui.md](./ui.md)

**Libraries:** 58 files — see [libraries.md](./libraries.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `src/lib/utils.ts` — imported by **62** files
- `src/lib/types.ts` — imported by **51** files
- `src/lib/paths.ts` — imported by **48** files
- `src/components/ui/button.tsx` — imported by **45** files
- `src/lib/workspace-context.ts` — imported by **31** files
- `src/components/ui/badge.tsx` — imported by **24** files

## Required Environment Variables

- `API_KEY` — `__tests__/daemon.test.ts`
- `APPDATA` — `scripts/daemon/runner.ts`
- `CLAUDE_CODE_EXECUTABLE` — `src/lib/claude-sdk.ts`
- `CLAUDE_CODE_OAUTH_TOKEN` — `scripts/daemon/security.ts`
- `COMSPEC` — `scripts/daemon/security.ts`
- `HOME` — `scripts/daemon/runner.ts`
- `LOCALAPPDATA` — `scripts/daemon/runner.ts`
- `MANDIO_API_TOKEN` — `src/proxy.ts`
- `MANDIO_BOOTSTRAP_STANDALONE` — `bin/bootstrap.ts`
- `MANDIO_DATA_DIR` — `__tests__/chat-sessions.test.ts`
- `MANDIO_INSTALL_DIR` — `src/lib/paths.ts`
- `MANDIO_WORKSPACE_ID` — `scripts/daemon/prompt-builder.ts`
- _...12 more_

---
_Back to [index.md](./index.md) · Generated 2026-05-06_