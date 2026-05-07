import { describe, expect, it } from "vitest";
import type { ConversationReducerState } from "../src/hooks/use-conversation-stream";
import {
	conversationReducer,
	initialReducerState,
} from "../src/hooks/use-conversation-stream";
import type {
	Conversation,
	ConversationEvent,
	ConversationRun,
	ConversationTurn,
} from "../src/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────────────────────

const CONV_ID = "conv_test1";
const TS = "2026-05-07T00:00:00.000Z";
const TS2 = "2026-05-07T00:00:01.000Z";

function baseConversation(overrides?: Partial<Conversation>): Conversation {
	return {
		id: CONV_ID,
		title: "Test Conversation",
		agentId: null,
		model: null,
		status: "idle",
		mode: "foreground",
		executionSource: "chat",
		taskId: null,
		parentConversationId: null,
		currentRunId: null,
		runCount: 0,
		tokens: { input: 0, output: 0, total: 0 },
		turnCount: 0,
		error: null,
		errorKind: null,
		pausedReason: null,
		pausedDecisionId: null,
		summary: null,
		artifactRefs: [],
		mentionedPaths: [],
		attachmentPaths: [],
		recentRequestIds: [],
		createdAt: TS,
		startedAt: null,
		updatedAt: TS,
		completedAt: null,
		cancelledAt: null,
		archivedAt: null,
		deletedAt: null,
		pausedAt: null,
		version: 1,
		...overrides,
	};
}

function stateWithConversation(
	conversation?: Conversation,
): ConversationReducerState {
	return {
		...initialReducerState,
		conversation: conversation ?? baseConversation({ status: "running" }),
	};
}

// ─── Tests ────────────────────────────────────────────────────────────────────────────────────

describe("conversationReducer — internal actions", () => {
	it("__set_state replaces entire state and clears error/pendingToolCalls", () => {
		const conv = baseConversation();
		const turn: ConversationTurn = {
			id: "turn_1",
			turn: 1,
			role: "assistant",
			ts: TS,
			content: "Hello",
			pending: false,
		};
		const run: ConversationRun = {
			id: "run_1",
			conversationId: CONV_ID,
			status: "running",
			pid: 123,
			sessionHandle: null,
			continuationIndex: 0,
			source: "chat",
			projectId: null,
			missionId: null,
			tokens: { input: 0, output: 0, total: 0 },
			numTurns: 1,
			requestId: null,
			startedAt: TS,
			completedAt: null,
			exitCode: null,
			error: null,
			errorKind: null,
			model: null,
		};

		const dirty = {
			...initialReducerState,
			error: "old error",
			pendingToolCalls: { turn_99: [] },
		};

		const result = conversationReducer(dirty, {
			type: "__set_state",
			payload: { conversation: conv, turns: [turn], runs: [run] },
		});

		expect(result.conversation).toEqual(conv);
		expect(result.turns).toEqual([turn]);
		expect(result.runs).toEqual([run]);
		expect(result.error).toBeNull();
		expect(result.pendingToolCalls).toEqual({});
	});

	it("__set_error sets error field", () => {
		const result = conversationReducer(initialReducerState, {
			type: "__set_error",
			payload: "Network error",
		});
		expect(result.error).toBe("Network error");
	});

	it("__set_error with null clears error", () => {
		const state = { ...initialReducerState, error: "old error" };
		const result = conversationReducer(state, {
			type: "__set_error",
			payload: null,
		});
		expect(result.error).toBeNull();
	});
});

