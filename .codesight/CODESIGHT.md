# ccmc — AI Context Map

> **Stack:** next-app | none | react | typescript

> 132 routes | 0 models | 113 components | 51 lib files | 21 env vars | 4 middleware | 0% test coverage
> **Token savings:** this file is ~10,100 tokens. Without it, AI exploration would cost ~131,500 tokens. **Saves ~121,400 tokens per conversation.**

---

# Routes

## CRUD Resources

- **`/api/actions`** GET | POST | PUT/:id | DELETE/:id → Action
- **`/api/activity-log`** GET | POST | DELETE/:id → Activity-log
- **`/api/agents`** GET | POST | PUT/:id | DELETE/:id → Agent
- **`/api/brain-dump`** GET | POST | PUT/:id | DELETE/:id → Brain-dump
- **`/api/checkpoints`** GET | POST | DELETE/:id → Checkpoint
- **`/api/daemon`** GET | POST | PUT/:id → Daemon
- **`/api/decisions`** GET | POST | PUT/:id | DELETE/:id → Decision
- **`/api/field-ops/missions`** GET | POST | PUT/:id | DELETE/:id → Mission
- **`/api/field-ops/services`** GET | POST | PUT/:id | DELETE/:id → Service
- **`/api/field-ops/tasks`** GET | POST | PUT/:id | DELETE/:id → Task
- **`/api/field-ops/templates`** GET | POST | DELETE/:id → Template
- **`/api/field-ops/vault`** GET | POST | DELETE/:id → Vault
- **`/api/field-ops/vault/session`** GET | POST | DELETE/:id → Session
- **`/api/goals`** GET | POST | PUT/:id | DELETE/:id → Goal
- **`/api/inbox`** GET | POST | PUT/:id | DELETE/:id → Inbox
- **`/api/initiatives`** GET | POST | PUT/:id | DELETE/:id → Initiative
- **`/api/projects`** GET | POST | PUT/:id | DELETE/:id → Project
- **`/api/skills`** GET | POST | PUT/:id | DELETE/:id → Skill
- **`/api/tasks`** GET | POST | PUT/:id | DELETE/:id → Task
- **`/api/ventures`** GET | POST | PUT/:id | DELETE/:id → Venture
- **`/api/workspaces`** GET | POST | PUT/:id | DELETE/:id → Workspace

## Other Routes

- `POST` `/api/actions/[id]/comment` params(id) → out: { error } [auth, upload]
- `DELETE` `/api/actions/[id]/comment` params(id) → out: { error } [auth, upload]
- `POST` `/api/brain-dump/automate` → out: { error }
- `GET` `/api/checkpoints/export` → out: { error }
- `POST` `/api/checkpoints/import` → out: { error }
- `POST` `/api/checkpoints/load` → out: { error }
- `POST` `/api/checkpoints/new` → out: { ok }
- `GET` `/api/dashboard` [cache]
- `POST` `/api/emergency-stop` → out: { ok, results } [auth]
- `GET` `/api/field-ops/activity` → out: { data, events, meta }
- `GET` `/api/field-ops/approval-config` → out: { data, config }
- `PUT` `/api/field-ops/approval-config` → out: { data, config }
- `POST` `/api/field-ops/batch` → out: { error } [auth]
- `GET` `/api/field-ops/catalog` → out: { error }
- `POST` `/api/field-ops/execute/prepare` → out: { error } [payment]
- `POST` `/api/field-ops/execute` → out: { error } [auth, db, cache, payment]
- `POST` `/api/field-ops/execute/submit-signature` → out: { error }
- `GET` `/api/field-ops/financials` → out: { vaultLocked, snapshots, availableIntegrations } [auth, payment]
- `GET` `/api/field-ops/safety-limits` → out: { ...data, spendSummary } [auth]
- `PUT` `/api/field-ops/safety-limits` → out: { ...data, spendSummary } [auth]
- `POST` `/api/field-ops/services/activate` → out: { error } [auth]
- `POST` `/api/field-ops/services/save-from-catalog` → out: { error } [auth]
- `POST` `/api/field-ops/services/test` → out: { error } [auth, payment]
- `POST` `/api/field-ops/templates/instantiate` → out: { error }
- `POST` `/api/field-ops/vault/decrypt` → out: { error } [auth]
- `POST` `/api/field-ops/vault/reset` → out: { error } [auth]
- `POST` `/api/field-ops/vault/setup` → out: { error } [auth]
- `GET` `/api/field-ops/wallet` → out: { error, wallets } [auth, db, cache]
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
- `GET` `/api/sidebar` → out: { tasks, unreadInbox, pendingDecisions, pendingFieldApprovals, pendingActionApprovals, agents } [cache]
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
- `GET` `/uploads/[filename]` params(filename) → out: { error } [cache, upload]

