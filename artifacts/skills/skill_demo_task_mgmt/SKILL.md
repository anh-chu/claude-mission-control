---
name: Task Management
description: Manages tasks in Mandio via JSON data files
tags:
  - tasks
  - management
  - workflow
agentIds:
  - developer
  - researcher
  - marketer
  - business-analyst
---

# Task Management

Data is stored in $MANDIO_DATA_DIR/workspaces/<id>/ (defaults to ~/.mandio/workspaces/<id>/). The daemon SOP injects correct file paths at runtime.

## Quick Reference
- AI Context: ai-context.md (read FIRST)
- Tasks: tasks.json
- Goals: goals.json
- Initiatives: initiatives.json

## Creating a Task
Required: id, title, description, importance, urgency, kanban, assignedTo
Generate IDs as: task_{Date.now()}

## After Any Data Modification
Run pnpm gen:context in  to regenerate ai-context.md