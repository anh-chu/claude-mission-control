import { spawn } from "child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import { DATA_DIR, getWorkspaceDir } from "../../src/lib/paths";
import type { HealthMonitor } from "./health";
import { logger } from "./logger";
import {
	buildScheduledPrompt,
	getPendingTasks,
	hasPendingDecision,
	isTaskUnblocked,
} from "./prompt-builder";
import { clearSessionRecord, persistSessionRecord } from "./recovery";
import { type AgentRunner, parseClaudeOutput } from "./runner";
import type { DaemonConfig, ProjectRunsFile } from "./types";
import { getWorkspaceEnv } from "./workspace-env";

const TSX_BIN = path.resolve(__dirname, "../../node_modules/.bin/tsx");
const MAX_RETRY_DELAY_MINUTES = 60;

// ─── Script Resolution ─────────────────────────────────────────────────────────

/**
 * Resolve the path to a daemon script.
 * If a compiled dist/ version exists, use it (node); otherwise use tsx.
 */
function resolveScript(
	scriptName: string,
	cwd: string,
): { runner: string; args: string[] } {
	const distName = scriptName.replace(/\.ts$/, ".js");
	const distPath = path.join(cwd, "../../dist", distName);
	const tsxPath = path.join(__dirname, scriptName);
	if (existsSync(distPath)) {
		return { runner: process.execPath, args: [distPath] };
	}
	return { runner: TSX_BIN, args: [tsxPath] };
}

// ─── Retry Queue ────────────────────────────────────────────────────────────

interface RetryEntry {
	taskId: string;
	agentId: string;
	retryAt: string; // ISO timestamp — when this retry becomes eligible
	attempt: number; // 1-based attempt number (1 = first retry)
	failedAt: string; // ISO timestamp — when the failure occurred
	error: string | null;
}

// ─── Task Dispatcher ─────────────────────────────────────────────────────────

export class Dispatcher {
	private workspaceId: string;
	private config: DaemonConfig;
	private runner: AgentRunner;
	private health: HealthMonitor;
	private retryQueue: RetryEntry[] = [];

	private get MISSIONS_FILE(): string {
		return path.join(getWorkspaceDir(this.workspaceId), "missions.json");
	}
	private get TASKS_FILE(): string {
		return path.join(getWorkspaceDir(this.workspaceId), "tasks.json");
	}
	private get ACTIVE_RUNS_FILE(): string {
		return path.join(getWorkspaceDir(this.workspaceId), "active-runs.json");
	}
	private get DECISIONS_FILE(): string {
		return path.join(getWorkspaceDir(this.workspaceId), "decisions.json");
	}
	private get RETRY_QUEUE_FILE(): string {
		return path.join(
			getWorkspaceDir(this.workspaceId),
			"daemon-retry-queue.json",
		);
	}

	constructor(
		workspaceId: string,
		config: DaemonConfig,
		runner: AgentRunner,
		health: HealthMonitor,
	) {
		this.workspaceId = workspaceId;
		this.config = config;
		this.runner = runner;
		this.health = health;
		this.loadRetryQueue();
	}

	updateConfig(config: DaemonConfig): void {
		this.config = config;
	}

	// ─── Inbox Notifications ────────────────────────────────────────────────

