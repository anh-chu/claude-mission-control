# mandio — AI Context Map

> **Stack:** next-app | none | react | typescript

> 99 routes | 0 models | 102 components | 58 lib files | 24 env vars | 1 middleware | 0% test coverage
> **Token savings:** this file is ~8,500 tokens. Without it, AI exploration would cost ~112,200 tokens. **Saves ~103,700 tokens per conversation.**
> **Last scanned:** 2026-05-06 22:46 — re-run after significant changes

---

# Routes

## CRUD Resources

- **`/api/activity-log`** GET | POST | DELETE/:id → Activity-log
- **`/api/agents`** GET | POST | PUT/:id | DELETE/:id → Agent
- **`/api/brain-dump`** GET | POST | PUT/:id | DELETE/:id → Brain-dump
- **`/api/chat/session`** POST | PATCH/:id | DELETE/:id → Session
- **`/api/commands`** GET | POST | PUT/:id | DELETE/:id → Command
- **`/api/daemon`** GET | POST | PUT/:id → Daemon
- **`/api/decisions`** GET | POST | PUT/:id | DELETE/:id → Decision
- **`/api/inbox`** GET | POST | PUT/:id | DELETE/:id → Inbox
- **`/api/initiatives`** GET | POST | PUT/:id | DELETE/:id → Initiative
- **`/api/projects`** GET | POST | PUT/:id | DELETE/:id → Project
- **`/api/skills`** GET | POST | PUT/:id | DELETE/:id → Skill
- **`/api/tasks`** GET | POST | PUT/:id | DELETE/:id → Task
- **`/api/workspaces`** GET | POST | PUT/:id | DELETE/:id → Workspace

## Other Routes

- `GET` `/api/assets/[...path]` → out: { error } [cache, upload]
- `PUT` `/api/assets/[...path]` → out: { error } [cache, upload]
- `POST` `/api/brain-dump/automate` → out: { error }
- `GET` `/api/chat/messages` → out: { error } [auth, ai]
- `GET` `/api/chat` [auth, queue, ai]
- `POST` `/api/chat` [auth, queue, ai]
- `GET` `/api/claude/models` → out: { models } [db, cache, ai]
- `GET` `/api/claude/slash-commands` → out: { commands } [db, cache, ai]
- `GET` `/api/commands/activate` → out: { error }
- `POST` `/api/commands/activate` → out: { error }
- `GET` `/api/dashboard` → out: { stats } [cache]
- `POST` `/api/emergency-stop` → out: { ok, results }
- `GET` `/api/logs/app` → out: { lines, error }
- `GET` `/api/logs/daemon` → out: { lines, error }
- `GET` `/api/logs/stream` [cache, queue]
- `GET` `/api/missions` → out: { missions }
- `GET` `/api/plugins` → out: { plugins }
- `POST` `/api/projects/[id]/run` params(id) → out: { error, missionId } [queue]
- `POST` `/api/projects/[id]/stop` params(id) → out: { error }
- `GET` `/api/runs`
- `GET` `/api/runs/stream` [cache, queue]
- `GET` `/api/server-status` → out: { status }
- `GET` `/api/sidebar` → out: { tasks, unreadInbox, pendingDecisions, agents } [cache]
- `GET` `/api/skills/activate` → out: { error }
- `POST` `/api/skills/activate` → out: { error }
- `POST` `/api/sync` → out: { ok, message } [ai]
- `POST` `/api/tasks/[id]/comment` params(id) → out: { error } [auth, upload]
- `DELETE` `/api/tasks/[id]/comment` params(id) → out: { error } [auth, upload]
- `POST` `/api/tasks/[id]/run` params(id) → out: { error }
- `POST` `/api/tasks/[id]/stop` params(id) → out: { error }
- `GET` `/api/tasks/archive` → out: { data, tasks, archived, meta, filtered }
- `POST` `/api/tasks/archive` → out: { data, tasks, archived, meta, filtered }
- `PUT` `/api/tasks/bulk` → out: { error }
- `DELETE` `/api/tasks/bulk` → out: { error }
- `POST` `/api/upload/[...path]` → out: { error } [upload]
- `POST` `/api/upload` → out: { error } [upload]
- `GET` `/api/wiki/content` → out: { error }
- `PUT` `/api/wiki/content` → out: { error }
- `GET` `/api/wiki/file` → out: { error } [cache]
- `POST` `/api/wiki/folder` → out: { error }
- `POST` `/api/wiki/generate` → out: { error } [auth]
- `POST` `/api/wiki/init` → out: { error } [cache]
- `POST` `/api/wiki/move` → out: { error }
- `POST` `/api/wiki/page` → out: { error }
- `GET` `/api/wiki` → out: { error }
- `DELETE` `/api/wiki` → out: { error }
- `GET` `/api/wiki/slugs` → out: { error } [cache]
- `GET` `/api/wiki/status` → out: { installed, version }
- `POST` `/api/wiki/upload` → out: { error }
- `GET` `/uploads/[filename]` params(filename) → out: { error } [cache, upload]

