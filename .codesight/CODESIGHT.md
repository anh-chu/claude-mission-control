# mission-control — AI Context Map

> **Stack:** next-app | none | react | typescript

> 100 routes | 0 models | 96 components | 37 lib files | 21 env vars | 3 middleware | 0% test coverage
> **Token savings:** this file is ~6,900 tokens. Without it, AI exploration would cost ~105,400 tokens. **Saves ~98,600 tokens per conversation.**
> **Last scanned:** 2026-04-24 03:14 — re-run after significant changes

---

# Routes

## CRUD Resources

- **`/api/activity-log`** GET | POST | DELETE/:id → Activity-log
- **`/api/agents`** GET | POST | PUT/:id | DELETE/:id → Agent
- **`/api/brain-dump`** GET | POST | PUT/:id | DELETE/:id → Brain-dump
- **`/api/checkpoints`** GET | POST | DELETE/:id → Checkpoint
- **`/api/daemon`** GET | POST | PUT/:id → Daemon
- **`/api/decisions`** GET | POST | PUT/:id | DELETE/:id → Decision
- **`/api/goals`** GET | POST | PUT/:id | DELETE/:id → Goal
- **`/api/inbox`** GET | POST | PUT/:id | DELETE/:id → Inbox
- **`/api/initiatives`** GET | POST | PUT/:id | DELETE/:id → Initiative
- **`/api/projects`** GET | POST | PUT/:id | DELETE/:id → Project
- **`/api/skills`** GET | POST | PUT/:id | DELETE/:id → Skill
- **`/api/tasks`** GET | POST | PUT/:id | DELETE/:id → Task
- **`/api/ventures`** GET | POST | PUT/:id | DELETE/:id → Venture
- **`/api/workspaces`** GET | POST | PUT/:id | DELETE/:id → Workspace

## Other Routes

- `POST` `/api/brain-dump/automate` → out: { error }
- `GET` `/api/checkpoints/export` → out: { error }
- `POST` `/api/checkpoints/import` → out: { error }
- `POST` `/api/checkpoints/load` → out: { error }
- `POST` `/api/checkpoints/new` → out: { ok }
- `GET` `/api/dashboard` [cache]
- `POST` `/api/emergency-stop` → out: { ok, results }
- `POST` `/api/inbox/respond` → out: { error }
- `GET` `/api/inbox/respond/status` → out: { runs }
- `POST` `/api/inbox/respond/stop` → out: { error }
- `GET` `/api/logs/app` → out: { lines, error }
- `GET` `/api/logs/daemon` → out: { lines, error }
- `GET` `/api/logs/stream` [cache, queue]
- `GET` `/api/missions` → out: { missions }
- `POST` `/api/projects/[id]/run` params(id) → out: { error, missionId } [queue]
- `POST` `/api/projects/[id]/stop` params(id) → out: { error }
- `GET` `/api/runs`
- `GET` `/api/runs/stream` [cache, queue]
- `GET` `/api/server-status` → out: { mode, uptimeSeconds, pid }
- `GET` `/api/sidebar` → out: { tasks, unreadInbox, pendingDecisions, agents } [cache]
- `POST` `/api/sync` → out: { ok, message } [ai]
- `POST` `/api/tasks/[id]/comment` params(id) → out: { error } [auth, upload]
- `DELETE` `/api/tasks/[id]/comment` params(id) → out: { error } [auth, upload]
- `POST` `/api/tasks/[id]/run` params(id) → out: { error }
- `POST` `/api/tasks/[id]/stop` params(id) → out: { error }
- `GET` `/api/tasks/archive` → out: { data, tasks, archived, meta, filtered }
- `POST` `/api/tasks/archive` → out: { data, tasks, archived, meta, filtered }
- `PUT` `/api/tasks/bulk` → out: { error }
- `DELETE` `/api/tasks/bulk` → out: { error }
- `POST` `/api/upload` → out: { error } [upload]
- `POST` `/api/ventures/[id]/run` params(id) → out: { error, missionId } [queue]
- `POST` `/api/ventures/[id]/stop` params(id) → out: { error }
- `GET` `/api/wiki/content` → out: { error }
- `PUT` `/api/wiki/content` → out: { error }
- `GET` `/api/wiki/file` → out: { error } [cache]
- `POST` `/api/wiki/folder` → out: { error }
- `POST` `/api/wiki/generate` → out: { runId, pid, workspaceId, startedAt }
- `POST` `/api/wiki/init` → out: { error }
- `POST` `/api/wiki/move` → out: { error }
- `GET` `/api/wiki/prompt` → out: { content, isDefault }
- `PUT` `/api/wiki/prompt` → out: { content, isDefault }
- `GET` `/api/wiki` → out: { error }
- `DELETE` `/api/wiki` → out: { error }
- `GET` `/api/wiki/run-stream` → out: { error }
- `GET` `/api/wiki/runs` → out: { runs }
- `POST` `/api/wiki/upload` → out: { error }
- `GET` `/uploads/[filename]` params(filename) → out: { error } [cache, upload]

