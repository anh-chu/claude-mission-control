# Mandio UI Map

Pages → tabs → every widget, view, and interactive element.

---

## Cross-cutting Components (always available)

| Component | Widgets |
|---|---|
| **TopNav** | Workspace switcher dropdown (name + color dot, check mark on active, New Workspace item), New Workspace dialog (name input, color swatch picker, Create / Cancel), nav links (Home / Work / Wiki / Agents) with icon + expand-on-hover label, active state highlighting |
| **CommandBar** | Cmd+K palette: task search, command search, brain dump capture textarea + submit |
| **SearchDialog** | Modal: global search input, results list (tasks, projects, documents) |
| **ChatSidebar** | Toggle button (right edge), conversation list, conversation view, model selector dropdown, agent selector, new conversation button, localStorage persistence |
| **KeyboardShortcuts** | Global hotkey bindings |
| **ActiveRunsProvider** | Context: running task ID set, run/stop methods, poll trigger (used across Home, Tasks, Crew) |
| **LayoutShell** | Skip-to-content link, offline banner (red pulsing dot + message), main content wrapper with padding + chat sidebar margin offset |

---

## `/` — Home / Command Center

**Tabs:** Overview | Inbox | Activity | Logs *(tab bar links with active highlight)*

### Tag: Overview

| Section | Widgets & Views |
|---|---|
| **Empty State** | Rocket icon, "Welcome to Mandio" heading + subtitle, 3 CTA cards (Create a project / Add your first task / Deploy AI agents), CreateTaskDialog, ProjectDialog |
| **Error Banner** | Inline error message + Retry button (shown when dashboard API fails) |
| **Automation Card** | Link to `/autopilot`, Rocket icon, status dot (pulsing amber when running), agent active count + tasks completed, last poll time, Active/Paused badge, "View Details →" arrow |
| **Attention Required Card** | AlertTriangle icon, header "Attention Required" with count badge, scrollable list of: <br>• Pending decisions (red icon, question text, context excerpt, inline Approve/Reject buttons or custom options) <br>• Unread reports (yellow icon, subject + body, Ack button) <br>• Unprocessed brain dump entries (yellow icon, content preview, "Triage" link) <br>• DO-quadrant tasks not started (ShieldAlert icon, count, links to `/priority-matrix`) <br>• Recent completions (CheckSquare icon, count, links to `/priority-matrix`) |
| **Crew Status Card** | "Crew Status" header with User icon + "View all →" link to `/crew`. Agents with non-nominal status: overloaded (red dot), awaiting decision (amber dot), dependencies (blue dot). Each row: agent icon, name, status badge, task count, current task title, dependency/decision sub-lines. "All agents nominal" message when none need attention. |
| **Projects Grid** | "Projects" section header with Sparkles icon + New Task / New Project buttons + "View all →" link to `/map`. Grid of active project cards (ProjectCardLarge with name, color, description, tags, task count, progress bar, run/stop buttons). Dashed "Create your first project" CTA card when no active projects. |
| **Create Task Dialog** | Modal: title, description, importance/urgency selectors, kanban status, project + initiative + milestone pickers, assignee + collaborators, tags, subtasks, blocked-by task selector, estimated minutes, due date, acceptance criteria textarea, Submit |
| **Project Dialog** | Modal: name, description, color swatch picker, status selector, team members, tags |

### Tag: Inbox

| Section | Widgets & Views |
|---|---|
| **Header** | Lightbulb icon, "Inbox" title, unprocessed count badge, "Auto-Process All" button (with spinner when processing) |
| **To Process Section** | Heading "(N) to process". Card list per entry: content text, capture date, tag badges, inline actions: Auto-process (Zap icon + spinner), Edit (Pencil icon → expands inline textarea with Save/Cancel), Convert to Task (→ CreateTaskDialog with pre-filled content), Archive, Delete (with ConfirmDialog). Pulsing border animation on processing entries. |
| **Archived Section** | Heading "Archived (N)". Striked-through content per card, conversion target label, Delete button per entry. |
| **Processing Hook** | 5s polling while entries are being auto-processed, visibility-aware |

### Tag: Activity

| Section | Widgets & Views |
|---|---|
| **Filter Bar** | Search input, Actor dropdown select (all actors + per-agent), Event type dropdown select (12 types: Task Created/Updated/Completed/Delegated/Failed, Message Sent, Decision Requested/Answered, Brain Dump Processed, Milestone Completed, Agent Check-in), Clear filters button |
| **Feed** | Day-grouped event list with date header + count badge. Per event row: actor avatar circle + icon, actor name, event type badge (color-coded), time, summary text, details excerpt (2-line clamp). For decision_requested events: inline decision answer buttons (predefined options + custom text input + Send), answered state shows answer value. |
| **Empty/Error States** | Skeleton loader (8 rows), ErrorState with retry, EmptyState with filter context |

