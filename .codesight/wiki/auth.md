# Auth

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Auth subsystem handles **1 routes** and touches: auth.

## Routes

- `POST` `/api/field-ops/vault/reset` → out: { error } [auth]
  `mission-control/src/app/api/field-ops/vault/reset/route.ts`

## Middleware

- **owner-guard** (auth) — `mission-control/src/lib/owner-guard.ts`
- **middleware** (auth) — `mission-control/src/middleware.ts`

## Source Files

Read these before implementing or modifying this subsystem:
- `mission-control/src/app/api/field-ops/vault/reset/route.ts`

---
_Back to [overview.md](./overview.md)_