---

# Components

- **ActionsActivityPage** [client] — `mission-control/src/app/actions/activity/page.tsx`
- **ActivityPage** [client] — `mission-control/src/app/activity/page.tsx`
- **ApprovalsPage** [client] — `mission-control/src/app/approvals/page.tsx`
- **AutopilotPage** [client] — `mission-control/src/app/autopilot/page.tsx`
- **BrainDumpLoading** — `mission-control/src/app/brain-dump/loading.tsx`
- **BrainDumpPage** [client] — `mission-control/src/app/brain-dump/page.tsx`
- **CheckpointsPage** [client] — `mission-control/src/app/checkpoints/page.tsx`
- **EditAgentPage** [client] — `mission-control/src/app/crew/[id]/edit/page.tsx`
- **AgentPage** [client] — `mission-control/src/app/crew/[id]/page.tsx`
- **CrewLoading** — `mission-control/src/app/crew/loading.tsx`
- **NewAgentPage** [client] — `mission-control/src/app/crew/new/page.tsx`
- **CrewPage** [client] — `mission-control/src/app/crew/page.tsx`
- **DaemonPage** — `mission-control/src/app/daemon/page.tsx`
- **DecisionsPage** [client] — `mission-control/src/app/decisions/page.tsx`
- **Error** [client] — props: error, reset — `mission-control/src/app/error.tsx`
- **FieldActivityPage** [client] — `mission-control/src/app/field-ops/activity/page.tsx`
- **ApprovalsPage** [client] — `mission-control/src/app/field-ops/approvals/page.tsx`
- **MissionDetailPage** [client] — `mission-control/src/app/field-ops/missions/[id]/page.tsx`
- **MissionsPage** [client] — `mission-control/src/app/field-ops/missions/page.tsx`
- **ConnectionsOverviewPage** [client] — `mission-control/src/app/field-ops/page.tsx`
- **SafetyPage** [client] — `mission-control/src/app/field-ops/safety/page.tsx`
- **ServicesPage** [client] — `mission-control/src/app/field-ops/services/page.tsx`
- **VaultPage** [client] — `mission-control/src/app/field-ops/vault/page.tsx`
- **GlobalError** [client] — props: error, reset — `mission-control/src/app/global-error.tsx`
- **GoalsPage** — `mission-control/src/app/goals/page.tsx`
- **GuidePage** [client] — `mission-control/src/app/guide/page.tsx`
- **InboxLoading** — `mission-control/src/app/inbox/loading.tsx`
- **InboxPage** [client] — `mission-control/src/app/inbox/page.tsx`
- **InitiativeDetailPage** [client] — `mission-control/src/app/initiatives/[id]/page.tsx`
- **InitiativesPage** [client] — props: open, onOpenChange, onSubmit, parentGoalOptions — `mission-control/src/app/initiatives/page.tsx`
- **RootLayout** — `mission-control/src/app/layout.tsx`
- **DashboardLoading** — `mission-control/src/app/loading.tsx`
- **LogsPage** [client] — `mission-control/src/app/logs/page.tsx`
- **NotFound** — `mission-control/src/app/not-found.tsx`
- **GoalsPage** [client] — `mission-control/src/app/objectives/page.tsx`
- **CommandCenterPage** [client] — `mission-control/src/app/page.tsx`
- **PriorityMatrixLoading** — `mission-control/src/app/priority-matrix/loading.tsx`
- **TasksPage** [client] — `mission-control/src/app/priority-matrix/page.tsx`
- **ProjectsDetailPage** — `mission-control/src/app/projects/[id]/page.tsx`
- **ProjectsPage** [client] — `mission-control/src/app/projects/page.tsx`
- **SafetyPage** — `mission-control/src/app/safety/page.tsx`
- **ServicesPage** — `mission-control/src/app/services/page.tsx`
- **SettingsPage** [client] — `mission-control/src/app/settings/page.tsx`
- **SkillEditorPage** [client] — `mission-control/src/app/skills/[id]/page.tsx`
- **NewSkillPage** [client] — `mission-control/src/app/skills/new/page.tsx`
- **SkillsPage** [client] — `mission-control/src/app/skills/page.tsx`
- **StatusBoardLoading** — `mission-control/src/app/status-board/loading.tsx`
- **KanbanPage** [client] — `mission-control/src/app/status-board/page.tsx`
- **AgentNotFound** — `mission-control/src/app/team/[role]/not-found.tsx`
- **TeamMemberRedirect** — props: params — `mission-control/src/app/team/[role]/page.tsx`
- **VaultPage** — `mission-control/src/app/vault/page.tsx`
- **VenturesDetailPage** — `mission-control/src/app/ventures/[id]/page.tsx`
- **ProjectsPage** [client] — `mission-control/src/app/ventures/page.tsx`
- **ActionDetailPanel** [client] — props: action, open, onClose, onUpdate, agents — `mission-control/src/components/action-detail-panel.tsx`
- **AgentConsole** [client] — props: runId, onStop — `mission-control/src/components/agent-console.tsx`
- **AppSidebar** [client] — props: href, label, icon, isActive, collapsed, onClick, size, badge, badgeDot, tooltipSuffix — `mission-control/src/components/app-sidebar.tsx`
- **AutonomySelector** [client] — props: value, onChange, showInherit — `mission-control/src/components/autonomy-selector.tsx`
- **DraggableTaskCard** [client] — props: task, project, onClick, isSelected, onToggleSelect, isRunning, onRun, pendingDecisionTaskIds, onStatusChange, onDuplicate — `mission-control/src/components/board-view.tsx`
- **BreadcrumbNav** [client] — props: items, className — `mission-control/src/components/breadcrumb-nav.tsx`
- **BulkActionBar** [client] — props: count, onMarkDone, onDelete, onClear — `mission-control/src/components/bulk-action-bar.tsx`
- **CommandBar** [client] — props: onCapture, sidebarOpen, onToggleSidebar, isMobile, tasks, onTaskClick — `mission-control/src/components/command-bar.tsx`
- **ConfirmDialog** [client] — props: open, onOpenChange, title, description, confirmLabel, onConfirm, variant — `mission-control/src/components/confirm-dialog.tsx`
- **AgentContextMenuContent** [client] — props: agent, href, onEdit, onNewTask, onToggleStatus — `mission-control/src/components/context-menus/agent-context-menu.tsx`
- **FieldTaskContextMenuContent** [client] — props: task, onOpen, onEdit, onDelete — `mission-control/src/components/context-menus/field-task-context-menu.tsx`
- **GoalContextMenuContent** [client] — props: goal, onEdit, onAddMilestone, onMarkComplete, onDelete — `mission-control/src/components/context-menus/goal-context-menu.tsx`
- **InitiativeContextMenuContent** [client] — props: initiative, onTogglePause, onArchive, onDelete — `mission-control/src/components/context-menus/initiative-context-menu.tsx`
- **ProjectContextMenuContent** [client] — props: project, href, onEdit, onRun, onArchive, onDelete — `mission-control/src/components/context-menus/project-context-menu.tsx`
- **TaskContextMenuContent** [client] — props: task, onOpen, onStatusChange, onDuplicate, onRun, onDelete — `mission-control/src/components/context-menus/task-context-menu.tsx`
- **CreateGoalDialog** [client] — props: open, onOpenChange, projects, goals, onSubmit, title, type, timeframe, projectId, parentGoalId — `mission-control/src/components/create-goal-dialog.tsx`
- **CreateProjectDialog** [client] — props: open, onOpenChange, onSubmit — `mission-control/src/components/create-project-dialog.tsx`
- **CreateTaskDialog** [client] — props: open, onOpenChange, projects, goals, onSubmit, defaultValues — `mission-control/src/components/create-task-dialog.tsx`
- **DecisionDialog** [client] — props: open, onOpenChange, decision, onAnswered — `mission-control/src/components/decision-dialog.tsx`
- **EditGoalDialog** [client] — props: open, onOpenChange, goal, projects, goals, onSubmit, title, type, timeframe, status — `mission-control/src/components/edit-goal-dialog.tsx`
- **EditProjectDialog** [client] — props: open, onOpenChange, project, agents, onSubmit, name, description, status, color, teamMembers — `mission-control/src/components/edit-project-dialog.tsx`
- **EisenhowerSummary** [client] — props: tasks — `mission-control/src/components/eisenhower-summary.tsx`
- **EmptyState** — props: icon, title, description, actionLabel, onAction, className, compact — `mission-control/src/components/empty-state.tsx`
- **ErrorState** — props: message, onRetry, className, compact — `mission-control/src/components/error-state.tsx`
- **ActivateServiceDialog** [client] — props: service, catalogEntry, open, onOpenChange, onActivated, updateMode — `mission-control/src/components/field-ops/activate-service-dialog.tsx`
- **CatalogServiceCard** [client] — props: service — `mission-control/src/components/field-ops/catalog-service-card.tsx`
- **ExecutionResultPanel** [client] — props: result, success, className — `mission-control/src/components/field-ops/execution-result-panel.tsx`
- **FieldTaskCard** [client] — props: task, services, onStatusChange, onEdit, onDelete, onReject, onOpen, onExecute, executing, onDryRun — `mission-control/src/components/field-ops/field-task-card.tsx`
- **FieldTaskFormDialog** [client] — props: open, onOpenChange, task, missionId, missionAutonomy, services, onSubmit, title, description, type — `mission-control/src/components/field-ops/field-task-form-dialog.tsx`
- **FinancialOverviewCard** [client] — props: variant — `mission-control/src/components/field-ops/financial-overview-card.tsx`
- **GettingStartedCard** [client] — props: title, description, steps, learnMoreHref, storageKey, accentClass — `mission-control/src/components/field-ops/getting-started-card.tsx`
- **MissionFormDialog** [client] — props: open, onOpenChange, mission, projects, onSubmit, title, description, autonomyLevel, linkedProjectId — `mission-control/src/components/field-ops/mission-form-dialog.tsx`
- **RejectTaskDialog** [client] — props: open, onOpenChange, taskTitle, onReject — `mission-control/src/components/field-ops/reject-task-dialog.tsx`
- **SetupGuideDialog** [client] — props: service, open, onOpenChange — `mission-control/src/components/field-ops/setup-guide-dialog.tsx`
- **SignTransactionButton** [client] — props: taskId, onComplete — `mission-control/src/components/field-ops/sign-transaction-button.tsx`
- **VaultUnlockDialog** [client] — props: open, onOpenChange, onUnlock, context — `mission-control/src/components/field-ops/vault-unlock-dialog.tsx`
- **WalletBalanceCard** [client] — props: onUnlockVault — `mission-control/src/components/field-ops/wallet-balance-card.tsx`
- **WalletConnectButton** [client] — `mission-control/src/components/field-ops/wallet-connect-button.tsx`
- **GoalCard** [client] — props: goal, tasks, projects, milestones, onEdit, onAddMilestone, onMarkComplete, onDelete — `mission-control/src/components/goal-card.tsx`
- **KeyboardShortcuts** [client] — props: onCreateTask — `mission-control/src/components/keyboard-shortcuts.tsx`
- **LayoutShell** [client] — `mission-control/src/components/layout-shell.tsx`
- **MarkdownContent** [client] — props: content, className — `mission-control/src/components/markdown-content.tsx`
- **MentionTextarea** [client] — props: value, onChange, agents, placeholder, className, onSubmit, stagedFiles, onFilesChange — `mission-control/src/components/mention-textarea.tsx`
- **ProjectRunProgress** [client] — props: projectRun, runs, onStop — `mission-control/src/components/mission-progress.tsx`
- **OnboardingDialog** [client] — `mission-control/src/components/onboarding-dialog.tsx`
- **ProjectCardLarge** [client] — props: project, tasks, goals, isRunning, isProjectRunActive, onRun, onStop, onEdit, onArchive, onDelete — `mission-control/src/components/project-card-large.tsx`
- **ProjectDetailPage** [client] — props: parentLabel, parentHref — `mission-control/src/components/project-detail-page.tsx`
- **RunButton** [client] — props: isRunning, onClick, size, disabled, title, isProjectRunActive, onStop — `mission-control/src/components/run-button.tsx`
- **SearchDialog** [client] — `mission-control/src/components/search-dialog.tsx`
- **SidebarFooter** [client] — props: collapsed — `mission-control/src/components/sidebar-footer.tsx`
- **SidebarNav** [client] — `mission-control/src/components/sidebar-nav.tsx`
- **TaskCardSkeleton** — `mission-control/src/components/skeletons.tsx`
- **TaskCard** [client] — props: task, project, agents, className, isDragging, onClick, allTasks, pendingDecisionTaskIds, isRunning, onRun — `mission-control/src/components/task-card.tsx`
- **TaskDetailPanel** [client] — props: task, projects, goals, allTasks, onUpdate, onDelete, onClose — `mission-control/src/components/task-detail-panel.tsx`
- **TaskForm** [client] — props: initial, projects, goals, allTasks, currentTaskId, onSubmit, onCancel, submitLabel — `mission-control/src/components/task-form.tsx`
- **ThemeProvider** [client] — `mission-control/src/components/theme-provider.tsx`
- **ThemeToggle** [client] — `mission-control/src/components/theme-toggle.tsx`
- **VaultSecurityDetails** [client] — props: onComplete, onSkip, compact — `mission-control/src/components/vault-setup-wizard.tsx`
- **WorkspaceSwitcher** [client] — props: collapsed — `mission-control/src/components/workspace-switcher.tsx`
- **ActiveRunsProvider** [client] — `mission-control/src/providers/active-runs-provider.tsx`

