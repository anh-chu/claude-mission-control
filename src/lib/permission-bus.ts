// In-process permission-request bus.
// Chat route registers a pending request; permission route resolves it.
// Only suitable for single-process deployments (standard Next.js).

import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";

export type { PermissionResult };

interface PendingPermission {
	resolve: (result: PermissionResult) => void;
	reject: (err: unknown) => void;
	createdAt: number;
}

const pending = new Map<string, PendingPermission>();
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Register a pending permission request. Returns a Promise that resolves
 * once the user approves or denies, or rejects after the timeout.
 */
export function registerPending(requestId: string): Promise<PermissionResult> {
	return new Promise<PermissionResult>((resolve, reject) => {
		const timer = setTimeout(() => {
			if (pending.delete(requestId)) {
				reject(new Error("Permission request timed out."));
			}
		}, TIMEOUT_MS);

		pending.set(requestId, {
			resolve: (result) => {
				clearTimeout(timer);
				pending.delete(requestId);
				resolve(result);
			},
			reject: (err) => {
				clearTimeout(timer);
				pending.delete(requestId);
				reject(err);
			},
			createdAt: Date.now(),
		});
	});
}

/**
 * Resolve a pending permission request. Returns true if the request was
 * found and resolved, false if no matching request exists.
 */
export function resolvePending(
	requestId: string,
	result: PermissionResult,
): boolean {
	const entry = pending.get(requestId);
	if (!entry) return false;
	entry.resolve(result);
	return true;
}

/** Check whether a permission request is currently pending. */
export function hasPending(requestId: string): boolean {
	return pending.has(requestId);
}
