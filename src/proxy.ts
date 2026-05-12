import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPublicPath } from "@/lib/auth-paths";

export const proxy = auth((req) => {
	const startedAt = Date.now();
	const pathname = req.nextUrl.pathname;

	// ── Request logging ──
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

	// ── Workspace header injection (preserved from legacy proxy) ──
	const workspaceId = req.cookies.get("workspace_id")?.value ?? "default";
	const requestHeaders = new Headers(req.headers);
	requestHeaders.set("x-workspace-id", workspaceId);

	// ── CSRF Protection — reject missing/mismatched Origin for cookie-authenticated mutations ──
	// Exempt /api/auth/* so Auth.js can handle its own flows.
	const method = req.method.toUpperCase();
	const isUnsafe = ["POST", "PUT", "DELETE", "PATCH"].includes(method);
	if (isUnsafe && req.auth && !pathname.startsWith("/api/auth/")) {
		const origin = req.headers.get("origin");
		const host = req.headers.get("host");

		if (!origin) {
			return finalize(
				NextResponse.json({ error: "Missing Origin header" }, { status: 403 }),
			);
		}

		if (!host) {
			return finalize(
				NextResponse.json({ error: "Missing Host header" }, { status: 403 }),
			);
		}

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
				NextResponse.json({ error: "Invalid Origin header" }, { status: 403 }),
			);
		}
	}

	// ── Auth check ──
	if (!req.auth && !isPublicPath(pathname)) {
		// API routes → JSON 401; page routes → redirect to /login with callbackUrl
		if (pathname.startsWith("/api/")) {
			return finalize(
				NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
			);
		}

		const loginUrl = new URL("/login", req.nextUrl.origin);
		loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
		return finalize(NextResponse.redirect(loginUrl));
	}

	return finalize(NextResponse.next({ request: { headers: requestHeaders } }));
});

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
