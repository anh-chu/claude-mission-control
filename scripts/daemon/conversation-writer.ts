/**
 * Daemon-side conversation writer.
 *
 * Lifecycle helpers + JSONL stream consumer that translates Claude CLI output
 * into conversation turns, events, and persistence.
 *
 * Schema: docs/conversation-event-schema.md (locked v1.0)
 * Persistence: src/lib/conversations.ts
 * Event bus: src/lib/conversation-event-bus.ts
 *
 * == Design decisions ==
 *
 * Tool-result attachment (turn parts):
 *   Instead of mutating turns.jsonl (which is append-only), we only publish a
 *   `tool.completed` event. The UI is responsible for reconciling tool results
 *   from the event stream. This keeps turns.jsonl truly append-only.
 *
 * Streaming text deltas:
 *   The current daemon does NOT emit per-token deltas — Claude CLI emits whole
 *   assistant messages as single JSONL lines. So we emit turn.started +
 *   turn.completed per assistant message, not turn.delta. Future enhancement:
 *   hook into a streaming Claude SDK to emit real deltas.
 */

import { publishAndEmit } from "../../src/lib/conversation-event-bus";
import {
	appendConversationTurn,
	createConversation,
	createConversationRun,
	getConversation,
	listRunsForConversation,
	updateConversation,
	updateConversationRun,
} from "../../src/lib/conversations";
import type {
	ConversationErrorKind,
	ConversationRun,
	ConversationSource,
	ConversationTokens,
	MessagePart,
	ToolCallRecord,
} from "../../src/lib/types";
import { logger } from "./logger";

// ─── Public Interfaces ───────────────────────────────────────────────────────

export interface StartConversationParams {
	taskId: string | null;
	agentId: string;
	model: string | null;
	source: ConversationSource;
	projectId: string | null;
	missionId: string | null;
	continuationIndex: number;
	resumeSessionId: string | null;
	/** If a conversation already exists for this task (continuation/resume), pass its id */
	existingConversationId?: string | null;
}

export interface ConversationContext {
	conversationId: string;
	runId: string;
}

// ─── Module-level stream state ──────────────────────────────────────────────

/**
 * Track the most recent assistant turn ID so tool_result lines can emit
 * `tool.completed` events correlated to the correct turn.
 *
 * Claude CLI stream order is: assistant → user(tool_result) → assistant → …
 * so the most recent assistant turn is always the right target.
 */
let _lastAssistantTurnId: string | null = null;

/** Map of tool_call_id → tool_name for tool.completed event enrichment. */
const _toolNameById = new Map<string, string>();

/**
 * Reset module-level stream state.
 * @internal Exported for tests only.
 */
export function __resetWriterState(): void {
	_lastAssistantTurnId = null;
	_toolNameById.clear();
}

// ─── Lifecycle Helpers ──────────────────────────────────────────────────────

/**
 * Start (or continue) a conversation for a task run.
 *
 * - If `existingConversationId` is provided, creates a new ConversationRun on
 *   the existing conversation (continuation/resume).
 * - Otherwise creates a new Conversation + first Run.
 * - Publishes `conversation.started` event.
 */
export async function startConversationForTask(
	params: StartConversationParams,
): Promise<ConversationContext> {
	let conversationId: string;

	if (params.existingConversationId) {
		const existing = await getConversation(params.existingConversationId);
		if (!existing) {
			throw new Error(
				`Conversation not found: ${params.existingConversationId}`,
			);
		}
		conversationId = existing.id;
	} else {
		const title = params.taskId
			? `Task run: ${params.taskId}`
			: `Chat: ${params.agentId}`;
		const conv = await createConversation({
			title,
			agentId: params.agentId,
			model: params.model,
			mode: "background",
			executionSource: params.source,
			taskId: params.taskId,
			status: "starting",
		});
		conversationId = conv.id;
	}

	const run = await createConversationRun({
		conversationId,
		source: params.source,
		projectId: params.projectId,
		missionId: params.missionId,
		continuationIndex: params.continuationIndex,
		sessionHandle: params.resumeSessionId,
		model: params.model,
	});

	await publishAndEmit({
		conversationId,
		type: "conversation.started",
		payload: { runId: run.id, source: params.source },
	});

	return { conversationId, runId: run.id };
}

/**
 * Mark the spawned process pid on the run.
 * Publishes `conversation.updated` with status="running".
 */
