# npm Publish Plan — mandio

Make the app installable via `npx mandio`.

## Architecture

```
npx mandio
  └─ bin/cli.js (entry point)
       ├─ preflight checks (Node >=18, Claude CLI, port 3000)
       ├─ bootstrap ~/.cmc/ data dir
       ├─ fork .next/standalone/server.js (Next.js)
       ├─ fork dist/daemon.js (background agent runner)
       └─ open browser → localhost:3000
```

## Steps

1. Enable `output: 'standalone'` in next.config.ts
2. Fix `process.cwd()` → `__dirname`-relative for ARTIFACTS_DIR in data.ts, scheduled-jobs.ts
3. Create CLI entry point (bin/cli.ts) with subcommands: start, stop, status, dev, version
4. esbuild daemon into dist/daemon.js + sub-scripts
5. esbuild CLI into bin/cli.js
6. Preflight checker (bin/checks.ts) — Node version, Claude CLI, port, data dir
7. Data dir bootstrap + version migration framework (bin/bootstrap.ts)
8. Process manager (bin/process-manager.ts) — replaces PM2 for default users
9. Update dispatcher to use compiled dist/*.js when available, fall back to tsx
10. package.json — remove private, add bin/files/engines/prepublishOnly
11. .npmignore safety net
12. Copy public/ + .next/static/ into standalone dir during build
13. Verify /api/server-status works without auth
14. README quick-start for npm users

## Constraints
- Existing `pnpm dev` workflow must keep working for contributors
- Claude CLI is external dep — detect and fail gracefully
- PM2 stays as optional advanced config, not required
- daemon must work both via tsx (dev) and compiled (prod)
