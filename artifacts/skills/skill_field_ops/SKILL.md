---
name: Field Ops Integration
description: Enables agents to create, manage, and monitor Field Ops tasks (external actions like tweets, payments, deployments) via the Field Ops API
tags:
  - field-ops
  - external-actions
  - social-media
  - automation
  - execution
agentIds:
  - developer
  - marketer
  - business-analyst
---

# Field Ops Integration

Field Ops is the system for executing external actions — social media posts, crypto transfers, email campaigns, payments, and more. As an agent, you can create field tasks, submit them for approval, and check results.

## Reading Field Ops State

Read these files directly for awareness:
- `field-ops/services.json` — connected external services
- `field-ops/missions.json` — field missions (groups of tasks)
- `field-ops/tasks.json` — individual field tasks and their status
- `field-ops/activity-log.json` — execution history

Also check `ai-context.md` which includes a Field Ops Status section.

### Service Status Check

Before creating tasks, check the service's `status` in `services.json`:
- `connected` — ready to use
- `saved` — credentials saved but not activated/verified yet
- `disconnected` — not usable, needs human to reconnect

Only create tasks for services with status `connected` or `saved`.
## Field Task Lifecycle

```
draft → pending-approval → approved → executing → completed (done)
           ↘ rejected → draft (resubmit after fixing)
                         failed → draft (retry)
```

Key rules:
- If `approvalRequired: true`, you MUST go draft → pending-approval → approved. Direct draft → approved returns 403.
- `failed` and `rejected` are NOT terminal — transition back to `draft` to retry or resubmit.
- After rejection, check `rejectionFeedback` for what to fix before resubmitting.

### Risk Classification & Approval

| Task Type | Base Risk | Approval Notes |
|-----------|-----------|----------------|
| social-post | medium | Escalates to HIGH if service is high-risk |
| crypto-transfer | high | Always requires approval regardless of autonomy |
| custom | high | Always requires approval (security policy) |
| design | low | May auto-execute under full-autonomy missions |
| email-campaign | medium | Depends on mission autonomy level |
| publish | medium | Depends on mission autonomy level |
| payment | high | Always requires approval |

Mission `autonomyLevel` controls when approval is needed:
- `approve-all` — ALL tasks require human approval
- `approve-high-risk` — only HIGH risk tasks need approval
- `full-autonomy` — only HIGH risk + custom tasks need approval

### Circuit Breaker

3 consecutive failed tasks in a mission will auto-pause the mission. If your tasks aren't executing, check the mission status — it may be paused. The human must resume it.

## Creating a Field Mission

POST `http://localhost:3000/api/field-ops/missions`
```json
{
  "title": "Q2 Social Campaign",
  "description": "Post announcements across social channels",
  "autonomyLevel": "approve-all",
  "linkedProjectId": "proj_xxx",
  "actor": "<your-agent-id>"
}
```

## Creating a Field Task

POST `http://localhost:3000/api/field-ops/tasks`
```json
{
  "title": "Post launch announcement on Twitter",
  "description": "Announce the v1.0 launch with key features",
  "type": "social-post",
  "serviceId": "twitter",
  "missionId": "fmission_xxx",
  "assignedTo": "<your-agent-id>",
  "status": "draft",
  "approvalRequired": true,
  "payload": {
    "operation": "tweet",
    "text": "Exciting news! We just launched v1.0..."
  },
  "linkedTaskId": "task_xxx",
  "actor": "<your-agent-id>"
}
```

Payload must be under 10KB. Setting `linkedTaskId` automatically cross-links the regular task.

Optional fields:
- `scheduledFor`: ISO timestamp to delay execution (e.g. `"2026-03-17T09:00:00Z"` for tomorrow 9am)
- `blockedBy`: array of field task IDs that must complete first (auto-unblocked on completion)

### Payload Examples by Type

**social-post (Twitter):**
```json
{ "operation": "tweet", "text": "Your tweet text here" }
```

**crypto-transfer (Ethereum):**
```json
{ "operation": "send-usdc", "to": "0x...", "amount": "50" }
```
Operations: `send-usdc`, `send-eth`

**custom:**
```json
{ "operation": "custom", "data": { ... } }
```

## Submitting for Approval

### Single task:
PUT `http://localhost:3000/api/field-ops/tasks`
```json
{ "id": "ftask_xxx", "status": "pending-approval", "actor": "<your-agent-id>" }
```

### Batch (multiple tasks at once):
POST `http://localhost:3000/api/field-ops/batch`
```json
{
  "action": "submit-for-approval",
  "taskIds": ["ftask_xxx", "ftask_yyy", "ftask_zzz"],
  "actor": "<your-agent-id>"
}
```
Batch actions: `submit-for-approval`, `approve`, `reject`. Max 50 tasks per batch.

## Using Templates

Templates are pre-built field task configurations with variable slots.

### List templates:
GET `http://localhost:3000/api/field-ops/templates`
### Create from template:
POST `http://localhost:3000/api/field-ops/templates/instantiate`
```json
{
  "templateId": "ftpl_xxx",
  "missionId": "fmission_xxx",
  "assignedTo": "<your-agent-id>",
  "variables": { "product": "Mandio", "url": "https://example.com" },
  "actor": "<your-agent-id>"
}
```
Template payloads use `{{variableName}}` syntax — provide values in `variables`.

## Task Chaining

Set `blockedBy: ["ftask_aaa"]` on a task to block it until `ftask_aaa` completes. When a task completes, all downstream tasks are automatically unblocked. Use this for sequential workflows like: post tweet A → post reply B using A's URL.
## Checking Results

Read `field-ops/tasks.json` and look for:
- `status: "completed"` — check the `result` field for output data (tweet URL, tx hash, etc.)
- `status: "failed"` — check `result.error` for failure reason. Transition back to `draft` to retry.
- `status: "rejected"` — check `rejectionFeedback` for human feedback. Fix and resubmit as `draft`.

Results also appear in your inbox as notifications automatically.

## Cross-Linking with Regular Tasks

When creating field tasks from a regular task assignment, set `linkedTaskId` on the field task pointing to your regular task ID. The reverse link (`fieldTaskIds` on the regular task) is created automatically.
## Task Types

| Type | Service | Use For |
|------|---------|--------|
| social-post | twitter, linkedin | Posting on social media |
| crypto-transfer | ethereum-wallet | Sending cryptocurrency |
| email-campaign | mailchimp, sendgrid | Email blasts |
| payment | stripe | Processing payments |
| publish | vercel, netlify | Deploying websites |
| design | figma | Design assets |
| custom | any | Anything else |

## Best Practices

1. Always create field tasks as `draft` first, then submit for approval
2. Check service status before creating tasks — only use `connected` or `saved` services
3. Group related tasks under a single mission
4. Use descriptive titles — humans review these for approval
5. Include all necessary data in the payload (under 10KB) — adapters use it directly
6. Set `linkedTaskId` to connect field tasks back to your regular task (reverse link is automatic)
7. Use batch API when submitting multiple tasks for approval
8. Use templates for repetitive task patterns
9. Set `scheduledFor` for time-sensitive posts (e.g. schedule tweets for optimal times)
10. After creating tasks, mention them in your completion report
11. If tasks fail, check `result.error` and retry by transitioning back to `draft`
12. If a mission seems stuck, check its status — the circuit breaker may have paused it