describe("conversationReducer — turn events", () => {
	it("turn.started adds a placeholder turn", () => {
		const result = conversationReducer(initialReducerState, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "turn.started",
			payload: { turnId: "turn_1", turn: 1, role: "assistant" },
		});

		expect(result.turns).toHaveLength(1);
		expect(result.turns[0].id).toBe("turn_1");
		expect(result.turns[0].turn).toBe(1);
		expect(result.turns[0].role).toBe("assistant");
		expect(result.turns[0].content).toBe("");
		expect(result.turns[0].parts).toEqual([]);
		expect(result.turns[0].pending).toBe(true);
		expect(result.turns[0].ts).toBe(TS);
	});

	it("turn.started is idempotent (same turnId skipped)", () => {
		const state = conversationReducer(initialReducerState, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "turn.started",
			payload: { turnId: "turn_1", turn: 1, role: "assistant" },
		});
		const result = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 2,
			type: "turn.started",
			payload: { turnId: "turn_1", turn: 1, role: "assistant" },
		});

		expect(result.turns).toHaveLength(1);
	});

	it("turn.delta appends to existing turn content", () => {
		const state = conversationReducer(initialReducerState, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "turn.started",
			payload: { turnId: "turn_1", turn: 1, role: "assistant" },
		});

		const afterDelta = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS2,
			seq: 2,
			type: "turn.delta",
			payload: { turnId: "turn_1", delta: "Hello " },
		});

		expect(afterDelta.turns[0].content).toBe("Hello ");
		expect(afterDelta.turns[0].parts).toHaveLength(1);
		expect(afterDelta.turns[0].parts?.[0].type).toBe("text");
		expect(afterDelta.turns[0].parts?.[0].content).toBe("Hello ");

		const afterDelta2 = conversationReducer(afterDelta, {
			conversationId: CONV_ID,
			ts: TS2,
			seq: 3,
			type: "turn.delta",
			payload: { turnId: "turn_1", delta: "World!" },
		});

		expect(afterDelta2.turns[0].content).toBe("Hello World!");
		expect(afterDelta2.turns[0].parts?.[0].content).toBe("Hello World!");
	});

	it("turn.delta with partType thinking only updates that part, not content", () => {
		const state = conversationReducer(initialReducerState, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "turn.started",
			payload: { turnId: "turn_1", turn: 1, role: "assistant" },
		});

		// Text delta
		const s1 = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 2,
			type: "turn.delta",
			payload: { turnId: "turn_1", delta: "Answer: " },
		});

		// Thinking delta
		const s2 = conversationReducer(s1, {
			conversationId: CONV_ID,
			ts: TS2,
			seq: 3,
			type: "turn.delta",
			payload: {
				turnId: "turn_1",
				delta: "hidden reasoning",
				partType: "thinking",
			},
		});

		expect(s2.turns[0].content).toBe("Answer: ");
		expect(s2.turns[0].parts).toHaveLength(2);
		expect(s2.turns[0].parts?.[0].type).toBe("text");
		expect(s2.turns[0].parts?.[0].content).toBe("Answer: ");
		expect(s2.turns[0].parts?.[1].type).toBe("thinking");
		expect(s2.turns[0].parts?.[1].content).toBe("hidden reasoning");
	});

	it("turn.delta for unknown turnId is silently ignored", () => {
		const result = conversationReducer(initialReducerState, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "turn.delta",
			payload: { turnId: "ghost", delta: "nothing" },
		});
		expect(result).toBe(initialReducerState);
	});

	it("turn.completed marks turn as not pending", () => {
		const s1 = conversationReducer(initialReducerState, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "turn.started",
			payload: { turnId: "turn_1", turn: 1, role: "assistant" },
		});

		const tokens = { input: 10, output: 50, total: 60 };
		const s2 = conversationReducer(s1, {
			conversationId: CONV_ID,
			ts: TS2,
			seq: 2,
			type: "turn.completed",
			payload: { turnId: "turn_1", tokens },
		});

		expect(s2.turns[0].pending).toBe(false);
		expect(s2.turns[0].tokens).toEqual(tokens);
	});

	it("turn.completed with content/parts/toolCalls populates turn (Bug #2 fix)", () => {
		const s1 = conversationReducer(initialReducerState, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "turn.started",
			payload: { turnId: "turn_1", turn: 1, role: "assistant" },
		});

		const s2 = conversationReducer(s1, {
			conversationId: CONV_ID,
			ts: TS2,
			seq: 2,
			type: "turn.completed",
			payload: {
				turnId: "turn_1",
				tokens: { input: 10, output: 50 },
				content: "Hello world!",
				parts: [
					{ type: "text", content: "Hello world!" },
					{
						type: "tool_use",
						content: '{"cmd":"ls"}',
						toolName: "Bash",
						toolCallId: "tc_1",
					},
				],
				toolCalls: [
					{
						id: "tc_1",
						tool: "Bash",
						args: { cmd: "ls" },
						status: "running",
					},
				],
			},
		});

		expect(s2.turns[0].pending).toBe(false);
		expect(s2.turns[0].tokens?.input).toBe(10);
		expect(s2.turns[0].tokens?.output).toBe(50);
		expect(s2.turns[0].content).toBe("Hello world!");
		expect(s2.turns[0].parts).toHaveLength(2);
		expect(s2.turns[0].parts?.[0].type).toBe("text");
		expect(s2.turns[0].parts?.[0].content).toBe("Hello world!");
		expect(s2.turns[0].parts?.[1].type).toBe("tool_use");
		expect(s2.turns[0].parts?.[1].toolCallId).toBe("tc_1");
		expect(s2.turns[0].toolCalls).toHaveLength(1);
		expect(s2.turns[0].toolCalls?.[0].id).toBe("tc_1");
	});
});