---

# Components

- **ActivityPage** [client] — `src/app/activity/page.tsx`
- **AutopilotPage** [client] — `src/app/autopilot/page.tsx`
- **BrainDumpLoading** — `src/app/brain-dump/loading.tsx`
- **BrainDumpPage** [client] — `src/app/brain-dump/page.tsx`
- **EditAgentPage** [client] — `src/app/crew/[id]/edit/page.tsx`
- **AgentPage** [client] — `src/app/crew/[id]/page.tsx`
- **CrewLoading** — `src/app/crew/loading.tsx`
- **NewAgentPage** [client] — `src/app/crew/new/page.tsx`
- **CrewPage** [client] — `src/app/crew/page.tsx`
- **DaemonPage** — `src/app/daemon/page.tsx`
- **DecisionsPage** [client] — `src/app/decisions/page.tsx`
- **DocumentsPage** [client] — `src/app/documents/page.tsx`
- **Error** [client] — props: error, reset — `src/app/error.tsx`
- **GlobalError** [client] — props: error, reset — `src/app/global-error.tsx`
- **GoalsPage** — `src/app/goals/page.tsx`
- **GuidePage** [client] — `src/app/guide/page.tsx`
- **InboxLoading** — `src/app/inbox/loading.tsx`
- **InboxPage** [client] — `src/app/inbox/page.tsx`
- **InitiativeDetailPage** [client] — `src/app/initiatives/[id]/page.tsx`
- **InitiativesPage** [client] — `src/app/initiatives/page.tsx`
- **RootLayout** — `src/app/layout.tsx`
- **DashboardLoading** — `src/app/loading.tsx`
- **LogsPage** [client] — `src/app/logs/page.tsx`
- **NotFound** — `src/app/not-found.tsx`
- **GoalsPage** [client] — `src/app/objectives/page.tsx`
- **CommandCenterPage** [client] — `src/app/page.tsx`
- **PriorityMatrixLoading** — `src/app/priority-matrix/loading.tsx`
- **TasksPage** [client] — `src/app/priority-matrix/page.tsx`
- **ProjectsDetailPage** — `src/app/projects/[id]/page.tsx`
- **ProjectsPage** [client] — `src/app/projects/page.tsx`
- **SettingsPage** [client] — `src/app/settings/page.tsx`
- **SkillEditorPage** [client] — `src/app/skills/[id]/page.tsx`
- **NewSkillPage** [client] — `src/app/skills/new/page.tsx`
- **SkillsPage** [client] — `src/app/skills/page.tsx`
- **StatusBoardLoading** — `src/app/status-board/loading.tsx`
- **KanbanPage** [client] — `src/app/status-board/page.tsx`
- **VenturesDetailPage** — `src/app/ventures/[id]/page.tsx`
- **ProjectsPage** [client] — `src/app/ventures/page.tsx`
- **StreamEntry** [client] — props: line — `src/components/agent-console.tsx`
- **AgentConsole** [client] — props: runId, onStop — `src/components/agent-console.tsx`
- **AppSidebar** [client] — props: collapsed, unreadInbox, pendingDecisions, isMobile, onClose — `src/components/app-sidebar.tsx`
- **DraggableTaskCard** [client] — props: task, project, onClick, isSelected, onToggleSelect, isRunning, onRun, pendingDecisionTaskIds, onStatusChange, onDuplicate — `src/components/board-view.tsx`
- **BoardColumn** [client] — props: config, tasks, projects, onTaskClick, minHeight, maxHeight, selected, onToggleSelect, runningTaskIds, onRunTask — `src/components/board-view.tsx`
- **BoardPanels** [client] — props: tasks, projects, goals, selectedTask, showCreateTask, onUpdate, onDelete, onCloseDetail, onCloseCreate, onSubmitCreate — `src/components/board-view.tsx`
- **BoardDndWrapper** [client] — props: activeTask, projects, onDragStart, onDragEnd — `src/components/board-view.tsx`
- **BreadcrumbNav** [client] — props: items, className — `src/components/breadcrumb-nav.tsx`
- **CommandBar** [client] — props: onCapture, sidebarOpen, onToggleSidebar, isMobile, tasks, onTaskClick — `src/components/command-bar.tsx`
- **ConfirmDialog** [client] — props: open, onOpenChange, title, description, confirmLabel, onConfirm, variant — `src/components/confirm-dialog.tsx`
- **AgentContextMenuContent** [client] — props: agent, href, onEdit, onNewTask, onToggleStatus — `src/components/context-menus/agent-context-menu.tsx`
- **GoalContextMenuContent** [client] — props: goal, onEdit, onAddMilestone, onMarkComplete, onDelete — `src/components/context-menus/goal-context-menu.tsx`
- **InitiativeContextMenuContent** [client] — props: initiative, onTogglePause, onArchive, onDelete — `src/components/context-menus/initiative-context-menu.tsx`
- **ProjectContextMenuContent** [client] — props: project, href, onEdit, onRun, onArchive, onDelete — `src/components/context-menus/project-context-menu.tsx`
- **TaskContextMenuContent** [client] — props: task, onOpen, onStatusChange, onDuplicate, onRun, onDelete — `src/components/context-menus/task-context-menu.tsx`
- **CreateGoalDialog** [client] — props: open, onOpenChange, onSubmit — `src/components/create-goal-dialog.tsx`
- **CreateProjectDialog** [client] — props: open, onOpenChange, onSubmit — `src/components/create-project-dialog.tsx`
- **CreateTaskDialog** [client] — props: open, onOpenChange, projects, goals, onSubmit, defaultValues — `src/components/create-task-dialog.tsx`
- **DecisionDialog** [client] — props: open, onOpenChange, decision, onAnswered — `src/components/decision-dialog.tsx`
- **EditGoalDialog** [client] — props: open, onOpenChange, goal, onSubmit — `src/components/edit-goal-dialog.tsx`
- **EditProjectDialog** [client] — props: open, onOpenChange, project, agents, onSubmit — `src/components/edit-project-dialog.tsx`
- **EisenhowerSummary** [client] — props: tasks — `src/components/eisenhower-summary.tsx`
- **EmptyState** — props: Icon, title, description, actionLabel, onAction, className, compact — `src/components/empty-state.tsx`
- **ErrorState** — props: message, onRetry, className, compact — `src/components/error-state.tsx`
- **GoalCard** [client] — props: goal, tasks, projects, milestones, onEdit, onAddMilestone, onMarkComplete, onDelete — `src/components/goal-card.tsx`
- **KeyboardShortcuts** [client] — props: onCreateTask — `src/components/keyboard-shortcuts.tsx`
- **LayoutShell** [client] — `src/components/layout-shell.tsx`
- **MarkdownContent** [client] — props: content, className — `src/components/markdown-content.tsx`
- **MentionTextarea** [client] — props: value, onChange, agents, placeholder, className, onSubmit, stagedFiles, onFilesChange — `src/components/mention-textarea.tsx`
- **ProjectRunProgress** [client] — props: projectRun, runs, onStop — `src/components/mission-progress.tsx`
- **OnboardingDialog** [client] — `src/components/onboarding-dialog.tsx`
- **ProjectCardLarge** [client] — props: project, tasks, goals, isRunning, isProjectRunActive, onRun, onStop, onEdit, onArchive, onDelete — `src/components/project-card-large.tsx`
- **ProjectDetailPage** [client] — props: parentLabel, parentHref — `src/components/project-detail-page.tsx`
- **RunButton** [client] — props: isRunning, onClick, size, disabled, title, isProjectRunActive, onStop — `src/components/run-button.tsx`
- **SearchDialog** [client] — `src/components/search-dialog.tsx`
- **SidebarFooter** [client] — props: collapsed — `src/components/sidebar-footer.tsx`
- **SidebarNav** [client] — `src/components/sidebar-nav.tsx`
- **TaskCardSkeleton** — `src/components/skeletons.tsx`
- **StatsBarSkeleton** — `src/components/skeletons.tsx`
- **ProjectCardSkeleton** — `src/components/skeletons.tsx`
- **GoalCardSkeleton** — `src/components/skeletons.tsx`
- **MessageRowSkeleton** — `src/components/skeletons.tsx`
- **EventRowSkeleton** — `src/components/skeletons.tsx`
- **EntryRowSkeleton** — `src/components/skeletons.tsx`
- **DecisionCardSkeleton** — `src/components/skeletons.tsx`
- **WidgetSkeleton** — props: rows — `src/components/skeletons.tsx`
- **EisenhowerSkeleton** — `src/components/skeletons.tsx`
- **KanbanSkeleton** — `src/components/skeletons.tsx`
- **AgentCardSkeleton** — `src/components/skeletons.tsx`
- **SkillCardSkeleton** — `src/components/skeletons.tsx`
- **DashboardSkeleton** — `src/components/skeletons.tsx`
- **TaskCard** [client] — props: task, project, agents, className, isDragging, onClick, allTasks, pendingDecisionTaskIds, isRunning, onRun — `src/components/task-card.tsx`
- **TaskDetailPanel** [client] — props: task, projects, goals, allTasks, onUpdate, onDelete, onClose — `src/components/task-detail-panel.tsx`
- **TaskForm** [client] — props: initial, allTasks, currentTaskId, onSubmit, onCancel, submitLabel — `src/components/task-form.tsx`
- **ThemeProvider** [client] — `src/components/theme-provider.tsx`
- **ThemeToggle** [client] — `src/components/theme-toggle.tsx`
- **WorkspaceSwitcher** [client] — props: collapsed — `src/components/workspace-switcher.tsx`
- **ActiveRunsProvider** [client] — `src/providers/active-runs-provider.tsx`

