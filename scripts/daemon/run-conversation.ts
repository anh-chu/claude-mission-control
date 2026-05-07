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

import { existsSync, readFileSync } from "node:fs";
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
				try {
					const parsed = JSON.parse(trimmed);
					await processStreamLine(ctx, parsed);
				} catch {
					// skip malformed line
				}
			}
		} catch (err) {
			logger.warn("run-conv", `Stream tail error: ${String(err)}`);
		}
	};

	const interval = setInterval(() => {
		if (stopped) return;
		doRead();
	}, 250);

	return {
		stop: async () => {
			if (stopped) return;
			stopped = true;
			clearInterval(interval);
			await doRead();
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

async function main() {
	const conversationId = process.argv[2];
	if (!conversationId) {
		console.error("Usage: run-conversation.ts <conversationId>");
		process.exit(1);
	}

	logger.info("run-conv", `Starting conversation ${conversationId}`);

	// 1. Read conversation
	const conversation = await getConversation(conversationId);
	if (!conversation) {
		logger.error("run-conv", `Conversation not found: ${conversationId}`);
		process.exit(1);
	}

	// 2. Read turns
	const turns = await readConversationTurns(conversationId);

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
			`Spawning agent for conversation ${conversationId} (run: ${convCtx.runId}, prompt length: ${prompt.length})`,
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
				if (convCtx) {
					attachPidToRun(convCtx, pid).catch((err) =>
						logger.error("run-conv", `attachPidToRun failed: ${String(err)}`),
					);
				}
			},
		});

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
