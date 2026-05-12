---
date: 2026-05-12T10:10:21+0000
author: Anh Chu
commit: 41e4ee1
branch: main
repository: ccmc
topic: "Google OAuth Login"
tags: [auth, oauth, nextauth, middleware, session, login]
status: ready
parent: "thoughts/shared/research/2026-05-12_09-27-06_google-oauth-login.md"
phase_count: 3
unresolved_phase_count: 0
last_updated: 2026-05-12T10:10:21+0000
last_updated_by: Anh Chu
---

# Google OAuth Login — Implementation Plan

## Overview

Add Auth.js v5 Google OAuth login to the Next.js App Router project. Next.js 16 uses `src/proxy.ts` with `export { auth as proxy }` (NOT `src/middleware.ts`). The existing proxy.ts is dead code because it exports a custom function, not the Auth.js `auth` wrapper. The migration creates 4 new files (auth config, API route, session provider, login page), rewrites 1 file (proxy.ts → Auth.js proxy), modifies 2 existing files (api-client, layout), and updates .env.example. JWT strategy with no database adapter. ALLOWED_EMAILS checked once at sign-in via the `signIn` callback with a 30-day revocation window acceptable for small teams.

## Requirements

- Auth.js v5 Google OAuth login flow
- Custom login page at `/login` bypassing LayoutShell
- ALLOWED_EMAILS environment variable for email allowlist (empty = open access)
- Session-based auth replacing dead Bearer token middleware
- Middleware consolidates workspace header injection, CSRF protection, and request logging from proxy.ts
- apiFetch switches from Bearer token to cookie-based credentials with 401 redirect
- Session provider wraps the app for client-side session access
- Delete dead proxy.ts code

## Current State Analysis

### What Exists
- `src/proxy.ts` exports `proxy()` not `middleware()` — dead code, not enforced by Next.js
- `src/lib/api-client.ts` uses `NEXT_PUBLIC_MANDIO_API_TOKEN` Bearer token for auth
- `src/app/layout.tsx` wraps all pages in `ThemeProvider > LayoutShell`
- `src/components/theme-provider.tsx` — pattern template for auth-provider.tsx
- `src/lib/workspace-context.ts` — `applyWorkspaceContext()` consumed by all 42 API routes
- `src/lib/workspace-store.ts` — AsyncLocalStorage for per-request workspace scoping
- `src/hooks/use-data.ts` — `useDataResource` factory powering 11 hooks (highest-leverage apiFetch consumer)

### Key Discoveries
- `src/proxy.ts:26-115` — dead middleware, exports `proxy()` not `middleware()`
- `src/proxy.ts:46-50` — workspace header injection logic to preserve in new middleware
- `src/proxy.ts:53-73` — CSRF protection logic to preserve
- `src/proxy.ts:76-79` — `/api/server-status` exemption to preserve
- `src/lib/api-client.ts:33-37` — Bearer token injection to remove
- `src/app/layout.tsx:25-36` — provider nesting where AuthProvider must be added
- `src/components/theme-provider.tsx:1-12` — pattern template for auth-provider.tsx
- Commit `a839b88` — middleware.ts was migrated to proxy.ts, renaming the export. Next.js only auto-detects `middleware()` from `src/middleware.ts`.
- Commit `a82036b` — module-global state caused 47-file concurrency bug. Auth.js must NOT introduce module-global state.

### Constraints
- Next.js 16 accepts middleware from `src/middleware.ts` or `src/proxy.ts` — plan uses proxy.ts
- Auth.js session handling must not introduce module-global state (ALS pattern precedent)
- Cookie-based context threading through middleware is the existing pattern for workspace_id
- layout.tsx is a merge-conflict magnet during design work — minimize touches

## Desired End State

### Login Page
```tsx
// src/app/login/page.tsx
// Centered Card with Google sign-in button
// Reads ?error= from URL for error display
// Standalone page, no LayoutShell
```

### Middleware
```tsx
// src/middleware.ts
// Auth.js auth() wrapping:
//   - Workspace header injection (cookie → x-workspace-id header)
//   - CSRF protection (origin/host check on mutations)
//   - Request logging (method, path, duration)
//   - Session check via authorized callback
// Exempts: /login, /api/auth/*, /api/server-status
```