---

# Libraries

- `scripts/daemon/config.ts`
  - function loadConfig: (workspaceId) => DaemonConfig
  - function saveConfig: (config, workspaceId) => void
  - function getConfigPath: (workspaceId) => string
- `scripts/daemon/dispatcher.ts` — class Dispatcher
- `scripts/daemon/health.ts` — class HealthMonitor
- `scripts/daemon/prompt-builder.ts`
  - function buildTaskPrompt: (agentId, task, missionId?) => string
  - function buildScheduledPrompt: (command) => string
  - function getTask: (taskId) => TaskDef | null
  - function getPendingTasks: () => TaskDef[]
  - function isTaskUnblocked: (task) => boolean
  - function hasPendingDecision: (taskId) => boolean
- `scripts/daemon/recovery.ts`
  - function persistSessionRecord: (taskId, agentId, sessionId) => void
  - function clearSessionRecord: (taskId) => void
  - function runCrashRecovery: (workspaceId) => RecoveryResult
  - interface SessionRecord
  - interface RecoveryResult
- `scripts/daemon/respond-runs.ts`
  - function readRespondRuns: () => RespondRunsFile
  - function writeRespondRuns: (data) => void
  - function isRunStopped: (runId) => boolean
  - function findRunningByMessage: (messageId) => RespondRunEntry | null
  - function getRunningRuns: () => RespondRunEntry[]
  - function createRespondRun: (entry) => void
  - _...3 more_