export async function attachPidToRun(
	ctx: ConversationContext,
	pid: number,
): Promise<void> {
	await updateConversationRun(ctx.runId, { pid, status: "running" });
	await updateConversation(ctx.conversationId, { status: "running" });

	await publishAndEmit({
		conversationId: ctx.conversationId,
		type: "conversation.updated",
		payload: { fields: { status: "running" } },
	});
}

/**
 * Append a user turn (e.g. when daemon manually injects a "decision answered" turn).
 * Does NOT publish events — the turn data will be discovered by the UI via polling
 * or subsequent events.
 */
export async function appendUserTurn(
	ctx: ConversationContext,
	content: string,
): Promise<void> {
	await appendConversationTurn(ctx.conversationId, {
		role: "user",
		content,
		runId: ctx.runId,
	});
}

/**
 * Mark conversation paused for human input.
 * Saves the Claude session ID on the current run's sessionHandle.
 * Closes the current run as "completed".
 * Publishes `conversation.paused`.
 */
export async function pauseForDecision(
	ctx: ConversationContext,
	decisionId: string,
	reason: string,
	claudeSessionId: string | null,
): Promise<void> {
	await updateConversationRun(ctx.runId, {
		sessionHandle: claudeSessionId,
		status: "completed",
	});

	await updateConversation(ctx.conversationId, {
		status: "awaiting-decision",
		pausedReason: reason,
		pausedDecisionId: decisionId,
		pausedAt: new Date().toISOString(),
	});

	await publishAndEmit({
		conversationId: ctx.conversationId,
		type: "conversation.paused",
		payload: { reason, decisionId },
	});
}

/**
 * Mark conversation completed successfully.
 * Closes the current run as completed.
 * Aggregates token totals across all runs.
 * Publishes `conversation.completed`.
 */
export async function completeConversation(
	ctx: ConversationContext,
	result: {
		exitCode: number | null;
		tokens: ConversationTokens;
		numTurns: number;
	},
): Promise<void> {
	await updateConversationRun(ctx.runId, {
		status: "completed",
		exitCode: result.exitCode,
		tokens: result.tokens,
		numTurns: result.numTurns,
		completedAt: new Date().toISOString(),
	});

	const allRuns = await listRunsForConversation(ctx.conversationId);
	const aggregate = sumTokens(allRuns);

	await updateConversation(ctx.conversationId, {
		status: "completed",
		tokens: aggregate,
		completedAt: new Date().toISOString(),
	});

	await publishAndEmit({
		conversationId: ctx.conversationId,
		type: "conversation.completed",
		payload: {
			runId: ctx.runId,
			exitCode: result.exitCode,
			tokens: aggregate,
		},
	});
}

/**
 * Mark conversation failed.
 * Closes the current run as failed.
 * Publishes `conversation.error`.
 */
export async function failConversation(
	ctx: ConversationContext,
	error: {
		message: string;
		kind: ConversationErrorKind;
		exitCode: number | null;
	},
): Promise<void> {
	await updateConversationRun(ctx.runId, {
		status: "failed",
		error: error.message,
		errorKind: error.kind,
		exitCode: error.exitCode,
		completedAt: new Date().toISOString(),
	});

	await updateConversation(ctx.conversationId, {
		status: "failed",
		error: error.message,
		errorKind: error.kind,
	});

	await publishAndEmit({
		conversationId: ctx.conversationId,
		type: "conversation.error",
		payload: {
			runId: ctx.runId,
			error: error.message,
			errorKind: error.kind,
		},
	});
}

/**
 * Update token totals + numTurns on the run and aggregate on the conversation.
 * Publishes `conversation.updated` with new tokens + turnCount.
 */
export async function updateRunMetrics(
	ctx: ConversationContext,
	metrics: {
		tokens: ConversationTokens;
		numTurns: number;
	},
): Promise<void> {
	await updateConversationRun(ctx.runId, {
		tokens: metrics.tokens,
		numTurns: metrics.numTurns,
	});

	const allRuns = await listRunsForConversation(ctx.conversationId);
	const aggregate = sumTokens(allRuns);

	await updateConversation(ctx.conversationId, {
		tokens: aggregate,
	});

	const conv = await getConversation(ctx.conversationId);

	await publishAndEmit({
		conversationId: ctx.conversationId,
		type: "conversation.updated",
		payload: {
			fields: {
				tokens: aggregate,
				turnCount: conv?.turnCount ?? 0,
			},
		},
	});
}

