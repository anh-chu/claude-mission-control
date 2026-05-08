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
import { buildScheduledTask, loadCommandPrompt } from "./command-prompt";
import { reapStaleRuns, setConversationsWorkspace } from "./conversations";
import {
	getActiveRuns,
	getDecisions,
	getTasks,
	mutateActiveRuns,
	mutateTasks,
	setCurrentWorkspace,
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
 * Enumerate workspace directories under DATA_DIR/workspaces.
 */
function enumerateWorkspaces(): string[] {
	const workspacesDir = path.join(DATA_DIR, "workspaces");
	if (!existsSync(workspacesDir)) return [];
	try {
		return readdirSync(workspacesDir).filter((name) => {
			try {
				return (
					statSync(path.join(workspacesDir, name)).isDirectory() &&
					!name.startsWith(".")
				);
			} catch {
				return false;
			}
		});
	} catch {
		return [];
	}
}

/**
 * One tick of the autopilot poller:
 * 1. Recovery sweep — mark dead runs as failed, reset orphaned tasks.
 * 2. Dispatch — spawn run-task.ts for each dispatchable task up to concurrency limit.
 */
async function runAutopilotTick(): Promise<void> {
	const workspaces = enumerateWorkspaces();
	if (workspaces.length === 0) return;

	const GLOBAL_MAX_PARALLEL = parseInt(
		process.env.MANDIO_GLOBAL_MAX_PARALLEL_AGENTS ?? "10",
		10,
	);

	// Count total running processes across all workspaces for global cap
	let totalRunningGlobally = 0;
	for (const wsId of workspaces) {
		try {
			const activeRunsPath = path.join(
				DATA_DIR,
				"workspaces",
				wsId,
				"active-runs.json",
			);
			const raw = readFileSync(activeRunsPath, "utf-8");
			const data = JSON.parse(raw) as {
				runs: Array<{ status: string; pid: number }>;
			};
			for (const run of data.runs) {
				if (
					run.status === "running" &&
					(run.pid === 0 || isProcessAlive(run.pid))
				) {
					totalRunningGlobally++;
				}
			}
		} catch {
			// File may not exist yet
		}
	}

	// Process each workspace sequentially
	for (const wsId of workspaces) {
		const dispatched = await runWorkspaceTick(
			wsId,
			totalRunningGlobally,
			GLOBAL_MAX_PARALLEL,
		);
		totalRunningGlobally += dispatched;
	}
}

/**
 * Run the autopilot tick for a single workspace.
 * Returns the number of tasks dispatched.
 */
async function runWorkspaceTick(
	wsId: string,
	totalRunningGlobally: number,
	globalMaxParallel: number,
): Promise<number> {
	// Read daemon-config directly to avoid module-global race
	const configPath = path.join(
		DATA_DIR,
		"workspaces",
		wsId,
		"daemon-config.json",
	);
	let configRaw: Record<string, unknown>;
	try {
		configRaw = JSON.parse(readFileSync(configPath, "utf-8")) as Record<
			string,
			unknown
		>;
	} catch {
		return 0; // No config or unreadable M-bM-^@M-^T skip this workspace
	}

	const config = configRaw as {
		polling?: { enabled?: boolean };
		concurrency?: { maxParallelAgents?: number };
		execution?: { retries?: number };
	};

	if (!config.polling?.enabled) return 0;

	const maxParallelAgents = config.concurrency?.maxParallelAgents ?? 3;
	const maxRetries = config.execution?.retries ?? 1;

	// Set workspace context for subsequent data reads
	setCurrentWorkspace(wsId);

	// Load valid agents once per tick for existence checks
	let validAgentIds = new Set<string>();
	try {
		const agentsRaw = readFileSync(
			path.join(DATA_DIR, "workspaces", wsId, "agents.json"),
			"utf-8",
		);
		const agentsData = JSON.parse(agentsRaw) as {
			agents: Array<{ id: string }>;
		};
		validAgentIds = new Set(agentsData.agents.map((a) => a.id));
	} catch {
		/* agents.json missing — validAgentIds stays empty, all agent tasks will be skipped */
	}

	// ── Recovery sweep ─────────────────────────────────────────────────────────────

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
					`Workspace ${wsId}: marked run ${run.id} for task ${run.taskId} as failed (pid ${run.pid} not alive)`,
				);
			}
		}
		return dead;
	});

	// Reset orphaned in-progress tasks back to not-started, or fail if max retries exceeded.
	if (deadTaskIds.size > 0) {
		await mutateTasks(async (data) => {
			for (const task of data.tasks) {
				if (task.kanban === "in-progress" && deadTaskIds.has(task.id)) {
					const attempts = (task.attemptCount ?? 0) + 1;
					if (attempts > maxRetries) {
						task.kanban = "failed";
						task.error = `Max retries exceeded (${maxRetries})`;
						autopilotLogger.warn(
							"recovery",
							`Workspace ${wsId}: task ${task.id} failed after ${attempts} attempts (max ${maxRetries})`,
						);
					} else {
						task.kanban = "not-started";
						autopilotLogger.info(
							"recovery",
							`Workspace ${wsId}: reset task ${task.id} to not-started (attempt ${attempts}/${maxRetries + 1})`,
						);
					}
					task.attemptCount = attempts;
					task.updatedAt = new Date().toISOString();
				}
			}
			return undefined;
		});
	}

	// Conversation reaper alongside active-runs sweep
	try {
		setConversationsWorkspace(wsId);
		const reaped = await reapStaleRuns({ gracePeriodMs: 60000 });
		if (reaped > 0) {
			autopilotLogger.info(
				"recovery",
				`Workspace ${wsId}: reaped ${reaped} stale conversation(s)`,
			);
		}
	} catch (err) {
		autopilotLogger.warn(
			"recovery",
			`Workspace ${wsId}: conversation reaper failed: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	// ── Dispatch ────────────────────────────────────────────────────────────────

	const [tasksData, runsData, decisionsData] = await Promise.all([
		getTasks(),
		getActiveRuns(),
		getDecisions(),
	]);

	// Determine which task IDs currently have a live running process.
	const aliveRunningTaskIds = new Set<string>();
	let localRunningCount = 0;
	for (const run of runsData.runs) {
		if (
			run.status === "running" &&
			isProcessAlive(run.pid, /* assumeAliveIfZero */ true)
		) {
			aliveRunningTaskIds.add(run.taskId);
			localRunningCount++;
		}
	}

	// Available slots = min(global remaining, per-workspace remaining)
	const globalRemaining = Math.max(0, globalMaxParallel - totalRunningGlobally);
	const wsRemaining = Math.max(0, maxParallelAgents - localRunningCount);
	const availableSlots = Math.min(globalRemaining, wsRemaining);

	if (availableSlots <= 0) {
		autopilotLogger.debug(
			"dispatch",
			`Workspace ${wsId}: no slots available (${localRunningCount}/${maxParallelAgents} local, ${totalRunningGlobally} global)`,
		);
		return 0;
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
		// Skip tasks whose assigned agent no longer exists
		if (!validAgentIds.has(task.assignedTo)) {
			autopilotLogger.warn(
				"dispatch",
				`Workspace ${wsId}: skipping task ${task.id}: assigned agent "${task.assignedTo}" does not exist`,
			);
			return false;
		}
		// Skip tasks that have exhausted their retry budget
		if ((task.attemptCount ?? 0) > maxRetries) {
			autopilotLogger.warn(
				"dispatch",
				`Workspace ${wsId}: skipping task ${task.id}: max retries exceeded (${maxRetries})`,
			);
			return false;
		}
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
		autopilotLogger.debug(
			"dispatch",
			`Workspace ${wsId}: no dispatchable tasks`,
		);
		return 0;
	}

	autopilotLogger.info(
		"dispatch",
		`Workspace ${wsId}: found ${dispatchable.length} dispatchable task(s), ${availableSlots} slot(s) available`,
	);

	const toDispatch = dispatchable.slice(0, availableSlots);
	const cwd = process.cwd();
	const runTaskEntry = resolveScriptEntrypoint("run-task");

	let dispatchedCount = 0;
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
				env: {
					...process.env,
					MANDIO_WORKSPACE_ID: wsId,
				},
			});
			child.unref();
			dispatchedCount++;
			autopilotLogger.info(
				"dispatch",
				`Workspace ${wsId}: dispatched task ${task.id} (assignedTo: ${task.assignedTo}, pid: ${child.pid ?? "unknown"})`,
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
				`Workspace ${wsId}: failed to dispatch task ${task.id}: ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
		}
	}

	return dispatchedCount;
}