---

# Components

- **CommandEditorPage** [client] — `src/app/commands/[id]/page.tsx`
- **NewCommandPage** [client] — `src/app/commands/new/page.tsx`
- **EditAgentPage** [client] — `src/app/crew/[id]/edit/page.tsx`
- **AgentPage** [client] — `src/app/crew/[id]/page.tsx`
- **CrewLoading** — `src/app/crew/loading.tsx`
- **NewAgentPage** [client] — `src/app/crew/new/page.tsx`
- **CrewPage** [client] — `src/app/crew/page.tsx`
- **BrainPage** [client] — `src/app/documents/page.tsx`
- **Error** [client] — props: error, reset — `src/app/error.tsx`
- **GlobalError** [client] — props: error, reset — `src/app/global-error.tsx`
- **InitiativeDetailPage** [client] — `src/app/initiatives/[id]/page.tsx`
- **InitiativesPage** — `src/app/initiatives/page.tsx`
- **RootLayout** — `src/app/layout.tsx`
- **HomeContentSkeleton** — `src/app/loading.tsx`
- **HomeLoading** — `src/app/loading.tsx`
- **NotFound** — `src/app/not-found.tsx`
- **CommandCenterPage** [client] — `src/app/page.tsx`
- **PriorityMatrixLoading** — `src/app/priority-matrix/loading.tsx`
- **TasksPage** [client] — `src/app/priority-matrix/page.tsx`
- **ProjectsDetailPage** — `src/app/projects/[id]/page.tsx`
- **ProjectsPage** — `src/app/projects/page.tsx`
- **SettingsPage** [client] — `src/app/settings/page.tsx`
- **SkillEditorPage** [client] — `src/app/skills/[id]/page.tsx`
- **NewSkillPage** [client] — `src/app/skills/new/page.tsx`
- **TaskDetailPage** [client] — `src/app/tasks/[id]/page.tsx`
- **AgentForm** [client] — props: mode, initialData, currentStatus, onSave, onDelete, onStatusToggle, onCancel — `src/components/agent-form.tsx`
- **DraggableTaskCard** [client] — props: task, project, onClick, isSelected, onToggleSelect, isRunning, onRun, pendingDecisionTaskIds, onStatusChange, onDuplicate — `src/components/board-view.tsx`
- **BoardColumn** [client] — props: config, tasks, projects, onTaskClick, minHeight, maxHeight, selected, onToggleSelect, runningTaskIds, onRunTask — `src/components/board-view.tsx`
- **BoardPanels** [client] — props: showCreateTask, onCloseCreate, onSubmitCreate — `src/components/board-view.tsx`
- **BoardDndWrapper** [client] — props: activeTask, projects, onDragStart, onDragEnd — `src/components/board-view.tsx`
- **BreadcrumbNav** [client] — props: items, className — `src/components/breadcrumb-nav.tsx`
- **AssistantThread** [client] — props: cwd, context, model, persona, workspaceId — `src/components/chat/AssistantThread.tsx`
- **ChatSidebar** [client] — props: open, onToggle, isMobile — `src/components/chat/ChatSidebar.tsx`
- **DaemonRunViewer** [client] — props: runId — `src/components/chat/DaemonRunViewer.tsx`
- **ReadToolUI** [client] — `src/components/chat/tool-uis.tsx`
- **CommandBar** [client] — props: onCapture, tasks, onTaskClick, commands — `src/components/command-bar.tsx`
- **CommandForm** [client] — props: mode, initialData, onDelete, activationProps — `src/components/command-form.tsx`
- **ConfirmDialog** [client] — props: open, onOpenChange, title, description, confirmLabel, onConfirm, variant — `src/components/confirm-dialog.tsx`
- **AgentContextMenuContent** [client] — props: agent, href, onEdit, onNewTask, onToggleStatus — `src/components/context-menus/agent-context-menu.tsx`
- **InitiativeContextMenuContent** [client] — props: initiative, onTogglePause, onArchive, onDelete — `src/components/context-menus/initiative-context-menu.tsx`
- **ProjectContextMenuContent** [client] — props: project, href, onRun, onArchive, onDelete — `src/components/context-menus/project-context-menu.tsx`
- **TaskContextMenuContent** [client] — props: task, onOpen, onStatusChange, onDuplicate, onRun, onDelete — `src/components/context-menus/task-context-menu.tsx`
- **CreateTaskDialog** [client] — props: open, onOpenChange, onSubmit, defaultValues — `src/components/create-task-dialog.tsx`
- **CrewAutopilot** [client] — `src/components/crew-autopilot.tsx`
- **CrewSkills** [client] — `src/components/crew-skills.tsx`
- **DecisionDialog** [client] — props: open, onOpenChange, decision, onAnswered — `src/components/decision-dialog.tsx`
- **EditorBubbleMenu** [client] — props: editor — `src/components/editor/bubble-menu.tsx`
- **CsvViewer** [client] — props: path — `src/components/editor/csv-viewer.tsx`
- **EditorToolbar** [client] — props: editor — `src/components/editor/editor-toolbar.tsx`
- **KBEditor** [client] — `src/components/editor/editor.tsx`
- **ResizableImage** [client] — `src/components/editor/extensions/resizable-image.tsx`
- **FileFallbackViewer** [client] — props: path — `src/components/editor/file-fallback-viewer.tsx`
- **FolderIndex** [client] — props: folderPath, entries — `src/components/editor/folder-index.tsx`
- **GoogleDocViewer** [client] — props: path, title, google — `src/components/editor/google-doc-viewer.tsx`
- **ImageViewer** [client] — props: path, title — `src/components/editor/image-viewer.tsx`
- **LinkPopover** [client] — props: anchor, initialUrl, onCancel, onApply, onRemove — `src/components/editor/link-popover.tsx`
- **MediaPopover** [client] — props: kind, pagePath, onCancel, onInsert, anchor — `src/components/editor/media-popover.tsx`
- **MediaViewer** [client] — props: path, type — `src/components/editor/media-viewer.tsx`
- **MermaidViewer** [client] — props: path, title — `src/components/editor/mermaid-viewer.tsx`
- **NotebookViewer** [client] — props: path — `src/components/editor/notebook-viewer.tsx`
- **DocxViewer** [client] — props: path, title — `src/components/editor/office/docx-viewer.tsx`
- **OfficeChrome** [client] — props: path, extLabel, external, hideFinder — `src/components/editor/office/office-chrome.tsx`
- **PptxViewer** [client] — props: path, title — `src/components/editor/office/pptx-viewer.tsx`
- **XlsxViewer** [client] — props: path, title — `src/components/editor/office/xlsx-viewer.tsx`
- **PdfViewer** [client] — props: path, title — `src/components/editor/pdf-viewer.tsx`
- **SlashCommands** [client] — props: editor — `src/components/editor/slash-commands.tsx`
- **SourceViewer** [client] — props: path — `src/components/editor/source-viewer.tsx`
- **TableMenu** [client] — props: editor — `src/components/editor/table-menu.tsx`
- **WebsiteViewer** [client] — props: path, title, fullscreen, onExit — `src/components/editor/website-viewer.tsx`
- **DIRS** [client] — `src/components/editor/wiki-link-create-dialog.tsx`
- **WikiLinkPicker** [client] — props: editor, onCreateRequest — `src/components/editor/wiki-link-picker.tsx`
- **EmptyState** — props: Icon, title, description, actionLabel, onAction, className, compact — `src/components/empty-state.tsx`
- **ErrorState** — props: message, onRetry, className, compact — `src/components/error-state.tsx`
- **HomeActivity** [client] — `src/components/home-activity.tsx`
- **HomeInbox** [client] — `src/components/home-inbox.tsx`
- **HomeLogs** [client] — `src/components/home-logs.tsx`
- **KeyboardShortcuts** [client] — props: onCreateTask — `src/components/keyboard-shortcuts.tsx`
- **ViewerToolbar** [client] — props: path, badge, sublabel, _showBreadcrumb, leading, className — `src/components/layout/viewer-toolbar.tsx`
- **LayoutShell** [client] — `src/components/layout-shell.tsx`
- **MarkdownContent** [client] — props: content, className — `src/components/markdown-content.tsx`
- **MentionTextarea** [client] — props: value, onChange, agents, placeholder, className, onSubmit, stagedFiles, onFilesChange — `src/components/mention-textarea.tsx`
- **ProjectRunProgress** [client] — props: projectRun, runs, onStop — `src/components/mission-progress.tsx`
- **ModelSelect** [client] — props: value, onChange, className — `src/components/model-select.tsx`
- **ProjectCardLarge** [client] — props: project, tasks, isRunning, isProjectRunActive, onRun, onStop, onArchive, onDelete — `src/components/project-card-large.tsx`
- **ProjectDetailPage** [client] — props: parentLabel, parentHref — `src/components/project-detail-page.tsx`
- **ProjectDialog** [client] — props: open, onOpenChange, agents, onSubmit — `src/components/project-dialog.tsx`
- **ProjectInitiativeCanvas** [client] — `src/components/project-initiative-canvas.tsx`
- **RunButton** [client] — props: isRunning, onClick, size, disabled, title, isProjectRunActive, onStop — `src/components/run-button.tsx`
- **SearchDialog** [client] — `src/components/search-dialog.tsx`
- **CardSkeleton** — props: className, lines, footer, footerClassName, childrenPosition — `src/components/skeletons.tsx`
- **RowSkeleton** — props: className, leading, lines, trailing, linesClassName, trailingClassName — `src/components/skeletons.tsx`
- **GridSkeleton** — props: className, count, renderItem — `src/components/skeletons.tsx`
- **PageSkeleton** — props: className — `src/components/skeletons.tsx`
- **SkillForm** [client] — props: mode, initialData, onDelete, activationProps — `src/components/skill-form.tsx`
- **TaskCard** [client] — props: task, project, agents, className, isDragging, onClick, allTasks, pendingDecisionTaskIds, isRunning, onRun — `src/components/task-card.tsx`
- **TaskForm** [client] — props: initial, allTasks, currentTaskId, onSubmit, onCancel, submitLabel — `src/components/task-form.tsx`
- **ThemeProvider** [client] — `src/components/theme-provider.tsx`
- **ThemeToggle** [client] — `src/components/theme-toggle.tsx`
- **TopNav** [client] — `src/components/top-nav.tsx`
- **FrontmatterHeader** [client] — props: data — `src/components/wiki/frontmatter-header.tsx`
- **WorkMapView** [client] — `src/components/work-map-view.tsx`
- **ActiveRunsProvider** [client] — `src/providers/active-runs-provider.tsx`

