/**
 * Node.js-only instrumentation logic.
 * Imported dynamically from instrumentation.ts to avoid Edge bundling.
 */
import {
	copyFileSync,
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLogger } from "@/lib/logger";
import { DAEMON_PID_FILE } from "@/lib/paths";
import {
	runStartupRecovery,
	scheduleAutopilotPoller,
	scheduleLogCleanup,
	scheduleUploadsCleanup,
} from "@/lib/scheduled-jobs";

const DATA_DIR = process.env.MANDIO_DATA_DIR
	? path.resolve(process.env.MANDIO_DATA_DIR)
	: path.join(os.homedir(), ".mandio");
const appLogger = createLogger("app");

// ─── Seed default workspace on fresh install ────────────────────────────────

const wsDir = path.join(DATA_DIR, "workspaces", "default");
const artifactsDir = path.join(
	process.cwd(),
	"artifacts",
	"workspaces",
	"default",
);

if (!existsSync(wsDir)) {
	appLogger.info("startup", "Initializing workspace", {
		workspaceId: "default",
	});
	mkdirSync(wsDir, { recursive: true });

	if (existsSync(artifactsDir)) {
		for (const file of [
			"agents.json",
			"skills-library.json",
			"daemon-config.json",
			"CLAUDE.md",
		]) {
			const src = path.join(artifactsDir, file);
			if (existsSync(src)) {
				copyFileSync(src, path.join(wsDir, file));
				appLogger.info("startup", "Seeded workspace artifact", {
					workspaceId: "default",
					file,
				});
			}
		}
		const claudeSrc = path.join(artifactsDir, ".claude");
		if (existsSync(claudeSrc)) {
			cpSync(claudeSrc, path.join(wsDir, ".claude"), { recursive: true });
			appLogger.info("startup", "Seeded workspace directory", {
				workspaceId: "default",
				directory: ".claude",
			});
		}
	}

	const emptySeeds: Record<string, unknown> = {
		"tasks.json": { tasks: [] },
		"tasks-archive.json": { tasks: [] },
		"initiatives.json": { initiatives: [] },
		"projects.json": { projects: [] },
		"brain-dump.json": { entries: [] },
		"activity-log.json": { events: [] },
		"inbox.json": { messages: [] },
		"decisions.json": { decisions: [] },
		"active-runs.json": { runs: [] },
	};
	for (const [file, content] of Object.entries(emptySeeds)) {
		const dest = path.join(wsDir, file);
		if (!existsSync(dest)) {
			writeFileSync(dest, JSON.stringify(content, null, 2), "utf-8");
			appLogger.info("startup", "Seeded workspace data file", {
				workspaceId: "default",
				file,
			});
		}
	}
}

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