---

# Libraries

- `mission-control/scripts/daemon/config.ts`
  - function loadConfig: (workspaceId) => DaemonConfig
  - function saveConfig: (config, workspaceId) => void
  - function getConfigPath: (workspaceId) => string
- `mission-control/scripts/daemon/dispatcher.ts` — class Dispatcher
- `mission-control/scripts/daemon/health.ts` — class HealthMonitor
- `mission-control/scripts/daemon/prompt-builder.ts`
  - function buildTaskPrompt: (agentId, task, missionId?) => string
  - function buildScheduledPrompt: (command) => string
  - function getTask: (taskId) => TaskDef | null
  - function getPendingTasks: () => TaskDef[]
  - function isTaskUnblocked: (task) => boolean
  - function hasPendingDecision: (taskId) => boolean
- `mission-control/scripts/daemon/recovery.ts`
  - function persistSessionRecord: (taskId, agentId, sessionId) => void
  - function clearSessionRecord: (taskId) => void
  - function runCrashRecovery: (workspaceId) => RecoveryResult
  - interface SessionRecord
  - interface RecoveryResult
- `mission-control/scripts/daemon/respond-runs.ts`
  - function readRespondRuns: () => RespondRunsFile
  - function writeRespondRuns: (data) => void
  - function isRunStopped: (runId) => boolean
  - function findRunningByMessage: (messageId) => RespondRunEntry | null
  - function getRunningRuns: () => RespondRunEntry[]
  - function createRespondRun: (entry) => void
  - _...3 more_