---

# Libraries

- `bin/bootstrap.ts` — function bootstrapDataDir: () => Promise<void>
- `bin/checks.ts`
  - function checkNodeVersion: (minVersion) => boolean
  - function checkClaudeCLI: () => boolean
  - function checkPortAvailable: (port) => Promise<boolean>
  - function checkDataDirWritable: (dataDir) => boolean
- `scripts/daemon/active-runs.ts`
  - function readActiveRuns: (filePath) => void
  - function writeActiveRuns: (filePath, data) => void
  - interface ActiveRunEntry
- `scripts/daemon/config.ts` — function loadConfig: (workspaceId) => DaemonConfig, function saveConfig: (config, workspaceId) => void
- `scripts/daemon/data-io.ts` — function readJSON: (filePath) => T | null
- `scripts/daemon/prompt-builder.ts`
  - function buildTaskPrompt: (agentId, task, missionId?, workspaceId) => string
  - function buildScheduledPrompt: (command, workspaceId) => string
  - function getTask: (taskId) => TaskDef | null
  - function getPendingTasks: () => TaskDef[]
  - function isTaskUnblocked: (task) => boolean
  - function hasPendingDecision: (taskId) => boolean
- `scripts/daemon/runner.ts` — function parseClaudeOutput: (stdout) => ClaudeOutputMeta, class AgentRunner
- `scripts/daemon/runs-registry.ts` — function readJsonFile: (filePath, defaultValue) => T, function atomicWriteJson: (filePath, data) => void
- `scripts/daemon/security.ts`
  - function validatePathWithinWorkspace: (filePath, workspaceRoot) => boolean
  - function escapeFenceContent: (content) => string
  - function fenceTaskData: (taskData) => string
  - function enforcePromptLimit: (prompt) => string
  - function validateBinary: (binary) => boolean
  - function buildSafeEnv: (opts?) => Record<string, string>
