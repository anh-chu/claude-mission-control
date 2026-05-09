# Mandio UI Map — Proposed

Pages, tabs, sections, and what users can do — in hierarchical order.

This is the proposed information architecture. Differences from the current map:

- `/crew` is renamed to `/agents` (route, nav label, detail pages, forms)
- The Agents page gains two tabs from Ops: Autopilot and Runs
- Inside Agents, the Skills tab is renamed Extensions and continues to hold Skills, Plugins, and Commands
- `/ops` is dissolved entirely; Logs moves to Settings under a Diagnostics section
- Home keeps its three tabs unchanged (Overview / Inbox / Activity)
- New index pages exist for projects, initiatives, and milestones under `/work`

---

## Global (present on every page)

- **Top nav** — switch workspaces, create a new workspace, navigate between Home / Work / Brain / Agents / Settings
- **Command bar** (Cmd+K) — search tasks and commands, capture a brain dump
- **Chat sidebar** — open or close a persistent chat panel, browse conversations, pick a model and agent, start a new conversation
- **Keyboard shortcuts** — global hotkey bindings across all pages
- **Offline banner** — shown when the app loses connectivity

---

## `/` — Home

### Overview

- **Attention Required** — review items that need a decision: pending decisions (approve or reject inline), unread agent reports (acknowledge), unprocessed brain dump entries (triage), and stalled DO-quadrant tasks
- **Agents Status** — see which agents are overloaded, waiting on a decision, or blocked by dependencies; click through to an agent
- **Automation Card** — check autopilot status (running or paused), see task count and last poll time; links to `/agents?tab=autopilot`
- **Projects Grid** — see active projects with progress bars; run or stop a project; create a task or project

### Inbox

- See unprocessed brain dump entries with capture date and tags
- Per entry: auto-process it, edit it inline, convert it to a task, archive it, or delete it
- See archived entries

### Activity

- Browse a chronological feed of all system events (task changes, messages, decisions, completions, brain dump processing, agent check-ins)
- Filter by actor and event type
- Respond to pending decisions inline with predefined options or a custom reply

---

## `/work` — Work

Three views of the same task list, toggled from the top bar. Filter by project and assignee in all views.

### Matrix

- See tasks arranged across four Eisenhower quadrants (DO / SCHEDULE / DELEGATE / ELIMINATE)
- Drag a task to a different quadrant to reprioritize it
- Per task: run it, change status, duplicate it, delete it

### Board

- See tasks in kanban columns (Not Started / In Progress / Done)
- Drag a task between columns to update its status
- Same per-task actions as Matrix

### Map

- See all projects, initiatives, and tasks as an interactive node graph
- Pan and zoom the canvas
- Create a new project or initiative from the canvas
- Per project: run it, stop it, archive it, delete it
- Per initiative: edit it, delete it

---

## `/work/projects` — Projects index

- See all projects in a list or grid with name, status, owner, progress, and last activity
- Filter by status, owner, and tag; sort by recency or progress
- Per project: open it, run it, stop it, archive it, delete it
- Create a new project

---

## `/work/initiatives` — Initiatives index

- See all initiatives with name, parent project, status, owner, and task count
- Filter by project, owner, and status
- Per initiative: open it, edit it, archive it, delete it
- Create a new initiative

---

## `/work/milestones` — Milestones index

- See all milestones with name, parent project or initiative, target date, and progress
- Filter by project, initiative, and date range; sort by target date
- Per milestone: open it, edit it, delete it
- Create a new milestone

---

## `/brain` — Brain

Two-panel layout: file tree on the left, file viewer on the right.

### File tree

- Browse all wiki files and folders
- Expand and collapse folders on demand (lazy-loaded)
- Upload files to any folder
- Create new folders
- Delete files and folders (with confirmation)
- Drag a file or folder onto another folder to move it
- See the plugin version; check for updates

**Empty state** (no files yet): initialize the wiki plugin or upload files to get started

### File viewer