- `mission-control/scripts/daemon/runner.ts` — function parseClaudeOutput: (stdout) => ClaudeOutputMeta, class AgentRunner
- `mission-control/scripts/daemon/scheduler.ts` — class Scheduler
- `mission-control/scripts/daemon/security.ts`
  - function validatePathWithinWorkspace: (filePath, workspaceRoot) => boolean
  - function escapeFenceContent: (content) => string
  - function fenceTaskData: (taskData) => string
  - function enforcePromptLimit: (prompt) => string
  - function validateBinary: (binary) => boolean
  - function buildSafeEnv: (opts?) => Record<string, string>
- `mission-control/src/hooks/use-active-runs.ts` — function useActiveRuns: () => void
- `mission-control/src/hooks/use-agent-stream.ts` — function useAgentStream: (runId) => UseAgentStreamReturn, interface StreamLine
- `mission-control/src/hooks/use-connection.ts` — function useConnection: () => void
- `mission-control/src/hooks/use-daemon.ts` — function useDaemon: () => DaemonData
- `mission-control/src/hooks/use-dashboard-data.ts`
  - function useDashboardData: () => void
  - interface DashboardStats
  - interface DashboardAttention
  - interface DashboardEisenhowerCounts
  - interface DashboardData
- `mission-control/src/hooks/use-dashboard.ts` — function useDashboard: () => void, interface DashboardData
- `mission-control/src/hooks/use-data.ts`
  - function useTasks: () => void
  - function useInitiativeTasks: (initiativeId) => void
  - function useGoals: () => void
  - function useProjects: () => void
  - function useBrainDump: () => void
  - function useActivityLog: () => void
  - _...6 more_
