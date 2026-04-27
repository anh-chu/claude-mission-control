#!/usr/bin/env node
import { watch } from "node:fs/promises";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "fs";
import path from "path";
import {
	DOC_MAINTAINER_AGENT_INSTRUCTIONS,
	getWorkspaceDataDir,
} from "../../src/lib/data";
import { DATA_DIR, getWikiDir, getWorkspaceDir } from "../../src/lib/paths";
import {
	type ActiveRunEntry,
	readActiveRuns,
	writeActiveRuns,
} from "./active-runs";
import { loadConfig } from "./config";
import { Dispatcher } from "./dispatcher";
import { HealthMonitor } from "./health";
import { logger } from "./logger";
import { runCrashRecovery } from "./recovery";
import { AgentRunner } from "./runner";
import { Scheduler } from "./scheduler";
import {
	appendStreamEvent,
	buildSdkOptions,
	consumeStream,
	getWarmHandle,
	preheatSdk,
	runWithSdk,
} from "./warm-sdk";

// ─── Constants ───────────────────────────────────────────────────────────────
const PID_FILE = path.join(DATA_DIR, "daemon.pid");

// ─── Workspace Registry ──────────────────────────────────────────────────────

interface WorkspaceEntry {
	id: string;
	name: string;
	settings?: { daemonEnabled?: boolean };
}

function readWorkspaces(): WorkspaceEntry[] {
	const file = path.join(DATA_DIR, "workspaces.json");
	try {
		const raw = readFileSync(file, "utf-8");
		const data = JSON.parse(raw) as { workspaces: WorkspaceEntry[] };
		return data.workspaces ?? [];
	} catch {
		// Fall back to default workspace if registry missing
		return [{ id: "default", name: "Default" }];
	}
}

// ─── PID File Management ─────────────────────────────────────────────────────

function writePidFile(): void {
	writeFileSync(PID_FILE, String(process.pid), "utf-8");
}

function readPidFile(): number | null {
	try {
		if (!existsSync(PID_FILE)) return null;
		const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim());
		return isNaN(pid) ? null : pid;
	} catch {
		return null;
	}
}

function removePidFile(): void {
	try {
		if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
	} catch {
		// Best effort
	}
}

function isProcessRunning(pid: number): boolean {
	try {
		process.kill(pid, 0); // Signal 0 = check if process exists
		return true;
	} catch {
		return false;
	}
}

// ─── Wiki Agent Config ────────────────────────────────────────────────────────

interface WikiAgentConfig {
	id: string;
	name?: string;
	instructions?: string;
}

function readAgentConfig(
	workspaceId: string,
	agentId: string,
): WikiAgentConfig | null {
	try {
		const agentsPath = path.join(
			getWorkspaceDataDir(workspaceId),
			"agents.json",
		);
		const raw = readFileSync(agentsPath, "utf-8");
		const data = JSON.parse(raw) as { agents?: WikiAgentConfig[] };
		if (!Array.isArray(data.agents)) return null;
		return data.agents.find((a) => a.id === agentId) ?? null;
	} catch {
		return null;
	}
}

// ─── Wiki Job Processing ──────────────────────────────────────────────────────

interface WikiJobFile {
	runId: string;
	workspaceId: string;
	agentId: string;
	model: string;
	sessionId: string | null;
	message: string | null;
}

function deleteJobFile(filePath: string): void {
	try {
		rmSync(filePath);
	} catch {
		// best-effort
	}
}

