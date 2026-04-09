# UI

> **Navigation aid.** Component inventory and prop signatures extracted via AST. Read the source files before adding props or modifying component logic.

**113 components** (react)

## Client Components

- **ActionsActivityPage** — `mission-control/src/app/actions/activity/page.tsx`
- **ActivityPage** — `mission-control/src/app/activity/page.tsx`
- **ApprovalsPage** — `mission-control/src/app/approvals/page.tsx`
- **AutopilotPage** — `mission-control/src/app/autopilot/page.tsx`
- **BrainDumpPage** — `mission-control/src/app/brain-dump/page.tsx`
- **CheckpointsPage** — `mission-control/src/app/checkpoints/page.tsx`
- **EditAgentPage** — `mission-control/src/app/crew/[id]/edit/page.tsx`
- **AgentPage** — `mission-control/src/app/crew/[id]/page.tsx`
- **NewAgentPage** — `mission-control/src/app/crew/new/page.tsx`
- **CrewPage** — `mission-control/src/app/crew/page.tsx`
- **DecisionsPage** — `mission-control/src/app/decisions/page.tsx`
- **Error** — props: error, reset — `mission-control/src/app/error.tsx`
- **FieldActivityPage** — `mission-control/src/app/field-ops/activity/page.tsx`
- **ApprovalsPage** — `mission-control/src/app/field-ops/approvals/page.tsx`
- **MissionDetailPage** — `mission-control/src/app/field-ops/missions/[id]/page.tsx`
- **MissionsPage** — `mission-control/src/app/field-ops/missions/page.tsx`
- **ConnectionsOverviewPage** — `mission-control/src/app/field-ops/page.tsx`
- **SafetyPage** — `mission-control/src/app/field-ops/safety/page.tsx`
- **ServicesPage** — `mission-control/src/app/field-ops/services/page.tsx`
- **VaultPage** — `mission-control/src/app/field-ops/vault/page.tsx`
- **GlobalError** — props: error, reset — `mission-control/src/app/global-error.tsx`
- **GuidePage** — `mission-control/src/app/guide/page.tsx`
- **InboxPage** — `mission-control/src/app/inbox/page.tsx`
- **InitiativeDetailPage** — `mission-control/src/app/initiatives/[id]/page.tsx`
- **InitiativesPage** — props: open, onOpenChange, onSubmit, parentGoalOptions — `mission-control/src/app/initiatives/page.tsx`
- **LogsPage** — `mission-control/src/app/logs/page.tsx`
- **GoalsPage** — `mission-control/src/app/objectives/page.tsx`
- **CommandCenterPage** — `mission-control/src/app/page.tsx`
- **TasksPage** — `mission-control/src/app/priority-matrix/page.tsx`
- **ProjectsPage** — `mission-control/src/app/projects/page.tsx`
- **SettingsPage** — `mission-control/src/app/settings/page.tsx`
- **SkillEditorPage** — `mission-control/src/app/skills/[id]/page.tsx`
- **NewSkillPage** — `mission-control/src/app/skills/new/page.tsx`
- **SkillsPage** — `mission-control/src/app/skills/page.tsx`
- **KanbanPage** — `mission-control/src/app/status-board/page.tsx`
- **ProjectsPage** — `mission-control/src/app/ventures/page.tsx`
- **ActionDetailPanel** — props: action, open, onClose, onUpdate, agents — `mission-control/src/components/action-detail-panel.tsx`
- **AgentConsole** — props: runId, onStop — `mission-control/src/components/agent-console.tsx`
- **AppSidebar** — props: href, label, icon, isActive, collapsed, onClick, size, badge, badgeDot, tooltipSuffix — `mission-control/src/components/app-sidebar.tsx`
- **AutonomySelector** — props: value, onChange, showInherit — `mission-control/src/components/autonomy-selector.tsx`
- **DraggableTaskCard** — props: task, project, onClick, isSelected, onToggleSelect, isRunning, onRun, pendingDecisionTaskIds, onStatusChange, onDuplicate — `mission-control/src/components/board-view.tsx`
- **BreadcrumbNav** — props: items, className — `mission-control/src/components/breadcrumb-nav.tsx`
- **BulkActionBar** — props: count, onMarkDone, onDelete, onClear — `mission-control/src/components/bulk-action-bar.tsx`
- **CommandBar** — props: onCapture, sidebarOpen, onToggleSidebar, isMobile, tasks, onTaskClick — `mission-control/src/components/command-bar.tsx`
- **ConfirmDialog** — props: open, onOpenChange, title, description, confirmLabel, onConfirm, variant — `mission-control/src/components/confirm-dialog.tsx`
- **AgentContextMenuContent** — props: agent, href, onEdit, onNewTask, onToggleStatus — `mission-control/src/components/context-menus/agent-context-menu.tsx`
- **FieldTaskContextMenuContent** — props: task, onOpen, onEdit, onDelete — `mission-control/src/components/context-menus/field-task-context-menu.tsx`
- **GoalContextMenuContent** — props: goal, onEdit, onAddMilestone, onMarkComplete, onDelete — `mission-control/src/components/context-menus/goal-context-menu.tsx`
- **InitiativeContextMenuContent** — props: initiative, onTogglePause, onArchive, onDelete — `mission-control/src/components/context-menus/initiative-context-menu.tsx`
- **ProjectContextMenuContent** — props: project, href, onEdit, onRun, onArchive, onDelete — `mission-control/src/components/context-menus/project-context-menu.tsx`
- **TaskContextMenuContent** — props: task, onOpen, onStatusChange, onDuplicate, onRun, onDelete — `mission-control/src/components/context-menus/task-context-menu.tsx`
- **CreateGoalDialog** — props: open, onOpenChange, projects, goals, onSubmit, title, type, timeframe, projectId, parentGoalId — `mission-control/src/components/create-goal-dialog.tsx`
- **CreateProjectDialog** — props: open, onOpenChange, onSubmit — `mission-control/src/components/create-project-dialog.tsx`
- **CreateTaskDialog** — props: open, onOpenChange, projects, goals, onSubmit, defaultValues — `mission-control/src/components/create-task-dialog.tsx`
- **DecisionDialog** — props: open, onOpenChange, decision, onAnswered — `mission-control/src/components/decision-dialog.tsx`
- **EditGoalDialog** — props: open, onOpenChange, goal, projects, goals, onSubmit, title, type, timeframe, status — `mission-control/src/components/edit-goal-dialog.tsx`
- **EditProjectDialog** — props: open, onOpenChange, project, agents, onSubmit, name, description, status, color, teamMembers — `mission-control/src/components/edit-project-dialog.tsx`
- **EisenhowerSummary** — props: tasks — `mission-control/src/components/eisenhower-summary.tsx`
- **ActivateServiceDialog** — props: service, catalogEntry, open, onOpenChange, onActivated, updateMode — `mission-control/src/components/field-ops/activate-service-dialog.tsx`
- **CatalogServiceCard** — props: service — `mission-control/src/components/field-ops/catalog-service-card.tsx`
- **ExecutionResultPanel** — props: result, success, className — `mission-control/src/components/field-ops/execution-result-panel.tsx`
- **FieldTaskCard** — props: task, services, onStatusChange, onEdit, onDelete, onReject, onOpen, onExecute, executing, onDryRun — `mission-control/src/components/field-ops/field-task-card.tsx`
- **FieldTaskFormDialog** — props: open, onOpenChange, task, missionId, missionAutonomy, services, onSubmit, title, description, type — `mission-control/src/components/field-ops/field-task-form-dialog.tsx`
- **FinancialOverviewCard** — props: variant — `mission-control/src/components/field-ops/financial-overview-card.tsx`
- **GettingStartedCard** — props: title, description, steps, learnMoreHref, storageKey, accentClass — `mission-control/src/components/field-ops/getting-started-card.tsx`
- **MissionFormDialog** — props: open, onOpenChange, mission, projects, onSubmit, title, description, autonomyLevel, linkedProjectId — `mission-control/src/components/field-ops/mission-form-dialog.tsx`
- **RejectTaskDialog** — props: open, onOpenChange, taskTitle, onReject — `mission-control/src/components/field-ops/reject-task-dialog.tsx`
- **SetupGuideDialog** — props: service, open, onOpenChange — `mission-control/src/components/field-ops/setup-guide-dialog.tsx`
- **SignTransactionButton** — props: taskId, onComplete — `mission-control/src/components/field-ops/sign-transaction-button.tsx`
- **VaultUnlockDialog** — props: open, onOpenChange, onUnlock, context — `mission-control/src/components/field-ops/vault-unlock-dialog.tsx`
- **WalletBalanceCard** — props: onUnlockVault — `mission-control/src/components/field-ops/wallet-balance-card.tsx`
- **WalletConnectButton** — `mission-control/src/components/field-ops/wallet-connect-button.tsx`
- **GoalCard** — props: goal, tasks, projects, milestones, onEdit, onAddMilestone, onMarkComplete, onDelete — `mission-control/src/components/goal-card.tsx`
- **KeyboardShortcuts** — props: onCreateTask — `mission-control/src/components/keyboard-shortcuts.tsx`
- **LayoutShell** — `mission-control/src/components/layout-shell.tsx`
- **MarkdownContent** — props: content, className — `mission-control/src/components/markdown-content.tsx`
- **MentionTextarea** — props: value, onChange, agents, placeholder, className, onSubmit, stagedFiles, onFilesChange — `mission-control/src/components/mention-textarea.tsx`
- **ProjectRunProgress** — props: projectRun, runs, onStop — `mission-control/src/components/mission-progress.tsx`
- **OnboardingDialog** — `mission-control/src/components/onboarding-dialog.tsx`
- **ProjectCardLarge** — props: project, tasks, goals, isRunning, isProjectRunActive, onRun, onStop, onEdit, onArchive, onDelete — `mission-control/src/components/project-card-large.tsx`
- **ProjectDetailPage** — props: parentLabel, parentHref — `mission-control/src/components/project-detail-page.tsx`
- **RunButton** — props: isRunning, onClick, size, disabled, title, isProjectRunActive, onStop — `mission-control/src/components/run-button.tsx`
- **SearchDialog** — `mission-control/src/components/search-dialog.tsx`
- **SidebarFooter** — props: collapsed — `mission-control/src/components/sidebar-footer.tsx`
- **SidebarNav** — `mission-control/src/components/sidebar-nav.tsx`
- **TaskCard** — props: task, project, agents, className, isDragging, onClick, allTasks, pendingDecisionTaskIds, isRunning, onRun — `mission-control/src/components/task-card.tsx`
- **TaskDetailPanel** — props: task, projects, goals, allTasks, onUpdate, onDelete, onClose — `mission-control/src/components/task-detail-panel.tsx`
- **TaskForm** — props: initial, projects, goals, allTasks, currentTaskId, onSubmit, onCancel, submitLabel — `mission-control/src/components/task-form.tsx`
- **ThemeProvider** — `mission-control/src/components/theme-provider.tsx`
- **ThemeToggle** — `mission-control/src/components/theme-toggle.tsx`
- **VaultSecurityDetails** — props: onComplete, onSkip, compact — `mission-control/src/components/vault-setup-wizard.tsx`
- **WorkspaceSwitcher** — props: collapsed — `mission-control/src/components/workspace-switcher.tsx`
- **ActiveRunsProvider** — `mission-control/src/providers/active-runs-provider.tsx`