- `scripts/daemon/runner.ts` — function parseClaudeOutput: (stdout) => ClaudeOutputMeta, class AgentRunner
- `scripts/daemon/scheduler.ts` — class Scheduler
- `scripts/daemon/security.ts`
  - function validatePathWithinWorkspace: (filePath, workspaceRoot) => boolean
  - function escapeFenceContent: (content) => string
  - function fenceTaskData: (taskData) => string
  - function enforcePromptLimit: (prompt) => string
  - function validateBinary: (binary) => boolean
  - function buildSafeEnv: (opts?) => Record<string, string>
- `src/hooks/use-active-runs.ts` — function useActiveRuns: () => void
- `src/hooks/use-agent-stream.ts` — function useAgentStream: (runId) => UseAgentStreamReturn, interface StreamLine
- `src/hooks/use-connection.ts` — function useConnection: () => void
- `src/hooks/use-daemon.ts` — function useDaemon: () => DaemonData
- `src/hooks/use-dashboard-data.ts`
  - function useDashboardData: () => void
  - interface DashboardStats
  - interface DashboardAttention
  - interface DashboardEisenhowerCounts
  - interface DashboardData
- `src/hooks/use-dashboard.ts` — function useDashboard: () => void, interface DashboardData
- `src/hooks/use-data.ts`
  - function useTasks: () => void
  - function useInitiativeTasks: (initiativeId) => void
  - function useGoals: () => void
  - function useProjects: () => void
  - function useBrainDump: () => void
  - function useActivityLog: () => void
  - _...5 more_
