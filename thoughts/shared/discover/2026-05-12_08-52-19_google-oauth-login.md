---
date: 2026-05-12T08:52:19+0000
author: Anh Chu
commit: 41e4ee1
branch: main
repository: ccmc
topic: "Google OAuth login"
tags: [intent, frd, auth, middleware, nextauth]
status: complete
last_updated: 2026-05-12T08:52:19+0000
last_updated_by: Anh Chu
---

# FRD: Google OAuth Login

## Summary
Add Google OAuth login to an app that currently has no user authentication. Users sign in with their Google account via a dedicated /login page. Access is restricted to an allowlist of email addresses configured via environment variable. The existing Bearer token auth (MANDIO_API_TOKEN) is replaced by session-based auth. Workspaces remain independent of user identity.

## Problem & Intent
The app needs end-user login. Today it has no authentication — just a shared Bearer token for API access. Users need to sign in with Google to access the app, and only specific people (allowlisted by email) should be allowed in.

## Goals
- Users can sign in with their Google account
- Only allowlisted email addresses can access the app
- Unauthenticated users are redirected to a /login page
- The existing Bearer token auth is replaced by session cookies
- Sessions persist for 30 days

## Non-Goals
- Multi-provider OAuth (GitHub, Microsoft, etc.) — Google only for now
- User-facing profile/settings page — no user display in the UI
- Tying workspaces to user identity — workspaces stay independent
- Admin UI for managing the allowlist — env var is sufficient
- Password-based or magic-link auth

## Functional Requirements
1. The system SHALL authenticate users via Google OAuth using Auth.js v5
2. The system SHALL restrict access to email addresses listed in an ALLOWED_EMAILS environment variable
3. The system SHALL redirect unauthenticated requests to /login
4. The system SHALL display a dedicated /login page with a "Sign in with Google" button
5. The system SHALL issue session cookies valid for 30 days
6. The system SHALL replace the existing Bearer token auth (MANDIO_API_TOKEN / NEXT_PUBLIC_MANDIO_API_TOKEN) with session-based auth for all /api/* routes
7. The system SHALL consolidate the existing proxy.ts middleware logic (CSRF, workspace header injection) into src/middleware.ts alongside auth checks
8. The system SHALL keep workspace selection (workspace_id cookie) independent of user identity

## Non-Functional Requirements
- **Performance**: Standard OAuth flow latency is acceptable. No specific throughput constraints.
- **Security**: Session cookies must be httpOnly and secure in production. CSRF protection from existing proxy.ts must be preserved. Timing-safe token comparison logic should be retained if Bearer token fallback is kept.
- **UX / Accessibility**: /login page must be accessible (keyboard navigable, screen-reader friendly). No user identity display in the UI for now.
- **Reliability**: If Google OAuth is unreachable, show a clear error message on /login. Session invalidation on sign-out must be immediate.

## Constraints & Assumptions
- Next.js App Router — Auth.js v5 has first-class support
- The app is deployed in an environment where environment variables are configurable
- Google Cloud project with OAuth 2.0 credentials (CLIENT_ID, CLIENT_SECRET) must exist
- The existing workspace_id cookie mechanism is preserved as-is

## Acceptance Criteria
- [ ] Visiting any page without a session redirects to /login
- [ ] Clicking "Sign in with Google" on /login initiates the Google OAuth flow
- [ ] A user with an allowlisted email completes login and lands on the app
- [ ] A user with a non-allowlisted email is rejected with a clear error
- [ ] Session persists across browser restarts for 30 days
- [ ] Signing out invalidates the session and redirects to /login
- [ ] API routes accept session cookies instead of Bearer tokens
- [ ] Existing CSRF protection and workspace header injection continue to work

## Recommended Approach
Use Auth.js v5 with the Google provider. Create a src/middleware.ts that combines the existing proxy logic (CSRF, workspace injection) with Auth.js session checks. Add a SessionProvider to the root layout. Create a /login page. Configure ALLOWED_EMAILS as a comma-separated env var. Update apiFetch to use session cookies instead of Bearer tokens.

## Decisions

### Auth library
**Question**: The app uses Next.js App Router with no existing auth. NextAuth.js (Auth.js v5) is the standard for Google OAuth in this setup. Use it?
**Recommended**: NextAuth.js / Auth.js v5
**Chosen**: NextAuth.js / Auth.js v5
**Rationale**: First-class Next.js App Router support, handles Google OAuth flow, session management, and JWT/cookie handling

### Middleware consolidation
**Question**: The current API middleware lives in src/proxy.ts. Next.js auto-detects middleware from src/middleware.ts. Should we consolidate auth into a single middleware file?
**Recommended**: Move to src/middleware.ts
**Chosen**: Move to src/middleware.ts
**Rationale**: Combine proxy logic + auth checks in the standard Next.js middleware location

### Access model
**Question**: Who should be able to log in? This affects whether we need an allowlist or open registration.
**Recommended**: Allowlist only
**Chosen**: Allowlist only
**Rationale**: Only specific email addresses or domains can sign in

### Allowlist configuration
**Question**: How should the allowlist be configured?
**Recommended**: Environment variable (ALLOWED_EMAILS=alice@co.com,bob@co.com)
**Chosen**: Environment variable
**Rationale**: Simple, restart to change, works for small teams

### API auth replacement
**Question**: The app currently has a Bearer token (MANDIO_API_TOKEN) protecting all /api/* routes. What happens to it after OAuth is added?
**Recommended**: Replace with session auth
**Chosen**: Replace with session auth
**Rationale**: OAuth session cookies replace the Bearer token entirely. apiFetch uses session cookies instead of tokens.

### Login page
**Question**: What should unauthenticated users see when they visit the app?
**Recommended**: Dedicated login page (/login)
**Chosen**: Dedicated login page
**Rationale**: A /login page with "Sign in with Google" button. Middleware redirects all unauthenticated requests there.

### Workspace independence
**Question**: Workspaces are currently selected via a cookie (workspace_id), not tied to any user. Should OAuth change this?
**Recommended**: Keep separate
**Chosen**: Keep separate
**Rationale**: Workspace selection stays independent of user identity. Simpler migration.

### User display
**Question**: Should the logged-in user's name or email be visible anywhere in the UI?
**Recommended**: None for now
**Chosen**: None for now
**Rationale**: No visible user identity in the UI. Just protect routes, don't show who's logged in.

### Session duration
**Question**: How long should a login session last before requiring re-authentication?
**Recommended**: 30 days
**Chosen**: 30 days
**Rationale**: Standard for productivity tools. User stays logged in unless they sign out or clear cookies.

## Open Questions
- None — all decisions resolved.

## References
- src/proxy.ts — existing middleware (CSRF, Bearer token, workspace injection)
- src/lib/api-client.ts — client-side fetch wrapper with Bearer token
- src/app/layout.tsx — root layout where SessionProvider needs to be added
- src/components/layout-shell.tsx — app shell component
- .env.example — documents MANDIO_API_TOKEN / NEXT_PUBLIC_MANDIO_API_TOKEN
