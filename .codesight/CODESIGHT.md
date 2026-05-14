# mandio — AI Context Map

> **Stack:** next-app | none | react | typescript

> 103 routes (3 inferred) + 3 ws | 0 models | 122 components | 71 lib files | 41 env vars | 9 middleware | 5 events | 17% test coverage
> **Token savings:** this file is ~10,700 tokens. Without it, AI exploration would cost ~130,000 tokens. **Saves ~119,300 tokens per conversation.**
> **Last scanned:** 2026-05-14 19:53 — re-run after significant changes

---

# Routes

## CRUD Resources

- **`/api/activity-log`** GET | POST | DELETE/:id → Activity-log
- **`/api/agents`** GET | POST | PUT/:id | DELETE/:id → Agent
- **`/api/brain-dump`** GET | POST | PUT/:id | DELETE/:id → Brain-dump
- **`/api/commands`** GET | POST | PUT/:id | DELETE/:id → Command
- **`/api/conversations/[id]`** GET | PATCH/:id | DELETE/:id → [id]
- **`/api/daemon`** GET | POST | PUT/:id → Daemon
- **`/api/decisions`** GET | POST | PUT/:id | DELETE/:id → Decision
- **`/api/inbox`** GET | POST | PUT/:id | DELETE/:id → Inbox
- **`/api/initiatives`** GET | POST | PUT/:id | DELETE/:id → Initiative
- **`/api/projects`** GET | POST | PUT/:id | DELETE/:id → Project
- **`/api/skills`** GET | POST | PUT/:id | DELETE/:id → Skill
- **`/api/tasks`** GET | POST | PUT/:id | DELETE/:id → Task
- **`/api/workspaces`** GET | POST | PUT/:id | DELETE/:id → Workspace

## Other Routes

- `GET` `/api/assets/[...path]` → out: { error } [auth, cache, upload]
- `PUT` `/api/assets/[...path]` → out: { error } [auth, cache, upload]
- `POST` `/api/brain-dump/automate` → out: { error } [auth]
- `GET` `/api/claude/models` → out: { models } [auth, db, cache, ai]
- `GET` `/api/claude/slash-commands` → out: { commands } [auth, db, cache, ai]
- `GET` `/api/commands/activate` → out: { error } [auth]
- `POST` `/api/commands/activate` → out: { error } [auth]
- `POST` `/api/conversations/[id]/cancel` params(id) → out: { error } [auth]
- `POST` `/api/conversations/[id]/continue` params(id) → out: { error } [auth, queue]
- `GET` `/api/conversations/[id]/events` params(id) [auth, cache, queue]
- `GET` `/api/conversations` → out: { conversations } [auth] ✓
- `POST` `/api/conversations` → out: { conversations } [auth] ✓
- `GET` `/api/dashboard` → out: { stats } [auth, cache]
- `POST` `/api/emergency-stop` → out: { ok, results } [auth]
- `GET` `/api/logs/app` → out: { lines, error } [auth]
- `GET` `/api/logs/daemon` → out: { lines, error } [auth]
- `GET` `/api/logs/stream` [auth, cache, queue]
- `GET` `/api/missions` → out: { missions } [auth]
- `GET` `/api/plugins` → out: { plugins } [auth]
- `POST` `/api/projects/[id]/run` params(id) → out: { error, missionId } [auth, queue]
- `POST` `/api/projects/[id]/stop` params(id) → out: { error } [auth]
- `GET` `/api/runs/[id]` params(id) → out: { error } [auth]
- `GET` `/api/runs` → out: { runs } [auth]
- `GET` `/api/server-status` → out: { status } ✓
- `GET` `/api/sidebar` → out: { tasks, unreadInbox, pendingDecisions, agents } [auth, cache]
- `GET` `/api/skills/activate` → out: { error } [auth]
- `POST` `/api/skills/activate` → out: { error } [auth]
- `POST` `/api/sync` → out: { ok, message } [auth, ai]
- `POST` `/api/tasks/[id]/comment` params(id) → out: { error } [auth, upload]
- `DELETE` `/api/tasks/[id]/comment` params(id) → out: { error } [auth, upload]
- `POST` `/api/tasks/[id]/run` params(id) → out: { error } [auth]
- `POST` `/api/tasks/[id]/stop` params(id) → out: { error } [auth]
- `GET` `/api/tasks/archive` → out: { data, tasks, archived, meta, filtered } [auth]
- `POST` `/api/tasks/archive` → out: { data, tasks, archived, meta, filtered } [auth]
- `PUT` `/api/tasks/bulk` → out: { error } [auth]
- `DELETE` `/api/tasks/bulk` → out: { error } [auth]
- `POST` `/api/upload/[...path]` → out: { error } [auth, upload]
- `POST` `/api/upload` → out: { error } [auth, upload]
- `POST` `/api/webhooks` → out: { error } [auth, queue, payment]
- `GET` `/api/wiki/content` → out: { error } [auth]
- `PUT` `/api/wiki/content` → out: { error } [auth]
- `GET` `/api/wiki/file` → out: { error } [auth, cache]
- `POST` `/api/wiki/folder` → out: { error } [auth]
- `POST` `/api/wiki/generate` → out: { error } [auth]
- `POST` `/api/wiki/init` → out: { error } [auth, cache]
- `GET` `/api/wiki/latest-version` → out: { installedVersion, latestVersion, hasUpdate } [auth, cache]
- `POST` `/api/wiki/move` → out: { error } [auth]
- `POST` `/api/wiki/page` → out: { error } [auth]
- `GET` `/api/wiki` → out: { error } [auth]
- `DELETE` `/api/wiki` → out: { error } [auth]
- `GET` `/api/wiki/slugs` → out: { error } [auth, cache]
- `GET` `/api/wiki/status` → out: { installed, version } [auth]
- `POST` `/api/wiki/upload` → out: { error } [auth]
- `GET` `/uploads/[filename]` params(filename) → out: { error } [auth, cache, upload]

