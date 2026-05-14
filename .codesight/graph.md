# Dependency Graph

## Most Imported Files (change these carefully)

- `src/lib/utils.ts` — imported by **74** files
- `src/lib/types.ts` — imported by **70** files
- `src/lib/auth-guards.ts` — imported by **57** files
- `src/lib/paths.ts` — imported by **55** files
- `src/components/ui/button.tsx` — imported by **54** files
- `src/lib/workspace-context.ts` — imported by **40** files
- `src/components/ui/badge.tsx` — imported by **28** files
- `src/components/ui/input.tsx` — imported by **23** files
- `src/hooks/use-data.ts` — imported by **19** files
- `src/components/breadcrumb-nav.tsx` — imported by **18** files
- `src/lib/api-client.ts` — imported by **17** files
- `src/lib/data.ts` — imported by **17** files
- `src/components/ui/card.tsx` — imported by **14** files
- `src/lib/toast.ts` — imported by **13** files
- `src/components/ui/label.tsx` — imported by **13** files
- `scripts/daemon/logger.ts` — imported by **10** files
- `src/components/ui/textarea.tsx` — imported by **10** files
- `src/providers/active-runs-provider.tsx` — imported by **10** files
- `src/components/ui/tip.tsx` — imported by **10** files
- `src/components/layout/viewer-toolbar.tsx` — imported by **10** files

## Import Map (who imports what)

- `src/lib/utils.ts` ← `src/app/agents/[id]/page.tsx`, `src/app/agents/page.tsx`, `src/app/api/activity-log/route.ts`, `src/app/api/brain-dump/route.ts`, `src/app/api/commands/route.ts` +69 more
- `src/lib/types.ts` ← `__tests__/conversation-event-bus.test.ts`, `__tests__/data.test.ts`, `scripts/daemon/run-task.ts`, `scripts/daemon/workspace-settings.ts`, `src/app/agents/[id]/page.tsx` +65 more
- `src/lib/auth-guards.ts` ← `__tests__/auth-oauth-security.test.ts`, `src/app/api/activity-log/route.ts`, `src/app/api/agents/route.ts`, `src/app/api/assets/[...path]/route.ts`, `src/app/api/brain-dump/automate/route.ts` +52 more
- `src/lib/paths.ts` ← `__tests__/api-projects-stop-conversation.test.ts`, `__tests__/api-tasks-stop-conversation.test.ts`, `__tests__/daemon-multi-workspace.test.ts`, `__tests__/seeding.test.ts`, `bin/cli.ts` +50 more
- `src/components/ui/button.tsx` ← `src/app/agents/[id]/edit/page.tsx`, `src/app/agents/[id]/page.tsx`, `src/app/agents/page.tsx`, `src/app/brain/page.tsx`, `src/app/error.tsx` +49 more
- `src/lib/workspace-context.ts` ← `src/app/api/agents/route.ts`, `src/app/api/assets/[...path]/route.ts`, `src/app/api/brain-dump/automate/route.ts`, `src/app/api/commands/activate/route.ts`, `src/app/api/commands/route.ts` +35 more
- `src/components/ui/badge.tsx` ← `src/app/agents/[id]/page.tsx`, `src/app/agents/page.tsx`, `src/app/initiatives/[id]/page.tsx`, `src/app/page.tsx`, `src/app/settings/page.tsx` +23 more
- `src/components/ui/input.tsx` ← `src/app/agents/[id]/page.tsx`, `src/app/initiatives/[id]/page.tsx`, `src/app/settings/page.tsx`, `src/app/settings/workspaces/[id]/page.tsx`, `src/app/settings/workspaces/page.tsx` +18 more
- `src/hooks/use-data.ts` ← `src/app/agents/[id]/edit/page.tsx`, `src/app/agents/new/page.tsx`, `src/app/agents/page.tsx`, `src/app/commands/[id]/page.tsx`, `src/app/page.tsx` +14 more
- `src/components/breadcrumb-nav.tsx` ← `src/app/agents/[id]/edit/page.tsx`, `src/app/agents/[id]/page.tsx`, `src/app/agents/loading.tsx`, `src/app/brain/page.tsx`, `src/app/commands/[id]/page.tsx` +13 more
