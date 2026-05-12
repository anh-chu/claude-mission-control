import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

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

	// Auth.js session is already verified by the auth wrapper.
	// Session data available at req.auth if needed.

	return finalize(NextResponse.next({ request: { headers: requestHeaders } }));
});

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
