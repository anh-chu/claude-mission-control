---
name: Eisenhower Matrix Triage
description: Applies Eisenhower matrix logic to prioritize work
tags:
  - prioritization
  - eisenhower
  - triage
agentIds:
  - me
  - business-analyst
---

# Eisenhower Matrix Triage

## Quadrant Definitions
| Quadrant | Criteria | Action |
|----------|----------|--------|
| DO | important + urgent | Work on immediately |
| SCHEDULE | important + not-urgent | Block time |
| DELEGATE | not-important + urgent | Assign to agent |
| ELIMINATE | not-important + not-urgent | Drop or defer |

## Triage Rules
1. New tasks default to SCHEDULE unless deadline < 48 hours
2. DELEGATE tasks should always have assignedTo set
3. Review DO quadrant daily