- `scripts/daemon/spawn-utils.ts` — function extractSummary: (stdout) => string
- `scripts/daemon/warm-sdk.ts`
  - function appendStreamEvent: (streamFile, event) => void
  - function buildSdkOptions: (opts) => void
  - function consumeStream: (stream, streamFile) => Promise<
  - function runWithSdk: (opts) => Promise<
  - function preheatSdk: (opts) => Promise<void>
  - function getWarmHandle: (expectedKey) => WarmQuery | null
- `scripts/daemon/workspace-env.ts` — function getWorkspaceEnv: (workspaceId) => Record<string, string>
- `src/hooks/use-active-runs.ts` — function useActiveRuns: () => void
- `src/hooks/use-connection.ts` — function useConnection: () => void
- `src/hooks/use-daemon.ts` — function useDaemon: () => DaemonData
- `src/hooks/use-data.ts`
  - function useTasks: () => void
  - function useInitiativeTasks: (initiativeId) => void
  - function useProjects: () => void
  - function useBrainDump: () => void
  - function useActivityLog: () => void
  - function useInbox: () => void
  - _...6 more_
- `src/hooks/use-fast-task-poll.ts` — function useFastTaskPoll: (hasRunningTasks, refetchTasks) => void
- `src/hooks/use-home-data.ts`
  - function useHomeData: () => void
  - interface HomeStats
  - interface HomeData