	private writeInboxMessage(
		from: string,
		type: "delegation" | "report" | "update",
		taskId: string | null,
		subject: string,
		body: string,
	): void {
		const INBOX_FILE = path.join(
			getWorkspaceDir(this.workspaceId),
			"inbox.json",
		);
		try {
			const raw = existsSync(INBOX_FILE)
				? readFileSync(INBOX_FILE, "utf-8")
				: '{"messages":[]}';
			const data = JSON.parse(raw) as { messages: unknown[] };
			data.messages.push({
				id: `msg_${Date.now()}`,
				from,
				to: "me",
				type,
				taskId,
				subject,
				body,
				status: "unread",
				createdAt: new Date().toISOString(),
				readAt: null,
			});
			const tmp = INBOX_FILE + ".tmp";
			writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
			renameSync(tmp, INBOX_FILE);
		} catch (err) {
			logger.warn(
				"dispatcher",
				`Failed to write inbox message: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	// ─── Retry Queue Persistence ────────────────────────────────────────────

	private loadRetryQueue(): void {
		try {
			if (!existsSync(this.RETRY_QUEUE_FILE)) return;
			const raw = readFileSync(this.RETRY_QUEUE_FILE, "utf-8");
			const data = JSON.parse(raw);
			if (Array.isArray(data)) {
				this.retryQueue = data;
				logger.info(
					"dispatcher",
					`Loaded ${data.length} pending retry(ies) from disk`,
				);
			}
		} catch {
			logger.warn("dispatcher", "Failed to load retry queue — starting fresh");
			this.retryQueue = [];
		}
	}

	private saveRetryQueue(): void {
		try {
			const tmp = this.RETRY_QUEUE_FILE + ".tmp";
			writeFileSync(tmp, JSON.stringify(this.retryQueue, null, 2), "utf-8");
			renameSync(tmp, this.RETRY_QUEUE_FILE);
		} catch (err) {
			logger.error(
				"dispatcher",
				`Failed to persist retry queue: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	/**
	 * Calculate retry delay with exponential backoff.
	 * delay = retryDelayMinutes * 2^(attempt-1), capped at MAX_RETRY_DELAY_MINUTES
	 */
	private getRetryDelayMinutes(attempt: number): number {
		const base = this.config.execution.retryDelayMinutes;
		return Math.min(base * 2 ** (attempt - 1), MAX_RETRY_DELAY_MINUTES);
	}

	// ─── Polling ────────────────────────────────────────────────────────────

	/**
	 * Poll for pending tasks and dispatch them to agents.
	 * Also processes due retries from the persistent queue.
	 * Called on each polling interval.
	 */
	async pollAndDispatch(): Promise<void> {
		logger.info("dispatcher", "Polling for pending tasks...");
		this.health.setLastPollAt(new Date().toISOString());

		try {
			// 1. Process due retries first (they have higher priority — already started once)
			await this.processDueRetries();

			// 2. Get pending tasks sorted by Eisenhower priority
			const pendingTasks = getPendingTasks();

			if (pendingTasks.length === 0) {
				logger.debug("dispatcher", "No pending tasks to dispatch");
				return;
			}

			logger.info("dispatcher", `Found ${pendingTasks.length} pending task(s)`);

			// 3. Filter to dispatchable tasks
			const dispatchable = pendingTasks.filter((task) => {
				// Already running?
				if (this.health.isTaskRunning(task.id)) {
					logger.debug("dispatcher", `Skipping ${task.id} — already running`);
					return false;
				}

				// Already in retry queue?
				if (this.retryQueue.some((r) => r.taskId === task.id)) {
					logger.debug("dispatcher", `Skipping ${task.id} — in retry queue`);
					return false;
				}

				// Blocked by dependencies?
				const taskWithBlockedBy = task as typeof task & { blockedBy: string[] };
				if (!isTaskUnblocked(taskWithBlockedBy)) {
					logger.debug(
						"dispatcher",
						`Skipping ${task.id} — blocked by dependencies`,
					);
					return false;
				}

				// Has pending decision?
				if (hasPendingDecision(task.id)) {
					logger.debug(
						"dispatcher",
						`Skipping ${task.id} — waiting for decision`,
					);
					return false;
				}

				// Exceeded retry limit?
				const retryCount = this.health.getRetryCount(task.id);
				if (retryCount >= this.config.execution.retries + 1) {
					logger.warn(
						"dispatcher",
						`Skipping ${task.id} — exceeded retry limit (${retryCount} attempts)`,
					);
					return false;
				}

				return true;
			});

			if (dispatchable.length === 0) {
				logger.debug(
					"dispatcher",
					"No dispatchable tasks (all blocked, running, or at retry limit)",
				);
				return;
			}

			// 4. Dispatch up to concurrency limit
			const availableSlots =
				this.config.concurrency.maxParallelAgents - this.health.activeCount();
			if (availableSlots <= 0) {
				logger.info(
					"dispatcher",
					`No available slots (${this.health.activeCount()}/${this.config.concurrency.maxParallelAgents} agents running)`,
				);
				return;
			}

			const toDispatch = dispatchable.slice(0, availableSlots);

			for (const task of toDispatch) {
				this.dispatchTask(task.id, task.assignedTo!);
			}
		} catch (err) {
			logger.error(
				"dispatcher",
				`Poll error: ${err instanceof Error ? err.message : String(err)}`,
			);
		}

		// Also check for running/stalled project runs that need continuation
		this.pollProjectRuns();
	}

	/**
	 * Process retry entries that are due (retryAt <= now).
	 */
	private async processDueRetries(): Promise<void> {
		if (this.retryQueue.length === 0) return;

		const now = new Date();
		const dueRetries: RetryEntry[] = [];
		const remaining: RetryEntry[] = [];

		for (const entry of this.retryQueue) {
			if (new Date(entry.retryAt) <= now) {
				dueRetries.push(entry);
			} else {
				remaining.push(entry);
			}
		}

		if (dueRetries.length === 0) return;

		// Check available concurrency slots
		const availableSlots =
			this.config.concurrency.maxParallelAgents - this.health.activeCount();
		const toRetry = dueRetries.slice(0, Math.max(0, availableSlots));
		const deferred = dueRetries.slice(Math.max(0, availableSlots));

		logger.info("dispatch", "Processing retry queue", {
			queued: this.retryQueue.length,
			due: dueRetries.length,
			dispatching: toRetry.length,
			deferred: deferred.length,
			availableSlots,
		});

		// Update queue: remove retries we're about to dispatch
		this.retryQueue = [...remaining, ...deferred];
		this.saveRetryQueue();

		for (const entry of toRetry) {
			logger.info(
				"dispatcher",
				`Retrying task ${entry.taskId} (attempt ${entry.attempt + 1}, agent=${entry.agentId})`,
			);
			this.dispatchTask(entry.taskId, entry.agentId);
		}

		if (deferred.length > 0) {
			logger.info(
				"dispatcher",
				`${deferred.length} due retry(ies) deferred — no concurrency slots available`,
			);
		}
	}

	/**
	 * Dispatch a single task to its assigned agent.
	 */
	private dispatchTask(taskId: string, agentId: string): void {
		// Notify inbox: task picked up
		try {
			const { getTask } = require("./prompt-builder");
			const task = getTask(taskId);
			if (task) {
				this.writeInboxMessage(
					agentId,
					"update",
					taskId,
					`Picked up: ${task.title}`,
					`Agent "${agentId}" has started working on this task.`,
				);
			}
		} catch {
			// Non-fatal — inbox notification is best-effort
		}

		const taskArgs: string[] = [taskId];
		if (this.config.execution.agentTeams) {
			taskArgs.push("--agent-teams");
		}

		const { runner, args } = resolveScript("run-task.js", __dirname);
		args.push(...taskArgs);

		try {
			const child = spawn(runner, args, {
				cwd: getWorkspaceDir(this.workspaceId),
				detached: true,
				stdio: "ignore",
				shell: false,
				env: { ...process.env, MANDIO_WORKSPACE_ID: this.workspaceId },
			});
			child.unref();
			logger.info(
				"dispatcher",
				`Dispatched task ${taskId} to agent ${agentId} (pid: ${child.pid})`,
			);
		} catch (err) {
			logger.error(
				"dispatcher",
				`Failed to dispatch task ${taskId}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	/**
	 * Attempt to resume an orphaned Claude session after a daemon crash.
	 * Uses --resume <sessionId> so the agent has full conversation history
	 * and can continue from where it left off.
	 * Falls back to a normal re-dispatch if the resume fails to start.
	 */
	async resumeOrphanedSession(
		taskId: string,
		agentId: string,
		sessionId: string,
	): Promise<void> {
		try {
			logger.info("recovery", "Attempting session resume", {
				taskId,
				agentId,
				sessionId,
			});

			const { getTask } = await import("./prompt-builder");
			const task = getTask(taskId);
			if (!task) {
				logger.warn("dispatcher", `Task ${taskId} not found — skipping resume`);
				clearSessionRecord(taskId);
				return;
			}

			const resumePrompt =
				"The daemon was restarted unexpectedly. Review your conversation history to understand " +
				"what you were working on, then continue and complete the task. If the task is already " +
				"done, mark it done and post a completion report.";

			const innerSessionId = this.health.startSession(
				agentId,
				taskId,
				"task-resume",
				0,
			);

			const spawnPromise = this.runner.spawnAgent({
				prompt: resumePrompt,
				maxTurns: this.config.execution.maxTurns,
				timeoutMinutes: this.config.execution.timeoutMinutes,
				skipPermissions: this.config.execution.skipPermissions,
				allowedTools: this.config.execution.allowedTools,
				cwd: getWorkspaceDir(this.workspaceId),
				resumeSessionId: sessionId,
				env: getWorkspaceEnv(this.workspaceId),
				// Persist the new session ID in case the resume itself gets interrupted
				onSessionId: (newId) => persistSessionRecord(taskId, agentId, newId),
			});

			spawnPromise
				.then((result) => {
					if (result.pid > 0)
						this.health.updateSessionPid(innerSessionId, result.pid);
					const meta = parseClaudeOutput(result.stdout);
					this.health.endSession(
						innerSessionId,
						result.exitCode,
						result.stderr || null,
						result.timedOut,
						meta.totalCostUsd,
						meta.numTurns,
						meta.usage,
					);

					if (result.exitCode === 0 && !result.timedOut) {
						logger.info("recovery", "Session resume succeeded", {
							taskId,
							agentId,
							sessionId,
							pid: result.pid,
						});
						clearSessionRecord(taskId);
					} else {
						logger.warn("recovery", "Session resume failed", {
							taskId,
							agentId,
							sessionId,
							pid: result.pid,
							timedOut: result.timedOut,
							exitCode: result.exitCode,
						});
						clearSessionRecord(taskId);
						this.resetTaskToNotStarted(taskId);
					}
				})
				.catch((err) => {
					this.health.endSession(
						innerSessionId,
						1,
						err instanceof Error ? err.message : String(err),
						false,
					);
					logger.error("recovery", "Session resume error", {
						taskId,
						agentId,
						sessionId,
						error: err instanceof Error ? err.message : String(err),
					});
					clearSessionRecord(taskId);
					this.resetTaskToNotStarted(taskId);
				});
		} catch (err) {
			logger.error(
				"dispatcher",
				`Failed to initiate resume for task ${taskId}: ${err instanceof Error ? err.message : String(err)}`,
			);
			clearSessionRecord(taskId);
			this.resetTaskToNotStarted(taskId);
		}
	}

	private resetTaskToNotStarted(taskId: string): void {
		try {
			const TASKS_FILE_PATH = path.join(
				getWorkspaceDir(this.workspaceId),
				"tasks.json",
			);
			if (!existsSync(TASKS_FILE_PATH)) return;
			const data = JSON.parse(readFileSync(TASKS_FILE_PATH, "utf-8")) as {
				tasks: Array<Record<string, unknown>>;
			};
			const task = data.tasks.find((t) => t.id === taskId);
			if (task && task.kanban === "in-progress") {
				task.kanban = "not-started";
				task.updatedAt = new Date().toISOString();
				const tmp = TASKS_FILE_PATH + ".tmp";
				writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
				renameSync(tmp, TASKS_FILE_PATH);
				logger.info("dispatcher", `Task ${taskId} reset to not-started`);
			}
		} catch (err) {
			logger.error(
				"dispatcher",
				`Failed to reset task ${taskId}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	// ─── Project Run Continuation ───────────────────────────────────────────

	/**
	 * Poll for running/stalled project runs that have dispatchable tasks but no
	 * live processes. Acts as a daemon-level safety net for chain dispatch.
	 */
	private pollProjectRuns(): void {
		try {
			if (!existsSync(this.MISSIONS_FILE)) return;
			const runsFileData: ProjectRunsFile = JSON.parse(
				readFileSync(this.MISSIONS_FILE, "utf-8"),
			);

			const activeRuns = runsFileData.missions.filter(
				(m) => m.status === "running" || m.status === "stalled",
			);
			if (activeRuns.length === 0) return;

			// Read state
			const tasksRaw = existsSync(this.TASKS_FILE)
				? readFileSync(this.TASKS_FILE, "utf-8")
				: '{"tasks":[]}';
			const tasksData = JSON.parse(tasksRaw) as {
				tasks: Array<Record<string, unknown>>;
			};
			const runsRaw = existsSync(this.ACTIVE_RUNS_FILE)
				? readFileSync(this.ACTIVE_RUNS_FILE, "utf-8")
				: '{"runs":[]}';
			const runsData = JSON.parse(runsRaw) as {
				runs: Array<{
					taskId: string;
					missionId: string | null;
					pid: number;
					status: string;
				}>;
			};
			const decisionsRaw = existsSync(this.DECISIONS_FILE)
				? readFileSync(this.DECISIONS_FILE, "utf-8")
				: '{"decisions":[]}';
			const decisionsData = JSON.parse(decisionsRaw) as {
				decisions: Array<{ taskId: string | null; status: string }>;
			};

			const pendingDecisionTaskIds = new Set(
				decisionsData.decisions
					.filter((d) => d.status === "pending" && d.taskId)
					.map((d) => d.taskId as string),
			);

			// Check which runs are actually alive
			const liveRunningTaskIds = new Set<string>();
			let liveRunningCount = 0;
			for (const run of runsData.runs) {
				if (run.status === "running") {
					let alive = run.pid <= 0;
					if (!alive) {
						try {
							process.kill(run.pid, 0);
							alive = true;
						} catch {
							alive = false;
						}
					}
					if (alive) {
						liveRunningTaskIds.add(run.taskId);
						liveRunningCount++;
					}
				}
			}

			let changed = false;

			for (const projectRun of activeRuns) {
				// Check if this project run has live processes
				const projectRunProcesses = runsData.runs.filter(
					(r) => r.missionId === projectRun.id && r.status === "running",
				);
				const hasLiveProcesses = projectRunProcesses.some((r) => {
					if (r.pid <= 0) return true;
					try {
						process.kill(r.pid, 0);
						return true;
					} catch {
						return false;
					}
				});

				if (hasLiveProcesses) continue;

				// No live processes — find dispatchable tasks
				const projectTasks = tasksData.tasks.filter(
					(t) => t.projectId === projectRun.projectId,
				);
				const remaining = projectTasks.filter(
					(t) =>
						t.kanban !== "done" &&
						t.assignedTo &&
						t.assignedTo !== "me" &&
						!t.deletedAt,
				);

				if (remaining.length === 0) {
					projectRun.status = "completed";
					projectRun.completedAt = new Date().toISOString();
					changed = true;
					continue;
				}

				const dispatchable = remaining.filter((t) => {
					const tid = t.id as string;
					if (liveRunningTaskIds.has(tid)) return false;
					const blocked = (t.blockedBy as string[] | undefined) ?? [];
					if (blocked.length > 0) {
						const allDone = blocked.every((depId) => {
							const dep = tasksData.tasks.find((d) => d.id === depId);
							return (
								(dep as Record<string, unknown> | undefined)?.kanban === "done"
							);
						});
						if (!allDone) return false;
					}
					if (pendingDecisionTaskIds.has(tid)) return false;
					const attempts = projectRun.loopDetection?.taskAttempts?.[tid] ?? 0;
					if (attempts >= 3) return false;
					return true;
				});

				if (dispatchable.length > 0) {
					const slotsAvailable = Math.max(
						0,
						this.config.concurrency.maxParallelAgents - liveRunningCount,
					);
					const toSpawn = dispatchable.slice(0, slotsAvailable);

					if (toSpawn.length > 0) {
						// Revive stalled project runs
						if (projectRun.status === "stalled") {
							projectRun.status = "running";
							changed = true;
						}

						const { runner, args: baseArgs } = resolveScript(
							"run-task.js",
							__dirname,
						);
						for (const task of toSpawn) {
							const spawnArgs = [
								...baseArgs,
								task.id as string,
								"--source",
								"project-run-chain",
								"--mission",
								projectRun.id,
							];
							if (this.config.execution.agentTeams) {
								spawnArgs.push("--agent-teams");
							}
							try {
								const child = spawn(runner, spawnArgs, {
									cwd: getWorkspaceDir(this.workspaceId),
									detached: true,
									stdio: "ignore",
									shell: false,
									env: { ...process.env, MANDIO_WORKSPACE_ID: this.workspaceId },
								});
								child.unref();
								logger.info(
									"dispatcher",
									`ProjectRun ${projectRun.id}: re-dispatched task ${task.id} (pid: ${child.pid})`,
								);
							} catch (err) {
								logger.error(
									"dispatcher",
									`ProjectRun ${projectRun.id}: failed to re-dispatch task ${task.id}: ${err instanceof Error ? err.message : String(err)}`,
								);
							}
						}
					}
				}
			}

			if (changed) {
				writeFileSync(
					this.MISSIONS_FILE,
					JSON.stringify(runsFileData, null, 2),
					"utf-8",
				);
			}
		} catch (err) {
			logger.error(
				"dispatcher",
				`Project run poll error: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	// ─── Scheduled Commands ─────────────────────────────────────────────────

	/**
	 * Run a scheduled command (daily-plan, standup, etc.)
	 */
	async runScheduledCommand(command: string): Promise<void> {
		if (this.health.isCommandRunning(command)) {
			logger.info(
				"dispatcher",
				`Scheduled command "/${command}" already running, skipping`,
			);
			return;
		}

		const availableSlots =
			this.config.concurrency.maxParallelAgents - this.health.activeCount();
		if (availableSlots <= 0) {
			logger.info(
				"dispatcher",
				`No slots available for scheduled command "/${command}"`,
			);
			return;
		}

		logger.info("dispatcher", `Running scheduled command: /${command}`);

		const prompt = buildScheduledPrompt(command);

		const sessionId = this.health.startSession("system", null, command, 0);

		try {
			const result = await this.runner.spawnAgent({
				prompt,
				maxTurns: this.config.execution.maxTurns,
				timeoutMinutes: this.config.execution.timeoutMinutes,
				skipPermissions: this.config.execution.skipPermissions,
				allowedTools: this.config.execution.allowedTools,
				cwd: getWorkspaceDir(this.workspaceId),
				env: getWorkspaceEnv(this.workspaceId),
			});

			// Parse cost/usage from Claude Code output
			const meta = parseClaudeOutput(result.stdout);
			this.health.endSession(
				sessionId,
				result.exitCode,
				result.stderr || null,
				result.timedOut,
				meta.totalCostUsd,
				meta.numTurns,
				meta.usage,
			);

			if (result.exitCode === 0) {
				logger.info(
					"dispatcher",
					`Scheduled command "/${command}" completed successfully`,
				);
			} else {
				logger.error(
					"dispatcher",
					`Scheduled command "/${command}" failed (exit=${result.exitCode})`,
				);
			}
		} catch (err) {
			this.health.endSession(
				sessionId,
				1,
				err instanceof Error ? err.message : String(err),
				false,
			);
			logger.error(
				"dispatcher",
				`Scheduled command "/${command}" error: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
}