/**
 * One-shot startup recovery: mark dead runs as failed and reset orphaned tasks.
 * Called once at server startup before the poller begins.
 */
export async function runStartupRecovery(): Promise<void> {
	const workspaces = enumerateWorkspaces();

	for (const wsId of workspaces) {
		try {
			// Read daemon-config directly to avoid module-global race
			const configPath = path.join(
				DATA_DIR,
				"workspaces",
				wsId,
				"daemon-config.json",
			);
			let configRaw: Record<string, unknown>;
			try {
				configRaw = JSON.parse(readFileSync(configPath, "utf-8")) as Record<
					string,
					unknown
				>;
			} catch {
				continue; // No config — skip this workspace
			}

			const config = configRaw as { execution?: { retries?: number } };
			const maxRetries = config.execution?.retries ?? 1;

			setCurrentWorkspace(wsId);

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
							`Workspace ${wsId}: startup marked run ${run.id} for task ${run.taskId} as failed (pid ${run.pid} not alive)`,
						);
					}
				}
				return dead;
			});

			if (deadTaskIds.size > 0) {
				await mutateTasks(async (data) => {
					for (const task of data.tasks) {
						if (task.kanban === "in-progress" && deadTaskIds.has(task.id)) {
							const attempts = (task.attemptCount ?? 0) + 1;
							if (attempts > maxRetries) {
								task.kanban = "failed";
								task.error = `Max retries exceeded (${maxRetries})`;
								autopilotLogger.warn(
									"recovery",
									`Workspace ${wsId}: startup task ${task.id} failed after ${attempts} attempts (max ${maxRetries})`,
								);
							} else {
								task.kanban = "not-started";
								autopilotLogger.info(
									"recovery",
									`Workspace ${wsId}: startup reset task ${task.id} to not-started (attempt ${attempts}/${maxRetries + 1})`,
								);
							}
							task.attemptCount = attempts;
							task.updatedAt = new Date().toISOString();
						}
					}
					return undefined;
				});
			}

			if (deadTaskIds.size > 0) {
				autopilotLogger.info(
					"recovery",
					`Workspace ${wsId}: startup recovery: recovered ${deadTaskIds.size} task(s)`,
				);
			} else {
				autopilotLogger.debug(
					"recovery",
					`Workspace ${wsId}: startup recovery: no dead runs found`,
				);
			}
		} catch (err) {
			autopilotLogger.error(
				"recovery",
				`Workspace ${wsId}: startup recovery error: ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
		}

		// Conversation reaper — mark conversations whose process died as failed
		try {
			setConversationsWorkspace(wsId);
			const reaped = await reapStaleRuns({ gracePeriodMs: 10000 });
			if (reaped > 0) {
				autopilotLogger.info(
					"recovery",
					`Workspace ${wsId}: startup reaped ${reaped} stale conversation(s)`,
				);
			}
		} catch (err) {
			autopilotLogger.warn(
				"recovery",
				`Workspace ${wsId}: conversation reaper failed: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
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

	// Scheduled commands: register cron entries for each workspace.
	const cwd = process.cwd();
	const runTaskEntry = resolveScriptEntrypoint("run-task");
	const workspaces = enumerateWorkspaces();

	for (const wsId of workspaces) {
		// Read daemon-config directly to avoid module-global race
		const configPath = path.join(
			DATA_DIR,
			"workspaces",
			wsId,
			"daemon-config.json",
		);
		let configRaw: Record<string, unknown>;
		try {
			configRaw = JSON.parse(readFileSync(configPath, "utf-8")) as Record<
				string,
				unknown
			>;
		} catch {
			continue; // No config — skip this workspace
		}

		const config = configRaw as {
			schedule?: Record<
				string,
				{
					enabled?: boolean;
					cron?: string;
					command?: string;
					agentId?: string;
				}
			>;
		};

		if (!config.schedule) continue;

		for (const [name, entry] of Object.entries(config.schedule)) {
			if (!entry.enabled || !entry.cron || !entry.command) continue;
			// Skip if startAt is set and still in the future
			if (
				(entry as { startAt?: string | null }).startAt &&
				new Date((entry as { startAt: string }).startAt) > new Date()
			) {
				autopilotLogger.info(
					"scheduler",
					`Workspace ${wsId}: skipping schedule "${name}": startAt ${(entry as { startAt: string }).startAt} is in the future`,
				);
				continue;
			}
			if (!cron.validate(entry.cron)) {
				autopilotLogger.warn(
					"scheduler",
					`Workspace ${wsId}: invalid cron expression for "${name}": ${entry.cron}`,
				);
				continue;
			}

			const command = entry.command;
			cron.schedule(entry.cron, () => {
				autopilotLogger.info(
					"scheduler",
					`Workspace ${wsId}: triggering scheduled command: ${command} (schedule: ${name})`,
				);

				void (async () => {
					try {
						// Set workspace context for data operations
						setCurrentWorkspace(wsId);

						// Load the command prompt (outside mutex — safe, just file I/O)
						const promptResult = loadCommandPrompt(command);
						if (!promptResult.found) {
							autopilotLogger.error(
								"scheduler",
								`Workspace ${wsId}: no command file found for /${command}, skipping`,
							);
							return;
						}

						// Dedup + create task atomically inside the mutex
						let taskId: string | null = null;
						await mutateTasks(async (data) => {
							const alreadyQueued = data.tasks.some(
								(t) =>
									t.isScheduled &&
									t.title === `Command: /${command}` &&
									(t.kanban === "not-started" || t.kanban === "in-progress"),
							);
							if (alreadyQueued) return;

							const task = buildScheduledTask(
								command,
								promptResult.content,
								entry.agentId,
							);
							taskId = task.id;
							data.tasks.push(task);
						});

						if (!taskId) {
							autopilotLogger.info(
								"scheduler",
								`Workspace ${wsId}: skipping schedule "${name}": command /${command} already queued or running`,
							);
							return;
						}

						// Spawn run-task.ts with the new task ID
						const args = [
							...runTaskEntry.args,
							taskId,
							"--source",
							"scheduled",
						];
						const child = spawn(runTaskEntry.runner, args, {
							cwd,
							detached: true,
							stdio: "ignore",
							shell: false,
							env: {
								...process.env,
								MANDIO_WORKSPACE_ID: wsId,
							},
						});
						child.unref();
						autopilotLogger.info(
							"scheduler",
							`Workspace ${wsId}: dispatched command /${command} → task ${taskId} (pid: ${child.pid ?? "unknown"})`,
						);
					} catch (dispatchErr) {
						autopilotLogger.error(
							"scheduler",
							`Workspace ${wsId}: failed to dispatch command /${command}: ${
								dispatchErr instanceof Error
									? dispatchErr.message
									: String(dispatchErr)
							}`,
						);
					}
				})();
			});

			autopilotLogger.info(
				"scheduler",
				`Workspace ${wsId}: registered schedule "${name}": ${entry.cron} → ${command}`,
			);
		}
	}

	console.log("[autopilot] poller registered (every 60s)");
}