async function processWikiJob(
	jobFilePath: string,
	workspaceId: string,
): Promise<void> {
	let job: WikiJobFile | null = null;
	// Retry once after short delay for partial writes
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			job = JSON.parse(readFileSync(jobFilePath, "utf-8")) as WikiJobFile;
			break;
		} catch (err) {
			if (attempt === 0) {
				await new Promise((r) => setTimeout(r, 100));
				continue;
			}
			logger.error(
				"daemon",
				`Failed to read wiki job file ${jobFilePath}: ${err instanceof Error ? err.message : String(err)}`,
			);
			return;
		}
	}
	if (!job) return;

	const { runId, agentId, model, sessionId, message } = job;
	logger.info("daemon", `[${workspaceId}] Processing wiki job ${runId}`);

	const workspaceDir = getWorkspaceDir(workspaceId);
	const wikiDir = getWikiDir(workspaceId);
	const agentStreamsDir = path.join(
		getWorkspaceDataDir(workspaceId),
		"agent-streams",
	);
	mkdirSync(agentStreamsDir, { recursive: true });
	const streamFile = path.join(agentStreamsDir, `${runId}.jsonl`);

	// Ensure stream file exists (should be pre-created by generate route, but fallback)
	if (!existsSync(streamFile)) {
		writeFileSync(streamFile, "", "utf-8");
	}

	const selectedAgent = readAgentConfig(workspaceId, agentId);
	const agentInstruction =
		selectedAgent?.instructions?.trim() || DOC_MAINTAINER_AGENT_INSTRUCTIONS;

	let pluginPath: string;
	try {
		pluginPath = readFileSync(
			path.join(wikiDir, ".plugin-path"),
			"utf-8",
		).trim();
	} catch (err) {
		logger.error(
			"daemon",
			`[${workspaceId}] Failed to read .plugin-path for job ${runId}: ${err instanceof Error ? err.message : String(err)}`,
		);
		// Update active-runs to failed
		const activeRunsPath = path.join(
			getWorkspaceDataDir(workspaceId),
			"active-runs.json",
		);
		try {
			const activeRunsData = readActiveRuns(activeRunsPath);
			const idx = activeRunsData.runs.findIndex((r) => r.id === runId);
			if (idx !== -1) {
				const entry = activeRunsData.runs[idx]!;
				entry.status = "failed";
				entry.exitCode = 1;
				entry.completedAt = new Date().toISOString();
				writeActiveRuns(activeRunsPath, activeRunsData);
			}
		} catch {
			// best-effort
		}
		deleteJobFile(jobFilePath);
		return;
	}

	const prompt =
		sessionId && message ? message : message?.trim() || "Run wiki maintenance.";

	const sdkBuildOpts = {
		pluginPath,
		agentInstruction,
		workspaceDir,
		wikiDir,
		model: model || "",
		sessionId,
	};

	let exitCode = 1;
	let finalSessionId: string | null = null;

	try {
		const expectedKey = JSON.stringify({
			pluginPath: sdkBuildOpts.pluginPath,
			agentInstruction: sdkBuildOpts.agentInstruction,
			workspaceDir: sdkBuildOpts.workspaceDir,
			wikiDir: sdkBuildOpts.wikiDir,
			model: sdkBuildOpts.model,
		});
		const warmHandle = !sessionId ? getWarmHandle(expectedKey) : null;
		let result: { exitCode: number; sessionId: string | null };

		if (warmHandle) {
			logger.info(
				"daemon",
				`[${workspaceId}] Using warm SDK handle for wiki job ${runId}`,
			);
			const q = warmHandle.query(prompt);
			result = await consumeStream(q, streamFile);
		} else {
			logger.info(
				"daemon",
				`[${workspaceId}] Using cold SDK path for wiki job ${runId} (resume=${!!sessionId})`,
			);
			result = await runWithSdk({ prompt, ...sdkBuildOpts, streamFile });
		}

		exitCode = result.exitCode;
		finalSessionId = result.sessionId;

		// Stale session: retry as fresh run (no resume)
		if (exitCode !== 0 && sessionId) {
			const streamContent = readFileSync(streamFile, "utf-8");
			if (streamContent.includes("No conversation found with session ID")) {
				logger.warn(
					"daemon",
					`[${workspaceId}] Stale session for ${runId}, retrying as fresh run`,
				);
				appendStreamEvent(streamFile, {
					type: "system",
					subtype: "info",
					message: "Previous session expired. Starting fresh conversation.",
				});
				const freshOpts = { ...sdkBuildOpts, sessionId: null };
				const freshResult = await runWithSdk({
					prompt,
					...freshOpts,
					streamFile,
				});
				exitCode = freshResult.exitCode;
				finalSessionId = freshResult.sessionId;
			}
		}
	} catch (err) {
		appendStreamEvent(streamFile, {
			type: "system",
			subtype: "sdk_error",
			message: err instanceof Error ? err.message : String(err),
		});
		logger.error(
			"daemon",
			`[${workspaceId}] Wiki job ${runId} SDK error: ${err instanceof Error ? err.message : String(err)}`,
		);
		exitCode = 1;
	}

	// Re-preheat SDK for next job
	void preheatSdk(sdkBuildOpts);

	// Update active-runs.json
	const completedAt = new Date().toISOString();
	const activeRunsPath = path.join(
		getWorkspaceDataDir(workspaceId),
		"active-runs.json",
	);
	try {
		const activeRunsData = readActiveRuns(activeRunsPath);
		const idx = activeRunsData.runs.findIndex((r) => r.id === runId);
		if (idx !== -1) {
			const entry = activeRunsData.runs[idx]!;
			entry.status = exitCode === 0 ? "completed" : "failed";
			entry.exitCode = exitCode;
			entry.completedAt = completedAt;
			entry.sessionId = finalSessionId ?? null;
			writeActiveRuns(activeRunsPath, activeRunsData);
		}
	} catch (err) {
		logger.warn(
			"daemon",
			`[${workspaceId}] Failed to update active-runs for wiki job ${runId}: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	logger.info(
		"daemon",
		`[${workspaceId}] Wiki job ${runId} finished with exit code ${exitCode}`,
	);
	deleteJobFile(jobFilePath);
}

// ─── Wiki Watcher per Workspace ───────────────────────────────────────────────

function startWikiWatcher(workspaceId: string): {
	markShuttingDown: () => void;
} {
	const wikiDir = getWikiDir(workspaceId);
	const jobsDir = path.join(wikiDir, ".jobs");

	// Ensure jobsDir exists
	try {
		mkdirSync(jobsDir, { recursive: true });
	} catch {
		// best-effort
	}

	// Pre-warm SDK if plugin path exists
	const workspaceDir = getWorkspaceDir(workspaceId);
	try {
		const pluginPath = readFileSync(
			path.join(wikiDir, ".plugin-path"),
			"utf-8",
		).trim();
		void preheatSdk({
			pluginPath,
			agentInstruction: DOC_MAINTAINER_AGENT_INSTRUCTIONS,
			workspaceDir,
			wikiDir,
			model: "",
			sessionId: null,
		});
	} catch {
		logger.warn(
			"daemon",
			`[${workspaceId}] No .plugin-path for wiki preheat, skipping`,
		);
	}

	// Serial job queue
	const queue: string[] = [];
	let processing = false;
	let shuttingDown = false;

	async function drainQueue(): Promise<void> {
		if (processing || shuttingDown) return;
		while (queue.length > 0 && !shuttingDown) {
			processing = true;
			const jobPath = queue.shift()!;
			try {
				await processWikiJob(jobPath, workspaceId);
			} catch (err) {
				logger.error(
					"daemon",
					`[${workspaceId}] Unhandled error in wiki job ${jobPath}: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
			processing = false;
		}
	}

	// Scan for existing jobs on startup
	try {
		const existing = readdirSync(jobsDir).filter((f) => f.endsWith(".json"));
		for (const f of existing) {
			queue.push(path.join(jobsDir, f));
		}
	} catch {
		// jobsDir may not exist yet
	}
	void drainQueue();

	// Watch for new job files (fire-and-forget async loop)
	void (async () => {
		let watcher: AsyncIterable<{ eventType: string; filename: string | null }>;
		try {
			watcher = watch(jobsDir, { persistent: true }) as AsyncIterable<{
				eventType: string;
				filename: string | null;
			}>;
		} catch (err) {
			logger.error(
				"daemon",
				`[${workspaceId}] Failed to watch wiki jobs dir: ${err instanceof Error ? err.message : String(err)}`,
			);
			return;
		}

		for await (const event of watcher) {
			if (shuttingDown) break;
			if (event.eventType !== "rename" || !event.filename?.endsWith(".json"))
				continue;

			const jobPath = path.join(jobsDir, event.filename);
			if (!existsSync(jobPath)) continue;
			if (queue.includes(jobPath)) continue;

			queue.push(jobPath);
			void drainQueue();
		}
	})();

	return {
		markShuttingDown: () => {
			shuttingDown = true;
		},
	};
}