## WebSocket Events

- `WS` `pong` — `src/lib/terminal/ws-bridge.ts`
- `WS` `message` — `src/lib/terminal/ws-bridge.ts`
- `WS` `close` — `src/lib/terminal/ws-bridge.ts`

---

# Components

- **EditAgentPage** [client] — `src/app/agents/[id]/edit/page.tsx`
- **AgentPage** [client] — `src/app/agents/[id]/page.tsx`
- **AgentsLoading** — `src/app/agents/loading.tsx`
- **NewAgentPage** [client] — `src/app/agents/new/page.tsx`
- **AgentsPage** [client] — `src/app/agents/page.tsx`
- **BrainPage** [client] — `src/app/brain/page.tsx`
- **CommandEditorPage** [client] — `src/app/commands/[id]/page.tsx`
- **NewCommandPage** [client] — `src/app/commands/new/page.tsx`
- **Error** [client] — props: error, reset — `src/app/error.tsx`
- **GlobalError** [client] — props: error, reset — `src/app/global-error.tsx`
- **InitiativeDetailPage** [client] — `src/app/initiatives/[id]/page.tsx`
- **InitiativesPage** — `src/app/initiatives/page.tsx`
- **RootLayout** — `src/app/layout.tsx`
- **HomeContentSkeleton** — `src/app/loading.tsx`
- **HomeLoading** — `src/app/loading.tsx`
- **LoginPage** [client] — `src/app/login/page.tsx`
- **NotFound** — `src/app/not-found.tsx`
- **CommandCenterPage** [client] — `src/app/page.tsx`
- **PriorityMatrixLoading** — `src/app/priority-matrix/loading.tsx`
- **TasksPage** [client] — `src/app/priority-matrix/page.tsx`
- **ProjectsDetailPage** — `src/app/projects/[id]/page.tsx`
- **ProjectsPage** — `src/app/projects/page.tsx`
- **SettingsPage** [client] — `src/app/settings/page.tsx`
- **WorkspaceSettingsPage** [client] — `src/app/settings/workspaces/[id]/page.tsx`
- **WorkspacesPage** [client] — `src/app/settings/workspaces/page.tsx`
- **SkillEditorPage** [client] — `src/app/skills/[id]/page.tsx`
- **NewSkillPage** [client] — `src/app/skills/new/page.tsx`
- **TaskDetailPage** [client] — `src/app/tasks/[id]/page.tsx`
- **WorkInitiativesPage** [client] — `src/app/work/initiatives/page.tsx`
- **PriorityMatrixLoading** — `src/app/work/loading.tsx`
- **MapLoading** — `src/app/work/map/loading.tsx`
- **MapPage** [client] — `src/app/work/map/page.tsx`
- **TasksPage** [client] — `src/app/work/page.tsx`
- **WorkProjectsPage** [client] — `src/app/work/projects/page.tsx`
- **ActivityRail** [client] — props: active, onSelect — `src/components/activity-rail.tsx`
- **AgentForm** [client] — props: mode, initialData, currentStatus, onSave, onDelete, onStatusToggle, onCancel — `src/components/agent-form.tsx`
- **AgentSkills** [client] — `src/components/agent-skills.tsx`
- **AuthProvider** [client] — `src/components/auth-provider.tsx`
- **AutopilotPage** [client] — `src/components/autopilot-page.tsx`
- **DraggableTaskCard** [client] — props: task, project, onClick, isSelected, onToggleSelect, isRunning, onRun, pendingDecisionTaskIds, onStatusChange, onDuplicate — `src/components/board-view.tsx`
- **BoardColumn** [client] — props: config, tasks, projects, onTaskClick, minHeight, maxHeight, selected, onToggleSelect, runningTaskIds, onRunTask — `src/components/board-view.tsx`
- **BoardPanels** [client] — props: showCreateTask, onCloseCreate, onSubmitCreate — `src/components/board-view.tsx`
- **BoardDndWrapper** [client] — props: activeTask, projects, onDragStart, onDragEnd — `src/components/board-view.tsx`
- **BreadcrumbNav** [client] — props: items, className, peers — `src/components/breadcrumb-nav.tsx`
- **ChatSidebar** [client] — `src/components/chat/ChatSidebar.tsx`
- **CommandBar** [client] — props: onCapture, tasks, onTaskClick, commands, onTerminalToggle — `src/components/command-bar.tsx`
- **CommandForm** [client] — props: mode, initialData, onDelete, activationProps — `src/components/command-form.tsx`
- **ConditionalShell** [client] — `src/components/conditional-shell.tsx`
- **ConfirmDialog** [client] — props: open, onOpenChange, title, description, confirmLabel, onConfirm, variant — `src/components/confirm-dialog.tsx`
- **AgentContextMenuContent** [client] — props: agent, href, onEdit, onNewTask, onToggleStatus — `src/components/context-menus/agent-context-menu.tsx`
- **InitiativeContextMenuContent** [client] — props: initiative, onTogglePause, onArchive, onDelete — `src/components/context-menus/initiative-context-menu.tsx`
- **ProjectContextMenuContent** [client] — props: project, href, onRun, onArchive, onDelete — `src/components/context-menus/project-context-menu.tsx`
- **TaskContextMenuContent** [client] — props: task, onOpen, onStatusChange, onDuplicate, onRun, onDelete — `src/components/context-menus/task-context-menu.tsx`
- **ConversationComposer** [client] — props: conversationId, disabled, placeholder, onSent, onOptimisticTurn — `src/components/conversation/ConversationComposer.tsx`
- **ConversationList** [client] — props: currentId, onSelect, taskId, source, onConversationsChange, onConversationDeleted — `src/components/conversation/ConversationList.tsx`
- **ConversationStatusBadge** — props: status, className — `src/components/conversation/ConversationStatusBadge.tsx`
- **ConversationView** [client] — props: conversationId, embed — `src/components/conversation/ConversationView.tsx`
- **DecisionPanel** [client] — props: conversation — `src/components/conversation/DecisionPanel.tsx`
- **ToolCallCard** [client] — props: toolCall, onRetry — `src/components/conversation/ToolCallCard.tsx`
- **TurnBlock** [client] — props: turn, compact — `src/components/conversation/TurnBlock.tsx`
- **CreateTaskDialog** [client] — props: open, onOpenChange, onSubmit, defaultValues — `src/components/create-task-dialog.tsx`
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
- **FilterBar** [client] — props: search, filters, onClear, className — `src/components/filter-bar.tsx`
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
- **RightPanel** [client] — props: activePanel, isMobile, onClose — `src/components/right-panel.tsx`
- **RunButton** [client] — props: isRunning, onClick, size, disabled, title, isProjectRunActive, onStop — `src/components/run-button.tsx`
- **RunsFeed** [client] — `src/components/runs-feed.tsx`
- **SearchDialog** [client] — `src/components/search-dialog.tsx`
- **CardSkeleton** — props: className, lines, footer, footerClassName, childrenPosition — `src/components/skeletons.tsx`
- **RowSkeleton** — props: className, leading, lines, trailing, linesClassName, trailingClassName — `src/components/skeletons.tsx`
- **GridSkeleton** — props: className, count, renderItem — `src/components/skeletons.tsx`
- **PageSkeleton** — props: className — `src/components/skeletons.tsx`
- **SkillForm** [client] — props: mode, initialData, onDelete, activationProps — `src/components/skill-form.tsx`
- **TaskCard** [client] — props: task, project, agents, className, isDragging, onClick, allTasks, pendingDecisionTaskIds, isRunning, onRun — `src/components/task-card.tsx`
- **TaskForm** [client] — props: initial, allTasks, currentTaskId, onSubmit, onCancel, submitLabel — `src/components/task-form.tsx`
- **TerminalDrawer** [client] — props: enabled — `src/components/terminal-drawer.tsx`
- **ThemeProvider** [client] — `src/components/theme-provider.tsx`
- **ThemeToggle** [client] — `src/components/theme-toggle.tsx`
- **TopNav** [client] — props: onTerminalToggle — `src/components/top-nav.tsx`
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
- `scripts/daemon/conversation-writer.ts`
  - function __resetWriterState: () => void
  - function startConversationForTask: (params) => Promise<ConversationContext>
  - function attachPidToRun: (ctx, pid) => Promise<void>
  - function appendUserTurn: (ctx, content) => Promise<void>
  - function pauseForDecision: (ctx, decisionId, reason, claudeSessionId) => Promise<void>
  - function completeConversation: (ctx, result) => Promise<void>
  - _...5 more_
