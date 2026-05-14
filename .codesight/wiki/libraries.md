# Libraries

> **Navigation aid.** Library inventory extracted via AST. Read the source files listed here before modifying exported functions.

**71 library files** across 6 modules

## Lib (44 files)

- `src/lib/types.ts` — getQuadrant, valuesFromQuadrant, AgentDefinition, AgentsFile, SkillDefinition, LegacySkillDefinition, …
- `src/lib/data.ts` — ensureSkillsMigrated, getWorkspaceDataDir, ensureWorkspaceDir, initWikiDir, ensureDocMaintainerAgentForWorkspace, getTasks, …
- `src/lib/conversations.ts` — setConversationsWorkspace, turnsFilePath, eventsFilePath, seqFilePath, ensureConversationDir, getConversationsFile, …
- `src/lib/validations.ts` — validateBody, WebhookTriggerInput, safeId, DEFAULT_LIMIT, LIMITS, commentSchema, …
- `src/lib/paths.ts` — assertSafeId, getWorkspaceDir, getUploadsDir, getWikiPathFile, getWikiDir, getDefaultWikiDir, …
- `src/lib/command-activation.ts` — activateCommand, deactivateCommand, listActivatedCommands, listActivatedCommandsSync, isCommandActivated, activateAllCommands, …
- `src/lib/skill-activation.ts` — activateSkill, deactivateSkill, listActivatedSkills, isSkillActivated, listActivatedSkillsSync, activateAllSkills, …
- `src/lib/workspace-git.ts` — isGitRepo, gitInit, writeWorkspaceGitignore, hasAnyCommit, gitStatusPorcelain, isDirty, …
- `src/lib/command-files.ts` — parseCommandFile, serializeCommandFile, readCommandFile, readCommandFileSync, writeCommandFile, listCommandIds, …
- `src/lib/skill-files.ts` — parseSkillFile, serializeSkillFile, readSkillFile, readSkillFileSync, writeSkillFile, listSkillIds, …
- `src/lib/wiki-plugin.ts` — compareVersions, getPluginStatus, ensureWikiPluginInstalledDetailed, ensureWikiBootstrappedFromPlugin, reconcileWikiWithPlugin, getLatestAvailableVersion, …
- `src/lib/terminal/session-manager.ts` — detectShell, buildEnv, TerminalSessionManager, TerminalSession, IDLE_MS, MAX_AGE_MS, …
- `src/lib/conversation-event-bus.ts` — emitLocal, subscribeLocal, subscribe, publishAndEmit, _watcherCount, _clearWatchers
- `src/lib/paginate.ts` — parsePaginationParams, paginateItems, PaginationParams, PaginatedResult, CACHE_HEADERS
- `src/lib/cabinets/tree.ts` — findRootCabinetNode, findNodeByPath, findDeepestCabinetNode, findParentCabinetNode
- `src/lib/embeds/detect.ts` — detectEmbed, providerLabel, DetectedEmbed, EmbedProvider
- `src/lib/google/detect.ts` — detectGoogle, googleKindLabel, GoogleLink, GoogleKind
- `src/lib/scheduled-jobs.ts` — scheduleUploadsCleanup, scheduleLogCleanup, runStartupRecovery, scheduleAutopilotPoller
- `src/lib/command-prompt.ts` — buildScheduledTask, loadCommandPrompt, CommandPromptResult
- `src/lib/log-reader.ts` — isAllowedLogPath, scrubLogLines, tailFile
- `src/lib/logger.ts` — createLogger, Logger, LogLevel
- `src/lib/sync-commands.ts` — generateAgentCommandMarkdown, syncAgentCommand, syncAllAgentCommands
- `src/lib/utils.ts` — cn, generateId, parseAgentMentions
- `src/lib/workspace-store.ts` — getWorkspaceId, setFallbackWorkspaceId, workspaceStore
- `src/lib/api-client.ts` — apiFetch, ApiFetchInit
- _…and 19 more files_

## Scripts (12 files)

- `scripts/daemon/conversation-writer.ts` — __resetWriterState, startConversationForTask, attachPidToRun, appendUserTurn, pauseForDecision, completeConversation, …
- `scripts/daemon/security.ts` — validatePathWithinWorkspace, escapeFenceContent, fenceTaskData, enforcePromptLimit, validateBinary, buildSafeEnv
- `scripts/daemon/warm-sdk.ts` — appendStreamEvent, buildSdkOptions, consumeStream, runWithSdk, preheatSdk, getWarmHandle
- `scripts/daemon/prompt-builder.ts` — buildTaskPrompt, getTask, getPendingTasks, isTaskUnblocked, hasPendingDecision
- `scripts/daemon/active-runs.ts` — readActiveRuns, writeActiveRuns, ActiveRunEntry
- `scripts/daemon/config.ts` — loadConfig, saveConfig
- `scripts/daemon/runner.ts` — parseClaudeOutput, AgentRunner
- `scripts/daemon/runs-registry.ts` — readJsonFile, atomicWriteJson
- `scripts/daemon/data-io.ts` — readJSON
- `scripts/daemon/spawn-utils.ts` — extractSummary
- `scripts/daemon/workspace-env.ts` — getWorkspaceEnv
- `scripts/daemon/workspace-settings.ts` — readWorkspaceSettingsSync

## Hooks (11 files)

- `src/hooks/use-data.ts` — useTasks, useInitiativeTasks, useProjects, useBrainDump, useActivityLog, useInbox, …
- `src/hooks/use-conversation-stream.ts` — conversationReducer, useConversationStream, ConversationReducerState, ConversationStreamState, initialReducerState
- `src/hooks/use-home-data.ts` — useHomeData, HomeStats, HomeData
- `src/hooks/use-terminal-ws.ts` — useTerminalWS, UseTerminalWSResult, TerminalStatus
- `src/hooks/use-active-runs.ts` — useActiveRuns
- `src/hooks/use-connection.ts` — useConnection
- `src/hooks/use-daemon.ts` — useDaemon
- `src/hooks/use-fast-task-poll.ts` — useFastTaskPoll
- `src/hooks/use-processing-entries.ts` — useProcessingEntries
- `src/hooks/use-sidebar.ts` — useSidebar
- `src/hooks/use-workspace.ts` — useWorkspace

## Bin (2 files)

- `bin/checks.ts` — checkNodeVersion, checkClaudeCLI, checkPortAvailable, checkDataDirWritable
- `bin/bootstrap.ts` — bootstrapDataDir

## Instrumentation.ts (1 files)

- `src/instrumentation.ts` — register

## Stores (1 files)

- `src/stores/editor-store.ts` — FetchPageError, LoadStatus, useEditorStore

---
_Back to [overview.md](./overview.md)_