- `mission-control/src/hooks/use-fast-task-poll.ts` — function useFastTaskPoll: (hasRunningTasks, refetchTasks) => void
- `mission-control/src/hooks/use-field-ops.ts`
  - function getCachedVaultPassword: () => string | null
  - function useVaultSession: () => void
  - function useExecuteTask: () => void
  - function useFieldMissions: () => void
  - function useFieldTasks: () => void
  - function useFieldServices: () => void
- `mission-control/src/hooks/use-processing-entries.ts` — function useProcessingEntries: (entries) => void
- `mission-control/src/hooks/use-sidebar.ts` — function useSidebar: () => void
- `mission-control/src/hooks/use-wallet.ts` — function useWallet: () => void
- `mission-control/src/hooks/use-workspace.ts` — function useWorkspace: () => void
- `mission-control/src/instrumentation.ts` — function register: () => void
- `mission-control/src/lib/action-adapter.ts` — function actionToFieldTask: (action) => FieldTask
- `mission-control/src/lib/adapters/ethereum-adapter.ts` — function prepareTransaction: (operation, payload, unknown>, network, rpcUrl?) => Promise<
- `mission-control/src/lib/adapters/registry.ts`
  - function registerAdapter: (adapter) => void
  - function getAdapter: (serviceId) => ServiceAdapter | undefined
  - function hasAdapter: (serviceId) => boolean
  - function listAdapters: () => ServiceAdapter[]
  - function adapterCount: () => number
  - function listFinancialAdapters: () => ServiceAdapter[]