- `scripts/daemon/data-io.ts` — function readJSON: (filePath) => T | null
- `scripts/daemon/prompt-builder.ts`
  - function buildTaskPrompt: (agentId, task, missionId?, workspaceId) => string
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
- `scripts/daemon/workspace-settings.ts` — function readWorkspaceSettingsSync: (workspaceId) => WorkspaceSettings | null
- `src/hooks/use-active-runs.ts` — function useActiveRuns: () => void
- `src/hooks/use-connection.ts` — function useConnection: () => void
- `src/hooks/use-conversation-stream.ts`
  - function conversationReducer: (state, action) => ConversationReducerState
  - function useConversationStream: (conversationId) => ConversationStreamState &
  - interface ConversationReducerState
  - interface ConversationStreamState
  - const initialReducerState: ConversationReducerState
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
- `src/hooks/use-terminal-ws.ts`
  - function useTerminalWS: (enabled) => UseTerminalWSResult
  - interface UseTerminalWSResult
  - type TerminalStatus
- `src/hooks/use-workspace.ts` — function useWorkspace: () => void
- `src/instrumentation.ts` — function register: () => void
- `src/lib/agent-icons.ts` — function getAgentIcon: (agentId, iconName?) => LucideIcon
- `src/lib/api-client.ts` — function apiFetch: (url, init?) => Promise<Response>, interface ApiFetchInit
- `src/lib/auth-email-allowlist.ts` — function isEmailAllowed: (email) => boolean
- `src/lib/auth-guards.ts` — function requireSession: () => Promise<Response | null>
- `src/lib/auth-paths.ts` — function isPublicPath: (pathname) => boolean
- `src/lib/cabinets/tree.ts`
  - function findRootCabinetNode: (nodes) => TreeNode | null
  - function findNodeByPath: (nodes, path) => TreeNode | null
  - function findDeepestCabinetNode: (nodes, targetPath) => TreeNode | null
  - function findParentCabinetNode: (nodes, cabinetPath, cabinetAncestor) => TreeNode | null