- `src/hooks/use-processing-entries.ts` — function useProcessingEntries: (entries) => void
- `src/hooks/use-sidebar.ts` — function useSidebar: () => void
- `src/hooks/use-workspace.ts` — function useWorkspace: () => void
- `src/instrumentation.ts` — function register: () => void
- `src/lib/agent-icons.ts` — function getAgentIcon: (agentId, iconName?) => LucideIcon
- `src/lib/api-client.ts` — function apiFetch: (url, init?) => Promise<Response>, interface ApiFetchInit
- `src/lib/cabinets/tree.ts`
  - function findRootCabinetNode: (nodes) => TreeNode | null
  - function findNodeByPath: (nodes, path) => TreeNode | null
  - function findDeepestCabinetNode: (nodes, targetPath) => TreeNode | null
  - function findParentCabinetNode: (nodes, cabinetPath, cabinetAncestor) => TreeNode | null
- `src/lib/chat-sessions.ts`
  - function listSessions: (workspaceId, context?) => SessionEntry[]
  - function getCurrentSession: (workspaceId, context?) => SessionEntry | null
  - function createSession: (workspaceId, context?) => SessionEntry
  - function setCurrentSession: (workspaceId, context, id) => SessionEntry | null
  - function clearCurrentSession: (workspaceId, context) => void
  - function updateSession: (workspaceId, context, id, patch) => SessionEntry | null
  - _...6 more_
- `src/lib/claude-sdk.ts` — function resolveClaudeExecutable: () => string | null
- `src/lib/claude-session-log.ts` — function getSessionLogPath: (cwd, sessionId) => string, function readSessionMessages: (cwd, sessionId) => UIMessage[]
- `src/lib/command-activation.ts`
  - function activateCommand: (workspaceId, commandId) => Promise<void>
  - function deactivateCommand: (workspaceId, commandId) => Promise<void>
  - function listActivatedCommands: (workspaceId) => Promise<string[]>
  - function listActivatedCommandsSync: (workspaceId) => string[]
  - function isCommandActivated: (workspaceId, commandId) => Promise<boolean>
  - function activateAllCommands: (workspaceId) => Promise<void>
  - _...6 more_
- `src/lib/command-files.ts`
  - function parseCommandFile: (id, raw) => Omit<CommandFileData, "createdAt" | "updatedAt">
  - function serializeCommandFile: (cmd, "createdAt" | "updatedAt">) => string
  - function readCommandFile: (cmdDir) => Promise<CommandFileData | null>
  - function readCommandFileSync: (cmdDir) => CommandFileData | null
  - function writeCommandFile: (cmdDir, cmd, "createdAt" | "updatedAt">) => Promise<void>
  - function listCommandIds: (baseDir) => Promise<string[]>
  - _...5 more_