- `mission-control/src/lib/agent-icons.ts` — function getAgentIcon: (agentId, iconName?) => LucideIcon, function getIconByName: (name) => LucideIcon
- `mission-control/src/lib/api-client.ts` — function apiFetch: (url, init?) => Promise<Response>, interface ApiFetchInit
- `mission-control/src/lib/autonomy.ts` — function resolveAutonomyLevel: (action, "autonomyOverride">, initiative, "autonomyLevel"> | null, workspace, "autonomyLevel">) => AutonomyLevel
- `mission-control/src/lib/data.ts`
  - function getCurrentWorkspace: () => string
  - function setCurrentWorkspace: (id) => void
  - function getWorkspaceDataDir: (workspaceId) => string
  - function ensureFieldOpsDir: () => Promise<void>
  - function ensureWorkspaceDir: (workspaceId) => Promise<void>
  - function getCheckpointsDir: () => string
  - _...78 more_
- `mission-control/src/lib/field-ops-activity.ts` — function addFieldActivityEvent: (evt) => Promise<void>, type FieldActivityEventInput
- `mission-control/src/lib/field-ops-notify.ts`
  - function notifyFieldTaskCompleted: (task) => Promise<void>
  - function notifyFieldTaskFailed: (task) => Promise<void>
  - function notifyFieldTaskApproved: (task) => Promise<void>
  - function notifyFieldTaskRejected: (task) => Promise<void>
  - function logFieldOpsActivity: (type, actor, taskId, summary, details) => Promise<void>