- `src/lib/claude-sdk.ts` — function resolveClaudeExecutable: () => string | null
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
- `src/lib/command-prompt.ts`
  - function buildScheduledTask: (command, description, agentId?) => void
  - function loadCommandPrompt: (command, workspaceId) => CommandPromptResult
  - interface CommandPromptResult
- `src/lib/conversation-event-bus.ts`
  - function emitLocal: (event) => void
  - function subscribeLocal: (conversationId, listener) => void
  - function subscribe: (conversationId, listener) => void
  - function publishAndEmit: (event, "ts" | "seq">) => Promise<ConversationEvent>
  - function _watcherCount: () => number
  - function _clearWatchers: () => void
- `src/lib/conversations.ts`
  - function setConversationsWorkspace: (id) => void
  - function turnsFilePath: (conversationId) => string
  - function eventsFilePath: (conversationId) => string
  - function seqFilePath: (conversationId) => string
  - function ensureConversationDir: (conversationId) => Promise<void>
  - function getConversationsFile: () => Promise<ConversationsFile>
  - _...23 more_
- `src/lib/data.ts`
  - function ensureSkillsMigrated: (workspaceId) => Promise<void>
  - function getWorkspaceDataDir: (workspaceId) => string
  - function ensureWorkspaceDir: (workspaceId) => Promise<void>
  - function initWikiDir: (workspaceId) => Promise<void>
  - function ensureDocMaintainerAgentForWorkspace: (workspaceId) => Promise<void>
  - function getTasks: () => Promise<TasksFile>
  - _...32 more_
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
- `src/lib/terminal/session-manager.ts`
  - function detectShell: () => void
  - function buildEnv: () => NodeJS.ProcessEnv
  - class TerminalSessionManager
  - interface TerminalSession
  - const IDLE_MS
  - const MAX_AGE_MS
  - _...2 more_