- `src/hooks/use-fast-task-poll.ts` — function useFastTaskPoll: (hasRunningTasks, refetchTasks) => void
- `src/hooks/use-processing-entries.ts` — function useProcessingEntries: (entries) => void
- `src/hooks/use-sidebar.ts` — function useSidebar: () => void
- `src/hooks/use-workspace.ts` — function useWorkspace: () => void
- `src/instrumentation.ts` — function register: () => void
- `src/lib/agent-icons.ts` — function getAgentIcon: (agentId, iconName?) => LucideIcon, function getIconByName: (name) => LucideIcon
- `src/lib/api-client.ts` — function apiFetch: (url, init?) => Promise<Response>, interface ApiFetchInit
- `src/lib/data.ts`
  - function getCurrentWorkspace: () => string
  - function setCurrentWorkspace: (id) => void
  - function getWorkspaceDataDir: (workspaceId) => string
  - function ensureWorkspaceDir: (workspaceId) => Promise<void>
  - function initWikiDir: (workspaceId) => Promise<void>
  - function getCheckpointsDir: () => string
  - _...63 more_
- `src/lib/log-reader.ts`
  - function isAllowedLogPath: (filePath) => boolean
  - function scrubLogLines: (lines) => string[]
  - function tailFile: (filePath, lines, search?) => Promise<string[]>
- `src/lib/logger.ts`
  - function createLogger: (processName, opts) => Logger
  - interface Logger
  - type LogLevel
- `src/lib/paths.ts`
  - function getWorkspaceDir: (workspaceId) => string
  - function getUploadsDir: (workspaceId) => string
  - function getWikiPathFile: (workspaceId) => string
  - function getWikiDir: (workspaceId) => string
  - function getDefaultWikiDir: (workspaceId) => string
  - const DATA_DIR: string
