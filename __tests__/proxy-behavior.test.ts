import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────────────────────
// Mock @/lib/auth so its auth(handler) returns a callable proxy that injects
// a mutable mocked req.auth value before calling the handler.
const { mockAuthValue } = vi.hoisted(() => ({
	mockAuthValue: vi.fn<any, any>(() => null),
}));

vi.mock("@/lib/auth", () => ({
	auth: (handler: (req: any) => any) => {
		return async (req: any, ..._args: any[]) => {
			req.auth = mockAuthValue();
			return handler(req);
		};
	},
}));

// ─── Imports ───────────────────────────────────────────────────────────────
import { config, proxy } from "@/proxy";

// ─── Helpers ───────────────────────────────────────────────────────────────

function mockRequest(options?: {
	method?: string;
	pathname?: string;
	search?: string;
	origin?: string;
	headers?: Record<string, string>;
	cookies?: Record<string, string>;
}) {
	const {
		method = "GET",
		pathname = "/",
		search = "",
		origin = "http://localhost:3000",
		headers: headerEntries = {},
		cookies: cookieEntries = {},
	} = options ?? {};

	const headers = new Headers(headerEntries);

	return {
		method,
		nextUrl: {
			pathname,
			search,
			origin,
			toString() {
				return `${origin}${pathname}${search}`;
			},
		},
		headers,
		cookies: {
			get(name: string) {
				return { value: cookieEntries[name] ?? null };
			},
		},
	};
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("proxy middleware behavior", () => {
	beforeEach(() => {
		mockAuthValue.mockReset();
		mockAuthValue.mockReturnValue(null); // default: unauthenticated
	});

	// ── Unauthenticated ──────────────────────────────────────────────────

	it("returns JSON 401 for unauthenticated /api/tasks", async () => {
		mockAuthValue.mockReturnValue(null);
		const req = mockRequest({
			method: "GET",
			pathname: "/api/tasks",
		});

		const res = await proxy(req);

		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body).toEqual({ error: "Unauthorized" });
	});

	it("redirects unauthenticated /work?tab=map to /login with callbackUrl", async () => {
		mockAuthValue.mockReturnValue(null);
		const req = mockRequest({
			method: "GET",
			pathname: "/work",
			search: "?tab=map",
		});

		const res = await proxy(req);

		// NextResponse.redirect produces 307 by default
		expect(res.status).toBe(307);
		const location = res.headers.get("location");
		expect(location).toBe(
			"http://localhost:3000/login?callbackUrl=%2Fwork%3Ftab%3Dmap",
		);
	});

	// ── Authenticated + CSRF ─────────────────────────────────────────────

	it("returns 403 for authenticated unsafe request with missing Origin", async () => {
		mockAuthValue.mockReturnValue({
			user: { email: "test@example.com" },
		});
		const req = mockRequest({
			method: "POST",
			pathname: "/api/tasks",
			headers: { host: "localhost:3000" },
			// No origin header
		});

		const res = await proxy(req);

		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body).toEqual({ error: "Missing Origin header" });
	});

	it("returns 403 for authenticated unsafe request with missing Host", async () => {
		mockAuthValue.mockReturnValue({
			user: { email: "test@example.com" },
		});
		const req = mockRequest({
			method: "POST",
			pathname: "/api/tasks",
			headers: { origin: "http://localhost:3000" },
			// No host header
		});

		const res = await proxy(req);

		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body).toEqual({ error: "Missing Host header" });
	});

	it("returns 403 for authenticated unsafe request with mismatched Origin/Host", async () => {
		mockAuthValue.mockReturnValue({
			user: { email: "test@example.com" },
		});
		const req = mockRequest({
			method: "POST",
			pathname: "/api/tasks",
			headers: {
				origin: "http://evil.com",
				host: "localhost:3000",
			},
		});

		const res = await proxy(req);

		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body).toEqual({ error: "Cross-origin request blocked" });
	});

	it("passes through authenticated unsafe request with matching Origin/Host", async () => {
		mockAuthValue.mockReturnValue({
			user: { email: "test@example.com" },
		});
		const req = mockRequest({
			method: "POST",
			pathname: "/api/tasks",
			headers: {
				origin: "http://localhost:3000",
				host: "localhost:3000",
			},
		});

		const res = await proxy(req);

		// Pass-through returns NextResponse.next() which is 200
		expect(res.status).toBe(200);
	});

	// ── /api/auth/* exemption ────────────────────────────────────────────

	it("exempts /api/auth/* from auth check even when unauthenticated", async () => {
		mockAuthValue.mockReturnValue(null);
		const req = mockRequest({
			method: "POST",
			pathname: "/api/auth/callback/google",
		});

		const res = await proxy(req);

		// /api/auth/* is public so it passes through (200), not 401
		expect(res.status).toBe(200);
	});

	it("exempts /api/auth/* from CSRF blocking", async () => {
		mockAuthValue.mockReturnValue({
			user: { email: "test@example.com" },
		});
		const req = mockRequest({
			method: "POST",
			pathname: "/api/auth/session",
			// Missing origin/host — normally would be 403, but /api/auth/* is exempt
		});

		const res = await proxy(req);

		expect(res.status).toBe(200);
	});

	// ── Matcher config ───────────────────────────────────────────────────

	it("matcher does not contain image extension exclusion (svg, png, jpg, etc.)", () => {
		const matcher = config.matcher[0];
		expect(matcher).not.toContain("svg");
		expect(matcher).not.toContain("png");
		expect(matcher).not.toContain("jpg");
		expect(matcher).not.toContain("jpeg");
		expect(matcher).not.toContain("gif");
		expect(matcher).not.toContain("webp");
	});
});