- `src/lib/terminal/upgrade-handler.ts` — function attachTerminalUpgrade: (server, wss) => void
- `src/lib/terminal/ws-bridge.ts` — function attachWebSocketToSession: (ws, session) => void
- `src/lib/toast.ts` — function showSuccess: (message, options?) => void, function showError: (message, options?) => void
- `src/lib/types.ts`
  - function getQuadrant: (task) => EisenhowerQuadrant
  - function valuesFromQuadrant: (quadrant) => void
  - interface AgentDefinition
  - interface AgentsFile
  - interface SkillDefinition
  - interface LegacySkillDefinition
  - _...75 more_
- `src/lib/utils.ts`
  - function cn: (...inputs) => void
  - function generateId: (prefix) => string
  - function parseAgentMentions: (text) => string[]
- `src/lib/validations.ts`
  - function validateBody: (request, schema) => Promise<ValidationResult<T>>
  - type WebhookTriggerInput
  - const safeId
  - const DEFAULT_LIMIT
  - const LIMITS
  - const commentSchema
  - _...23 more_
- `src/lib/webhooks/signature.ts` — function verifyHmacSignature: (rawBody, header, secret) => boolean
- `src/lib/wiki-helpers.ts` — function isAppFolder: (wikiDir, relPath) => Promise<boolean>
- `src/lib/wiki-plugin.ts`
  - function compareVersions: (a, b) => number
  - function getPluginStatus: (cwd) => void
  - function ensureWikiPluginInstalledDetailed: (cwd, options?) => WikiPluginInstall
  - function ensureWikiBootstrappedFromPlugin: (wikiDir, pluginInstallPath, domain, options?) => WikiBootstrapResult
  - function reconcileWikiWithPlugin: (wikiDir, pluginInstallPath) => WikiReconcileResult
  - function getLatestAvailableVersion: () => string | null
  - _...5 more_
- `src/lib/workspace-context.ts` — function GET: () => void, function applyWorkspaceContext: (fn) => void
- `src/lib/workspace-git.ts`
  - function isGitRepo: (dir) => boolean
  - function gitInit: (dir) => boolean
  - function writeWorkspaceGitignore: (dir) => Promise<void>
  - function hasAnyCommit: (dir) => boolean
  - function gitStatusPorcelain: (dir) => string
  - function isDirty: (dir) => boolean
  - _...6 more_
- `src/lib/workspace-store.ts`
  - function getWorkspaceId: () => string
  - function setFallbackWorkspaceId: (id) => void
  - const workspaceStore
- `src/stores/editor-store.ts`
  - class FetchPageError
  - type LoadStatus
  - const useEditorStore

---

# Config

## Environment Variables