describe("conversationReducer — tool call events", () => {
	it("tool.started adds ToolCallRecord to existing turn", () => {
		const s1 = conversationReducer(initialReducerState, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "turn.started",
			payload: { turnId: "turn_1", turn: 1, role: "assistant" },
		});

		const s2 = conversationReducer(s1, {
			conversationId: CONV_ID,
			ts: TS2,
			seq: 2,
			type: "tool.started",
			payload: {
				turnId: "turn_1",
				toolCallId: "tc_1",
				tool: "Read",
				args: { path: "/foo" },
			},
		});

		expect(s2.turns[0].toolCalls).toHaveLength(1);
		expect(s2.turns[0].toolCalls?.[0].id).toBe("tc_1");
		expect(s2.turns[0].toolCalls?.[0].status).toBe("running");
		expect(s2.turns[0].toolCalls?.[0].tool).toBe("Read");

		// Also adds a tool_use part
		expect(s2.turns[0].parts).toHaveLength(1);
		expect(s2.turns[0].parts?.[0].type).toBe("tool_use");
		expect(s2.turns[0].parts?.[0].toolCallId).toBe("tc_1");
		expect(s2.turns[0].parts?.[0].status).toBe("running");
	});

	it("tool.started buffers when turn does not exist yet", () => {
		const result = conversationReducer(initialReducerState, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "tool.started",
			payload: {
				turnId: "future_turn",
				toolCallId: "tc_1",
				tool: "Bash",
				args: { command: "ls" },
			},
		});

		expect(result.turns).toHaveLength(0);
		expect(result.pendingToolCalls.future_turn).toHaveLength(1);
		expect(result.pendingToolCalls.future_turn[0].id).toBe("tc_1");
	});

	it("buffered tool call attaches when turn arrives", () => {
		const withTool = conversationReducer(initialReducerState, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "tool.started",
			payload: {
				turnId: "turn_1",
				toolCallId: "tc_1",
				tool: "Bash",
				args: { command: "ls" },
			},
		});

		const withTurn = conversationReducer(withTool, {
			conversationId: CONV_ID,
			ts: TS2,
			seq: 2,
			type: "turn.started",
			payload: { turnId: "turn_1", turn: 1, role: "assistant" },
		});

		expect(withTurn.turns).toHaveLength(1);
		expect(withTurn.turns[0].toolCalls).toHaveLength(1);
		expect(withTurn.turns[0].toolCalls?.[0].id).toBe("tc_1");
		expect(withTurn.turns[0].parts?.[0].type).toBe("tool_use");
		expect(withTurn.pendingToolCalls).toEqual({});
	});

	it("tool.completed updates tool call status and adds result part", () => {
		const s1 = conversationReducer(initialReducerState, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "turn.started",
			payload: { turnId: "turn_1", turn: 1, role: "assistant" },
		});

		const s2 = conversationReducer(s1, {
			conversationId: CONV_ID,
			ts: TS2,
			seq: 2,
			type: "tool.started",
			payload: {
				turnId: "turn_1",
				toolCallId: "tc_1",
				tool: "Read",
				args: { path: "/foo" },
			},
		});

		const s3 = conversationReducer(s2, {
			conversationId: CONV_ID,
			ts: TS2,
			seq: 3,
			type: "tool.completed",
			payload: {
				turnId: "turn_1",
				toolCallId: "tc_1",
				tool: "Read",
				status: "completed",
				result: "file content",
				durationMs: 150,
			},
		});

		expect(s3.turns[0].toolCalls?.[0].status).toBe("completed");
		expect(s3.turns[0].toolCalls?.[0].result).toBe("file content");
		expect(s3.turns[0].toolCalls?.[0].durationMs).toBe(150);

		// tool_use part updated to completed status
		const toolUsePart = s3.turns[0].parts?.find((p) => p.type === "tool_use");
		expect(toolUsePart?.status).toBe("completed");

		// tool_result part added
		const toolResultPart = s3.turns[0].parts?.find(
			(p) => p.type === "tool_result",
		);
		expect(toolResultPart?.content).toBe("file content");
		expect(toolResultPart?.toolCallId).toBe("tc_1");
	});
});

