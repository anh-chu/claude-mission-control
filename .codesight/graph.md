# Dependency Graph

## Most Imported Files (change these carefully)

- `mission-control/src/lib/paths.ts` — imported by **20** files
- `mission-control/scripts/daemon/logger.ts` — imported by **14** files
- `mission-control/scripts/daemon/types.ts` — imported by **11** files
- `mission-control/scripts/daemon/security.ts` — imported by **8** files
- `mission-control/scripts/daemon/runner.ts` — imported by **7** files
- `mission-control/scripts/daemon/config.ts` — imported by **6** files
- `mission-control/src/lib/adapters/registry.ts` — imported by **6** files
- `mission-control/scripts/daemon/prompt-builder.ts` — imported by **5** files
- `mission-control/src/lib/logger.ts` — imported by **5** files
- `mission-control/src/lib/types.ts` — imported by **5** files
- `mission-control/src/lib/adapters/types.ts` — imported by **4** files
- `mission-control/scripts/daemon/health.ts` — imported by **3** files
- `mission-control/__tests__/helpers.ts` — imported by **2** files
- `mission-control/scripts/daemon/recovery.ts` — imported by **2** files
- `mission-control/scripts/daemon/dispatcher.ts` — imported by **2** files
- `mission-control/src/lib/scrub.ts` — imported by **2** files
- `mission-control/src/lib/data.ts` — imported by **2** files
- `mission-control/src/lib/validations.ts` — imported by **1** files
- `mission-control/scripts/daemon/scheduler.ts` — imported by **1** files
- `mission-control/src/components/field-ops/execution-result-panel.tsx` — imported by **1** files

## Import Map (who imports what)

- `mission-control/src/lib/paths.ts` ← `mission-control/scripts/cleanup-uploads.ts`, `mission-control/scripts/daemon/config.ts`, `mission-control/scripts/daemon/dispatcher.ts`, `mission-control/scripts/daemon/health.ts`, `mission-control/scripts/daemon/index.ts` +15 more
- `mission-control/scripts/daemon/logger.ts` ← `mission-control/scripts/daemon/config.ts`, `mission-control/scripts/daemon/dispatcher.ts`, `mission-control/scripts/daemon/health.ts`, `mission-control/scripts/daemon/index.ts`, `mission-control/scripts/daemon/prompt-builder.ts` +9 more
- `mission-control/scripts/daemon/types.ts` ← `mission-control/scripts/daemon/config.ts`, `mission-control/scripts/daemon/dispatcher.ts`, `mission-control/scripts/daemon/health.ts`, `mission-control/scripts/daemon/prompt-builder.ts`, `mission-control/scripts/daemon/respond-runs.ts` +6 more
- `mission-control/scripts/daemon/security.ts` ← `mission-control/__tests__/security.test.ts`, `mission-control/__tests__/security.test.ts`, `mission-control/scripts/daemon/health.ts`, `mission-control/scripts/daemon/prompt-builder.ts`, `mission-control/scripts/daemon/run-action-comment.ts` +3 more
- `mission-control/scripts/daemon/runner.ts` ← `mission-control/scripts/daemon/dispatcher.ts`, `mission-control/scripts/daemon/index.ts`, `mission-control/scripts/daemon/run-action-comment.ts`, `mission-control/scripts/daemon/run-brain-dump-triage.ts`, `mission-control/scripts/daemon/run-inbox-respond.ts` +2 more
- `mission-control/scripts/daemon/config.ts` ← `mission-control/__tests__/daemon.test.ts`, `mission-control/scripts/daemon/index.ts`, `mission-control/scripts/daemon/run-brain-dump-triage.ts`, `mission-control/scripts/daemon/run-inbox-respond.ts`, `mission-control/scripts/daemon/run-task.ts` +1 more
- `mission-control/src/lib/adapters/registry.ts` ← `mission-control/src/lib/adapters/ethereum-adapter.ts`, `mission-control/src/lib/adapters/gmail-adapter.ts`, `mission-control/src/lib/adapters/linkedin-adapter.ts`, `mission-control/src/lib/adapters/reddit-adapter.ts`, `mission-control/src/lib/adapters/stripe-adapter.ts` +1 more
- `mission-control/scripts/daemon/prompt-builder.ts` ← `mission-control/__tests__/daemon.test.ts`, `mission-control/scripts/daemon/dispatcher.ts`, `mission-control/scripts/daemon/dispatcher.ts`, `mission-control/scripts/daemon/dispatcher.ts`, `mission-control/scripts/daemon/run-task.ts`
- `mission-control/src/lib/logger.ts` ← `mission-control/scripts/daemon/logger.ts`, `mission-control/scripts/daemon/run-action-comment.ts`, `mission-control/scripts/daemon/run-inbox-respond.ts`, `mission-control/scripts/daemon/run-task-comment.ts`, `mission-control/scripts/daemon/run-task.ts`
- `mission-control/src/lib/types.ts` ← `mission-control/src/lib/action-adapter.ts`, `mission-control/src/lib/autonomy.ts`, `mission-control/src/lib/service-categories.ts`, `mission-control/src/lib/spend-tracker.ts`, `mission-control/src/lib/sync-commands.ts`