- `ALLOWED_EMAILS` (has default) — .env.local
- `ANTHROPIC_API_KEY` **required** — __tests__/terminal-session-manager.test.ts
- `API_KEY` **required** — __tests__/daemon.test.ts
- `APPDATA` **required** — scripts/daemon/runner.ts
- `AUTH_ALLOW_ALL_USERS` **required** — __tests__/auth-email-allowlist.test.ts
- `AUTH_GOOGLE_ID` (has default) — .env.local
- `AUTH_GOOGLE_SECRET` (has default) — .env.local
- `AUTH_SECRET` (has default) — .env.local
- `AUTH_URL` (has default) — .env.local
- `CLAUDE_CODE_EXECUTABLE` **required** — src/lib/claude-sdk.ts
- `CLAUDE_CODE_OAUTH_TOKEN` **required** — scripts/daemon/security.ts
- `COMSPEC` **required** — scripts/daemon/security.ts
- `DB_PASSWORD` **required** — __tests__/terminal-session-manager.test.ts
- `HOME` **required** — __tests__/terminal-session-manager.test.ts
- `HOSTNAME` **required** — src/server.ts
- `LOCALAPPDATA` **required** — scripts/daemon/runner.ts
- `MANDIO_ALLOW_AGENT_IN_TESTS` **required** — scripts/daemon/runner.ts
- `MANDIO_BOOTSTRAP_STANDALONE` **required** — bin/bootstrap.ts
- `MANDIO_DATA_DIR` (has default) — .env.local
- `MANDIO_DEFAULT_MODEL` **required** — scripts/daemon/runner.ts
- `MANDIO_ENABLE_TERMINAL` **required** — src/server.ts
- `MANDIO_GLOBAL_MAX_PARALLEL_AGENTS` **required** — src/lib/scheduled-jobs.ts
- `MANDIO_INSTALL_DIR` **required** — src/lib/paths.ts
- `MANDIO_WEBHOOK_SECRET` **required** — __tests__/api-webhooks.test.ts
- `MANDIO_WORKSPACE_ID` **required** — scripts/daemon/config.ts
- `MY_API_KEY` **required** — __tests__/terminal-session-manager.test.ts
- `NEXT_RUNTIME` **required** — src/instrumentation.ts
- `NODE_ENV` **required** — __tests__/auth-email-allowlist.test.ts
- `P` **required** — scripts/daemon/security.ts
- `PATH` **required** — scripts/daemon/security.ts
- `PATHEXT` **required** — scripts/daemon/security.ts
- `PORT` **required** — src/server.ts
- `S` **required** — scripts/daemon/security.ts
- `SHELL` **required** — __tests__/terminal-session-manager.test.ts
- `SOME_TOKEN` **required** — __tests__/terminal-session-manager.test.ts
- `SYSTEMROOT` **required** — scripts/daemon/security.ts
- `TEMP` **required** — scripts/daemon/security.ts
- `TMP` **required** — scripts/daemon/security.ts
- `USERPROFILE` **required** — scripts/daemon/runner.ts
- `VITEST` **required** — bin/bootstrap.ts
- `WINDIR` **required** — scripts/daemon/security.ts

## Config Files

- `.env.example`
- `next.config.ts`
- `tailwind.config.ts`
- `tsconfig.json`

## Key Dependencies

- next: 16.2.4
- next-auth: 5.0.0-beta.31
- react: 19.2.5
- zod: ^4.3.6

---

# Middleware

## auth
- auth-email-allowlist.test — `__tests__/auth-email-allowlist.test.ts`
- auth-oauth-security.test — `__tests__/auth-oauth-security.test.ts`
- auth-signin-callback.test — `__tests__/auth-signin-callback.test.ts`
- auth-provider — `src/components/auth-provider.tsx`
- auth-email-allowlist — `src/lib/auth-email-allowlist.ts`
- auth-guards — `src/lib/auth-guards.ts`
- auth-paths — `src/lib/auth-paths.ts`
- auth — `src/lib/auth.ts`

## custom
- generate-context — `scripts/generate-context.ts`

---

# Dependency Graph

## Most Imported Files (change these carefully)

- `src/lib/utils.ts` — imported by **74** files
- `src/lib/types.ts` — imported by **71** files
- `src/lib/auth-guards.ts` — imported by **57** files
- `src/lib/paths.ts` — imported by **55** files
- `src/components/ui/button.tsx` — imported by **54** files
- `src/lib/workspace-context.ts` — imported by **41** files
- `src/components/ui/badge.tsx` — imported by **28** files
- `src/components/ui/input.tsx` — imported by **23** files
- `src/hooks/use-data.ts` — imported by **19** files
- `src/components/breadcrumb-nav.tsx` — imported by **18** files
- `src/lib/api-client.ts` — imported by **17** files
- `src/lib/data.ts` — imported by **17** files
- `src/components/ui/card.tsx` — imported by **14** files
- `src/lib/toast.ts` — imported by **13** files
- `src/components/ui/label.tsx` — imported by **13** files
- `__tests__/helpers.ts` — imported by **10** files
- `src/lib/conversation-event-bus.ts` — imported by **10** files
- `scripts/daemon/logger.ts` — imported by **10** files
- `src/components/ui/textarea.tsx` — imported by **10** files
- `src/providers/active-runs-provider.tsx` — imported by **10** files

