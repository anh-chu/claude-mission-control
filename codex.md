# Project Context

This is a typescript project using next-app.

The API has 99 routes. See .codesight/routes.md for the full route map with methods, paths, and tags.
The UI has 102 components. See .codesight/components.md for the full list with props.
Middleware includes: custom.

High-impact files (most imported, changes here affect many other files):
- src/lib/utils.ts (imported by 62 files)
- src/lib/types.ts (imported by 51 files)
- src/lib/paths.ts (imported by 48 files)
- src/components/ui/button.tsx (imported by 45 files)
- src/lib/workspace-context.ts (imported by 31 files)
- src/components/ui/badge.tsx (imported by 24 files)
- src/lib/data.ts (imported by 18 files)
- src/components/breadcrumb-nav.tsx (imported by 18 files)

Required environment variables (no defaults):
- API_KEY (__tests__/daemon.test.ts)
- APPDATA (scripts/daemon/runner.ts)
- CLAUDE_CODE_EXECUTABLE (src/lib/claude-sdk.ts)
- CLAUDE_CODE_OAUTH_TOKEN (scripts/daemon/security.ts)
- COMSPEC (scripts/daemon/security.ts)
- HOME (scripts/daemon/runner.ts)
- LOCALAPPDATA (scripts/daemon/runner.ts)
- MANDIO_API_TOKEN (src/proxy.ts)
- MANDIO_BOOTSTRAP_STANDALONE (bin/bootstrap.ts)
- MANDIO_DATA_DIR (__tests__/chat-sessions.test.ts)
- MANDIO_INSTALL_DIR (src/lib/paths.ts)
- MANDIO_WORKSPACE_ID (scripts/daemon/prompt-builder.ts)
- NEXT_PUBLIC_MANDIO_API_TOKEN (src/lib/api-client.ts)
- NEXT_RUNTIME (src/instrumentation.ts)
- NODE_ENV (src/instrumentation.ts)

Read .codesight/wiki/index.md for orientation (WHERE things live). Then read actual source files before implementing. Wiki articles are navigation aids, not implementation guides.
Read .codesight/CODESIGHT.md for the complete AI context map including all routes, schema, components, libraries, config, middleware, and dependency graph.
