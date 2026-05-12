import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────────────────────
let signInCallback:
	| ((params: { profile?: Record<string, unknown> }) => boolean)
	| undefined;

vi.mock("next-auth", () => ({
	default: vi.fn((config: any) => {
		signInCallback = config.callbacks.signIn;
		return {
			auth: vi.fn(),
			handlers: {},
			signIn: vi.fn(),
			signOut: vi.fn(),
		};
	}),
}));

vi.mock("next-auth/providers/google", () => ({
	default: vi.fn(() => ({ id: "google", name: "Google" })),
}));

// Trigger module-level code: the real auth.ts calls NextAuth(config) which is
// intercepted by our mock above, capturing the signIn callback for testing.
await import("../src/lib/auth");

// ─── Tests ─────────────────────────────────────────────────────────────────
describe("Auth.js signIn callback (OAuth security)", () => {
	beforeEach(() => {
		delete process.env.ALLOWED_EMAILS;
		delete process.env.AUTH_ALLOW_ALL_USERS;
		delete process.env.NODE_ENV;
	});

	// ── 1. Fail-closed with missing/empty ALLOWED_EMAILS ──
	describe("missing/empty ALLOWED_EMAILS", () => {
		it("denies when ALLOWED_EMAILS is unset and AUTH_ALLOW_ALL_USERS is not true", () => {
			const result = signInCallback!({
				profile: { email: "test@example.com", email_verified: true },
			});
			expect(result).toBe(false);
		});

		it("denies when ALLOWED_EMAILS is an empty string", () => {
			process.env.ALLOWED_EMAILS = "";
			const result = signInCallback!({
				profile: { email: "test@example.com", email_verified: true },
			});
			expect(result).toBe(false);
		});

		it("denies when ALLOWED_EMAILS contains only whitespace-delimited empty tokens", () => {
			process.env.ALLOWED_EMAILS = "  , , ";
			const result = signInCallback!({
				profile: { email: "test@example.com", email_verified: true },
			});
			expect(result).toBe(false);
		});

		it("denies when ALLOWED_EMAILS is set to a non-true AUTH_ALLOW_ALL_USERS value", () => {
			process.env.AUTH_ALLOW_ALL_USERS = "false";
			const result = signInCallback!({
				profile: { email: "test@example.com", email_verified: true },
			});
			expect(result).toBe(false);
		});

		it("denies when ALLOWED_EMAILS is set to a truthy-looking but not exactly 'true' value", () => {
			process.env.AUTH_ALLOW_ALL_USERS = "1";
			const result = signInCallback!({
				profile: { email: "test@example.com", email_verified: true },
			});
			expect(result).toBe(false);
		});
	});

	// ── 2. AUTH_ALLOW_ALL_USERS open-gate ──
	describe("AUTH_ALLOW_ALL_USERS=true (open gate)", () => {
		it("allows any verified email when open gate is enabled", () => {
			process.env.AUTH_ALLOW_ALL_USERS = "true";
			const result = signInCallback!({
				profile: { email: "anyone@example.com", email_verified: true },
			});
			expect(result).toBe(true);
		});

		it("denies all when NODE_ENV=production even if AUTH_ALLOW_ALL_USERS=true", () => {
			process.env.AUTH_ALLOW_ALL_USERS = "true";
			process.env.NODE_ENV = "production";
			const result = signInCallback!({
				profile: { email: "anyone@example.com", email_verified: true },
			});
			expect(result).toBe(false);
		});

		it("denies unverified email even when open gate is enabled", () => {
			process.env.AUTH_ALLOW_ALL_USERS = "true";
			const result = signInCallback!({
				profile: { email: "anyone@example.com", email_verified: false },
			});
			expect(result).toBe(false);
		});

		it("denies when email_verified field is missing even with open gate", () => {
			process.env.AUTH_ALLOW_ALL_USERS = "true";
			const result = signInCallback!({
				profile: { email: "anyone@example.com" },
			});
			expect(result).toBe(false);
		});
	});

	// ── 3. Allowlist with case-insensitive matching + verified requirement ──
	describe("allowlisted emails (case-insensitive + verified)", () => {
		it("allows exact-match allowlisted email with email_verified=true", () => {
			process.env.ALLOWED_EMAILS = "admin@example.com";
			const result = signInCallback!({
				profile: { email: "admin@example.com", email_verified: true },
			});
			expect(result).toBe(true);
		});

		it("allows case-different allowlisted email (upper in env, mixed in profile)", () => {
			process.env.ALLOWED_EMAILS = "Admin@Example.COM";
			const result = signInCallback!({
				profile: { email: "ADMIN@example.com", email_verified: true },
			});
			expect(result).toBe(true);
		});

		it("allows when profile email has different casing than env var", () => {
			process.env.ALLOWED_EMAILS = "USER@EXAMPLE.COM";
			const result = signInCallback!({
				profile: { email: "user@example.com", email_verified: true },
			});
			expect(result).toBe(true);
		});

		it("denies allowlisted email when email_verified is false", () => {
			process.env.ALLOWED_EMAILS = "admin@example.com";
			const result = signInCallback!({
				profile: { email: "admin@example.com", email_verified: false },
			});
			expect(result).toBe(false);
		});

		it("denies allowlisted email when email_verified is undefined", () => {
			process.env.ALLOWED_EMAILS = "admin@example.com";
			const result = signInCallback!({
				profile: { email: "admin@example.com" },
			});
			expect(result).toBe(false);
		});

		it("allows one of multiple comma-separated allowlisted emails", () => {
			process.env.ALLOWED_EMAILS =
				"alice@example.com, bob@example.com, carol@example.com";
			const result = signInCallback!({
				profile: { email: "bob@example.com", email_verified: true },
			});
			expect(result).toBe(true);
		});

		it("trims whitespace around comma-separated emails in the env var", () => {
			process.env.ALLOWED_EMAILS = "  alice@example.com ,  bob@example.com  ";
			const result = signInCallback!({
				profile: { email: "bob@example.com", email_verified: true },
			});
			expect(result).toBe(true);
		});
	});

	// ── 4. Non-allowlisted / unknown email ──
	describe("non-allowlisted email", () => {
		it("denies email not in the allowlist even with email_verified=true", () => {
			process.env.ALLOWED_EMAILS = "admin@example.com";
			const result = signInCallback!({
				profile: { email: "other@example.com", email_verified: true },
			});
			expect(result).toBe(false);
		});

		it("denies when profile is undefined", () => {
			process.env.ALLOWED_EMAILS = "admin@example.com";
			const result = signInCallback!({ profile: undefined });
			expect(result).toBe(false);
		});

		it("denies when profile.email is undefined", () => {
			process.env.ALLOWED_EMAILS = "admin@example.com";
			const result = signInCallback!({
				profile: { email: undefined, email_verified: true },
			});
			expect(result).toBe(false);
		});

		it("denies when profile is an empty object", () => {
			process.env.ALLOWED_EMAILS = "admin@example.com";
			const result = signInCallback!({ profile: {} });
			expect(result).toBe(false);
		});

		it("denies when ALLOWED_EMAILS has valid entries but profile email does not match any", () => {
			process.env.ALLOWED_EMAILS = "alice@example.com, bob@example.com";
			const result = signInCallback!({
				profile: { email: "mallory@example.com", email_verified: true },
			});
			expect(result).toBe(false);
		});
	});
});
