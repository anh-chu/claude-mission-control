---
name: task-management
description: >
  Manages tasks in Mandio. Use when creating, updating, or querying tasks,
  goals, projects, or brain dump entries. Applies when the user mentions tasks, priorities,
  to-dos, planning, or asks about what needs to be done.
---

# Task Management in Mandio

Data is stored in `$MANDIO_DATA_DIR/workspaces/<id>/` (defaults to `~/.mandio/workspaces/<id>/`). The daemon SOP injects correct file paths at runtime.

## Quick Reference
- **AI Context**: `ai-context.md` (read this FIRST for a snapshot)
- **Tasks**: `tasks.json`
- **Goals**: `goals.json`
- **Initiatives**: `initiatives.json`
- **Brain Dump**: `brain-dump.json`

## Creating a Task
Required fields: `id`, `title`, `description`, `importance`, `urgency`, `kanban`, `assignedTo`

```json
{
  "id": "task_{Date.now()}",
  "title": "Action-oriented title",
  "description": "What needs to be done",
  "importance": "important",
  "urgency": "urgent",
  "kanban": "not-started",
  "projectId": "proj_001",
  "milestoneId": "mile_001",
  "assignedTo": "developer",
  "tags": ["tag1"],
  "notes": "",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "completedAt": null
}
```

## Updating a Task
- Always update `updatedAt` to current ISO timestamp
- When kanban becomes `"done"`: set `completedAt` to current ISO timestamp
- When kanban changes from `"done"`: set `completedAt` to null

## Agent Assignment Rules
- Code/implementation tasks → `"developer"`
- Research/analysis tasks → `"researcher"`
- Marketing/content tasks → `"marketer"`
- Strategy/planning tasks → `"business-analyst"`
- Decisions/approvals → `"me"`

## After Any Data Modification
Run `pnpm gen:context` in `` to regenerate `ai-context.md`