## Import Map (who imports what)

- `src/lib/utils.ts` ← `src/app/agents/[id]/page.tsx`, `src/app/agents/page.tsx`, `src/app/api/activity-log/route.ts`, `src/app/api/brain-dump/route.ts`, `src/app/api/commands/route.ts` +69 more
- `src/lib/types.ts` ← `__tests__/conversation-event-bus.test.ts`, `__tests__/data.test.ts`, `scripts/daemon/run-task.ts`, `scripts/daemon/workspace-settings.ts`, `src/app/agents/[id]/page.tsx` +66 more
- `src/lib/auth-guards.ts` ← `__tests__/auth-oauth-security.test.ts`, `src/app/api/activity-log/route.ts`, `src/app/api/agents/route.ts`, `src/app/api/assets/[...path]/route.ts`, `src/app/api/brain-dump/automate/route.ts` +52 more
- `src/lib/paths.ts` ← `__tests__/api-projects-stop-conversation.test.ts`, `__tests__/api-tasks-stop-conversation.test.ts`, `__tests__/daemon-multi-workspace.test.ts`, `__tests__/seeding.test.ts`, `bin/cli.ts` +50 more
- `src/components/ui/button.tsx` ← `src/app/agents/[id]/edit/page.tsx`, `src/app/agents/[id]/page.tsx`, `src/app/agents/page.tsx`, `src/app/brain/page.tsx`, `src/app/error.tsx` +49 more
- `src/lib/workspace-context.ts` ← `src/app/api/agents/route.ts`, `src/app/api/assets/[...path]/route.ts`, `src/app/api/brain-dump/automate/route.ts`, `src/app/api/commands/activate/route.ts`, `src/app/api/commands/route.ts` +36 more
- `src/components/ui/badge.tsx` ← `src/app/agents/[id]/page.tsx`, `src/app/agents/page.tsx`, `src/app/initiatives/[id]/page.tsx`, `src/app/page.tsx`, `src/app/settings/page.tsx` +23 more
- `src/components/ui/input.tsx` ← `src/app/agents/[id]/page.tsx`, `src/app/initiatives/[id]/page.tsx`, `src/app/settings/page.tsx`, `src/app/settings/workspaces/[id]/page.tsx`, `src/app/settings/workspaces/page.tsx` +18 more
- `src/hooks/use-data.ts` ← `src/app/agents/[id]/edit/page.tsx`, `src/app/agents/new/page.tsx`, `src/app/agents/page.tsx`, `src/app/commands/[id]/page.tsx`, `src/app/page.tsx` +14 more
- `src/components/breadcrumb-nav.tsx` ← `src/app/agents/[id]/edit/page.tsx`, `src/app/agents/[id]/page.tsx`, `src/app/agents/loading.tsx`, `src/app/brain/page.tsx`, `src/app/commands/[id]/page.tsx` +13 more

---

# Events & Queues

- `exit` [event] — `__tests__/terminal-session-manager.test.ts`
- `message` [event] — `__tests__/terminal-ws-bridge.test.ts`
- `event` [event] — `src/lib/conversation-event-bus.ts`
- `conversation:${event.conversationId}` [event] — `src/lib/conversation-event-bus.ts`
- `upgrade` [event] — `src/lib/terminal/upgrade-handler.ts`

---

# Test Coverage

> **17%** of routes and models are covered by tests
> 27 test files found

## Covered Routes

- GET:/api/agents
- POST:/api/agents
- PUT:/api/agents
- DELETE:/api/agents
- GET:/api/conversations
- POST:/api/conversations
- GET:/api/projects
- POST:/api/projects
- PUT:/api/projects
- DELETE:/api/projects
- GET:/api/server-status
- GET:/api/tasks
- POST:/api/tasks
- PUT:/api/tasks
- DELETE:/api/tasks
- WS:pong
- WS:message
- WS:close

---

_Generated by [codesight](https://github.com/Houseofmvps/codesight) — see your codebase clearly_