// ─── JSONL Stream Consumer ──────────────────────────────────────────────────

/**
 * Process a single JSONL line emitted by Claude CLI and translate it into
 * conversation turn updates + events.
 *
 * Line shapes (from Claude CLI streaming):
 *   { type: "system", subtype: "init", session_id: "..." }
 *   { type: "assistant", message: { content: [...] } }
 *   { type: "user", message: { content: [...] } }
 *   { type: "result", subtype: "success", usage: {...}, session_id, num_turns, ... }
 *
 * Inside content arrays:
 *   { type: "text", text: "..." }
 *   { type: "thinking", thinking: "..." }
 *   { type: "tool_use", id: "tu_...", name: "Bash", input: {...} }
 *   { type: "tool_result", tool_use_id: "tu_...", content: "...", is_error: bool }
 *
 * Unknown line types are logged as warnings and skipped.
 */
export async function processStreamLine(
	ctx: ConversationContext,
	line: unknown,
): Promise<void> {
	const parsed = parseLine(line);
	if (!parsed) {
		logger.warn("conversation-writer", "Skipping unparseable line");
		return;
	}

	const type = typeof parsed.type === "string" ? parsed.type : "";

	switch (type) {
		case "system": {
			const subtype = typeof parsed.subtype === "string" ? parsed.subtype : "";
			if (subtype === "init") {
				const sessionId =
					typeof parsed.session_id === "string" ? parsed.session_id : null;
				if (sessionId) {
					await updateConversationRun(ctx.runId, {
						sessionHandle: sessionId,
					});
				}
			}
			break;
		}

		case "assistant": {
			await processAssistantMessage(ctx, parsed);
			break;
		}

		case "user": {
			await processUserMessage(ctx, parsed);
			break;
		}

		case "result": {
			await processResultLine(ctx, parsed);
			break;
		}

		default: {
			logger.warn("conversation-writer", `Unknown line type: ${type}`);
			break;
		}
	}
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Parse a value that may be a JSON string or an already-parsed object.
 */
function parseLine(line: unknown): Record<string, unknown> | null {
	if (typeof line === "string") {
		try {
			return JSON.parse(line) as Record<string, unknown>;
		} catch {
			return null;
		}
	}
	if (typeof line === "object" && line !== null) {
		return line as Record<string, unknown>;
	}
	return null;
}

/**
 * Process an assistant message line.
 * Appends a turn with role=assistant, publishes turn.started + turn.completed,
 * and for each tool_use publishes tool.started.
 */
async function processAssistantMessage(
	ctx: ConversationContext,
	parsed: Record<string, unknown>,
): Promise<void> {
	const message =
		typeof parsed.message === "object" && parsed.message !== null
			? (parsed.message as Record<string, unknown>)
			: {};
	const contentBlocks = Array.isArray(message.content)
		? (message.content as Record<string, unknown>[])
		: [];

	const parts: MessagePart[] = [];
	const textParts: string[] = [];
	const toolCalls: ToolCallRecord[] = [];

	for (const block of contentBlocks) {
		const blockType = typeof block.type === "string" ? block.type : "";

		if (blockType === "text") {
			const text = typeof block.text === "string" ? block.text : "";
			textParts.push(text);
			parts.push({ type: "text", content: text });
		} else if (blockType === "thinking") {
			const thinking =
				typeof block.thinking === "string"
					? block.thinking
					: typeof block.text === "string"
						? block.text
						: "";
			parts.push({ type: "thinking", content: thinking });
		} else if (blockType === "tool_use") {
			const toolId = typeof block.id === "string" ? block.id : "";
			const toolName = typeof block.name === "string" ? block.name : "";
			const toolInput = block.input !== undefined ? block.input : {};
			const inputStr =
				typeof toolInput === "string" ? toolInput : JSON.stringify(toolInput);

			parts.push({
				type: "tool_use",
				content: inputStr,
				toolName,
				toolCallId: toolId,
			});

			const args: Record<string, unknown> =
				typeof toolInput === "object" && toolInput !== null
					? (toolInput as Record<string, unknown>)
					: {};

			toolCalls.push({
				id: toolId,
				tool: toolName,
				args,
				status: "running",
			});

			_toolNameById.set(toolId, toolName);
		}
	}

	const content = textParts.join("");

	const turn = await appendConversationTurn(ctx.conversationId, {
		role: "assistant",
		content,
		parts: parts.length > 0 ? parts : undefined,
		toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
		runId: ctx.runId,
	});

	_lastAssistantTurnId = turn.id;

	await publishAndEmit({
		conversationId: ctx.conversationId,
		type: "turn.started",
		payload: {
			turnId: turn.id,
			turn: turn.turn,
			role: "assistant",
			runId: ctx.runId,
		},
	});

	for (const tc of toolCalls) {
		await publishAndEmit({
			conversationId: ctx.conversationId,
			type: "tool.started",
			payload: {
				turnId: turn.id,
				toolCallId: tc.id,
				tool: tc.tool,
				args: tc.args,
			},
		});
	}

	await publishAndEmit({
		conversationId: ctx.conversationId,
		type: "turn.completed",
		payload: {
			turnId: turn.id,
			content,
			parts: parts.length > 0 ? parts : undefined,
			toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
		},
	});
}

/**
 * Process a user message line (tool_result blocks).
 * Publishes `tool.completed` events for each tool_result.
 *
 * Turns.jsonl is NOT mutated here — we only publish events. The UI reconciles
 * tool results from the event stream, keeping turns.jsonl truly append-only.
 */
async function processUserMessage(
	ctx: ConversationContext,
	parsed: Record<string, unknown>,
): Promise<void> {
	const message =
		typeof parsed.message === "object" && parsed.message !== null
			? (parsed.message as Record<string, unknown>)
			: {};
	const contentBlocks = Array.isArray(message.content)
		? (message.content as Record<string, unknown>[])
		: [];

	for (const block of contentBlocks) {
		const blockType = typeof block.type === "string" ? block.type : "";
		if (blockType !== "tool_result") continue;

		const toolUseId =
			typeof block.tool_use_id === "string" ? block.tool_use_id : "";
		if (!toolUseId) continue;

		const resultContent =
			typeof block.content === "string"
				? block.content
				: block.content !== undefined
					? JSON.stringify(block.content)
					: "";
		const isError = block.is_error === true;
		const toolName = _toolNameById.get(toolUseId) ?? "";

		await publishAndEmit({
			conversationId: ctx.conversationId,
			type: "tool.completed",
			payload: {
				turnId: _lastAssistantTurnId ?? ctx.runId,
				toolCallId: toolUseId,
				tool: toolName,
				status: isError ? "error" : "completed",
				result: resultContent,
			},
		});
	}
}

/**
 * Process a result line (terminal line from Claude CLI).
 * Extracts usage tokens and calls updateRunMetrics.
 */
async function processResultLine(
	ctx: ConversationContext,
	parsed: Record<string, unknown>,
): Promise<void> {
	const usage =
		typeof parsed.usage === "object" && parsed.usage !== null
			? (parsed.usage as Record<string, unknown>)
			: {};

	const inputTokens =
		typeof usage.input_tokens === "number" ? usage.input_tokens : 0;
	const outputTokens =
		typeof usage.output_tokens === "number" ? usage.output_tokens : 0;
	const cacheRead =
		typeof usage.cache_read_input_tokens === "number"
			? usage.cache_read_input_tokens
			: 0;
	const cacheCreate =
		typeof usage.cache_creation_input_tokens === "number"
			? usage.cache_creation_input_tokens
			: 0;
	const cache = cacheRead + cacheCreate;

	const tokens: ConversationTokens = {
		input: inputTokens,
		output: outputTokens,
		total: inputTokens + outputTokens + cache,
	};
	if (cache > 0) {
		tokens.cache = cache;
	}

	const numTurns = typeof parsed.num_turns === "number" ? parsed.num_turns : 0;

	await updateRunMetrics(ctx, { tokens, numTurns });
}

/**
 * Sum token totals across all runs for aggregation on the conversation record.
 */
function sumTokens(runs: ConversationRun[]): ConversationTokens {
	const result: ConversationTokens = {
		input: 0,
		output: 0,
		total: 0,
	};
	for (const run of runs) {
		result.input += run.tokens.input;
		result.output += run.tokens.output;
		result.total += run.tokens.total;
		if (run.tokens.cache !== undefined) {
			result.cache = (result.cache ?? 0) + run.tokens.cache;
		}
	}
	return result;
}
