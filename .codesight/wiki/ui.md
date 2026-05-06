# UI

> **Navigation aid.** Component inventory and prop signatures extracted via AST. Read the source files before adding props or modifying component logic.

**102 components** (react)

## Client Components

- **CommandEditorPage** — `src/app/commands/[id]/page.tsx`
- **NewCommandPage** — `src/app/commands/new/page.tsx`
- **EditAgentPage** — `src/app/crew/[id]/edit/page.tsx`
- **AgentPage** — `src/app/crew/[id]/page.tsx`
- **NewAgentPage** — `src/app/crew/new/page.tsx`
- **CrewPage** — `src/app/crew/page.tsx`
- **BrainPage** — `src/app/documents/page.tsx`
- **Error** — props: error, reset — `src/app/error.tsx`
- **GlobalError** — props: error, reset — `src/app/global-error.tsx`
- **InitiativeDetailPage** — `src/app/initiatives/[id]/page.tsx`
- **CommandCenterPage** — `src/app/page.tsx`
- **TasksPage** — `src/app/priority-matrix/page.tsx`
- **SettingsPage** — `src/app/settings/page.tsx`
- **SkillEditorPage** — `src/app/skills/[id]/page.tsx`
- **NewSkillPage** — `src/app/skills/new/page.tsx`
- **TaskDetailPage** — `src/app/tasks/[id]/page.tsx`
- **AgentForm** — props: mode, initialData, currentStatus, onSave, onDelete, onStatusToggle, onCancel — `src/components/agent-form.tsx`
- **DraggableTaskCard** — props: task, project, onClick, isSelected, onToggleSelect, isRunning, onRun, pendingDecisionTaskIds, onStatusChange, onDuplicate — `src/components/board-view.tsx`
- **BoardColumn** — props: config, tasks, projects, onTaskClick, minHeight, maxHeight, selected, onToggleSelect, runningTaskIds, onRunTask — `src/components/board-view.tsx`
- **BoardPanels** — props: showCreateTask, onCloseCreate, onSubmitCreate — `src/components/board-view.tsx`
- **BoardDndWrapper** — props: activeTask, projects, onDragStart, onDragEnd — `src/components/board-view.tsx`
- **BreadcrumbNav** — props: items, className — `src/components/breadcrumb-nav.tsx`
- **AssistantThread** — props: cwd, context, model, persona, workspaceId — `src/components/chat/AssistantThread.tsx`
- **ChatSidebar** — props: open, onToggle, isMobile — `src/components/chat/ChatSidebar.tsx`
- **DaemonRunViewer** — props: runId — `src/components/chat/DaemonRunViewer.tsx`
- **ReadToolUI** — `src/components/chat/tool-uis.tsx`
- **CommandBar** — props: onCapture, tasks, onTaskClick, commands — `src/components/command-bar.tsx`
- **CommandForm** — props: mode, initialData, onDelete, activationProps — `src/components/command-form.tsx`
- **ConfirmDialog** — props: open, onOpenChange, title, description, confirmLabel, onConfirm, variant — `src/components/confirm-dialog.tsx`
- **AgentContextMenuContent** — props: agent, href, onEdit, onNewTask, onToggleStatus — `src/components/context-menus/agent-context-menu.tsx`
- **InitiativeContextMenuContent** — props: initiative, onTogglePause, onArchive, onDelete — `src/components/context-menus/initiative-context-menu.tsx`
- **ProjectContextMenuContent** — props: project, href, onRun, onArchive, onDelete — `src/components/context-menus/project-context-menu.tsx`
- **TaskContextMenuContent** — props: task, onOpen, onStatusChange, onDuplicate, onRun, onDelete — `src/components/context-menus/task-context-menu.tsx`
- **CreateTaskDialog** — props: open, onOpenChange, onSubmit, defaultValues — `src/components/create-task-dialog.tsx`
- **CrewAutopilot** — `src/components/crew-autopilot.tsx`
- **CrewSkills** — `src/components/crew-skills.tsx`
- **DecisionDialog** — props: open, onOpenChange, decision, onAnswered — `src/components/decision-dialog.tsx`
- **EditorBubbleMenu** — props: editor — `src/components/editor/bubble-menu.tsx`
- **CsvViewer** — props: path — `src/components/editor/csv-viewer.tsx`
- **EditorToolbar** — props: editor — `src/components/editor/editor-toolbar.tsx`
- **KBEditor** — `src/components/editor/editor.tsx`
- **ResizableImage** — `src/components/editor/extensions/resizable-image.tsx`
- **FileFallbackViewer** — props: path — `src/components/editor/file-fallback-viewer.tsx`
- **FolderIndex** — props: folderPath, entries — `src/components/editor/folder-index.tsx`
- **GoogleDocViewer** — props: path, title, google — `src/components/editor/google-doc-viewer.tsx`
- **ImageViewer** — props: path, title — `src/components/editor/image-viewer.tsx`
- **LinkPopover** — props: anchor, initialUrl, onCancel, onApply, onRemove — `src/components/editor/link-popover.tsx`
- **MediaPopover** — props: kind, pagePath, onCancel, onInsert, anchor — `src/components/editor/media-popover.tsx`
- **MediaViewer** — props: path, type — `src/components/editor/media-viewer.tsx`
- **MermaidViewer** — props: path, title — `src/components/editor/mermaid-viewer.tsx`
- **NotebookViewer** — props: path — `src/components/editor/notebook-viewer.tsx`
- **DocxViewer** — props: path, title — `src/components/editor/office/docx-viewer.tsx`
- **OfficeChrome** — props: path, extLabel, external, hideFinder — `src/components/editor/office/office-chrome.tsx`
- **PptxViewer** — props: path, title — `src/components/editor/office/pptx-viewer.tsx`
- **XlsxViewer** — props: path, title — `src/components/editor/office/xlsx-viewer.tsx`
- **PdfViewer** — props: path, title — `src/components/editor/pdf-viewer.tsx`
- **SlashCommands** — props: editor — `src/components/editor/slash-commands.tsx`
- **SourceViewer** — props: path — `src/components/editor/source-viewer.tsx`
- **TableMenu** — props: editor — `src/components/editor/table-menu.tsx`
- **WebsiteViewer** — props: path, title, fullscreen, onExit — `src/components/editor/website-viewer.tsx`
- **DIRS** — `src/components/editor/wiki-link-create-dialog.tsx`
- **WikiLinkPicker** — props: editor, onCreateRequest — `src/components/editor/wiki-link-picker.tsx`
- **HomeActivity** — `src/components/home-activity.tsx`
- **HomeInbox** — `src/components/home-inbox.tsx`
- **HomeLogs** — `src/components/home-logs.tsx`
- **KeyboardShortcuts** — props: onCreateTask — `src/components/keyboard-shortcuts.tsx`
- **ViewerToolbar** — props: path, badge, sublabel, _showBreadcrumb, leading, className — `src/components/layout/viewer-toolbar.tsx`
- **LayoutShell** — `src/components/layout-shell.tsx`
- **MarkdownContent** — props: content, className — `src/components/markdown-content.tsx`
- **MentionTextarea** — props: value, onChange, agents, placeholder, className, onSubmit, stagedFiles, onFilesChange — `src/components/mention-textarea.tsx`
- **ProjectRunProgress** — props: projectRun, runs, onStop — `src/components/mission-progress.tsx`
- **ModelSelect** — props: value, onChange, className — `src/components/model-select.tsx`
- **ProjectCardLarge** — props: project, tasks, isRunning, isProjectRunActive, onRun, onStop, onArchive, onDelete — `src/components/project-card-large.tsx`
- **ProjectDetailPage** — props: parentLabel, parentHref — `src/components/project-detail-page.tsx`
- **ProjectDialog** — props: open, onOpenChange, agents, onSubmit — `src/components/project-dialog.tsx`
- **ProjectInitiativeCanvas** — `src/components/project-initiative-canvas.tsx`
- **RunButton** — props: isRunning, onClick, size, disabled, title, isProjectRunActive, onStop — `src/components/run-button.tsx`
- **SearchDialog** — `src/components/search-dialog.tsx`
- **SkillForm** — props: mode, initialData, onDelete, activationProps — `src/components/skill-form.tsx`
- **TaskCard** — props: task, project, agents, className, isDragging, onClick, allTasks, pendingDecisionTaskIds, isRunning, onRun — `src/components/task-card.tsx`
- **TaskForm** — props: initial, allTasks, currentTaskId, onSubmit, onCancel, submitLabel — `src/components/task-form.tsx`
- **ThemeProvider** — `src/components/theme-provider.tsx`
- **ThemeToggle** — `src/components/theme-toggle.tsx`
- **TopNav** — `src/components/top-nav.tsx`
- **FrontmatterHeader** — props: data — `src/components/wiki/frontmatter-header.tsx`
- **WorkMapView** — `src/components/work-map-view.tsx`
- **ActiveRunsProvider** — `src/providers/active-runs-provider.tsx`