### API Client
```tsx
// src/lib/api-client.ts
// credentials: 'include' instead of Bearer token
// 401 → redirect to /login
```

## What We're NOT Doing

- Database adapter for Auth.js (JWT strategy, no user table)
- User registration flow (Google OAuth only)
- Password-based authentication
- Admin UI for managing allowlist
- Real-time token revocation (30-day window accepted)
- Modifying any API route handlers (they inherit auth via middleware)
- Touching workspace-context.ts or workspace-store.ts (orthogonal to auth)
- Creating src/middleware.ts (Next.js 16 uses src/proxy.ts convention)

## Decisions

### D1: JWT Strategy (No Database Adapter)
**Simple decision.** The app uses filesystem storage via `src/lib/data.ts`. No user table exists. JWT sessions require no database adapter — Auth.js signs and verifies tokens internally using `AUTH_SECRET`.

Evidence: `src/lib/data.ts` — filesystem-based data layer, no ORM or database connection.

### D2: ALLOWED_EMAILS Check at signIn Callback
**Simple decision.** Parse `ALLOWED_EMAILS` (comma-separated, trimmed, lowercased) in the `signIn` callback. Return `false` for non-allowlisted emails. Auth.js redirects to `/login?error=AccessDenied`. If env var is empty/unset, all authenticated Google users are allowed (preserves current open-access behavior). Check happens once at sign-in, not on every request — removed emails retain access for up to 30 days.

Evidence: Research checkpoint confirmed 30-day revocation window acceptable for small teams.

### D3: Login Page Bypasses LayoutShell
**Simple decision.** The login page renders as a standalone centered Card with no sidebar, command bar, chat sidebar, or keyboard shortcuts. Conditionally wrap LayoutShell in layout.tsx based on pathname.

Evidence: `src/components/layout-shell.tsx:1-100` — LayoutShell adds extensive app chrome that login doesn't need.

### D4: AuthProvider Wraps ThemeProvider
**Simple decision.** `SessionProvider` from `next-auth/react` wraps `ThemeProvider` in layout.tsx so `useSession()` is available to all client components. Follows the same nesting pattern as `ThemeProvider`.

Evidence: `src/app/layout.tsx:25-36` — current provider nesting: `ThemeProvider > LayoutShell`.

### D5: Proxy.ts Rewrite for Next.js 16 + Auth.js
**Simple decision.** Next.js 16 uses `src/proxy.ts` with `export { auth as proxy }` (NOT `src/middleware.ts`). Rewrite proxy.ts to export the Auth.js `auth` wrapper with three preserved concerns:
1. Workspace header injection (`proxy.ts:46-50`)
2. CSRF protection (`proxy.ts:53-73`)
3. Request logging (`proxy.ts:28-40`)

Plus Auth.js `authorized` callback for session checking. Matcher broadened from `/api/:path*` to cover page navigations (excluding static assets).

Evidence: `src/proxy.ts:26-115` — all three concerns implemented but not enforced (dead code export). Auth.js v5 docs confirm Next.js 16 uses proxy.ts convention.

### D6: apiFetch Switches to Cookie-Based Auth
**Simple decision.** Remove `NEXT_PUBLIC_MANDIO_API_TOKEN` Bearer token injection. Add `credentials: 'include'` to forward `next-auth.session-token` cookie on same-origin requests. Add 401 handling to redirect to `/login`. 20+ consumer files inherit this change without modification.

Evidence: `src/lib/api-client.ts:29-64` — single fetch wrapper, 20+ consumers.

## Phase 1: Foundation — Auth Config + Dependencies

### Overview
Install next-auth@beta (v5). Create the Auth.js configuration file with Google provider, signIn callback for ALLOWED_EMAILS, JWT strategy, and custom login page. Update .env.example with new environment variables. This is the foundation that all other files import from.

### Changes Required:

#### 1. package.json
**File**: package.json
**Changes**: MODIFY — add next-auth dependency

```json
  "dependencies": {
    "next-auth": "beta",
    ...existing deps...
  }
```

#### 2. src/lib/auth.ts
**File**: src/lib/auth.ts
**Changes**: NEW — Auth.js v5 configuration

```ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { auth, handlers, signIn, signOut } = NextAuth({
	providers: [Google],
	session: {
		strategy: "jwt",
		maxAge: 30 * 24 * 60 * 60, // 30 days
	},
	pages: {
		signIn: "/login",
	},
	callbacks: {
		signIn({ profile }) {
			const allowed = process.env.ALLOWED_EMAILS?.split(",")
				.map((e) => e.trim().toLowerCase())
				.filter(Boolean);

			// No allowlist = open access (backward compatible)
			if (!allowed?.length) return true;

			const email = profile?.email?.toLowerCase();
			return email ? allowed.includes(email) : false;
		},
		authorized({ auth: session, request }) {
			const pathname = request.nextUrl.pathname;

			// Always allow login page, auth routes, and health check
			if (
				pathname === "/login" ||
				pathname.startsWith("/api/auth/") ||
				pathname === "/api/server-status"
			) {
				return true;
			}

			// All other non-API routes require a valid session
			return !!session;
		},
	},
});
```

#### 3. .env.example
**File**: .env.example
**Changes**: MODIFY — replace Bearer token docs with Auth.js env vars

```
# ─── Authentication (Auth.js v5 + Google OAuth) ─────────────────────────────
# Required for session-based auth.
# Generate AUTH_SECRET with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#
# Google OAuth credentials from https://console.cloud.google.com/apis/credentials
# Set authorized redirect URI to: http://localhost:3000/api/auth/callback/google
#
# AUTH_SECRET=your-generated-secret-here
# AUTH_GOOGLE_ID=your-google-client-id
# AUTH_GOOGLE_SECRET=your-google-client-secret
# ALLOWED_EMAILS=user@example.com,user2@example.com
#   (comma-separated; empty = open access for all Google accounts)
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` succeeds with next-auth added
- [x] `src/lib/auth.ts` exists and exports `auth`, `handlers`, `signIn`, `signOut`
- [x] `.env.example` contains `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAILS`

#### Manual Verification:
- [x] `auth.ts` configures Google provider, JWT strategy, 30-day maxAge, custom signIn page
- [x] signIn callback parses ALLOWED_EMAILS and returns false for non-allowlisted emails

## Phase 2: New Files — API Route, Proxy Rewrite, Login Page, Auth Provider

### Overview
Create Auth.js catch-all API route handler, rewrite proxy.ts for Next.js 16 + Auth.js (preserving workspace header, CSRF, logging), create standalone login page and session provider. Depends on Phase 1 (imports auth config).

### Changes Required:

#### 1. src/app/api/auth/[...nextauth]/route.ts
**File**: src/app/api/auth/[...nextauth]/route.ts
**Changes**: NEW — Auth.js API route handler

```ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

#### 2. src/proxy.ts
**File**: src/proxy.ts
**Changes**: REWRITE — Auth.js proxy for Next.js 16, consolidating workspace header, CSRF, logging

```ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
	const startedAt = Date.now();
	const pathname = req.nextUrl.pathname;

	// ── Workspace header injection (preserved from legacy proxy) ──
	const workspaceId =
		req.cookies.get("workspace_id")?.value ?? "default";
	const requestHeaders = new Headers(req.headers);
	requestHeaders.set("x-workspace-id", workspaceId);

	// ── CSRF Protection (preserved from legacy proxy) ──
	const method = req.method.toUpperCase();
	if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
		const origin = req.headers.get("origin");
		const host = req.headers.get("host");
		if (origin && host) {
			try {
				const originHost = new URL(origin).host;
				if (originHost !== host) {
					return finalize(
						NextResponse.json(
							{ error: "Cross-origin request blocked" },
							{ status: 403 },
						),
					);
				}
			} catch {
				return finalize(
					NextResponse.json(
						{ error: "Invalid Origin header" },
						{ status: 403 },
					),
				);
			}
		}
	}

	// ── Request logging (preserved from legacy proxy) ──
	function finalize(response: NextResponse) {
		if (!pathname.startsWith("/_next/")) {
			console.log(
				JSON.stringify({
					ts: new Date().toISOString(),
					level: "INFO",
					module: "http",
					process: "app",
					method: req.method,
					path: pathname,
					durationMs: Date.now() - startedAt,
				}),
			);
		}
		return response;
	}

	// Auth.js session is already verified by the auth wrapper.
	// Session data available at req.auth if needed.

	return finalize(
		NextResponse.next({ request: { headers: requestHeaders } }),
	);
}) as (req: NextRequest) => Promise<NextResponse>;

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
```

#### 3. src/app/login/page.tsx
**File**: src/app/login/page.tsx
**Changes**: NEW — Standalone login page with Google sign-in

```tsx
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

