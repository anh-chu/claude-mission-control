/**
 * run-conversation.ts — Execute a single foreground chat conversation via Claude.
 *
 * Usage:
 *   node --import tsx scripts/daemon/run-conversation.ts <conversationId>
 *
 * This script:
 *   1. Reads the conversation + turns
 *   2. Verifies status is "queued" or "idle" (no concurrent runner)
 *   3. Reads previous run's sessionHandle for session resume
 *   4. Starts a new conversation run
 *   5. Spawns Claude with the latest user turn as prompt
 *   6. On exit, marks conversation as completed or failed
 *   7. On decision detected, pauses for user input
 */

import { existsSync, readFileSync, watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "../../src/lib/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
	getConversation,
	getConversationRun,
	readConversationTurns,
} from "../../src/lib/conversations";
import type {
	ConversationSource,
	ConversationStatus,
} from "../../src/lib/types";
import { loadConfig } from "./config";
import {
	attachPidToRun,
	completeConversation,
	failConversation,
	pauseForDecision,
	processStreamLine,
	startConversationForTask,
} from "./conversation-writer";
import { logger } from "./logger";
import { AgentRunner } from "./runner";
import { getWorkspaceEnv } from "./workspace-env";

const taskLogger = createLogger("conv", { sync: true });

// ─── Paths ──────────────────────────────────────────────────────────────────

import { getWorkspaceDir } from "../../src/lib/paths";

const WORKSPACE_DIR = getWorkspaceDir(
	process.env.MANDIO_WORKSPACE_ID ?? "default",
);
const STREAMS_DIR = path.join(WORKSPACE_DIR, "agent-streams");
const AGENTS_FILE = path.join(WORKSPACE_DIR, "agents.json");
const DECISIONS_FILE = path.join(WORKSPACE_DIR, "decisions.json");

// ─── Stream Tail (inline — refactored from run-task.ts) ────────────────────

function startStreamTail(
	file: string,
	ctx: { conversationId: string; runId: string },
): { stop: () => Promise<void> } {
	let offset = 0;
	let buffer = "";
	let stopped = false;
	let firstLine = true;
	let firstAssistant = true;

	const doRead = async (): Promise<void> => {
		try {
			if (!existsSync(file)) return;
			const fsP = await import("node:fs/promises");
			const { size } = await fsP.stat(file);
			if (size <= offset) return;
			const fh = await fsP.open(file, "r");
			const len = size - offset;
			const buf = Buffer.alloc(len);
			await fh.read(buf, 0, len, offset);
			await fh.close();
			offset = size;
			buffer += buf.toString("utf-8");
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) continue;
				if (firstLine) {
					firstLine = false;
					logger.info(
						"run-conv",
						`[TIMING ${_ms()}] first stream line received`,
					);
				}
				try {
					const parsed = JSON.parse(trimmed);
					if (firstAssistant && parsed.type === "assistant") {
						firstAssistant = false;
						logger.info(
							"run-conv",
							`[TIMING ${_ms()}] first assistant event (THINKING visible)`,
						);
					}
					await processStreamLine(ctx, parsed);
				} catch {
					// skip malformed line
				}
			}
		} catch (err) {
			logger.warn("run-conv", `Stream tail error: ${String(err)}`);
		}
	};

	// Use fs.watch to react to file changes instead of polling.
	// Watch the parent directory (not the file) so it works even before the
	// stream file is created by Claude CLI.  Filter by basename to only react
	// to writes to our specific stream file.
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	const DEBOUNCE_MS = 50;

	let watcher: import("node:fs").FSWatcher | null = null;
	let fallbackInterval: ReturnType<typeof setInterval> | null = null;

	const dirPath = path.dirname(file);
	const baseName = path.basename(file);
	try {
		watcher = watch(dirPath, (_event, filename) => {
			if (stopped) return;
			if (filename?.toString() !== baseName) return;
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				if (!stopped) doRead();
			}, DEBOUNCE_MS);
		});
	} catch {
		// Fallback to polling if fs.watch fails (e.g., unsupported platform)
		fallbackInterval = setInterval(() => {
			if (stopped) return;
			doRead();
		}, 100);
		watcher = null;
	}

	return {
		stop: async () => {
			if (stopped) return;
			stopped = true;
			if (debounceTimer) clearTimeout(debounceTimer);
			if (watcher) {
				watcher.close();
				watcher = null;
			}
			if (fallbackInterval) {
				clearInterval(fallbackInterval);
				fallbackInterval = null;
			}
			await doRead(); // drain remaining
		},
	};
}

// ─── Agent Config Helpers ──────────────────────────────────────────────────

interface ResolvedAgentConfig {
	maxTurns: number;
	timeoutMinutes: number;
	skipPermissions: boolean;
	allowedTools: string[];
	model: string | null;
}