- `src/lib/data.ts`
  - function setCurrentWorkspace: (id) => void
  - function ensureSkillsMigrated: (workspaceId) => Promise<void>
  - function getWorkspaceDataDir: (workspaceId) => string
  - function ensureWorkspaceDir: (workspaceId) => Promise<void>
  - function initWikiDir: (workspaceId) => Promise<void>
  - function ensureDocMaintainerAgentForWorkspace: (workspaceId) => Promise<void>
  - _...33 more_
- `src/lib/embeds/detect.ts`
  - function detectEmbed: (raw) => DetectedEmbed | null
  - function providerLabel: (p) => string
  - interface DetectedEmbed
  - type EmbedProvider
- `src/lib/google/detect.ts`
  - function detectGoogle: (rawUrl) => GoogleLink | null
  - function googleKindLabel: (kind) => string
  - interface GoogleLink
  - type GoogleKind
- `src/lib/json-io.ts` — function readJSON: (file) => T | null, function writeJSON: (file, data) => void
- `src/lib/log-reader.ts`
  - function isAllowedLogPath: (filePath) => boolean
  - function scrubLogLines: (lines) => string[]
  - function tailFile: (filePath, lines, search?) => Promise<string[]>
- `src/lib/logger.ts`
  - function createLogger: (processName, opts) => Logger
  - interface Logger
  - type LogLevel
- `src/lib/markdown/parse-frontmatter.ts` — function parseFrontmatter: (text) => ParsedFrontmatter, interface ParsedFrontmatter
- `src/lib/markdown/to-html.ts` — function markdownToHtml: (markdown, pagePath?) => Promise<string>
- `src/lib/markdown/to-markdown.ts` — function htmlToMarkdown: (html) => string
- `src/lib/paginate.ts`
  - function parsePaginationParams: (searchParams) => PaginationParams
  - function paginateItems: (items, {...}, offset }, total) => PaginatedResult<T>
  - interface PaginationParams
  - interface PaginatedResult
  - const CACHE_HEADERS
- `src/lib/paths.ts`
  - function assertSafeId: (id) => void
  - function getWorkspaceDir: (workspaceId) => string
  - function getUploadsDir: (workspaceId) => string
  - function getWikiPathFile: (workspaceId) => string
  - function getWikiDir: (workspaceId) => string
  - function getDefaultWikiDir: (workspaceId) => string
  - _...16 more_
- `src/lib/plugin-reader.ts` — function listInstalledPlugins: (projectDir?) => Promise<PluginInfo[]>, interface PluginInfo
- `src/lib/process-utils.ts` — function isProcessAlive: (pid, assumeAliveIfZero) => boolean
- `src/lib/scheduled-jobs.ts`
  - function scheduleUploadsCleanup: () => void
  - function scheduleLogCleanup: () => void
  - function runStartupRecovery: () => Promise<void>
  - function scheduleAutopilotPoller: () => void
- `src/lib/script-entrypoints.ts` — function resolveScriptEntrypoint: (name) => void, type ScriptName
- `src/lib/scrub.ts` — function scrubCredentials: (text) => string
- `src/lib/skill-activation.ts`
  - function activateSkill: (workspaceId, skillId) => Promise<void>
  - function deactivateSkill: (workspaceId, skillId) => Promise<void>
  - function listActivatedSkills: (workspaceId) => Promise<string[]>
  - function isSkillActivated: (workspaceId, skillId) => Promise<boolean>
  - function listActivatedSkillsSync: (workspaceId) => string[]
  - function activateAllSkills: (workspaceId) => Promise<void>
  - _...6 more_
- `src/lib/skill-files.ts`
  - function parseSkillFile: (id, raw) => Omit<SkillFileData, "createdAt" | "updatedAt">
  - function serializeSkillFile: (skill, "createdAt" | "updatedAt">) => string
  - function readSkillFile: (skillDir) => Promise<SkillFileData | null>
  - function readSkillFileSync: (skillDir) => SkillFileData | null
  - function writeSkillFile: (skillDir, skill, "createdAt" | "updatedAt">) => Promise<void>
  - function listSkillIds: (skillsBaseDir) => Promise<string[]>
  - _...5 more_
