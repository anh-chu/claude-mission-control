# Libraries

> **Navigation aid.** Library inventory extracted via AST. Read the source files listed here before modifying exported functions.

**37 library files** across 1 module

## Mission-control (37 files)

- `mission-control/src/lib/data.ts` — getCurrentWorkspace, setCurrentWorkspace, getWorkspaceDataDir, ensureWorkspaceDir, initWikiDir, getCheckpointsDir, …
- `mission-control/src/lib/types.ts` — getQuadrant, quadrantFromValues, valuesFromQuadrant, AgentDefinition, AgentsFile, SkillDefinition, …
- `mission-control/src/lib/validations.ts` — validateBody, DEFAULT_LIMIT, LIMITS, taskCreateSchema, taskUpdateSchema, goalCreateSchema, …
- `mission-control/src/hooks/use-data.ts` — useTasks, useInitiativeTasks, useGoals, useProjects, useBrainDump, useActivityLog, …
- `mission-control/scripts/daemon/respond-runs.ts` — readRespondRuns, writeRespondRuns, isRunStopped, findRunningByMessage, getRunningRuns, createRespondRun, …
- `mission-control/src/lib/wiki-plugin.ts` — ensureWikiPluginInstalledDetailed, ensureWikiPluginInstalled, ensureWikiBootstrappedFromPlugin, reconcileWikiWithPlugin, WikiPluginInstall, WikiBootstrapResult, …
- `mission-control/scripts/daemon/prompt-builder.ts` — buildTaskPrompt, buildScheduledPrompt, getTask, getPendingTasks, isTaskUnblocked, hasPendingDecision
- `mission-control/scripts/daemon/security.ts` — validatePathWithinWorkspace, escapeFenceContent, fenceTaskData, enforcePromptLimit, validateBinary, buildSafeEnv
- `mission-control/src/lib/sync-commands.ts` — generateAgentCommandMarkdown, resolveLinkedSkills, syncAgentCommand, syncAllAgentCommands, syncSkillFile, syncAllSkillFiles
- `mission-control/scripts/daemon/recovery.ts` — persistSessionRecord, clearSessionRecord, runCrashRecovery, SessionRecord, RecoveryResult
- `mission-control/src/hooks/use-dashboard-data.ts` — useDashboardData, DashboardStats, DashboardAttention, DashboardEisenhowerCounts, DashboardData
- `mission-control/src/lib/paths.ts` — getWorkspaceDir, getUploadsDir, getWikiDir, DATA_DIR
- `mission-control/scripts/daemon/config.ts` — loadConfig, saveConfig, getConfigPath
- `mission-control/src/lib/log-reader.ts` — isAllowedLogPath, scrubLogLines, tailFile
- `mission-control/src/lib/logger.ts` — createLogger, Logger, LogLevel
- `mission-control/src/lib/scheduled-jobs.ts` — scheduleUploadsCleanup, scheduleLogCleanup, scheduleDaemonWatchdog
- `mission-control/src/lib/toast.ts` — showSuccess, showError, showInfo
- `mission-control/src/lib/utils.ts` — cn, generateId, parseAgentMentions
- `mission-control/scripts/daemon/runner.ts` — parseClaudeOutput, AgentRunner
- `mission-control/src/hooks/use-agent-stream.ts` — useAgentStream, StreamLine
- `mission-control/src/hooks/use-dashboard.ts` — useDashboard, DashboardData
- `mission-control/src/lib/agent-icons.ts` — getAgentIcon, getIconByName
- `mission-control/src/lib/api-client.ts` — apiFetch, ApiFetchInit
- `mission-control/src/middleware.ts` — middleware, config
- `mission-control/scripts/daemon/dispatcher.ts` — Dispatcher
- _…and 12 more files_

---
_Back to [overview.md](./overview.md)_