describe("conversationReducer — conversation lifecycle events", () => {
	it("conversation.started creates a run and updates status", () => {
		const state = stateWithConversation();
		const result = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "conversation.started",
			payload: { runId: "run_1", source: "chat" },
		});

		expect(result.conversation?.status).toBe("starting");
		expect(result.conversation?.currentRunId).toBe("run_1");
		expect(result.runs).toHaveLength(1);
		expect(result.runs[0].id).toBe("run_1");
		expect(result.runs[0].status).toBe("starting");
		expect(result.runs[0].source).toBe("chat");
	});

	it("conversation.updated shallow-merges fields", () => {
		const state = stateWithConversation();
		const result = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "conversation.updated",
			payload: {
				fields: { title: "New Title", turnCount: 5 },
			},
		});

		expect(result.conversation?.title).toBe("New Title");
		expect(result.conversation?.turnCount).toBe(5);
		// Other fields unchanged
		expect(result.conversation?.status).toBe("running");
	});

	it("conversation.updated returns state unchanged if no conversation", () => {
		const result = conversationReducer(initialReducerState, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "conversation.updated",
			payload: {
				fields: { title: "New Title" },
			},
		});
		expect(result).toBe(initialReducerState);
	});

	it("conversation.completed sets status and tokens, updates run", () => {
		const state = stateWithConversation(
			baseConversation({ status: "running", currentRunId: "run_1" }),
		);
		const withRun = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "conversation.started",
			payload: { runId: "run_1", source: "chat" },
		});

		const tokens = { input: 100, output: 200, total: 300 };
		const result = conversationReducer(withRun, {
			conversationId: CONV_ID,
			ts: TS2,
			seq: 2,
			type: "conversation.completed",
			payload: { runId: "run_1", exitCode: 0, tokens },
		});

		expect(result.conversation?.status).toBe("completed");
		expect(result.conversation?.completedAt).toBe(TS2);
		expect(result.conversation?.tokens).toEqual(tokens);
		expect(result.runs[0].status).toBe("completed");
		expect(result.runs[0].exitCode).toBe(0);
		expect(result.runs[0].tokens).toEqual(tokens);
	});

	it("conversation.paused sets awaiting-decision status and metadata", () => {
		const state = stateWithConversation();
		const result = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "conversation.paused",
			payload: { reason: "Need approval", decisionId: "dec_1" },
		});

		expect(result.conversation?.status).toBe("awaiting-decision");
		expect(result.conversation?.pausedReason).toBe("Need approval");
		expect(result.conversation?.pausedDecisionId).toBe("dec_1");
		expect(result.conversation?.pausedAt).toBe(TS);
	});

	it("conversation.resumed clears pause state and increments runCount", () => {
		const paused = baseConversation({
			status: "awaiting-decision",
			pausedReason: "Need approval",
			pausedDecisionId: "dec_1",
			pausedAt: TS,
			runCount: 1,
		});
		const state = stateWithConversation(paused);

		const result = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS2,
			seq: 1,
			type: "conversation.resumed",
			payload: { runId: "run_2", decisionId: "dec_1", answer: "yes" },
		});

		expect(result.conversation?.status).toBe("running");
		expect(result.conversation?.pausedReason).toBeNull();
		expect(result.conversation?.pausedDecisionId).toBeNull();
		expect(result.conversation?.pausedAt).toBeNull();
		expect(result.conversation?.runCount).toBe(2);
		expect(result.conversation?.currentRunId).toBe("run_2");
	});

	it("conversation.error sets failed status and error info", () => {
		const state = stateWithConversation();
		const result = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "conversation.error",
			payload: {
				runId: "run_1",
				error: "Something broke",
				errorKind: "unknown",
			},
		});

		expect(result.conversation?.status).toBe("failed");
		expect(result.conversation?.error).toBe("Something broke");
		expect(result.conversation?.errorKind).toBe("unknown");
		expect(result.error).toBe("Something broke");
	});

	it("conversation.cancelled sets cancelled status and timestamp", () => {
		const state = stateWithConversation();
		const result = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "conversation.cancelled",
			payload: { runId: null, reason: "User cancelled" },
		});

		expect(result.conversation?.status).toBe("cancelled");
		expect(result.conversation?.cancelledAt).toBe(TS);
	});
});