## Components

- **BrainDumpLoading** — `mission-control/src/app/brain-dump/loading.tsx`
- **CrewLoading** — `mission-control/src/app/crew/loading.tsx`
- **DaemonPage** — `mission-control/src/app/daemon/page.tsx`
- **GoalsPage** — `mission-control/src/app/goals/page.tsx`
- **InboxLoading** — `mission-control/src/app/inbox/loading.tsx`
- **RootLayout** — `mission-control/src/app/layout.tsx`
- **DashboardLoading** — `mission-control/src/app/loading.tsx`
- **NotFound** — `mission-control/src/app/not-found.tsx`
- **PriorityMatrixLoading** — `mission-control/src/app/priority-matrix/loading.tsx`
- **ProjectsDetailPage** — `mission-control/src/app/projects/[id]/page.tsx`
- **SafetyPage** — `mission-control/src/app/safety/page.tsx`
- **ServicesPage** — `mission-control/src/app/services/page.tsx`
- **StatusBoardLoading** — `mission-control/src/app/status-board/loading.tsx`
- **AgentNotFound** — `mission-control/src/app/team/[role]/not-found.tsx`
- **TeamMemberRedirect** — props: params — `mission-control/src/app/team/[role]/page.tsx`
- **VaultPage** — `mission-control/src/app/vault/page.tsx`
- **VenturesDetailPage** — `mission-control/src/app/ventures/[id]/page.tsx`
- **EmptyState** — props: icon, title, description, actionLabel, onAction, className, compact — `mission-control/src/components/empty-state.tsx`
- **ErrorState** — props: message, onRetry, className, compact — `mission-control/src/components/error-state.tsx`
- **TaskCardSkeleton** — `mission-control/src/components/skeletons.tsx`

---
_Back to [overview.md](./overview.md)_