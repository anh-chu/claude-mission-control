/**
 * Unit tests for the HMAC-SHA256 webhook signature helper.
 */

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyHmacSignature } from "@/lib/webhooks/signature";

const SECRET = "test-webhook-secret-abc123";

function makeSignature(body: string, secret = SECRET): string {
	return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyHmacSignature", () => {
	it("returns true for a valid sha256=<hex> signature", () => {
		const body = '{"title":"test","prompt":"hello"}';
		const header = makeSignature(body);
		expect(verifyHmacSignature(body, header, SECRET)).toBe(true);
	});

	it("returns true for a bare <hex> signature (without sha256= prefix)", () => {
		const body = '{"title":"test","prompt":"hello"}';
		const header = createHmac("sha256", SECRET).update(body).digest("hex");
		expect(verifyHmacSignature(body, header, SECRET)).toBe(true);
	});

	it("returns false for a tampered body", () => {
		const body = '{"title":"test","prompt":"hello"}';
		const header = makeSignature(body);
		const tamperedBody = '{"title":"test","prompt":"TAMPERED"}';
		expect(verifyHmacSignature(tamperedBody, header, SECRET)).toBe(false);
	});

	it("returns false when the signature uses a different secret", () => {
		const body = '{"title":"test","prompt":"hello"}';
		const header = makeSignature(body, "wrong-secret");
		expect(verifyHmacSignature(body, header, SECRET)).toBe(false);
	});

	it("returns false for a null header (signature absent)", () => {
		const body = '{"title":"test","prompt":"hello"}';
		expect(verifyHmacSignature(body, null, SECRET)).toBe(false);
	});

	it("returns false for an empty string header", () => {
		const body = '{"title":"test","prompt":"hello"}';
		expect(verifyHmacSignature(body, "", SECRET)).toBe(false);
	});

	it("returns false for a malformed hex string (wrong length)", () => {
		const body = '{"title":"test","prompt":"hello"}';
		expect(verifyHmacSignature(body, "sha256=abc123", SECRET)).toBe(false);
	});

	it("returns false for a non-hex header value", () => {
		const body = '{"title":"test","prompt":"hello"}';
		expect(verifyHmacSignature(body, "sha256=not-hex!@#", SECRET)).toBe(false);
	});

	it("verifies an empty body correctly", () => {
		const body = "";
		const header = makeSignature(body);
		expect(verifyHmacSignature(body, header, SECRET)).toBe(true);
	});

	it("returns false when header has sha256= prefix with wrong-length hex", () => {
		const body = "test";
		// 63-char hex — one char short of 64
		const shortHex = "a".repeat(63);
		expect(verifyHmacSignature(body, `sha256=${shortHex}`, SECRET)).toBe(false);
	});
});
