import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request (or per-job-tick) workspace scope.
 * Replaces the `_currentWorkspaceId` module-global in data.ts and conversations.ts,
 * which was a concurrency bug: simultaneous requests would overwrite each other's
 * workspace context.
 *
 * Usage in route handlers:
 *   return applyWorkspaceContext(async (workspaceId) => { ... });
 *
 * Usage in scheduled jobs:
 *   await workspaceStore.run(wsId, async () => { ... });
 *
 * Usage in data-layer helpers:
 *   const wsId = getWorkspaceId(); // reads from ALS, falls back to "default"
 */
export const workspaceStore = new AsyncLocalStorage<string>();

/**
 * Fallback workspace id used when there is no active ALS context.
 * Intended for test setup only — route handlers must always run inside
 * applyWorkspaceContext() which sets the ALS context directly.
 */
let _fallbackWorkspaceId = "default";

/**
 * Return the active workspace id for the current async context.
 * Falls back to _fallbackWorkspaceId (test-layer default) when called
 * outside an ALS scope.
 */
export function getWorkspaceId(): string {
	return workspaceStore.getStore() ?? _fallbackWorkspaceId;
}

/**
 * Set the fallback workspace id used outside ALS context.
 * Call this in test beforeEach to scope data access without needing
 * to wrap every call in workspaceStore.run().
 *
 * @deprecated For test use only. Production code must use applyWorkspaceContext().
 */
export function setFallbackWorkspaceId(id: string): void {
	_fallbackWorkspaceId = id;
}