// ─── Commands ────────────────────────────────────────────────────────────────

function handleStatus(): void {
	const pid = readPidFile();
	if (pid && isProcessRunning(pid)) {
		console.log("\n=== Mission Control Agent Daemon ===");
		console.log(`Status:  \x1b[32mRunning\x1b[0m`);
		console.log(`PID:     ${pid}`);
		console.log("");
	} else {
		if (pid) removePidFile(); // Clean stale PID file
		console.log("\n=== Mission Control Agent Daemon ===");
		console.log(`Status:  \x1b[31mStopped\x1b[0m`);
		console.log("");
	}
}

function handleStop(): void {
	const pid = readPidFile();
	if (!pid) {
		console.log("Daemon is not running (no PID file).");
		return;
	}

	if (!isProcessRunning(pid)) {
		console.log("Daemon is not running (stale PID file). Cleaning up.");
		removePidFile();
		return;
	}

	console.log(`Stopping daemon (PID: ${pid})...`);
	try {
		process.kill(pid, "SIGTERM");
		console.log("Stop signal sent. Daemon will shut down gracefully.");
	} catch (err) {
		console.error(
			`Failed to stop daemon: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

async function handleStart(): Promise<void> {
	// Check for existing instance
	const existingPid = readPidFile();
	if (existingPid && isProcessRunning(existingPid)) {
		console.error(
			`Daemon is already running (PID: ${existingPid}). Use "stop" first.`,
		);
		process.exit(1);
	}
	if (existingPid) removePidFile();

	console.log("\n=== Mission Control Agent Daemon ===\n");

	// Discover active workspaces
	const allWorkspaces = readWorkspaces();
	const activeWorkspaces = allWorkspaces.filter(
		(w) => w.settings?.daemonEnabled !== false,
	);

	if (activeWorkspaces.length === 0) {
		logger.warn(
			"daemon",
			"No active workspaces found (all have daemonEnabled: false). Exiting.",
		);
		process.exit(0);
	}

	logger.info(
		"daemon",
		`Active workspaces: ${activeWorkspaces.map((w) => w.id).join(", ")}`,
	);

	// Spin up one Dispatcher + Scheduler per workspace
	const runner = new AgentRunner();
	const workspaceInstances: Array<{
		workspaceId: string;
		dispatcher: Dispatcher;
		scheduler: Scheduler;
		health: HealthMonitor;
		wikiWatcher: { markShuttingDown: () => void };
	}> = [];

	for (const ws of activeWorkspaces) {
		const config = loadConfig(ws.id);

		if (config.execution.skipPermissions) {
			logger.security("daemon", `[${ws.id}] ⚠  skipPermissions ENABLED`);
		}

		const health = new HealthMonitor();
		const dispatcher = new Dispatcher(ws.id, config, runner, health);
		const scheduler = new Scheduler(ws.id, config, dispatcher, health);

		scheduler.start();

		// Crash recovery per workspace
		const recovery = runCrashRecovery(ws.id);
		if (recovery.sessionsToResume.length > 0) {
			logger.info(
				"daemon",
				`[${ws.id}] Resuming ${recovery.sessionsToResume.length} interrupted session(s)...`,
			);
			for (const session of recovery.sessionsToResume) {
				void dispatcher.resumeOrphanedSession(
					session.taskId,
					session.agentId,
					session.sessionId,
				);
			}
		}

		if (config.polling.enabled) {
			logger.info("daemon", `[${ws.id}] Running initial task poll...`);
			await dispatcher.pollAndDispatch();
		}

		health.flush();
		logger.info(
			"daemon",
			`[${ws.id}] Ready. watching=${config.polling.enabled}, concurrency=${config.concurrency.maxParallelAgents}`,
		);

		// Start wiki job watcher for this workspace
		const wikiWatcher = startWikiWatcher(ws.id);

		workspaceInstances.push({
			workspaceId: ws.id,
			dispatcher,
			scheduler,
			health,
			wikiWatcher,
		});
	}

	writePidFile();
	logger.info(
		"daemon",
		`Daemon started (PID: ${process.pid}) — ${workspaceInstances.length} workspace(s) active`,
	);

	// ─── Graceful Shutdown ──────────────────────────────────────────────────
	let shuttingDown = false;

	async function shutdown(signal: string): Promise<void> {
		if (shuttingDown) return;
		shuttingDown = true;

		logger.info("daemon", `Received ${signal} — shutting down gracefully...`);

		for (const {
			workspaceId,
			dispatcher: _d,
			scheduler,
			health,
			wikiWatcher,
		} of workspaceInstances) {
			scheduler.stop();
			wikiWatcher.markShuttingDown();

			const activeSessions = health.getActiveSessions();
			if (activeSessions.length > 0) {
				logger.info(
					"daemon",
					`[${workspaceId}] Killing ${activeSessions.length} active session(s)...`,
				);
				for (const session of activeSessions) {
					if (session.pid > 0) await runner.killSession(session.pid);
					health.endSession(session.id, null, "Daemon shutdown", false);
				}
			}

			health.writeStoppedStatus();
		}

		removePidFile();
		logger.info("daemon", "Daemon stopped.");
		process.exit(0);
	}

	process.on("SIGINT", () => shutdown("SIGINT"));
	process.on("SIGTERM", () => shutdown("SIGTERM"));

	setInterval(() => {
		for (const { health } of workspaceInstances) {
			health.cleanStaleSessions();
			health.updateUptime();
			health.flush();
		}
	}, 60_000);
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

const command = process.argv[2] || "start";

switch (command) {
	case "start":
		handleStart().catch((err) => {
			logger.error(
				"daemon",
				`Fatal error: ${err instanceof Error ? err.message : String(err)}`,
			);
			removePidFile();
			process.exit(1);
		});
		break;

	case "stop":
		handleStop();
		break;

	case "status":
		handleStatus();
		break;

	default:
		console.log("Usage: npx tsx scripts/daemon/index.ts [start|stop|status]");
		console.log("");
		console.log("Commands:");
		console.log("  start   Start the daemon (default)");
		console.log("  stop    Stop a running daemon");
		console.log("  status  Show daemon status");
		process.exit(1);
}