- `src/lib/sync-commands.ts`
  - function generateAgentCommandMarkdown: (agent, linkedSkills) => string
  - function syncAgentCommand: (agent, workspaceId) => Promise<void>
  - function syncAllAgentCommands: (workspaceId) => Promise<void>
- `src/lib/toast.ts` — function showSuccess: (message, options?) => void, function showError: (message, options?) => void
- `src/lib/types.ts`
  - function getQuadrant: (task) => EisenhowerQuadrant
  - function valuesFromQuadrant: (quadrant) => void
  - interface AgentDefinition
  - interface AgentsFile
  - interface SkillDefinition
  - interface LegacySkillDefinition
  - _...45 more_
- `src/lib/utils.ts`
  - function cn: (...inputs) => void
  - function generateId: (prefix) => string
  - function parseAgentMentions: (text) => string[]
- `src/lib/validations.ts`
  - function validateBody: (request, schema) => Promise<ValidationResult<T>>
  - const safeId
  - const DEFAULT_LIMIT
  - const LIMITS
  - const commentSchema
  - const taskCreateSchema
  - _...21 more_
- `src/lib/wiki-helpers.ts` — function isAppFolder: (wikiDir, relPath) => Promise<boolean>
- `src/lib/wiki-plugin.ts`
  - function getPluginStatus: (cwd) => void
  - function ensureWikiPluginInstalledDetailed: (cwd, options?) => WikiPluginInstall
  - function ensureWikiBootstrappedFromPlugin: (wikiDir, pluginInstallPath, domain, options?) => WikiBootstrapResult
  - function reconcileWikiWithPlugin: (wikiDir, pluginInstallPath) => WikiReconcileResult
  - interface WikiPluginInstall
  - interface WikiBootstrapResult
  - _...3 more_
- `src/lib/workspace-context.ts` — function applyWorkspaceContext: () => Promise<string>
- `src/proxy.ts` — function proxy: (request) => void, const config
- `src/stores/editor-store.ts`
  - class FetchPageError
  - type LoadStatus
  - const useEditorStore

---

# Config

## Environment Variables

- `API_KEY` **required** — __tests__/daemon.test.ts
- `APPDATA` **required** — scripts/daemon/runner.ts
- `CLAUDE_CODE_EXECUTABLE` **required** — src/lib/claude-sdk.ts
- `CLAUDE_CODE_OAUTH_TOKEN` **required** — scripts/daemon/security.ts
- `COMSPEC` **required** — scripts/daemon/security.ts
- `HOME` **required** — scripts/daemon/runner.ts
- `LOCALAPPDATA` **required** — scripts/daemon/runner.ts
- `MANDIO_API_TOKEN` **required** — src/proxy.ts
- `MANDIO_BOOTSTRAP_STANDALONE` **required** — bin/bootstrap.ts
- `MANDIO_DATA_DIR` **required** — __tests__/chat-sessions.test.ts
- `MANDIO_INSTALL_DIR` **required** — src/lib/paths.ts
- `MANDIO_WORKSPACE_ID` **required** — scripts/daemon/prompt-builder.ts
- `NEXT_PUBLIC_MANDIO_API_TOKEN` **required** — src/lib/api-client.ts
- `NEXT_RUNTIME` **required** — src/instrumentation.ts
- `NODE_ENV` **required** — src/instrumentation.ts
- `P` **required** — scripts/daemon/security.ts
- `PATH` **required** — scripts/daemon/security.ts
- `PATHEXT` **required** — scripts/daemon/security.ts
- `S` **required** — scripts/daemon/security.ts
- `SYSTEMROOT` **required** — scripts/daemon/security.ts
- `TEMP` **required** — scripts/daemon/security.ts
- `TMP` **required** — scripts/daemon/security.ts
- `USERPROFILE` **required** — scripts/daemon/runner.ts
- `WINDIR` **required** — scripts/daemon/security.ts

## Config Files

- `.env.example`
- `next.config.ts`
- `tailwind.config.ts`
- `tsconfig.json`

## Key Dependencies

- ai: ^6.0.174
- next: 16.2.4
- react: 19.2.5
- zod: ^4.3.6

---

# Middleware

## custom
- generate-context — `scripts/generate-context.ts`

---

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

---

# Test Coverage

> **0%** of routes and models are covered by tests
> 11 test files found

---

_Generated by [codesight](https://github.com/Houseofmvps/codesight) — see your codebase clearly_