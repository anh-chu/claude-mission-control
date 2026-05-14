/**
 * HMAC-SHA256 webhook signature verification.
 *
 * Accepts the canonical `sha256=<hex>` format or a bare hex digest.
 * Uses `timingSafeEqual` to prevent timing attacks.
 *
 * Future per-provider validators (Slack, GitHub, etc.) should live
 * alongside this file and call `createHmac` with their own conventions.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify that the incoming request body matches the provided HMAC signature.
 *
 * @param rawBody   The raw request body as a UTF-8 string.
 * @param header    The value of `X-Mandio-Signature` (may be null if absent).
 * @param secret    The shared HMAC secret.
 * @returns         `true` if the signature is valid; `false` otherwise.
 */
export function verifyHmacSignature(
	rawBody: string,
	header: string | null,
	secret: string,
): boolean {
	if (!header) return false;

	// Accept both "sha256=<hex>" and bare "<hex>"
	const hex = header.startsWith("sha256=") ? header.slice(7) : header;

	// Guard against malformed hex that would cause a buffer-length mismatch
	if (!/^[0-9a-f]{64}$/i.test(hex)) return false;

	const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

	try {
		const expectedBuf = Buffer.from(expected, "hex");
		const receivedBuf = Buffer.from(hex, "hex");
		// Both are 32 bytes (sha256), so lengths always match after the regex guard
		return timingSafeEqual(expectedBuf, receivedBuf);
	} catch {
		return false;
	}
}