### Tag: Logs

| Section | Widgets & Views |
|---|---|
| **Header** | "Ops / Debug" heading, description, run count badge, Live toggle button (pulsing icon + animate-pulse), Pause/Play button (when live) |
| **Log Tabs** | Tab bar: All / Daemon / App / Runs |
| **Search** | Search input (filters log lines + run entries by substring) |
| **Daemon Log Tail** | Card: title "System Log Tail", description with live/refresh context, pre-formatted monospace text block (max-h 420px, scrollable, auto-scroll on live). States: Loading / Error / Empty / Populated. Live streaming via EventSource, live lines merged at bottom. |
| **App Log Tail** | Card: title "App Log Tail", same structure but no live streaming. |
| **Active/Recent Runs** | Card: "Active and Recent Runs" header. Scrollable list of run entries: agent ID badge, status badge (running=amber, completed=green, failed=red, timeout=yellow), task ID badge, source badge, run ID, started time + relative, PID, "Open Console" button per entry. |
| **Recent Failures** | Card: "Recent Failures" header. Per failure: agent ID badge, status badge, source badge, task ID, started time, error excerpt pre (500 char max, monospace, red text, background highlight). |
| **Run Console** | Card (toggled by "Open Console"): title "Run Console", description "Conversation for this run" or "Live stream...", Close button. Links to ConversationView for the run's task ID. States: linking spinner, no conversation message. |

---

## `/priority-matrix` — Work / Tasks

**View toggles:** Matrix | Board | Map *(segmented button group with Tip tooltips)*

**Cross-cutting:** Project filter dropdown, Assignee filter dropdown, Create Task button

### Views

| View | Widgets & Views |
|---|---|
| **Eisenhower Matrix** | 2x2 grid of droppable quadrants (DO / SCHEDULE / DELEGATE / ELIMINATE), each with subtitle + color indicator dot. Task cards inside each quadrant are draggable. Per task card: title, quadrant badge, project tag, agent assignee avatar, due date, subtask progress, dependency count, checkbox selector, dropdown menu (Status change / Duplicate / Delete). |
| **Kanban Board** | 3-column droppable zones (Not Started / In Progress / Done). Task cards same as above. Drag between columns changes kanban status. |
| **Project Map** | ReactFlow canvas (see `/map` below) |
| **Task Card (shared)** | Draggable card with: drag handle, title, quadrant badge, project badge, tags, assignee, due date, subtask progress, dependency count, run button, selection checkbox, context menu options (Change status / Duplicate / Delete). Hover edit controls. Dnd-kit powered. |
| **BoardPanels** | Side panels: task detail (shown when card clicked via router), create-task dialog |

---

## `/documents` — Wiki / Brain

**Two-panel layout:** Tree sidebar (left, 272px) + Viewer panel (right, flex)

### Tree Sidebar Panel

| Section | Widgets & Views |
|---|---|
| **Header** | "Brain" breadcrumb, New root folder button, Upload to root button |
| **Upload Error** | Inline alert (AlertCircle) when upload fails |
| **Root-level Folder Input** | Inline input (shown when creating root folder): Folder icon, text input, error message, Check/ X buttons, keyboard Enter/Escape support |
| **Tree View** | Scrollable file tree with lazy-load. Per node: indentation, folder expand/collapse (ChevronDown/ChevronRight + spin loader), icon (FolderOpen/Folder for dirs, FileText/File/ImageIcon/Globe per type), name label, dimmed for dotfiles. Hover toolbar: Upload (dirs only), New subfolder (dirs only), Delete. Drag-to-move: dragStart/dragOver/drop handlers, ring highlight on valid drop targets. Empty subtree shows "Empty" label. |
| **Empty Tree State** | FileText icon in circle, "No files yet" heading + subtext, two CTA buttons: "Initialize Wiki Plugin" (with spinner), "Upload Files" |
| **Footer** | Plugin version label + "just updated" indicator, Check for Updates / Initialize button |

### Viewer Panel