describe("conversationReducer — decision events", () => {
	it.each([
		[
			"decision.created",
			{ decisionId: "dec_1", question: "Proceed?", options: ["yes", "no"] },
		],
		["decision.answered", { decisionId: "dec_1", answer: "yes" }],
	] as Array<
		["decision.created" | "decision.answered", ConversationEvent["payload"]]
	>)("%s returns state unchanged", (type, payload) => {
		const state = stateWithConversation();
		const result = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type,
			payload,
		} as ConversationEvent);
		expect(result).toBe(state);
	});
});

describe("conversationReducer — edge cases", () => {
	it("unknown event type returns state unchanged", () => {
		const state = stateWithConversation();
		const result = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 999,
			type: "unknown.type",
			payload: {},
		} as unknown as ConversationEvent);
		expect(result).toBe(state);
	});

	it("lifecycle events return state unchanged when conversation is null", () => {
		for (const type of [
			"conversation.updated",
			"conversation.paused",
			"conversation.resumed",
			"conversation.error",
			"conversation.cancelled",
		] as const) {
			const result = conversationReducer(initialReducerState, {
				conversationId: CONV_ID,
				ts: TS,
				seq: 1,
				type,
				payload: {},
			} as unknown as ConversationEvent);
			expect(result).toBe(initialReducerState);
		}
	});
});

