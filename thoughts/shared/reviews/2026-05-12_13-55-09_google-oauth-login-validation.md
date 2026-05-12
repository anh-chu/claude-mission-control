# Validation Report: Google OAuth Login

Plan: `thoughts/shared/plans/2026-05-12_10-10-21_google-oauth-login.md`

Status: `needs_changes`

The OAuth implementation is mostly present and the previous proxy export blocker has been addressed with a named `proxy` export. Validation is still not complete because automated verification fails before a clean production build can finish.

## Implementation Status

✓ Phase 1: Foundation, implemented

- `package.json` includes `next-auth` `5.0.0-beta.31`.
- `pnpm-lock.yaml` includes the resolved `next-auth` dependency graph.
- `src/lib/auth.ts:4` exports `auth`, `handlers`, `signIn`, and `signOut`.
- `src/lib/auth.ts:5-12` configures Google provider, JWT sessions, 30-day `maxAge`, and `/login` as the sign-in page.
- `src/lib/auth.ts:14-23` parses `ALLOWED_EMAILS`, lowercases entries, and allows all Google users when the allowlist is empty.
- `.env.example:4-16` documents `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and `ALLOWED_EMAILS`.

✓ Phase 2: New files and proxy rewrite, implemented at source level

- `src/app/api/auth/[...nextauth]/route.ts:1-3` exports Auth.js `GET` and `POST` handlers.
- `src/proxy.ts:4` uses a named `proxy` export wrapping Auth.js, matching the Next.js 16/Auth.js proxy convention.
- `src/proxy.ts:24-29` preserves `workspace_id` cookie to `x-workspace-id` request header injection.
- `src/proxy.ts:32-56` preserves Origin/Host CSRF blocking for state-changing requests.
- `src/proxy.ts:7-22` preserves structured request logging.
- `src/proxy.ts:64-68` excludes static assets and image files from the matcher.
- `src/app/login/page.tsx:1-76` creates the client login page with Google sign-in and error handling.
- `src/components/auth-provider.tsx:1-7` wraps children in `SessionProvider`.

✓ Phase 3: Integration, implemented

- `src/app/layout.tsx:5-7` imports `AuthProvider`, `ConditionalShell`, and `ThemeProvider`.
- `src/app/layout.tsx:28-39` wraps the app in `AuthProvider > ThemeProvider > ConditionalShell`.
- `src/components/conditional-shell.tsx:6-9` bypasses `LayoutShell` for `/login` and keeps it for all other pages.
- `src/lib/api-client.ts:49` uses `credentials: "include"`.
- `src/lib/api-client.ts:52-56` redirects browser clients to `/login` on 401 before retry logic.
- `src/lib/api-client.ts` no longer references `NEXT_PUBLIC_MANDIO_API_TOKEN`, `Authorization`, or `Bearer`.

## Automated Verification Results

✓ `pnpm install --frozen-lockfile` passed.

✓ `pnpm test` passed.

```text
15 test files passed
312 tests passed
```

✗ `pnpm tsc --noEmit` failed.

```text
src/app/api/activity-log/route.ts(52,4): error TS2322:
Type '"... | "milestone_completed" | ..."' is not assignable to type 'EventType'.
Type '"milestone_completed"' is not assignable to type 'EventType'.
```

Root cause observed in the working tree: `src/lib/validations.ts:37` includes `"milestone_completed"`, but `ActivityEvent.type` still uses an `EventType` union that does not include it. This is outside the OAuth plan files, but it blocks type checking.

✗ `pnpm check` failed because `pnpm tsc --noEmit` failed first.

✗ `pnpm lint` failed because the repo script still runs `next lint`, which is not valid for this Next.js 16 install.

```text
Invalid project directory provided, no such directory: /home/sil/ccmc-google-oauth-login/lint
```

✗ `pnpm build` compiled, then failed during TypeScript validation on the same `milestone_completed` error.

```text
✓ Compiled successfully in 34.8s
Failed to type check.
```

⚠️ Proxy registration could not be cleanly verified because `pnpm build` does not complete. The source now matches the documented named proxy wrapper pattern, but the production artifact should be rechecked after the type error is fixed.

✗ `make check test` failed because this repo has no `check` make target.

```text
make: *** No rule to make target 'check'.  Stop.
```

## Code Review Findings

### Matches Plan

- Auth.js v5 configuration exists with Google OAuth and JWT sessions.
- `ALLOWED_EMAILS` behavior matches the plan: comma-separated, trimmed, lowercased, empty means open access.
- Auth API route is wired through `handlers`.
- The proxy preserves workspace header injection, CSRF checks, and logging.
- `/login`, `/api/auth/*`, and `/api/server-status` are exempted in `src/lib/auth.ts:27-34`.
- Login page is standalone and bypasses `LayoutShell` through `ConditionalShell`.
- API client uses cookies instead of the removed bearer-token flow.

### Deviations / Blockers

- **Blocker:** Automated validation cannot pass until the `milestone_completed` type mismatch is fixed.
- **Blocker:** `pnpm lint` cannot pass while the script uses `next lint` with Next.js 16.
- **Verification gap:** Browser OAuth flow was not exercised because Google OAuth credentials are not available in this environment.
- **Verification gap:** Proxy production registration still needs a clean `pnpm build` rerun after TypeScript passes.

### Potential Issues

- Auth is enforced at the proxy boundary. Auth.js docs recommend not relying on proxy exclusively for authorization. API handlers that expose sensitive data may still need route-local session checks later.
- No auth-specific automated tests were added. The plan did not require them, but redirect, allowlist, and proxy behavior remain manual checks.

## Manual Testing Required

1. Auth flow
   - [ ] Set `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and optional `ALLOWED_EMAILS` in `.env.local`.
   - [ ] Start the app and visit a protected page while signed out.
   - [ ] Confirm redirect to `/login`.
   - [ ] Click `Sign in with Google` and complete OAuth.
   - [ ] Confirm successful sign-in reaches the app.

2. Allowlist
   - [ ] Set `ALLOWED_EMAILS` to include the test account and confirm access.
   - [ ] Set `ALLOWED_EMAILS` to exclude the test account and confirm `/login?error=AccessDenied` displays the expected error.
   - [ ] Unset `ALLOWED_EMAILS` and confirm any Google account can sign in.

3. Proxy behavior
   - [ ] After fixing TypeScript, run `pnpm build` successfully.
   - [ ] Confirm production build output registers the proxy.
   - [ ] Confirm API requests receive `x-workspace-id` from the `workspace_id` cookie.
   - [ ] Confirm cross-origin mutation requests return 403.
   - [ ] Confirm `/api/server-status`, `/api/auth/*`, and `/login` are not auth-blocked.

4. Layout and API client
   - [ ] Confirm `/login` has no sidebar, command bar, or chat sidebar.
   - [ ] Confirm all other pages render inside `LayoutShell`.
   - [ ] Confirm unauthorized browser API requests redirect to `/login` without retrying.

## Recommendations

1. Fix the `EventType` mismatch for `milestone_completed` or revert the unrelated validation enum change.
2. Replace or update the `lint` script for Next.js 16, because `next lint` no longer validates successfully here.
3. Rerun `pnpm tsc --noEmit`, `pnpm lint`, `pnpm check`, `pnpm build`, and `pnpm test`.
4. After a clean build, inspect the proxy build artifact or perform a signed-out request smoke test before marking this complete.
5. Consider adding auth-focused tests for allowlist parsing, 401 redirect, and proxy matcher behavior.

## Sources

- [Auth.js Protecting Resources](https://authjs.dev/getting-started/session-management/protecting)
- [Next.js proxy file convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)

---

💬 Follow-up: fix the localized type/lint blockers, then rerun `/skill:validate`.

**Next step:** not ready for `/skill:commit` as-is. Status is `needs_changes`.
