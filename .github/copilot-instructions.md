# Project Context

This is a typescript project using next-app.

The API has 86 routes. See .codesight/routes.md for the full route map with methods, paths, and tags.
The UI has 83 components. See .codesight/components.md for the full list with props.
Middleware includes: custom, validation, auth.

High-impact files (most imported, changes here affect many other files):
- mission-control/src/lib/paths.ts (imported by 19 files)
- mission-control/scripts/daemon/logger.ts (imported by 13 files)
- mission-control/scripts/daemon/types.ts (imported by 10 files)
- mission-control/scripts/daemon/security.ts (imported by 7 files)
- mission-control/scripts/daemon/config.ts (imported by 6 files)
- mission-control/scripts/daemon/runner.ts (imported by 6 files)
- mission-control/scripts/daemon/prompt-builder.ts (imported by 5 files)
- mission-control/src/lib/logger.ts (imported by 4 files)

Required environment variables (no defaults):
- API_KEY (mission-control/__tests__/daemon.test.ts)
- APPDATA (mission-control/scripts/daemon/runner.ts)
- CLAUDE_CODE_OAUTH_TOKEN (mission-control/scripts/daemon/security.ts)
- CMC_DATA_DIR (mission-control/__tests__/helpers.ts)
- CMC_WORKSPACE_ID (mission-control/scripts/daemon/run-brain-dump-triage.ts)
- COMSPEC (mission-control/scripts/daemon/security.ts)
- HOME (mission-control/scripts/daemon/runner.ts)
- LOCALAPPDATA (mission-control/scripts/daemon/runner.ts)
- MC_API_TOKEN (mission-control/src/middleware.ts)
- NEXT_PUBLIC_MC_API_TOKEN (mission-control/src/lib/api-client.ts)
- NEXT_RUNTIME (mission-control/src/instrumentation.ts)
- NODE_ENV (mission-control/src/instrumentation.ts)
- P (mission-control/scripts/daemon/security.ts)
- PATH (mission-control/scripts/daemon/security.ts)
- PATHEXT (mission-control/scripts/daemon/security.ts)

Read .codesight/wiki/index.md for orientation (WHERE things live). Then read actual source files before implementing. Wiki articles are navigation aids, not implementation guides.
Read .codesight/CODESIGHT.md for the complete AI context map including all routes, schema, components, libraries, config, middleware, and dependency graph.