- `mission-control/src/lib/field-ops-security.ts`
  - function computeTaskRisk: (taskType, serviceRiskLevel) => RiskLevel
  - function requiresApproval: (taskType, serviceRiskLevel, autonomyLevel) => boolean
  - function isValidTransition: (from, to) => boolean
  - function getTransitionError: (from, to) => string
  - function isApprovalBypassAttempt: (currentStatus, newStatus, approvalRequired) => boolean
  - function getApprovalBypassError: () => string
  - _...14 more_
- `mission-control/src/lib/log-reader.ts`
  - function isAllowedLogPath: (filePath) => boolean
  - function scrubLogLines: (lines) => string[]
  - function tailFile: (filePath, lines, search?) => Promise<string[]>
- `mission-control/src/lib/logger.ts`
  - function createLogger: (processName, opts) => Logger
  - interface Logger
  - type LogLevel
- `mission-control/src/lib/owner-guard.ts` — function requireOwner: (body, unknown>) => Promise<NextResponse | null>
- `mission-control/src/lib/password-strength.ts` — function evaluatePasswordStrength: (password) => PasswordStrength, interface PasswordStrength
- `mission-control/src/lib/paths.ts`
  - function getWorkspaceDir: (workspaceId) => string
  - const DATA_DIR: string
  - const UPLOADS_DIR: string
- `mission-control/src/lib/scheduled-jobs.ts`
  - function scheduleUploadsCleanup: () => void
  - function scheduleLogCleanup: () => void
  - function scheduleDaemonWatchdog: () => void
- `mission-control/src/lib/scrub.ts` — function scrubCredentials: (text) => string
- `mission-control/src/lib/service-categories.ts`
  - function getCategoryInfo: (id) => CategoryInfo | undefined
  - interface CategoryInfo
  - const SERVICE_CATEGORIES: CategoryInfo[]
- `mission-control/src/lib/spend-tracker.ts`
  - function getServiceSpend: (spendLog, serviceId, since) => number
  - function getGlobalSpend: (spendLog, since) => number
  - function checkSpendLimits: (safetyLimits, serviceId, proposedAmountUsd, operation) => string | null
  - function pruneSpendLog: (spendLog) => SpendLogEntry[]
  - function getSpendSummary: (spendLog) => void
- `mission-control/src/lib/sync-commands.ts`
  - function generateAgentCommandMarkdown: (agent, linkedSkills) => string
  - function resolveLinkedSkills: (agent, allSkills) => SkillDefinition[]
  - function syncAgentCommand: (agent) => Promise<void>
  - function syncAllAgentCommands: () => Promise<void>
  - function syncSkillFile: (skill) => Promise<void>
  - function syncAllSkillFiles: () => Promise<void>
- `mission-control/src/lib/toast.ts`
  - function showSuccess: (message, options?) => void
  - function showError: (message, options?) => void
  - function showInfo: (message, options?) => void
