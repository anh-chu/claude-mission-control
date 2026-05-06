# Libraries

> **Navigation aid.** Library inventory extracted via AST. Read the source files listed here before modifying exported functions.

**58 library files** across 7 modules

## Lib (34 files)

- `src/lib/types.ts` — getQuadrant, valuesFromQuadrant, AgentDefinition, AgentsFile, SkillDefinition, LegacySkillDefinition, …
- `src/lib/data.ts` — setCurrentWorkspace, ensureSkillsMigrated, getWorkspaceDataDir, ensureWorkspaceDir, initWikiDir, ensureDocMaintainerAgentForWorkspace, …
- `src/lib/validations.ts` — validateBody, safeId, DEFAULT_LIMIT, LIMITS, commentSchema, taskCreateSchema, …
- `src/lib/paths.ts` — assertSafeId, getWorkspaceDir, getUploadsDir, getWikiPathFile, getWikiDir, getDefaultWikiDir, …
- `src/lib/chat-sessions.ts` — listSessions, getCurrentSession, createSession, setCurrentSession, clearCurrentSession, updateSession, …
- `src/lib/command-activation.ts` — activateCommand, deactivateCommand, listActivatedCommands, listActivatedCommandsSync, isCommandActivated, activateAllCommands, …
- `src/lib/skill-activation.ts` — activateSkill, deactivateSkill, listActivatedSkills, isSkillActivated, listActivatedSkillsSync, activateAllSkills, …
- `src/lib/command-files.ts` — parseCommandFile, serializeCommandFile, readCommandFile, readCommandFileSync, writeCommandFile, listCommandIds, …
- `src/lib/skill-files.ts` — parseSkillFile, serializeSkillFile, readSkillFile, readSkillFileSync, writeSkillFile, listSkillIds, …
- `src/lib/wiki-plugin.ts` — getPluginStatus, ensureWikiPluginInstalledDetailed, ensureWikiBootstrappedFromPlugin, reconcileWikiWithPlugin, WikiPluginInstall, WikiBootstrapResult, …
- `src/lib/paginate.ts` — parsePaginationParams, paginateItems, PaginationParams, PaginatedResult, CACHE_HEADERS
- `src/lib/cabinets/tree.ts` — findRootCabinetNode, findNodeByPath, findDeepestCabinetNode, findParentCabinetNode
- `src/lib/embeds/detect.ts` — detectEmbed, providerLabel, DetectedEmbed, EmbedProvider
- `src/lib/google/detect.ts` — detectGoogle, googleKindLabel, GoogleLink, GoogleKind
- `src/lib/scheduled-jobs.ts` — scheduleUploadsCleanup, scheduleLogCleanup, runStartupRecovery, scheduleAutopilotPoller
- `src/lib/log-reader.ts` — isAllowedLogPath, scrubLogLines, tailFile
- `src/lib/logger.ts` — createLogger, Logger, LogLevel
- `src/lib/sync-commands.ts` — generateAgentCommandMarkdown, syncAgentCommand, syncAllAgentCommands
- `src/lib/utils.ts` — cn, generateId, parseAgentMentions
- `src/lib/api-client.ts` — apiFetch, ApiFetchInit
- `src/lib/claude-session-log.ts` — getSessionLogPath, readSessionMessages
- `src/lib/json-io.ts` — readJSON, writeJSON
- `src/lib/markdown/parse-frontmatter.ts` — parseFrontmatter, ParsedFrontmatter
- `src/lib/plugin-reader.ts` — listInstalledPlugins, PluginInfo
- `src/lib/script-entrypoints.ts` — resolveScriptEntrypoint, ScriptName
- _…and 9 more files_

## Scripts (10 files)

- `scripts/daemon/prompt-builder.ts` — buildTaskPrompt, buildScheduledPrompt, getTask, getPendingTasks, isTaskUnblocked, hasPendingDecision
- `scripts/daemon/security.ts` — validatePathWithinWorkspace, escapeFenceContent, fenceTaskData, enforcePromptLimit, validateBinary, buildSafeEnv
- `scripts/daemon/warm-sdk.ts` — appendStreamEvent, buildSdkOptions, consumeStream, runWithSdk, preheatSdk, getWarmHandle
- `scripts/daemon/active-runs.ts` — readActiveRuns, writeActiveRuns, ActiveRunEntry
- `scripts/daemon/config.ts` — loadConfig, saveConfig
- `scripts/daemon/runner.ts` — parseClaudeOutput, AgentRunner
- `scripts/daemon/runs-registry.ts` — readJsonFile, atomicWriteJson
- `scripts/daemon/data-io.ts` — readJSON
- `scripts/daemon/spawn-utils.ts` — extractSummary
- `scripts/daemon/workspace-env.ts` — getWorkspaceEnv

## Hooks (9 files)

- `src/hooks/use-data.ts` — useTasks, useInitiativeTasks, useProjects, useBrainDump, useActivityLog, useInbox, …
- `src/hooks/use-home-data.ts` — useHomeData, HomeStats, HomeData
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

## Proxy.ts (1 files)

- `src/proxy.ts` — proxy, config

## Stores (1 files)

- `src/stores/editor-store.ts` — FetchPageError, LoadStatus, useEditorStore

---
_Back to [overview.md](./overview.md)_