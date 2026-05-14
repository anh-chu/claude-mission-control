# Payments

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Payments subsystem handles **1 routes** and touches: auth, queue, payment.

## Routes

- `POST` `/api/webhooks` → out: { error } [auth, queue, payment]
  `src/app/api/webhooks/route.ts`

## Source Files

Read these before implementing or modifying this subsystem:
- `src/app/api/webhooks/route.ts`

---
_Back to [overview.md](./overview.md)_