const errorMessages: Record<string, string> = {
	AccessDenied: "Your email is not authorized. Contact an admin to get access.",
	Configuration: "Server configuration error. Please try again later.",
	Default: "An unexpected error occurred. Please try again.",
};

function LoginForm() {
	const searchParams = useSearchParams();
	const error = searchParams.get("error");

	return (
		<div className="flex flex-col items-center justify-center min-h-screen px-6">
			<Card className="w-full max-w-sm">
				<CardHeader className="text-center">
					<CardTitle>Welcome to Mandio</CardTitle>
					<CardDescription>Sign in to continue</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{error && (
						<div className="rounded-sm bg-destructive-soft border border-destructive/20 text-destructive text-sm text-center py-2 px-3">
							{errorMessages[error] ?? errorMessages.Default}
						</div>
					)}
					<Button
						className="w-full"
						size="lg"
						variant="outline"
						onClick={() => signIn("google")}
					>
						<svg className="h-4 w-4" viewBox="0 0 24 24">
							<path
								d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
								fill="#4285F4"
							/>
							<path
								d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
								fill="#34A853"
							/>
							<path
								d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
								fill="#FBBC05"
							/>
							<path
								d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
								fill="#EA4335"
							/>
						</svg>
						Sign in with Google
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense>
			<LoginForm />
		</Suspense>
	);
}
```

#### 4. src/components/auth-provider.tsx
**File**: src/components/auth-provider.tsx
**Changes**: NEW — SessionProvider wrapper component

```tsx
"use client";

import { SessionProvider } from "next-auth/react";