- `mission-control/src/lib/types.ts`
  - function getQuadrant: (task) => EisenhowerQuadrant
  - function quadrantFromValues: (importance, urgency) => EisenhowerQuadrant
  - function valuesFromQuadrant: (quadrant) => void
  - interface AgentDefinition
  - interface AgentsFile
  - interface SkillDefinition
  - _...84 more_
- `mission-control/src/lib/utils.ts`
  - function cn: (...inputs) => void
  - function generateId: (prefix) => string
  - function parseAgentMentions: (text) => string[]
- `mission-control/src/lib/validations.ts`
  - function validateBody: (request, schema) => Promise<ValidationResult<T>>
  - const DEFAULT_LIMIT
  - const LIMITS
  - const taskCreateSchema
  - const taskUpdateSchema
  - const goalCreateSchema
  - _...32 more_
- `mission-control/src/lib/vault-crypto.ts`
  - function deriveKey: (password, salt) => Buffer
  - function hashMasterPassword: (password) => string
  - function verifyMasterPassword: (password, storedHash) => boolean
  - function encryptCredential: (plaintext, password, salt) => void
  - function decryptCredential: (encryptedData, iv, authTag, password, salt) => string
  - function isLegacyHash: (storedHash) => boolean
  - _...3 more_
- `mission-control/src/lib/vault-session.ts`
  - function setPassword: (password) => void
  - function getPassword: () => string | null
  - function clear: () => void
  - function isActive: () => boolean
  - function getRemainingMs: () => number
  - function getSessionInfo: () => void
- `mission-control/src/lib/workspace-context.ts` — function applyWorkspaceContext: () => Promise<string>
- `mission-control/src/middleware.ts` — function middleware: (request) => void, const config

---

# Config

## Environment Variables

- `API_KEY` **required** — mission-control/__tests__/daemon.test.ts
- `APPDATA` **required** — mission-control/scripts/daemon/runner.ts
- `CLAUDE_CODE_OAUTH_TOKEN` **required** — mission-control/scripts/daemon/security.ts
- `CMC_DATA_DIR` **required** — mission-control/__tests__/helpers.ts
- `CMC_WORKSPACE_ID` **required** — mission-control/scripts/daemon/run-action-comment.ts
- `COMSPEC` **required** — mission-control/scripts/daemon/security.ts
- `HOME` **required** — mission-control/scripts/daemon/runner.ts
- `LOCALAPPDATA` **required** — mission-control/scripts/daemon/runner.ts
- `MC_API_TOKEN` **required** — mission-control/src/middleware.ts
- `NEXT_PUBLIC_MC_API_TOKEN` **required** — mission-control/src/lib/api-client.ts
- `NEXT_RUNTIME` **required** — mission-control/src/instrumentation.ts
- `NODE_ENV` **required** — mission-control/src/instrumentation.ts
- `P` **required** — mission-control/scripts/daemon/security.ts
- `PATH` **required** — mission-control/scripts/daemon/security.ts
- `PATHEXT` **required** — mission-control/scripts/daemon/security.ts
- `S` **required** — mission-control/scripts/daemon/security.ts
- `SYSTEMROOT` **required** — mission-control/scripts/daemon/security.ts
- `TEMP` **required** — mission-control/scripts/daemon/security.ts
- `TMP` **required** — mission-control/scripts/daemon/security.ts
- `USERPROFILE` **required** — mission-control/scripts/daemon/runner.ts
- `WINDIR` **required** — mission-control/scripts/daemon/security.ts

## Config Files

- `mission-control/.env.example`
- `mission-control/next.config.ts`
- `mission-control/tailwind.config.ts`

---

# Middleware

## custom
- generate-context — `mission-control/scripts/generate-context.ts`

## validation
- migrate-to-initiatives — `mission-control/scripts/migrate-to-initiatives.ts`

## auth
- owner-guard — `mission-control/src/lib/owner-guard.ts`
- middleware — `mission-control/src/middleware.ts`

---

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

---

# Test Coverage

> **0%** of routes and models are covered by tests
> 9 test files found

---

_Generated by [codesight](https://github.com/Houseofmvps/codesight) — see your codebase clearly_