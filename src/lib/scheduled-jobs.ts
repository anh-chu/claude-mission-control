/**
 * Server-side background jobs registered via instrumentation.ts.
 * All jobs run in the Node.js process for the lifetime of the server.
 */

import { spawn } from "node:child_process";
import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	unlinkSync,
} from "node:fs";
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import cron from "node-cron";
import {
	getActiveRuns,
	getDaemonConfig,
	getDecisions,
	getTasks,
	mutateActiveRuns,
	mutateTasks,
} from "./data";
import { createLogger } from "./logger";
import { DATA_DIR } from "./paths";
import { isProcessAlive } from "./process-utils";
import { resolveScriptEntrypoint } from "./script-entrypoints";

const GRACE_MS = 60 * 60 * 1000; // 1 hour
const LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const UPLOAD_RE = /\/uploads\/[^"'\s)\]]+/g;

function collectReferencedFilenames(): Set<string> {
	const refs = new Set<string>();

	function extractFromValue(val: unknown) {
		if (typeof val === "string") {
			for (const match of val.matchAll(UPLOAD_RE)) {
				refs.add(path.basename(match[0]));
			}
		} else if (Array.isArray(val)) {
			for (const item of val) extractFromValue(item);
		} else if (val && typeof val === "object") {
			for (const v of Object.values(val as Record<string, unknown>))
				extractFromValue(v);
		}
	}

	function scanFile(filePath: string) {
		try {
			extractFromValue(JSON.parse(readFileSync(filePath, "utf-8")));
		} catch {
			/* ignore unreadable */
		}
	}

	const workspacesDir = path.join(DATA_DIR, "workspaces");
	if (existsSync(workspacesDir)) {
		for (const ws of readdirSync(workspacesDir)) {
			const wsDir = path.join(workspacesDir, ws);
			try {
				for (const file of readdirSync(wsDir).filter((f) =>
					f.endsWith(".json"),
				)) {
					scanFile(path.join(wsDir, file));
				}
			} catch {
				/* ignore */
			}
		}
	}

	try {
		for (const file of readdirSync(DATA_DIR).filter((f) =>
			f.endsWith(".json"),
		)) {
			scanFile(path.join(DATA_DIR, file));
		}
	} catch {
		/* ignore */
	}

	return refs;
}

function runUploadsCleanup() {
	const refs = collectReferencedFilenames();
	const now = Date.now();
	let deleted = 0;

	const workspacesDir = path.join(DATA_DIR, "workspaces");
	if (!existsSync(workspacesDir)) return;

	try {
		for (const ws of readdirSync(workspacesDir)) {
			const uploadsDir = path.join(workspacesDir, ws, "uploads");
			if (!existsSync(uploadsDir)) continue;
			try {
				for (const filename of readdirSync(uploadsDir).filter(
					(f) => !f.startsWith("."),
				)) {
					const filePath = path.join(uploadsDir, filename);
					try {
						const { mtimeMs } = statSync(filePath);
						if (!refs.has(filename) && now - mtimeMs >= GRACE_MS) {
							unlinkSync(filePath);
							deleted++;
						}
					} catch {
						/* ignore per-file errors */
					}
				}
			} catch {
				/* ignore dir errors */
			}
		}
	} catch {
		/* ignore workspaces dir errors */
	}

	if (deleted > 0) {
		console.log(`[cleanup:uploads] removed ${deleted} orphaned file(s)`);
	}
}

export function scheduleUploadsCleanup() {
	// Run immediately on startup (catches anything left from last session)
	runUploadsCleanup();

	// Then run every hour
	cron.schedule("0 * * * *", runUploadsCleanup);
	console.log("[cleanup:uploads] scheduler registered (hourly)");
}

async function cleanupDirectoryOlderThan(
	dir: string,
	maxAgeMs: number,
): Promise<number> {
	if (!existsSync(dir)) return 0;

	let deleted = 0;
	const entries = await readdir(dir, { withFileTypes: true });
	const now = Date.now();

	await Promise.all(
		entries.map(async (entry) => {
			if (!entry.isFile()) return;
			const filePath = path.join(dir, entry.name);

			try {
				const fileStat = await stat(filePath);
				if (now - fileStat.mtimeMs < maxAgeMs) return;
				await unlink(filePath);
				deleted += 1;
			} catch {
				// Ignore per-file errors so one bad file does not stop cleanup.
			}
		}),
	);

	return deleted;
}

async function runLogCleanup() {
	try {
		const [logFilesDeleted, streamFilesDeleted] = await Promise.all([
			cleanupDirectoryOlderThan(path.join(DATA_DIR, "logs"), LOG_RETENTION_MS),
			cleanupDirectoryOlderThan(
				path.join(DATA_DIR, "agent-streams"),
				LOG_RETENTION_MS,
			),
		]);

		if (logFilesDeleted > 0 || streamFilesDeleted > 0) {
			console.log(
				`[cleanup:logs] removed ${logFilesDeleted} log file(s) and ${streamFilesDeleted} stream file(s)`,
			);
		}
	} catch {
		// Non-fatal: cleanup should never break app startup.
	}
}

export function scheduleLogCleanup() {
	void runLogCleanup();
	cron.schedule("0 3 * * *", () => {
		void runLogCleanup();
	});
	console.log("[cleanup:logs] scheduler registered (daily)");
}

// ─── Autopilot Poller ────────────────────────────────────────────────────────

const autopilotLogger = createLogger("autopilot");

/**
 * One tick of the autopilot poller:
 * 1. Recovery sweep — mark dead runs as failed, reset orphaned tasks.
 * 2. Dispatch — spawn run-task.ts for each dispatchable task up to concurrency limit.
 */
async function runAutopilotTick(): Promise<void> {
	// Read config
	const rawConfig = await getDaemonConfig();
	const config = rawConfig as {
		polling?: { enabled?: boolean };
		concurrency?: { maxParallelAgents?: number };
	};

	if (!config.polling?.enabled) return;

	const maxParallelAgents = config.concurrency?.maxParallelAgents ?? 3;

	// ── Recovery sweep ───────────────────────────────────────────────────────

	// Mark runs whose process is no longer alive as failed; collect affected task IDs.
	const deadTaskIds = await mutateActiveRuns(async (data) => {
		const dead = new Set<string>();
		for (const run of data.runs) {
			if (run.status === "running" && !isProcessAlive(run.pid)) {
				run.status = "failed";
				run.completedAt = new Date().toISOString();
				run.error = "Process died unexpectedly (autopilot recovery)";
				dead.add(run.taskId);
				autopilotLogger.warn(
					"recovery",
					`Marked run ${run.id} for task ${run.taskId} as failed (pid ${run.pid} not alive)`,
				);
			}
		}
		return dead;
	});

	// Reset orphaned in-progress tasks back to not-started.
	if (deadTaskIds.size > 0) {
		await mutateTasks(async (data) => {
			for (const task of data.tasks) {
				if (task.kanban === "in-progress" && deadTaskIds.has(task.id)) {
					task.kanban = "not-started";
					task.updatedAt = new Date().toISOString();
					autopilotLogger.info(
						"recovery",
						`Reset task ${task.id} to not-started`,
					);
				}
			}
			return undefined;
		});
	}

	// ── Dispatch ─────────────────────────────────────────────────────────────

	const [tasksData, runsData, decisionsData] = await Promise.all([
		getTasks(),
		getActiveRuns(),
		getDecisions(),
	]);

	// Determine which task IDs currently have a live running process.
	const aliveRunningTaskIds = new Set<string>();
	for (const run of runsData.runs) {
		if (
			run.status === "running" &&
			isProcessAlive(run.pid, /* assumeAliveIfZero */ true)
		) {
			aliveRunningTaskIds.add(run.taskId);
		}
	}
	const runningCount = aliveRunningTaskIds.size;
	const availableSlots = Math.max(0, maxParallelAgents - runningCount);

	if (availableSlots <= 0) {
		autopilotLogger.debug(
			"dispatch",
			`No slots available (${runningCount}/${maxParallelAgents} agents running)`,
		);
		return;
	}

	// Collect task IDs blocked by a pending decision.
	const pendingDecisionTaskIds = new Set(
		decisionsData.decisions
			.filter((d) => d.status === "pending" && d.taskId != null)
			.map((d) => d.taskId as string),
	);

	// Find tasks that are ready to dispatch.
	const dispatchable = tasksData.tasks.filter((task) => {
		if (task.deletedAt) return false;
		if (task.kanban !== "not-started") return false;
		if (!task.assignedTo || task.assignedTo === "me") return false;
		if (aliveRunningTaskIds.has(task.id)) return false;
		// All blocking dependencies must be done.
		if (task.blockedBy.length > 0) {
			const allDone = task.blockedBy.every((depId) => {
				const dep = tasksData.tasks.find((t) => t.id === depId);
				return dep?.kanban === "done";
			});
			if (!allDone) return false;
		}
		// No pending decision gating this task.
		if (pendingDecisionTaskIds.has(task.id)) return false;
		return true;
	});

	if (dispatchable.length === 0) {
		autopilotLogger.debug("dispatch", "No dispatchable tasks");
		return;
	}

	autopilotLogger.info(
		"dispatch",
		`Found ${dispatchable.length} dispatchable task(s), ${availableSlots} slot(s) available`,
	);

	const toDispatch = dispatchable.slice(0, availableSlots);
	const cwd = process.cwd();
	const runTaskEntry = resolveScriptEntrypoint("run-task");

	for (const task of toDispatch) {
		// Pre-reserve the task by marking it in-progress so the next tick
		// does not see it as dispatchable. If spawn fails, reset below.
		await mutateTasks(async (data) => {
			const t = data.tasks.find((t) => t.id === task.id);
			if (t && t.kanban === "not-started") {
				t.kanban = "in-progress";
				t.updatedAt = new Date().toISOString();
			}
		});

		const args = [...runTaskEntry.args, task.id, "--source", "autopilot"];
		try {
			const child = spawn(runTaskEntry.runner, args, {
				cwd,
				detached: true,
				stdio: "ignore",
				shell: false,
			});
			child.unref();
			autopilotLogger.info(
				"dispatch",
				`Dispatched task ${task.id} (assignedTo: ${task.assignedTo}, pid: ${child.pid ?? "unknown"})`,
			);
		} catch (err) {
			// Spawn failed — unreserve the task so it can be retried.
			await mutateTasks(async (data) => {
				const t = data.tasks.find((t) => t.id === task.id);
				if (t && t.kanban === "in-progress") {
					t.kanban = "not-started";
					t.updatedAt = new Date().toISOString();
				}
			});
			autopilotLogger.error(
				"dispatch",
				`Failed to dispatch task ${task.id}: ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
		}
	}
}

/**
 * One-shot startup recovery: mark dead runs as failed and reset orphaned tasks.
 * Called once at server startup before the poller begins.
 */
export async function runStartupRecovery(): Promise<void> {
	try {
		const deadTaskIds = await mutateActiveRuns(async (data) => {
			const dead = new Set<string>();
			for (const run of data.runs) {
				if (run.status === "running" && !isProcessAlive(run.pid)) {
					run.status = "failed";
					run.completedAt = new Date().toISOString();
					run.error = "Process died unexpectedly (startup recovery)";
					dead.add(run.taskId);
					autopilotLogger.warn(
						"recovery",
						`Startup: marked run ${run.id} for task ${run.taskId} as failed (pid ${run.pid} not alive)`,
					);
				}
			}
			return dead;
		});

		if (deadTaskIds.size > 0) {
			await mutateTasks(async (data) => {
				for (const task of data.tasks) {
					if (task.kanban === "in-progress" && deadTaskIds.has(task.id)) {
						task.kanban = "not-started";
						task.updatedAt = new Date().toISOString();
						autopilotLogger.info(
							"recovery",
							`Startup: reset task ${task.id} to not-started`,
						);
					}
				}
				return undefined;
			});
		}

		if (deadTaskIds.size > 0) {
			autopilotLogger.info(
				"recovery",
				`Startup recovery: recovered ${deadTaskIds.size} task(s)`,
			);
		} else {
			autopilotLogger.debug("recovery", "Startup recovery: no dead runs found");
		}
	} catch (err) {
		autopilotLogger.error(
			"recovery",
			`Startup recovery error: ${
				err instanceof Error ? err.message : String(err)
			}`,
		);
	}
}

/**
 * Register the autopilot poller and any scheduled commands from daemon-config.json.
 * Runs inside the Next.js server process (registered via instrumentation.ts).
 */
export function scheduleAutopilotPoller(): void {
	// Polling tick: recovery sweep + task dispatch every minute.
	cron.schedule("* * * * *", () => {
		void runAutopilotTick().catch((err) => {
			autopilotLogger.error(
				"poller",
				`Unhandled tick error: ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
		});
	});

	// Scheduled commands: register each enabled cron entry from daemon-config.json.
	void getDaemonConfig()
		.then((rawConfig) => {
			const config = rawConfig as {
				schedule?: Record<
					string,
					{ enabled?: boolean; cron?: string; command?: string }
				>;
			};
			if (!config.schedule) return;

			const cwd = process.cwd();
			const runTaskEntry = resolveScriptEntrypoint("run-task");

			for (const [name, entry] of Object.entries(config.schedule)) {
				if (!entry.enabled || !entry.cron || !entry.command) continue;
				if (!cron.validate(entry.cron)) {
					autopilotLogger.warn(
						"scheduler",
						`Invalid cron expression for "${name}": ${entry.cron}`,
					);
					continue;
				}

				const command = entry.command;
				cron.schedule(entry.cron, () => {
					autopilotLogger.info(
						"scheduler",
						`Triggering scheduled command: ${command} (schedule: ${name})`,
					);
					const args = [...runTaskEntry.args, command, "--source", "scheduled"];
					try {
						const child = spawn(runTaskEntry.runner, args, {
							cwd,
							detached: true,
							stdio: "ignore",
							shell: false,
						});
						child.unref();
					} catch (spawnErr) {
						autopilotLogger.error(
							"scheduler",
							`Failed to spawn scheduled command ${command}: ${
								spawnErr instanceof Error ? spawnErr.message : String(spawnErr)
							}`,
						);
					}
				});

				autopilotLogger.info(
					"scheduler",
					`Registered schedule "${name}": ${entry.cron} → ${command}`,
				);
			}
		})
		.catch((err) => {
			autopilotLogger.warn(
				"scheduler",
				`Could not load schedule config: ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
		});

	console.log("[autopilot] poller registered (every 60s)");
}