| Section | Widgets & Views |
|---|---|
| **File Header** | File type icon (ImageIcon/FileText/File/Globe), full path title, toolbar: Edit (Pencil, for text files), Open as app (for app nodes, toggles fullscreen), Close (X) |
| **Viewer Router** | Auto-detects viewer by extension: <br>• `.md/.markdown` → Markdown editor (KBEditor) with wikilinks<br>• `.txt` → Plain text viewer<br>• `.csv/.tsv` → CsvViewer<br>• `.pdf` → PdfViewer<br>• `.mmd/.mermaid` → MermaidViewer<br>• `.ipynb` → NotebookViewer<br>• images → ImageViewer<br>• audio/video → MediaViewer<br>• `.docx` → DocxViewer<br>• `.xlsx/.xlsm` → XlsxViewer<br>• `.pptx` → PptxViewer<br>• source code → SourceViewer (syntax highlighted)<br>• apps → WebsiteViewer (iframe)<br>• fallback → FileFallbackViewer |
| **Markdown Editor** | Frontmatter header display (key-value), full markdown rendering (remark-gfm + custom wikilinks plugin). Styled heading hierarchy, lists, blockquotes, code blocks (inline + fenced), tables, links (external + wiki-link with broken-state detection via slug store), horizontal rules, emphasis. Wiki-links: slug lookup, broken-link styling, click navigates to target file. |
| **Editor Mode** | KBEditor component (loaded via editor-store), full editing toolbar, Save/Cancel footer with error display |
| **No Selection State** | FileText icon, "Select a file to view or edit" |
| **File Input** | Hidden `<input type="file" multiple>` triggered by Upload buttons |
| **Confirm Dialog** | Delete confirmation (file vs directory variant with content warning) |

---

## `/crew` — Agents

**Tabs:** Crew | Autopilot | Skills *(tab bar with active highlight)*

### Tag: Crew

| Section | Widgets & Views |
|---|---|
| **Header** | "Agents" title, agent count subtitle, "New Agent" button (→ `/crew/new`) |
| **Global Permission Default** | Card: label + description, On/Off toggle buttons (Off=default, On=warning color) |
| **Status Filter** | Button group: all / active / inactive |
| **Agent Cards Grid** | 3-column responsive grid. Per card: round icon, name, description (1-line clamp), skill ID badges (up to 3 + "+N" overflow), status dot (amber=active, gray=inactive), footer with task count, permission badge (Unrestricted=warning/Default=muted/Restricted=muted), skill count. Hover: shadow lift + border highlight + color change. |
| **Context Menu** | Right-click: Edit, New Task, Toggle Status (active ↔ inactive) |
| **Empty State** | Users icon, "No agents found" with contextual description, "Create an agent" CTA |
| **Create Task Dialog** | Modal (same as Home) |

### Tag: Autopilot

| Section | Widgets & Views |
|---|---|
| **Daemon Status Bar** | Status badge (Running/Stopped), Start/Stop button, polling indicator |
| **Commands List** | Pre-defined command buttons (standup, daily-plan, weekly-review, brainstorm, research, plan-feature, ship-feature, pick-up-work, report, orchestrate) with dispatch + schedule support |
| **Scheduler** | Per-command: start-at datetime picker, repeat interval selector (Once / Daily / Weekly / Monthly / Custom cron), day-of-week checkboxes (for weekly), cron expression display + auto-derivation, Save/Clear |
| **Agent Conversations** | Per-agent accordion: conversation list items (title, last message preview, timestamp), click to expand ConversationView, embed mode |
| **Run History** | Table/cards of past runs with status, duration, timestamps, re-run button |
| **Concurrency/Polling Controls** | Max parallel agents input, polling interval display |

### Tag: Skills

| Section | Widgets & Views |
|---|---|
| **Tabs (sub)** | Skills Library / Plugins / Commands |
| **Skills Library** | Grid of skill cards: name, description, category tags, activation status (border + background highlight), activate/deactivate toggle switch, customize link, reset link, click → `/skills/[id]`. Link-powered. |
| **Plugins Library** | Installed plugin list: name, version, category badge, description |
| **Commands Library** | Custom slash command list: command name, description, Copy to clipboard button, enable/disable toggle, delete |

---

## `/map` — Project-Initiative Canvas
*Redirect target for `/initiatives` and `/projects`.*

| Section | Widgets & Views |
|---|---|
| **ReactFlow Canvas** | Interactive graph with zoom, pan, controls, background grid. Nodes: Project nodes (rounded, colored by project color, name, child counts, run/stop/archive/delete actions), Initiative nodes (status badge, title, task count, color dot, edit/delete), Task nodes (title, quadrant badge, assignee, status badge). Edges: project→initiative, initiative→task, task→task dependencies (marker arrows). |
| **Create Initiative Dialog** | Modal: title, description, color swatch, project selector, Submit |
| **Create Project Dialog** | Modal: name, description, color, status, team members, tags |
| **Task Card** (inline canvas) | Draggable within canvas, same structure as priority-matrix |
| **Context Menus** | Right-click on project → Archive / Delete, on initiative → Edit / Delete |

---

## `/settings`

