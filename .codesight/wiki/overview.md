# mandio — Overview

> **Navigation aid.** This article shows WHERE things live (routes, models, files). Read actual source files before implementing new features or making changes.

**mandio** is a typescript project built with next-app.

## Scale

106 API routes · 122 UI components · 71 library files · 9 middleware layers · 41 environment variables

## Subsystems

- **[Payments](./payments.md)** — 1 routes — touches: auth, queue, payment
- **[Route](./route.md)** — 102 routes — touches: auth, cache, upload, db, ai
- **[Ws-bridge](./ws-bridge.md)** — 3 routes

**UI:** 122 components (react) — see [ui.md](./ui.md)

**Libraries:** 71 files — see [libraries.md](./libraries.md)

## High-Impact Files

Changes to these files have the widest blast radius across the codebase:

- `src/lib/utils.ts` — imported by **74** files
- `src/lib/types.ts` — imported by **71** files
- `src/lib/auth-guards.ts` — imported by **57** files
- `src/lib/paths.ts` — imported by **55** files
- `src/components/ui/button.tsx` — imported by **54** files
- `src/lib/workspace-context.ts` — imported by **41** files

## Required Environment Variables

- `ANTHROPIC_API_KEY` — `__tests__/terminal-session-manager.test.ts`
- `API_KEY` — `__tests__/daemon.test.ts`
- `APPDATA` — `scripts/daemon/runner.ts`
- `AUTH_ALLOW_ALL_USERS` — `__tests__/auth-email-allowlist.test.ts`
- `CLAUDE_CODE_EXECUTABLE` — `src/lib/claude-sdk.ts`
- `CLAUDE_CODE_OAUTH_TOKEN` — `scripts/daemon/security.ts`
- `COMSPEC` — `scripts/daemon/security.ts`
- `DB_PASSWORD` — `__tests__/terminal-session-manager.test.ts`
- `HOME` — `__tests__/terminal-session-manager.test.ts`
- `HOSTNAME` — `src/server.ts`
- `LOCALAPPDATA` — `scripts/daemon/runner.ts`
- `MANDIO_ALLOW_AGENT_IN_TESTS` — `scripts/daemon/runner.ts`
- _...23 more_

---
_Back to [index.md](./index.md) · Generated 2026-05-14_