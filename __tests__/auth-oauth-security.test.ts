import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────────────────────
// vi.mock() factories are hoisted above imports but cannot reference module
// variables directly. Use vi.hoisted() to create shared mock references.
const { mockAuthFn } = vi.hoisted(() => ({
	mockAuthFn: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
	auth: mockAuthFn,
}));

// ─── Imports ───────────────────────────────────────────────────────────────
// These are resolved after the vi.mock() calls above, so their internal
// imports of @/lib/auth will use the mock.
import { isPublicPath, requireSession } from "../src/lib/auth-guards";
import { config as proxyConfig } from "../src/proxy";

// ─── isPublicPath ──────────────────────────────────────────────────────────
describe("isPublicPath", () => {
	it("returns true for /login", () => {
		expect(isPublicPath("/login")).toBe(true);
	});

	it("returns true for /api/auth/* paths", () => {
		expect(isPublicPath("/api/auth/signin")).toBe(true);
		expect(isPublicPath("/api/auth/callback/google")).toBe(true);
		expect(isPublicPath("/api/auth/session")).toBe(true);
		expect(isPublicPath("/api/auth/csrf")).toBe(true);
		expect(isPublicPath("/api/auth/providers")).toBe(true);
	});

	it("returns true for /api/server-status", () => {
		expect(isPublicPath("/api/server-status")).toBe(true);
	});

	it("returns false for non-auth /api/ routes", () => {
		expect(isPublicPath("/api/conversations")).toBe(false);
		expect(isPublicPath("/api/tasks")).toBe(false);
		expect(isPublicPath("/api/agents")).toBe(false);
		expect(isPublicPath("/api/projects")).toBe(false);
	});

	it("returns false for normal page routes", () => {
		expect(isPublicPath("/")).toBe(false);
		expect(isPublicPath("/dashboard")).toBe(false);
		expect(isPublicPath("/settings")).toBe(false);
		expect(isPublicPath("/some-page")).toBe(false);
	});

	it("returns false for pathnames that merely start with /login but are not an exact match", () => {
		expect(isPublicPath("/login/other")).toBe(false);
		expect(isPublicPath("/login-extra")).toBe(false);
	});

	it("returns false for sub-paths of /api/server-status", () => {
		expect(isPublicPath("/api/server-status/extra")).toBe(false);
	});
});

// ─── requireSession ────────────────────────────────────────────────────────
describe("requireSession", () => {
	beforeEach(() => {
		mockAuthFn.mockReset();
	});

	it("returns a 401 JSON Response when auth() returns null", async () => {
		mockAuthFn.mockResolvedValue(null);
		const result = await requireSession();

		expect(result).toBeInstanceOf(Response);
		expect(result!.status).toBe(401);

		const body = await (result as Response).json();
		expect(body).toEqual({ error: "Unauthorized" });
	});

	it("returns null when auth() returns a valid session", async () => {
		mockAuthFn.mockResolvedValue({
			user: { email: "test@example.com" },
			expires: "2099-01-01T00:00:00.000Z",
		});
		const result = await requireSession();
		expect(result).toBeNull();
	});
});

// ─── proxy.ts middleware config ────────────────────────────────────────────
describe("proxy middleware config matcher", () => {
	it("does NOT exclude image extensions (svg, png, jpg, jpeg, gif, webp)", () => {
		const matcher = proxyConfig.matcher[0];
		expect(matcher).not.toContain("svg");
		expect(matcher).not.toContain("png");
		expect(matcher).not.toContain("jpg");
		expect(matcher).not.toContain("jpeg");
		expect(matcher).not.toContain("gif");
		expect(matcher).not.toContain("webp");
	});

	it("still excludes _next/static, _next/image, and favicon.ico", () => {
		const matcher = proxyConfig.matcher[0];
		expect(matcher).toContain("_next/static");
		expect(matcher).toContain("_next/image");
		expect(matcher).toContain("favicon.ico");
	});

	it("is a single matcher string pattern in the array", () => {
		expect(proxyConfig.matcher).toHaveLength(1);
		expect(typeof proxyConfig.matcher[0]).toBe("string");
	});
});