function resolveAgentConfig(
	agentId: string | null,
	defaults: ResolvedAgentConfig,
): ResolvedAgentConfig {
	if (!agentId) return defaults;
	try {
		const raw = readFileSync(AGENTS_FILE, "utf-8");
		const data = JSON.parse(raw) as {
			agents: Array<{
				id: string;
				model?: string | null;
				allowedTools?: string[];
				skipPermissions?: "inherit" | "on" | "off";
			}>;
		};
		const agentDef = data.agents.find((a) => a.id === agentId);
		if (!agentDef) return defaults;

		const allowedTools = agentDef.allowedTools ?? defaults.allowedTools;
		let skipPermissions = defaults.skipPermissions;
		if (agentDef.skipPermissions === "on") skipPermissions = true;
		else if (agentDef.skipPermissions === "off") skipPermissions = false;

		return {
			...defaults,
			allowedTools,
			skipPermissions,
			model: agentDef.model ?? defaults.model,
		};
	} catch {
		return defaults;
	}
}

// ─── Main ──────────────────────────────────────────────────────────────────

const _t0 = Date.now();
const _ms = () => `+${Date.now() - _t0}ms`;

async function main() {
	const conversationId = process.argv[2];
	if (!conversationId) {
		console.error("Usage: run-conversation.ts <conversationId>");
		process.exit(1);
	}

	logger.info("run-conv", `[TIMING ${_ms()}] main() start — ${conversationId}`);

	// 1. Read conversation
	const conversation = await getConversation(conversationId);
	if (!conversation) {
		logger.error("run-conv", `Conversation not found: ${conversationId}`);
		process.exit(1);
	}

	// 2. Read turns
	const turns = await readConversationTurns(conversationId);
	logger.info("run-conv", `[TIMING ${_ms()}] reads done`);

	// 3. Bail if not in an executable state
	const executable: ConversationStatus[] = ["queued", "idle"];
	if (!executable.includes(conversation.status as ConversationStatus)) {
		logger.warn(
			"run-conv",
			`Conversation ${conversationId} status is "${conversation.status}" — aborting`,
		);
		process.exit(1);
	}

	// 4. Read previous run's sessionHandle BEFORE creating new run (Bug #6 pattern)
	let resumeSessionId: string | null = null;
	if (conversation.currentRunId) {
		try {
			const previousRun = await getConversationRun(conversation.currentRunId);
			resumeSessionId = previousRun?.sessionHandle ?? null;
			logger.info(
				"run-conv",
				`[TIMING ${_ms()}] sessionHandle: ${resumeSessionId ? "resume" : "fresh"}`,
			);
		} catch (err) {
			logger.warn(
				"run-conv",
				`Failed to read previous run sessionHandle: ${String(err)}`,
			);
		}
	}

	// 5. Update status early to prevent concurrent runners
	//    (we do the actual startConversationForTask below, but update the
	//     conversation record here as a gate)
	const { updateConversation } = await import("../../src/lib/conversations");
	await updateConversation(conversationId, { status: "starting" });

	// 6. Start conversation run (no task linkage)
	logger.info("run-conv", `[TIMING ${_ms()}] startConversationForTask begin`);
	let convCtx: { conversationId: string; runId: string } | null = null;
	try {
		convCtx = await startConversationForTask({
			taskId: null,
			agentId: conversation.agentId ?? "claude",
			model: conversation.model,
			source: "chat" as ConversationSource,
			projectId: null,
			missionId: null,
			continuationIndex: conversation.runCount ?? 0,
			resumeSessionId,
			existingConversationId: conversationId,
		});
	} catch (err) {
		logger.error(
			"run-conv",
			`Failed to start conversation run for ${conversationId}: ${String(err)}`,
		);
		await failConversation(
			{ conversationId, runId: "" },
			{
				message: String(err),
				kind: "unknown",
				exitCode: -1,
			},
		).catch(() => {});
		process.exit(1);
	}

	if (!convCtx) {
		logger.error("run-conv", "convCtx is null — aborting");
		process.exit(1);
	}

	logger.info(
		"run-conv",
		`[TIMING ${_ms()}] startConversationForTask done (runId: ${convCtx?.runId})`,
	);

	// 7. Build prompt: latest user turn's content
	const lastUserTurn = [...turns].reverse().find((t) => t.role === "user");
	const prompt = lastUserTurn?.content ?? "";
	if (!prompt) {
		logger.warn("run-conv", "No user turn found — sending empty prompt");
	}

	// 8. Resolve agent config
	const config = loadConfig();
	const agentCfg = resolveAgentConfig(conversation.agentId, {
		maxTurns: config.execution.maxTurns,
		timeoutMinutes: config.execution.timeoutMinutes,
		skipPermissions: config.execution.skipPermissions,
		allowedTools: config.execution.allowedTools ?? [],
		model: conversation.model ?? "haiku",
	});

	// 9. Create stream file
	const streamFile = path.join(STREAMS_DIR, `${convCtx.runId}.jsonl`);

	// 10. Spawn agent
	const runner = new AgentRunner(WORKSPACE_DIR);
	const stopTail = startStreamTail(streamFile, convCtx);
	let capturedSessionId: string | null = null;

	try {
		logger.info(
			"run-conv",
			`[TIMING ${_ms()}] spawnAgent begin (prompt: ${prompt.length} chars)`,
		);
		taskLogger.info("run-conv", "Spawning agent", {
			conversationId,
			promptLength: prompt.length,
		});

		const spawnResult = await runner.spawnAgent({
			prompt,
			maxTurns: agentCfg.maxTurns,
			timeoutMinutes: agentCfg.timeoutMinutes,
			skipPermissions: agentCfg.skipPermissions,
			allowedTools: agentCfg.allowedTools,
			model: conversation.model ?? agentCfg.model ?? "haiku",
			backend: "claude",
			cwd: WORKSPACE_DIR,
			streamFile,
			resumeSessionId: resumeSessionId ?? undefined,
			env: getWorkspaceEnv(process.env.MANDIO_WORKSPACE_ID ?? "default"),
			onSessionId: (sid) => {
				capturedSessionId = sid;
			},
			onSpawned: (pid) => {
				logger.info(
					"run-conv",
					`[TIMING ${_ms()}] claude process spawned (pid: ${pid})`,
				);
				if (convCtx) {
					attachPidToRun(convCtx, pid).catch((err) =>
						logger.error("run-conv", `attachPidToRun failed: ${String(err)}`),
					);
				}
			},
		});
		logger.info(
			"run-conv",
			`[TIMING ${_ms()}] spawnAgent done (exit: ${spawnResult?.exitCode})`,
		);

		// 11. Check for decision
		let pendingDecisionFound = false;
		const runStartedAt = new Date().toISOString();
		try {
			const decisionsRaw = readFileSync(DECISIONS_FILE, "utf-8");
			const decisionsData = JSON.parse(decisionsRaw) as {
				decisions: Array<{
					taskId: string | null;
					status: string;
					createdAt: string;
				}>;
			};
			pendingDecisionFound = decisionsData.decisions.some(
				(d) =>
					d.taskId === conversation.taskId &&
					d.status === "pending" &&
					d.createdAt >= runStartedAt,
			);
		} catch {
			// decisions.json may not exist
		}

		// 12. Determine final status
		const meta = {
			totalCostUsd: null as number | null,
			numTurns: null as number | null,
		};
		try {
			// Try to parse output metadata
			const { parseClaudeOutput } = await import("./runner");
			const parsed = parseClaudeOutput(spawnResult.stdout);
			meta.totalCostUsd = parsed.totalCostUsd;
			meta.numTurns = parsed.numTurns;
		} catch {
			// non-fatal
		}

		if (pendingDecisionFound && capturedSessionId) {
			// Pause for decision
			try {
				const decisionsRaw = existsSync(DECISIONS_FILE)
					? readFileSync(DECISIONS_FILE, "utf-8")
					: '{"decisions":[]}';
				const decisionsData = JSON.parse(decisionsRaw) as {
					decisions: Array<{
						id: string;
						taskId: string | null;
						status: string;
						question: string;
					}>;
				};
				const pending = decisionsData.decisions.find(
					(d) => d.taskId === conversation.taskId && d.status === "pending",
				);
				if (pending) {
					await pauseForDecision(
						convCtx,
						pending.id,
						pending.question,
						capturedSessionId,
					);
				}
			} catch (err) {
				logger.error("run-conv", `pauseForDecision failed: ${String(err)}`);
			}
		} else if (spawnResult.exitCode === 0) {
			// Successful completion
			const tokens = { input: 0, output: 0, total: 0 };
			await completeConversation(convCtx, {
				exitCode: spawnResult.exitCode,
				tokens,
				numTurns: meta.numTurns ?? 0,
			}).catch((err) =>
				logger.error("run-conv", `completeConversation failed: ${String(err)}`),
			);
			logger.info(
				"run-conv",
				`Conversation ${conversationId} completed successfully`,
			);
			taskLogger.info("run-conv", "Conversation completed", {
				conversationId,
			});
		} else {
			// Failed
			const errorMsg =
				spawnResult.stderr?.trim()?.slice(0, 500) ||
				spawnResult.stdout?.trim()?.slice(0, 200) ||
				`Exit code: ${spawnResult.exitCode}`;
			await failConversation(convCtx, {
				message: errorMsg,
				kind: spawnResult.timedOut ? "timeout" : "unknown",
				exitCode: spawnResult.exitCode,
			}).catch((err) =>
				logger.error("run-conv", `failConversation failed: ${String(err)}`),
			);
			logger.error(
				"run-conv",
				`Conversation ${conversationId} failed: ${errorMsg}`,
			);
			taskLogger.error("run-conv", "Conversation failed", {
				conversationId,
				error: errorMsg,
			});
		}
	} catch (err) {
		// Unhandled error in spawn/tail
		const errorMsg = err instanceof Error ? err.message : String(err);
		logger.error(
			"run-conv",
			`Conversation ${conversationId} error: ${errorMsg}`,
		);

		if (convCtx) {
			await failConversation(convCtx, {
				message: errorMsg,
				kind: "unknown",
				exitCode: -1,
			}).catch(() => {});
		}

		process.exit(1);
	} finally {
		if (stopTail) await stopTail.stop();
	}
}

main().catch((err) => {
	logger.error(
		"run-conv",
		`Unhandled error: ${err instanceof Error ? err.message : String(err)}`,
	);
	process.exit(1);
});
