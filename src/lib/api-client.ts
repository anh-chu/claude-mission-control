/**
 * Authenticated API client for Mandio.
 *
 * Wraps fetch() with:
 * - Cookie-based session auth via credentials: 'include'
 * - 401 redirect to /login
 * - Retry with exponential backoff for network errors and 5xx responses
 * - Configurable retry behavior per request
 */

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extended RequestInit with retry options. */
export interface ApiFetchInit extends RequestInit {
	/** Max retries on network error or 5xx (default: 2 for GET, 0 for mutations). */
	retries?: number;
	/** Base delay in ms before first retry (doubles each attempt, default: 500). */
	retryDelay?: number;
}

/**
 * Fetch wrapper with auth + automatic retry for transient failures.
 *
 * - GET requests retry up to 2 times by default (safe to retry reads).
 * - POST/PUT/DELETE default to 0 retries (mutations need explicit opt-in).
 * - Retries only on network errors and 5xx responses (never on 4xx).
 * - 401 responses redirect to /login.
 */
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

			// Only retry on 5xx (server error), never on 4xx (client error)
			if (res.status >= 500 && attempt < maxRetries) {
				await sleep(baseDelay * 2 ** attempt);
				continue;
			}

			return res;
		} catch (err) {
			// Network error (server unreachable, DNS failure, CORS, etc.)
			lastError = err;
			if (attempt < maxRetries) {
				await sleep(baseDelay * 2 ** attempt);
			}
		}
	}

	// All retries exhausted — throw the last error
	throw lastError;
}