| Section | Widgets & Views |
|---|---|
| **Appearance** | Theme toggle button group: Light (Sun), Dark (Moon), System (Monitor) |
| **Workspace Settings** | Name input (max-w-sm), Color swatch picker (8 color circles, scale + border on selected), Save button (Saved feedback, 2s timeout) |
| **Environment Variables** | Key-value editor rows: key input (mono, 160px), "=" label, password-masked value input (show-on-hover), remove row button. "Add variable" button, Save button. Empty state message. |
| **Autopilot (Daemon Config)** | Daemon status badge + Enable/Disable button, Polling toggle switch, Max parallel agents number input (1-10), Save button (Saved feedback) |
| **Danger Zone** | Red-bordered card: "Delete workspace" label + description, Delete button (disabled for default workspace), ConfirmDialog (workspace name in description, "Delete workspace" confirm label) |

---

## `/tasks/[id]` — Task Detail

**Two-column layout (8+4)**

### Left Column

| Section | Widgets & Views |
|---|---|
| **Top Bar** | Back arrow button, breadcrumb trail (Projects / Project Name / Task Title, or Tasks / Task Title) |
| **Badge Strip** | Quadrant badge (color-coded: DO/SCHEDULE/DELEGATE/ELIMINATE), Project badge (border colored), Subtask progress badge (check icon, N/M), Dependency badges (pending count or total, accent highlight for unmet), Awaiting Decision badge (amber, clock icon), Acceptance criteria badge (N criteria) |
| **Action Toolbar** | Deploy to agent dropdown (Rocket icon): per active agent row (icon, name, "active" badge on current assignee), Delete button (Trash2, red, with ConfirmDialog) |
| **Task Form** | Title input, Description textarea, Importance/Urgency selectors (important/not-important, urgent/not-urgent), Kanban status dropdown, Project selector, Milestone selector, Initiative selector, Assignee dropdown, Collaborators multi-select, Tags input, Subtasks (inline editable list with done checkboxes + add/remove), Blocked-by task selector (multi), Estimated minutes, Due date picker, Acceptance criteria textarea, Submit "Save Changes" / Cancel |
| **Timestamps** | Created date, Updated date, Estimated time |
| **Conversation Card** | "Conversation" header. If conversationId exists: embedded ConversationView (scrollable, max-h 600px). If not: "No conversation yet" message + Run task button. |

### Right Column (sticky)

| Section | Widgets & Views |
|---|---|
| **Comments Card** | "Comments (N)" header. Scrollable list (max-h 500px): per comment (author icon circle, agent name or "System"/"Me", timestamp, delete button on hover, markdown content, file attachments as images or links). Agent comments get left accent border. Empty: "No comments yet". Bottom: MentionTextarea (with @agent auto-complete), staged file chips, Send button (highlights when @mentions present). |
| **Activity Timeline** | Collapsible card (Clock icon, "Timeline (N)" header). Merged event + message list sorted chronologically. Per item: actor icon, summary, timestamp, type badge (activity / message), timeline dot connector line. |

---

## `/crew/[id]` — Agent Detail

| Section | Widgets & Views |
|---|---|
| **Agent Profile Header** | Agent icon (large, colored circle), name, description, status dot (amber/gray), skill ID badges list, permission badge, inline edit (description + instructions: Pencil → inline textarea → Save/Cancel with loading spinner) |
| **Task List** | Filterable by kanban status tabs. Task cards with quadrant badge, project tag, due date, run button. |
| **Conversation** | Link to agent's conversation |
| **Activity** | Per-agent activity log events |

---

## `/crew/[id]/edit` & `/crew/new` — Agent Form

| Section | Widgets & Views |
|---|---|
| **Agent Form** | Agent ID input, Name, Description textarea, Icon selector, Permission mode radio (Restricted / Default / Unrestricted), Skill IDs multi-select/picker, Claude Code config: model selector, max turns input, thinking budget input, Save, Delete |

---

## `/projects/[id]` — Project Detail

| Section | Widgets & Views |
|---|---|
| **Project Header** | Project name, color indicator, status badge, tags list |
| **Task Board** | Droppable kanban zones (Not Started / In Progress / Done) with draggable task cards, same structure as priority-matrix |
| **Run Progress** | ProjectRunProgress bar, RunButton (Run/Stop), task count |
| **Activity** | Per-project activity log |

---

## `/initiatives/[id]` — Initiative Detail

| Section | Widgets & Views |
|---|---|
| **Initiative Header** | Title, description, status badge, color indicator, parent project link |
| **Task List** | Cards with status badges, quadrant badges, assignee, due dates, subtask progress |
| **Quick Actions** | Create Task button, archive/delete |
| **Activity** | Per-initiative activity log |

---

## `/skills/[id]` & `/skills/new` & `/commands/[id]` & `/commands/new`

**Skill / Command Forms (shared)**

| Section | Widgets & Views |
|---|---|
| **Form** | Name, Description textarea, Category/tags, Prompt template (for commands), Model config, Activation toggle (with spinner), Delete (with confirm) |