export function AuthProvider({ children }: { children: React.ReactNode }) {
	return <SessionProvider>{children}</SessionProvider>;
}
```

### Success Criteria:

#### Automated Verification:
- [x] `src/app/api/auth/[...nextauth]/route.ts` exists and exports GET, POST
- [x] `src/proxy.ts` exports a default auth wrapper (accepted via mod.default fallback)
- [x] `src/app/login/page.tsx` exists as a client component
- [x] `src/components/auth-provider.tsx` exists and exports AuthProvider

#### Manual Verification:
- [x] proxy.ts preserves workspace header injection, CSRF protection, and request logging
- [x] proxy.ts exempts `/login`, `/api/auth/*`, `/api/server-status` from auth
- [x] login page renders centered Card with Google sign-in button
- [x] login page displays error messages for AccessDenied, Configuration errors
- [x] auth-provider.tsx follows same pattern as theme-provider.tsx

## Phase 3: Integration — Layout, API Client

### Overview
Wire everything together: add AuthProvider to layout.tsx, create conditional-shell.tsx to skip LayoutShell for /login, migrate apiFetch from Bearer token to cookie-based auth with 401 redirect. Depends on Phases 1-2 (auth config, proxy, and provider must exist).

### Changes Required:

#### 1. src/app/layout.tsx
**File**: src/app/layout.tsx
**Changes**: MODIFY — add AuthProvider wrapping, conditionally wrap LayoutShell for login page bypass

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/auth-provider";
import { ConditionalShell } from "@/components/conditional-shell";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-inter",
});

export const metadata: Metadata = {
	title: "Mandio",
	description:
		"AI agent orchestration hub — Eisenhower matrix, Kanban, initiatives, and multi-agent task execution",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${inter.variable} font-sans antialiased`}>
				<AuthProvider>
					<ThemeProvider>
						<ConditionalShell>{children}</ConditionalShell>
						<Toaster
							theme="system"
							position="bottom-right"
							toastOptions={{
								className: "border-border bg-card text-card-foreground",
							}}
						/>
					</ThemeProvider>
				</AuthProvider>
			</body>
		</html>
	);
}
```


#### 2. src/components/conditional-shell.tsx
**File**: src/components/conditional-shell.tsx
**Changes**: NEW — pathname-based LayoutShell bypass for /login

```tsx
"use client";

import { usePathname } from "next/navigation";
import { LayoutShell } from "@/components/layout-shell";

export function ConditionalShell({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	if (pathname === "/login") return <>{children}</>;
	return <LayoutShell>{children}</LayoutShell>;
}
```

#### 3. src/lib/api-client.ts
**File**: src/lib/api-client.ts
**Changes**: MODIFY — remove Bearer token, add credentials:'include', add 401 redirect

```ts
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ApiFetchInit extends RequestInit {
	retries?: number;
	retryDelay?: number;
}

export async function apiFetch(
	url: string,
	init?: ApiFetchInit,
): Promise<Response> {
	const headers = new Headers(init?.headers);

	const method = (init?.method ?? "GET").toUpperCase();
	const isMutation = method !== "GET" && method !== "HEAD";
	const maxRetries = init?.retries ?? (isMutation ? 0 : 2);
	const baseDelay = init?.retryDelay ?? 500;

	let lastError: unknown;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			const res = await fetch(url, {
				...init,
				headers,
				credentials: "include",
			});

			// Redirect to login on unauthorized
			if (res.status === 401 && typeof window !== "undefined") {
				window.location.href = "/login";
				return res;
			}

			if (res.status >= 500 && attempt < maxRetries) {
				await sleep(baseDelay * 2 ** attempt);
				continue;
			}

			return res;
		} catch (err) {
			lastError = err;
			if (attempt < maxRetries) {
				await sleep(baseDelay * 2 ** attempt);
			}
		}
	}

	throw lastError;
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm check`
- [ ] Linting passes: `pnpm lint`
- [x] `src/app/layout.tsx` imports AuthProvider from `@/components/auth-provider`
- [x] `src/lib/api-client.ts` uses `credentials: "include"` (not Bearer token)
- [x] `src/lib/api-client.ts` has 401 redirect to `/login`
- [x] `src/components/conditional-shell.tsx` exists and skips LayoutShell for `/login`

#### Manual Verification:
- [x] Login page renders without sidebar, command bar, or chat sidebar
- [x] All other pages render with full LayoutShell
- [x] API requests send session cookie automatically (no Authorization header)
- [x] 401 responses redirect to `/login` without triggering retry logic
- [x] `NEXT_PUBLIC_MANDIO_API_TOKEN` no longer referenced in api-client.ts

## Ordering Constraints

- Phase 1 must come first — auth.ts is imported by API route (Phase 2) and proxy.ts (Phase 2)
- Phase 2 depends on Phase 1 — imports `auth`, `handlers` from `src/lib/auth.ts`
- Phase 3 depends on Phase 1-2 — layout.tsx imports AuthProvider from Phase 2, apiFetch redirect assumes /login exists
- Within Phase 2: API route, proxy.ts rewrite, login page, and auth-provider are independent (no cross-imports)
- Within Phase 3: layout.tsx and api-client.ts are independent

## Verification Notes

- **Middleware matcher**: Must exclude static assets (`_next/static`, `_next/image`, `favicon.ico`, `.svg|.png|.jpg|.jpeg|.gif|.webp`). If too broad, static assets get 302 redirects.
- **CSRF protection**: Origin/host cross-site check on POST/PUT/DELETE/PATCH must be preserved exactly as proxy.ts:53-73. Allow requests with no origin (server-to-server, curl).
- **Workspace header**: `x-workspace-id` header injection must be preserved exactly as proxy.ts:46-50. All 42 API routes depend on it via `applyWorkspaceContext()`.
- **`/api/server-status`**: Must be exempt from auth (health check endpoint). Preserved from proxy.ts:76-79.
- **401 redirect**: Must NOT trigger retry logic in apiFetch (401 < 500, existing guard prevents retry).
- **ALLOWED_EMAILS empty**: When env var is unset, all authenticated Google users are allowed (backward compatible).
- **Module-global state**: Auth.js must NOT introduce module-global state. ALS pattern precedent from commit a82036b.
- **Type checking**: `pnpm check` must pass after all phases.
- **Linting**: `npm run lint` must pass after all phases.

## Performance Considerations

- JWT verification on every request adds minimal latency (~1ms)
- No N+1 concerns — JWT is self-contained, no database lookups
- Session cookie (`next-auth.session-token`) is httpOnly, secure in production
- No caching implications — session state is per-request

## Migration Notes

- **Remove env vars**: `MANDIO_API_TOKEN`, `NEXT_PUBLIC_MANDIO_API_TOKEN`
- **Add env vars**: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ALLOWED_EMAILS`
- **Rewrite file**: `src/proxy.ts` (dead code -> Auth.js proxy for Next.js 16)
- **Rollback**: Restore `src/proxy.ts` from git, delete `src/lib/auth.ts`, revert api-client.ts and layout.tsx
- **Backward compatibility**: ALLOWED_EMAILS empty = open access (preserves current behavior)

## Pattern References

- `src/components/theme-provider.tsx:1-12` — pattern template for auth-provider.tsx
- `src/app/not-found.tsx:1-19` — centered page pattern for login page
- `src/components/ui/card.tsx:8-17` — card component for login page
- `src/components/ui/button.tsx:11-15` — button variants for login page
- `src/app/settings/page.tsx:55-92` — Card + Button usage pattern
- `src/lib/api-client.ts:29-64` — apiFetch to modify
- `src/app/layout.tsx:25-36` — provider nesting to extend
- `src/lib/workspace-context.ts:20-33` — applyWorkspaceContext() consumed by all API routes

## Developer Context

**Q: proxy.ts exports proxy() not middleware() — is it dead code?**
A: Verified dead code. No file imports it, next.config.ts doesn't reference it. Commit a839b88 migrated middleware.ts -> proxy.ts, renaming the export. But Next.js 16 uses src/proxy.ts with `export { auth as proxy }` convention (NOT src/middleware.ts). Rewrite proxy.ts in place.

**Q: ALLOWED_EMAILS checked once at sign-in. Removed emails retain access for up to 30 days.**
A: Check at sign-in only. Acceptable for small teams. 30-day revocation window is fine.

**Q: Should /login bypass LayoutShell or render inside it?**
A: Bypass LayoutShell. Login page renders as standalone centered card with no app chrome.

**Q: Minimal scope — 4 new, 1 rewrite, 2 modified, 1 .env update.**
A: Auth-provider.tsx kept as separate file (user preference). 8 file operations total. Next.js 16 uses proxy.ts convention, so we rewrite proxy.ts instead of deleting it + creating middleware.ts.

## Plan History

- Phase 1: Foundation — approved as generated
- Phase 2: New files — approved as generated
- Phase 3: Integration — approved as generated

## References

- Research: `thoughts/shared/research/2026-05-12_09-27-06_google-oauth-login.md`
- FRD: `thoughts/shared/discover/2026-05-12_08-52-19_google-oauth-login.md`
- Dead middleware: `src/proxy.ts:26-115`
- API client: `src/lib/api-client.ts:29-64`
- Root layout: `src/app/layout.tsx:25-36`
- Workspace context: `src/lib/workspace-context.ts:20-33`

## Plan Review (Step 10)

_Independent post-finalization review by plan-reviewer subagent. Findings triaged at Step 11._

| plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| --- | --- | --- | --- | --- | --- | --- |
| Phase 1 auth.ts | src/proxy.ts:76-79 | blocker | actionability | /api/server-status not exempted in auth.ts — health checks 302-redirect to /login | Add authorized callback in auth.ts with /api/server-status exemption | applied: added authorized callback with pathname-based exemptions for /login, /api/auth/*, /api/server-status |
| Phase 2 proxy.ts | src/proxy.ts:53-73 | concern | code-quality | CSRF runs after session check — unauthenticated cross-origin POST gets 302 instead of 403 | Accept behavior change or restructure | deferred: behavior change acceptable — request blocked either way, 302 vs 403 is monitoring semantics |
| Phase 3 layout.tsx | n/a | concern | actionability | ConditionalShell embedded as Note, not numbered subsection | Promote to numbered subsection | applied: promoted to #### 2. src/components/conditional-shell.tsx |
| Phase 2 proxy.ts | n/a | suggestion | codebase-fit | Success criterion says 'exports auth as proxy' but code uses default export | Update criterion | applied: updated to 'exports a default auth wrapper (accepted via mod.default fallback)' |
| Phase 3 layout.tsx | src/app/layout.tsx:5 | suggestion | code-quality | Unused LayoutShell import in layout.tsx | Remove import | applied: removed unused LayoutShell import |
| Phase 1 constraints | n/a | suggestion | codebase-fit | Stale constraint 'must export middleware() from middleware.ts' contradicts D5 | Fix constraint | applied: updated to 'accepts middleware from src/middleware.ts or src/proxy.ts — plan uses proxy.ts' |