Open a file from the tree to view it. The viewer adapts to file type:

| Format | What you can do |
|---|---|
| Markdown | Read rendered content; click wiki-links to navigate; edit with a full editor; save or cancel |
| Plain text | Read pre-formatted content |
| CSV / TSV | Browse tabular data |
| PDF | Read the document |
| Mermaid | View the diagram |
| Jupyter notebook | Browse cells |
| Images | View the image |
| Audio / Video | Play media |
| Word / Excel / PowerPoint | Read the file |
| Source code | Read with syntax highlighting |
| Web app node | Interact via iframe; open fullscreen |
| Everything else | Download or inspect |

Any open file can be deleted from the viewer toolbar.

---

## `/agents` — Agents

Four tabs: Crew / Extensions / Autopilot / Runs.

### Crew

- See all agents in a grid with status, skills, and permission level
- Filter agents by status (active / inactive)
- Set the global permission default that applies to all agents
- Per agent: edit it, create a task for it, toggle active or inactive
- Create a new agent

### Extensions

#### Skills
- See available skills with activation status
- Activate or deactivate a skill; customize or reset it
- Open a skill's detail page

#### Plugins
- See installed plugins with version and category

#### Commands
- See custom slash commands; copy, enable, disable, or delete them
- Create a new command

### Autopilot

- Start and stop the daemon
- Run pre-defined commands (standup, daily-plan, weekly-review, brainstorm, research, plan-feature, ship-feature, pick-up-work, report, orchestrate)
- Schedule a command with a start time and repeat interval (daily, weekly, monthly, or custom cron)
- Browse each agent's conversations
- See run history with status and duration; re-run from history
- Configure max parallel agents and polling interval

### Runs

- See active and recent runs with agent, status, task, and PID
- Open a run's conversation
- See recent failures with error excerpts

---

## `/settings`

- **Appearance** — switch between light, dark, and system theme
- **Workspace** — edit the workspace name and accent color
- **Environment variables** — add, edit, and delete key-value pairs used by the daemon
- **Autopilot** — enable or disable the daemon, toggle polling, set max parallel agents
- **Diagnostics** — tail the daemon log with live streaming; view the application log; search across all log entries
- **Danger zone** — delete the workspace (requires confirmation; disabled for the default workspace)

---

## `/tasks/[id]` — Task Detail

Two-column layout.

### Left column

- Read and edit all task fields: title, description, importance, urgency, kanban status, project, milestone, initiative, assignee, collaborators, tags, subtasks, blocked-by tasks, estimated time, due date, acceptance criteria
- Save or cancel edits
- Deploy the task to an agent via a dropdown
- Delete the task
- See the task's agent conversation; run it if none exists yet

### Right column

- Read and post comments; mention agents with @; attach files
- See a full activity timeline merging events and messages in chronological order

---

## `/agents/[id]` — Agent Detail

- See the agent's profile: name, description, skills, permission level, status
- Edit description and instructions inline
- Browse the agent's tasks filtered by kanban status
- See the agent's conversation and activity log

---

## `/agents/new` and `/agents/[id]/edit` — Agent Form

- Set agent ID, name, description, and icon
- Choose a permission mode (Restricted / Default / Unrestricted)
- Pick skills
- Configure model, max turns, and thinking budget
- Delete the agent (edit form only)

---

## `/projects/[id]` — Project Detail

- See the project's tasks in a kanban board
- Drag tasks between status columns
- Run or stop the project; see run progress
- See project activity

---

## `/initiatives/[id]` — Initiative Detail

- See the initiative's tasks with status, priority, assignee, and due dates
- Create new tasks for this initiative
- Archive or delete the initiative
- See initiative activity

---

## `/skills/[id]` and `/skills/new`

- Create or edit a skill: name, description, category, model config
- Activate or deactivate it
- Delete it (with confirmation)

---

## `/commands/[id]` and `/commands/new`

- Create or edit a custom slash command: name, description, prompt template
- Enable or disable it
- Delete it (with confirmation)
