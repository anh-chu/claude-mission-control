# Validation Report: Google OAuth Login

Plan: `thoughts/shared/plans/2026-05-12_10-10-21_google-oauth-login.md`

Status: `needs_changes`

The file-level OAuth implementation is mostly present, but the proxy is not active after build. This blocks the main requirement: session auth, CSRF checks, workspace header injection, and request logging are not enforced.

## Implementation Status

✓ Phase 1: Foundation, implemented

- `package.json:100-101` adds `next-auth` `5.0.0-beta.31`.
- `src/lib/auth.ts:4-41` exports `auth`, `handlers`, `signIn`, and `signOut`.
- `src/lib/auth.ts:5-12` configures Google provider, JWT strategy, 30-day `maxAge`, and `/login` sign-in page.
- `src/lib/auth.ts:14-23` parses `ALLOWED_EMAILS`, with an empty allowlist allowing all Google users.
- `.env.example:4-16` documents `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and `ALLOWED_EMAILS`.

⚠️ Phase 2: Files created, but proxy export is a blocker

- `src/app/api/auth/[...nextauth]/route.ts:1-3` exports Auth.js `GET` and `POST` handlers.
- `src/app/login/page.tsx:1-76` creates a client login page with Google sign-in and error messages.
- `src/components/auth-provider.tsx:1-7` wraps children in `SessionProvider`.
- `src/proxy.ts:5-66` uses `export default auth(...)`.
- Auth.js and Next.js docs show Next.js 16 proxy files need a named `proxy` export. The wrapper form should be `export const proxy = auth((req) => { ... })`.
- Build evidence confirms the current default export is not registered: `.next/server/middleware-manifest.json` contains `"middleware": {}` and `"sortedMiddleware": []`. No proxy file appears under `.next/server`.

✓ Phase 3: Integration code implemented

- `src/app/layout.tsx:5-7` imports `AuthProvider`, `ConditionalShell`, and `ThemeProvider`.
- `src/app/layout.tsx:28-39` wraps the app in `AuthProvider > ThemeProvider > ConditionalShell`.
- `src/components/conditional-shell.tsx:6-9` bypasses `LayoutShell` for `/login` and uses it elsewhere.
- `src/lib/api-client.ts:46-50` uses `credentials: "include"`.
- `src/lib/api-client.ts:52-56` redirects browser clients to `/login` on 401 before retry logic.
- `src/lib/api-client.ts` has no `NEXT_PUBLIC_MANDIO_API_TOKEN`, `Authorization`, or `Bearer` references.

## Automated Verification Results

✓ `pnpm install --frozen-lockfile` passed.

✓ `pnpm tsc --noEmit` passed.

✓ `pnpm build` passed.

✗ Proxy registration failed after build:

```json
{
  "version": 3,
  "middleware": {},
  "sortedMiddleware": [],
  "functions": {}
}
```

✗ `make check test` failed because the repo has no `check` target.

```text
make: *** No rule to make target 'check'.  Stop.
```

✗ `pnpm check` failed because `pnpm lint` failed:

```text
> mandio@0.15.0 lint /home/sil/ccmc-google-oauth-login
> next lint

Invalid project directory provided, no such directory: /home/sil/ccmc-google-oauth-login/lint
```

✗ `pnpm lint` failed with the same `next lint` issue.

✗ `pnpm test` failed: 2 failed, 310 passed.

Failures observed:

1. `__tests__/api-projects-stop-conversation.test.ts` failed with `headers was called outside a request scope` at `src/lib/workspace-context.ts:26`.
2. `__tests__/validations.test.ts` failed in `activityEventCreateSchema > accepts all valid event types` with `expected false to be true`.

These test failures are outside the OAuth files, but they still block a clean validation.

## Code Review Findings

### Matches Plan

- Auth.js v5 configuration exists and uses Google OAuth with JWT sessions.
- `ALLOWED_EMAILS` is parsed case-insensitively and empty means open access.
- Auth API route is wired through `handlers`.
- Login page is standalone and does not rely on `LayoutShell`.
- App is wrapped with `SessionProvider` via `AuthProvider`.
- API client switched from Bearer-token auth to cookie credentials and 401 redirect.

### Deviations and Blockers

- **Blocker:** `src/proxy.ts` uses a default export. Next.js 16 expects a named `proxy` export. The built middleware manifest is empty, so auth protection, workspace header injection, CSRF protection, and request logging are not active.
- **Plan issue:** The plan's Phase 2 success criterion says a default auth wrapper is accepted. Current docs and build output contradict that criterion.
- **Verification gap:** No browser-level OAuth flow was exercised because Google OAuth credentials are not available in this environment.
- **Coverage gap:** No auth-specific automated tests were added. The plan did not require them, but OAuth redirect and allowlist behavior remain manual checks.

## Manual Testing Required

1. Auth flow:
   - [ ] Set `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and optional `ALLOWED_EMAILS` in `.env.local`.
   - [ ] Start the app and visit a protected page while signed out.
   - [ ] Confirm redirect to `/login`.
   - [ ] Click `Sign in with Google` and complete OAuth.
   - [ ] Confirm successful sign-in redirects back into the app.

2. Allowlist:
   - [ ] Set `ALLOWED_EMAILS` to include the test account and confirm access.
   - [ ] Set `ALLOWED_EMAILS` to exclude the test account and confirm `/login?error=AccessDenied` shows the expected error.
   - [ ] Unset `ALLOWED_EMAILS` and confirm any Google account can sign in.

3. Proxy behavior:
   - [ ] After fixing the export, run `pnpm build` and confirm `.next/server/middleware-manifest.json` lists the proxy.
   - [ ] Confirm API requests receive `x-workspace-id` from the `workspace_id` cookie.
   - [ ] Confirm cross-origin mutation requests receive 403.
   - [ ] Confirm `/api/server-status`, `/api/auth/*`, and `/login` are not auth-blocked.

4. Layout and API client:
   - [ ] Confirm `/login` has no sidebar, command bar, or chat sidebar.
   - [ ] Confirm all other pages still render inside `LayoutShell`.
   - [ ] Confirm unauthorized browser API requests redirect to `/login` without retrying.

## Recommendations

1. Change `src/proxy.ts` from a default export to a named `proxy` export.
2. Rerun `pnpm build` and inspect `.next/server/middleware-manifest.json` before rerunning validation.
3. Fix or replace the broken `next lint` script, because `pnpm check` cannot pass as written.
4. Triage the two existing test failures before marking validation complete.
5. Consider revising the plan criterion that says a default proxy export is accepted.

## Sources

- [Auth.js Next.js Proxy docs](https://github.com/nextauthjs/next-auth/blob/main/docs/pages/getting-started/session-management/protecting.mdx?plain=1#L243#next-js-proxy)
- [Next.js Proxy response docs](https://github.com/vercel/next.js/blob/canary/docs/01-app/03-api-reference/03-file-conventions/proxy.mdx?plain=1#L520#producing-a-response)

---

💬 Follow-up: fix the proxy export and rerun `/skill:validate`. If the plan remains the source of truth, revise the Phase 2 export criterion as well.

**Next step:** not ready for `/skill:commit` as-is. Status is `needs_changes`.