- `src/lib/scheduled-jobs.ts`
  - function scheduleUploadsCleanup: () => void
  - function scheduleLogCleanup: () => void
  - function scheduleDaemonWatchdog: () => void
- `src/lib/scrub.ts` — function scrubCredentials: (text) => string
- `src/lib/sync-commands.ts`
  - function generateAgentCommandMarkdown: (agent, linkedSkills) => string
  - function resolveLinkedSkills: (agent, allSkills) => SkillDefinition[]
  - function syncAgentCommand: (agent) => Promise<void>
  - function syncAllAgentCommands: () => Promise<void>
  - function syncSkillFile: (skill) => Promise<void>
  - function syncAllSkillFiles: () => Promise<void>
- `src/lib/toast.ts`
  - function showSuccess: (message, options?) => void
  - function showError: (message, options?) => void
  - function showInfo: (message, options?) => void
- `src/lib/types.ts`
  - function getQuadrant: (task) => EisenhowerQuadrant
  - function quadrantFromValues: (importance, urgency) => EisenhowerQuadrant
  - function valuesFromQuadrant: (quadrant) => void
  - interface AgentDefinition
  - interface AgentsFile
  - interface SkillDefinition
  - _...50 more_
- `src/lib/utils.ts`
  - function cn: (...inputs) => void
  - function generateId: (prefix) => string
  - function parseAgentMentions: (text) => string[]
- `src/lib/validations.ts`
  - function validateBody: (request, schema) => Promise<ValidationResult<T>>
  - const DEFAULT_LIMIT
  - const LIMITS
  - const taskCreateSchema
  - const taskUpdateSchema
  - const goalCreateSchema
  - _...17 more_
- `src/lib/wiki-plugin.ts`
  - function ensureWikiPluginInstalledDetailed: (cwd, options?) => WikiPluginInstall
  - function ensureWikiPluginInstalled: (cwd) => WikiPluginStatus
  - function ensureWikiBootstrappedFromPlugin: (wikiDir, pluginInstallPath, domain, options?) => WikiBootstrapResult
  - function reconcileWikiWithPlugin: (wikiDir, pluginInstallPath) => WikiReconcileResult
  - interface WikiPluginInstall
  - interface WikiBootstrapResult
  - _...3 more_
- `src/lib/workspace-context.ts` — function applyWorkspaceContext: () => Promise<string>
- `src/proxy.ts` — function proxy: (request) => void, const config

---

# Config

## Environment Variables

- `API_KEY` **required** — __tests__/daemon.test.ts
- `APPDATA` **required** — scripts/daemon/runner.ts
- `CLAUDE_CODE_OAUTH_TOKEN` **required** — scripts/daemon/security.ts
- `CMC_DATA_DIR` **required** — __tests__/helpers.ts
- `CMC_WORKSPACE_ID` **required** — scripts/daemon/run-brain-dump-triage.ts
- `COMSPEC` **required** — scripts/daemon/security.ts
- `HOME` **required** — scripts/daemon/runner.ts
- `LOCALAPPDATA` **required** — scripts/daemon/runner.ts
- `MC_API_TOKEN` **required** — src/proxy.ts
- `NEXT_PUBLIC_MC_API_TOKEN` **required** — src/lib/api-client.ts
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

- next: 16.2.4
- react: 19.2.5
- zod: ^4.3.6

---

# Middleware

## custom
- run-wiki-generate — `scripts/daemon/run-wiki-generate.ts`
- generate-context — `scripts/generate-context.ts`

## validation
- migrate-to-initiatives — `scripts/migrate-to-initiatives.ts`

---

# Dependency Graph

## Most Imported Files (change these carefully)

