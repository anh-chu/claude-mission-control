/**
 * Node.js-only instrumentation logic.
 * Imported dynamically from instrumentation.ts to avoid Edge bundling.
 */
import { existsSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { ensureWorkspaceDir } from "@/lib/data";
import { DAEMON_PID_FILE, DATA_DIR } from "@/lib/paths";
import {
	runStartupRecovery,
	scheduleAutopilotPoller,
	scheduleLogCleanup,
	scheduleUploadsCleanup,
} from "@/lib/scheduled-jobs";

// ─── Seed/ensure all workspaces ────────────────────────────────────────────

void (async () => {
	// Ensure default workspace is fully seeded (idempotent, safe to call always)
	await ensureWorkspaceDir("default");

	// Ensure all existing workspace dirs are also seeded
	const workspacesDir = path.join(DATA_DIR, "workspaces");
	if (existsSync(workspacesDir)) {
		const entries = readdirSync(workspacesDir, { withFileTypes: true });
		for (const entry of entries) {
			if (
				entry.isDirectory() &&
				!entry.name.startsWith(".") &&
				entry.name !== "default"
			) {
				await ensureWorkspaceDir(entry.name);
			}
		}
	}
})();

// ─── Schedule uploads cleanup + autopilot poller ────────────────────────────

scheduleUploadsCleanup();
scheduleLogCleanup();

// Clean up stale daemon PID file. Do not send SIGTERM — the old daemon
// process is either already dead or its parent is gone. A blind kill risks
// terminating an unrelated process that has reused the PID.
if (existsSync(DAEMON_PID_FILE)) {
	try {
		unlinkSync(DAEMON_PID_FILE);
	} catch {
		// Non-fatal: startup should continue even if cleanup fails.
	}
}

void runStartupRecovery();
scheduleAutopilotPoller();
