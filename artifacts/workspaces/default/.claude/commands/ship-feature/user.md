Ship the feature: $ARGUMENTS

1. Read $MANDIO_DATA_DIR/workspaces/<id>/ai-context.md for a quick snapshot of current state
2. Read relevant task and milestone from $MANDIO_DATA_DIR/workspaces/<id>/
3. Run the test suite and fix any failures
4. Run typecheck (pnpm tsc --noEmit) and fix errors
5. Run lint (pnpm lint) and fix issues
6. Create a git commit with a descriptive message
7. Update task status to "done" in $MANDIO_DATA_DIR/workspaces/<id>/tasks.json (set completedAt, updatedAt)
8. Update milestone progress in goals.json
9. Check for downstream dependencies: search tasks.json for tasks that have this task's ID in their blockedBy array — if found, note that they may now be unblocked
10. Post a completion report to $MANDIO_DATA_DIR/workspaces/<id>/inbox.json:
    ```json
    {
      "id": "msg_{timestamp}",
      "from": "developer",
      "to": "me",
      "type": "report",
      "taskId": "<task-id>",
      "subject": "Shipped: <feature-name>",
      "body": "<summary of what was shipped, test results, any follow-up needed>",
      "status": "unread",
      "createdAt": "<ISO timestamp>",
      "readAt": null
    }
    ```
11. Log activity in $MANDIO_DATA_DIR/workspaces/<id>/activity-log.json:
    ```json
    {
      "id": "evt_{timestamp}",
      "type": "task_completed",
      "actor": "developer",
      "taskId": "<task-id>",
      "summary": "Shipped: <feature-name>",
      "details": "<commit hash, files changed, test results>",
      "timestamp": "<ISO timestamp>"
    }
    ```
12. Run `pnpm gen:context` in  to regenerate the AI context
13. Report what was shipped and any remaining work

IMPORTANT: Do not skip any verification step. Every step must pass before shipping.