describe("conversationReducer — multiple event sequences", () => {
	it("full turn lifecycle: started → deltas → completed", () => {
		// Simulate a complete assistant turn stream
		let state = initialReducerState;

		state = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "turn.started",
			payload: { turnId: "turn_1", turn: 1, role: "assistant" },
		});
		expect(state.turns[0].pending).toBe(true);
		expect(state.turns[0].content).toBe("");

		state = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 2,
			type: "turn.delta",
			payload: { turnId: "turn_1", delta: "Hello" },
		});
		expect(state.turns[0].content).toBe("Hello");

		state = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 3,
			type: "turn.delta",
			payload: { turnId: "turn_1", delta: " World" },
		});
		expect(state.turns[0].content).toBe("Hello World");

		// Tool call starts during the turn
		state = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 4,
			type: "tool.started",
			payload: {
				turnId: "turn_1",
				toolCallId: "tc_1",
				tool: "Read",
				args: { path: "/foo" },
			},
		});
		expect(state.turns[0].toolCalls).toHaveLength(1);
		expect(state.turns[0].toolCalls?.[0].status).toBe("running");

		// More text after tool
		state = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 5,
			type: "turn.delta",
			payload: { turnId: "turn_1", delta: "\n\nDone." },
		});
		expect(state.turns[0].content).toBe("Hello World\n\nDone.");

		// Tool completes
		state = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 6,
			type: "tool.completed",
			payload: {
				turnId: "turn_1",
				toolCallId: "tc_1",
				tool: "Read",
				status: "completed",
				result: "file contents here",
				durationMs: 200,
			},
		});
		expect(state.turns[0].toolCalls?.[0].status).toBe("completed");
		expect(state.turns[0].toolCalls?.[0].result).toBe("file contents here");

		// Turn completes
		state = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 7,
			type: "turn.completed",
			payload: {
				turnId: "turn_1",
				tokens: { input: 10, output: 60 },
			},
		});
		expect(state.turns[0].pending).toBe(false);
		expect(state.turns[0].tokens?.input).toBe(10);
		expect(state.turns[0].tokens?.output).toBe(60);
		expect(state.turns[0].content).toBe("Hello World\n\nDone.");
	});

	it("buffered tool calls attach in order when turn arrives", () => {
		let state = initialReducerState;

		// Two tool calls arrive before the turn
		state = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "tool.started",
			payload: {
				turnId: "turn_1",
				toolCallId: "tc_1",
				tool: "Grep",
				args: { pattern: "foo" },
			},
		});

		state = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 2,
			type: "tool.started",
			payload: {
				turnId: "turn_1",
				toolCallId: "tc_2",
				tool: "Read",
				args: { path: "/bar" },
			},
		});

		expect(Object.keys(state.pendingToolCalls)).toEqual(["turn_1"]);
		expect(state.pendingToolCalls.turn_1).toHaveLength(2);

		// Now the turn starts — both tools attach
		state = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 3,
			type: "turn.started",
			payload: { turnId: "turn_1", turn: 1, role: "assistant" },
		});

		expect(state.turns[0].toolCalls).toHaveLength(2);
		expect(state.turns[0].toolCalls?.[0].id).toBe("tc_1");
		expect(state.turns[0].toolCalls?.[1].id).toBe("tc_2");
		expect(state.pendingToolCalls).toEqual({});
	});

	it("multiple turns can coexist", () => {
		let state = initialReducerState;

		// User turn
		state = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 1,
			type: "turn.started",
			payload: { turnId: "turn_1", turn: 1, role: "user" },
		});
		state = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 2,
			type: "turn.completed",
			payload: { turnId: "turn_1" },
		});

		// Assistant turn
		state = conversationReducer(state, {
			conversationId: CONV_ID,
			ts: TS,
			seq: 3,
			type: "turn.started",
			payload: { turnId: "turn_2", turn: 2, role: "assistant" },
		});

		expect(state.turns).toHaveLength(2);
		expect(state.turns[0].id).toBe("turn_1");
		expect(state.turns[0].role).toBe("user");
		expect(state.turns[0].pending).toBe(false);
		expect(state.turns[1].id).toBe("turn_2");
		expect(state.turns[1].role).toBe("assistant");
		expect(state.turns[1].pending).toBe(true);
	});
});