## Components

- **CrewLoading** — `src/app/crew/loading.tsx`
- **InitiativesPage** — `src/app/initiatives/page.tsx`
- **RootLayout** — `src/app/layout.tsx`
- **HomeContentSkeleton** — `src/app/loading.tsx`
- **HomeLoading** — `src/app/loading.tsx`
- **NotFound** — `src/app/not-found.tsx`
- **PriorityMatrixLoading** — `src/app/priority-matrix/loading.tsx`
- **ProjectsDetailPage** — `src/app/projects/[id]/page.tsx`
- **ProjectsPage** — `src/app/projects/page.tsx`
- **EmptyState** — props: Icon, title, description, actionLabel, onAction, className, compact — `src/components/empty-state.tsx`
- **ErrorState** — props: message, onRetry, className, compact — `src/components/error-state.tsx`
- **CardSkeleton** — props: className, lines, footer, footerClassName, childrenPosition — `src/components/skeletons.tsx`
- **RowSkeleton** — props: className, leading, lines, trailing, linesClassName, trailingClassName — `src/components/skeletons.tsx`
- **GridSkeleton** — props: className, count, renderItem — `src/components/skeletons.tsx`
- **PageSkeleton** — props: className — `src/components/skeletons.tsx`

---
_Back to [overview.md](./overview.md)_