- `src/lib/types.ts` — imported by **68** files
- `src/lib/utils.ts` — imported by **56** files
- `src/lib/paths.ts` — imported by **49** files
- `src/components/ui/button.tsx` — imported by **45** files
- `src/components/ui/badge.tsx` — imported by **31** files
- `src/components/breadcrumb-nav.tsx` — imported by **31** files
- `src/lib/data.ts` — imported by **21** files
- `src/components/ui/input.tsx` — imported by **20** files
- `src/components/skeletons.tsx` — imported by **19** files
- `src/lib/workspace-context.ts` — imported by **18** files
- `src/components/ui/card.tsx` — imported by **17** files
- `src/hooks/use-data.ts` — imported by **16** files
- `src/components/ui/tip.tsx` — imported by **15** files
- `src/lib/api-client.ts` — imported by **15** files
- `scripts/daemon/logger.ts` — imported by **14** files
- `src/components/error-state.tsx` — imported by **14** files
- `src/components/ui/textarea.tsx` — imported by **14** files
- `src/components/ui/label.tsx` — imported by **14** files
- `src/lib/toast.ts` — imported by **11** files
- `scripts/daemon/types.ts` — imported by **10** files

## Import Map (who imports what)

- `src/lib/types.ts` ← `__tests__/data.test.ts`, `src/app/activity/page.tsx`, `src/app/activity/page.tsx`, `src/app/api/activity-log/route.ts`, `src/app/api/agents/route.ts` +63 more
- `src/lib/utils.ts` ← `src/app/api/activity-log/route.ts`, `src/app/api/brain-dump/route.ts`, `src/app/api/decisions/route.ts`, `src/app/api/goals/route.ts`, `src/app/api/inbox/route.ts` +51 more
- `src/lib/paths.ts` ← `scripts/cleanup-uploads.ts`, `scripts/daemon/config.ts`, `scripts/daemon/dispatcher.ts`, `scripts/daemon/health.ts`, `scripts/daemon/index.ts` +44 more
- `src/components/ui/button.tsx` ← `src/app/autopilot/page.tsx`, `src/app/brain-dump/page.tsx`, `src/app/crew/[id]/edit/page.tsx`, `src/app/crew/[id]/page.tsx`, `src/app/crew/new/page.tsx` +40 more
- `src/components/ui/badge.tsx` ← `src/app/activity/page.tsx`, `src/app/autopilot/page.tsx`, `src/app/brain-dump/page.tsx`, `src/app/crew/[id]/edit/page.tsx`, `src/app/crew/[id]/page.tsx` +26 more
- `src/components/breadcrumb-nav.tsx` ← `src/app/activity/page.tsx`, `src/app/autopilot/page.tsx`, `src/app/brain-dump/loading.tsx`, `src/app/brain-dump/page.tsx`, `src/app/crew/[id]/edit/page.tsx` +26 more
- `src/lib/data.ts` ← `__tests__/seeding.test.ts`, `src/app/api/activity-log/route.ts`, `src/app/api/brain-dump/route.ts`, `src/app/api/checkpoints/export/route.ts`, `src/app/api/checkpoints/import/route.ts` +16 more
- `src/components/ui/input.tsx` ← `src/app/autopilot/page.tsx`, `src/app/crew/[id]/edit/page.tsx`, `src/app/crew/[id]/page.tsx`, `src/app/crew/new/page.tsx`, `src/app/decisions/page.tsx` +15 more
- `src/components/skeletons.tsx` ← `src/app/activity/page.tsx`, `src/app/brain-dump/loading.tsx`, `src/app/brain-dump/page.tsx`, `src/app/crew/[id]/page.tsx`, `src/app/crew/loading.tsx` +14 more
- `src/lib/workspace-context.ts` ← `src/app/api/agents/route.ts`, `src/app/api/initiatives/route.ts`, `src/app/api/sidebar/route.ts`, `src/app/api/tasks/[id]/comment/route.ts`, `src/app/api/tasks/route.ts` +13 more

---

# Test Coverage

> **0%** of routes and models are covered by tests
> 8 test files found

---

_Generated by [codesight](https://github.com/Houseofmvps/codesight) — see your codebase clearly_