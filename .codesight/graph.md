# Dependency Graph

## Most Imported Files (change these carefully)

- `src/lib/utils.ts` — imported by **62** files
- `src/lib/types.ts` — imported by **51** files
- `src/lib/paths.ts` — imported by **48** files
- `src/components/ui/button.tsx` — imported by **45** files
- `src/lib/workspace-context.ts` — imported by **31** files
- `src/components/ui/badge.tsx` — imported by **24** files
- `src/lib/data.ts` — imported by **18** files
- `src/components/breadcrumb-nav.tsx` — imported by **18** files
- `src/components/ui/input.tsx` — imported by **18** files
- `src/hooks/use-data.ts` — imported by **17** files
- `src/lib/api-client.ts` — imported by **12** files
- `src/components/ui/card.tsx` — imported by **10** files
- `src/components/ui/tip.tsx` — imported by **10** files
- `src/lib/toast.ts` — imported by **10** files
- `src/components/ui/label.tsx` — imported by **10** files
- `src/components/layout/viewer-toolbar.tsx` — imported by **10** files
- `src/components/error-state.tsx` — imported by **9** files
- `src/components/ui/textarea.tsx` — imported by **9** files
- `scripts/daemon/logger.ts` — imported by **8** files
- `src/providers/active-runs-provider.tsx` — imported by **8** files

## Import Map (who imports what)

- `src/lib/utils.ts` ← `src/app/api/activity-log/route.ts`, `src/app/api/brain-dump/route.ts`, `src/app/api/commands/route.ts`, `src/app/api/decisions/route.ts`, `src/app/api/inbox/route.ts` +57 more
- `src/lib/types.ts` ← `__tests__/data.test.ts`, `src/app/api/activity-log/route.ts`, `src/app/api/agents/route.ts`, `src/app/api/brain-dump/route.ts`, `src/app/api/commands/route.ts` +46 more
- `src/lib/paths.ts` ← `__tests__/seeding.test.ts`, `bin/cli.ts`, `scripts/cleanup-uploads.ts`, `scripts/daemon/config.ts`, `scripts/daemon/run-brain-dump-triage.ts` +43 more
- `src/components/ui/button.tsx` ← `src/app/crew/[id]/edit/page.tsx`, `src/app/crew/[id]/page.tsx`, `src/app/crew/page.tsx`, `src/app/documents/page.tsx`, `src/app/error.tsx` +40 more
- `src/lib/workspace-context.ts` ← `src/app/api/agents/route.ts`, `src/app/api/assets/[...path]/route.ts`, `src/app/api/brain-dump/automate/route.ts`, `src/app/api/chat/messages/route.ts`, `src/app/api/chat/route.ts` +26 more
- `src/components/ui/badge.tsx` ← `src/app/crew/[id]/page.tsx`, `src/app/crew/page.tsx`, `src/app/initiatives/[id]/page.tsx`, `src/app/page.tsx`, `src/app/settings/page.tsx` +19 more
- `src/lib/data.ts` ← `__tests__/seeding.test.ts`, `src/app/api/activity-log/route.ts`, `src/app/api/brain-dump/automate/route.ts`, `src/app/api/brain-dump/route.ts`, `src/app/api/commands/route.ts` +13 more
- `src/components/breadcrumb-nav.tsx` ← `src/app/commands/[id]/page.tsx`, `src/app/crew/[id]/edit/page.tsx`, `src/app/crew/[id]/page.tsx`, `src/app/crew/loading.tsx`, `src/app/crew/page.tsx` +13 more
- `src/components/ui/input.tsx` ← `src/app/crew/[id]/page.tsx`, `src/app/initiatives/[id]/page.tsx`, `src/app/settings/page.tsx`, `src/components/agent-form.tsx`, `src/components/command-bar.tsx` +13 more
- `src/hooks/use-data.ts` ← `src/app/commands/[id]/page.tsx`, `src/app/crew/[id]/edit/page.tsx`, `src/app/crew/new/page.tsx`, `src/app/crew/page.tsx`, `src/app/page.tsx` +12 more
