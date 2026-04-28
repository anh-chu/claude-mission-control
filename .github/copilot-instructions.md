# Project Context

This is a typescript project using next-app.

The API has 86 routes. See .codesight/routes.md for the full route map with methods, paths, and tags.
The UI has 83 components. See .codesight/components.md for the full list with props.
Middleware includes: custom, validation, auth.

High-impact files (most imported, changes here affect many other files):
- src/lib/paths.ts (imported by 19 files)
- scripts/daemon/logger.ts (imported by 13 files)
- scripts/daemon/types.ts (imported by 10 files)
- scripts/daemon/security.ts (imported by 7 files)
- scripts/daemon/config.ts (imported by 6 files)
- scripts/daemon/runner.ts (imported by 6 files)
- scripts/daemon/prompt-builder.ts (imported by 5 files)
- src/lib/logger.ts (imported by 4 files)

Required environment variables (no defaults):
- API_KEY (__tests__/daemon.test.ts)
- APPDATA (scripts/daemon/runner.ts)
- CLAUDE_CODE_OAUTH_TOKEN (scripts/daemon/security.ts)
- MANDIO_DATA_DIR (__tests__/helpers.ts)
- MANDIO_WORKSPACE_ID (scripts/daemon/run-brain-dump-triage.ts)
- COMSPEC (scripts/daemon/security.ts)
- HOME (scripts/daemon/runner.ts)
- LOCALAPPDATA (scripts/daemon/runner.ts)
- MANDIO_API_TOKEN (src/middleware.ts)
- NEXT_PUBLIC_MANDIO_API_TOKEN (src/lib/api-client.ts)
- NEXT_RUNTIME (src/instrumentation.ts)
- NODE_ENV (src/instrumentation.ts)
- P (scripts/daemon/security.ts)
- PATH (scripts/daemon/security.ts)
- PATHEXT (scripts/daemon/security.ts)

Read .codesight/wiki/index.md for orientation (WHERE things live). Then read actual source files before implementing. Wiki articles are navigation aids, not implementation guides.
Read .codesight/CODESIGHT.md for the complete AI context map including all routes, schema, components, libraries, config, middleware, and dependency graph.
