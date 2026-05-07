import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	getConversation,
	getConversationRun,
	listRunsForConversation,
	readConversationEvents,
	readConversationTurns,
	setConversationsWorkspace,
} from "@/lib/conversations";
import type { ConversationContext } from "../scripts/daemon/conversation-writer";
import {
	__resetWriterState,
	appendUserTurn,
	attachPidToRun,
	completeConversation,
	failConversation,
	pauseForDecision,
	processStreamLine,
	startConversationForTask,
	updateRunMetrics,
} from "../scripts/daemon/conversation-writer";
import { backupDataFiles, restoreDataFiles } from "./helpers";

let backups: Record<string, string>;

beforeAll(async () => {
	backups = await backupDataFiles();
	setConversationsWorkspace("default");
});

afterAll(async () => {
	await restoreDataFiles(backups);
});

beforeEach(() => {
	__resetWriterState();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal valid context for tests that need a conversation + run. */
async function makeContext(
	overrides?: Partial<{
		taskId: string;
		existingConversationId: string | null;
		continuationIndex: number;
	}>,
): Promise<ConversationContext> {
	return startConversationForTask({
		taskId: overrides?.taskId ?? `vitest-task-${Date.now()}`,
		agentId: "test-agent",
		model: "haiku",
		source: "task",
		projectId: null,
		missionId: null,
		continuationIndex: overrides?.continuationIndex ?? 0,
		resumeSessionId: null,
		existingConversationId: overrides?.existingConversationId ?? null,
	});
}

// ─── Lifecycle Helpers ──────────────────────────────────────────────────────

describe("startConversationForTask", () => {
	it("creates new conversation + run, returns IDs, publishes conversation.started", async () => {
		const ctx = await startConversationForTask({
			taskId: `vitest-task-${Date.now()}`,
			agentId: "dev",
			model: "haiku",
			source: "task",
			projectId: "proj-1",
			missionId: null,
			continuationIndex: 0,
			resumeSessionId: null,
		});

		expect(ctx.conversationId).toMatch(/^conv_/);
		expect(ctx.runId).toMatch(/^run_/);

		const conv = await getConversation(ctx.conversationId);
		expect(conv).not.toBeNull();
		expect(conv?.taskId).toMatch(/^vitest-task-/);
		expect(conv?.agentId).toBe("dev");
		expect(conv?.status).toBe("starting");

		const run = await getConversationRun(ctx.runId);
		expect(run).not.toBeNull();
		expect(run?.continuationIndex).toBe(0);
		expect(run?.conversationId).toBe(ctx.conversationId);

		const events = await readConversationEvents(ctx.conversationId);
		const startedEvent = events.find((e) => e.type === "conversation.started");
		expect(startedEvent).toBeDefined();
		if (startedEvent?.type === "conversation.started") {
			expect(startedEvent.payload.runId).toBe(ctx.runId);
		}
	});

	it("with existingConversationId reuses conversation, creates new run with given continuationIndex", async () => {
		const ctx1 = await makeContext({ taskId: `vitest-reuse-${Date.now()}` });

		const ctx2 = await startConversationForTask({
			taskId: `vitest-reuse-${Date.now()}-cont`,
			agentId: "dev",
			model: "haiku",
			source: "task",
			projectId: null,
			missionId: null,
			continuationIndex: 1,
			resumeSessionId: "sess_abc",
			existingConversationId: ctx1.conversationId,
		});

		expect(ctx2.conversationId).toBe(ctx1.conversationId);
		expect(ctx2.runId).not.toBe(ctx1.runId);

		const conv = await getConversation(ctx2.conversationId);
		expect(conv?.runCount).toBe(2);

		const run2 = await getConversationRun(ctx2.runId);
		expect(run2?.continuationIndex).toBe(1);
		expect(run2?.sessionHandle).toBe("sess_abc");

		const runs = await listRunsForConversation(ctx2.conversationId);
		expect(runs).toHaveLength(2);
	});

	it("throws when existingConversationId does not exist", async () => {
		await expect(
			startConversationForTask({
				taskId: `vitest-task-${Date.now()}`,
				agentId: "dev",
				model: null,
				source: "task",
				projectId: null,
				missionId: null,
				continuationIndex: 0,
				resumeSessionId: null,
				existingConversationId: "conv_nonexistent",
			}),
		).rejects.toThrow("Conversation not found");
	});

	it("with taskId: null creates conversation without task linkage (chat)", async () => {
		const ctx = await startConversationForTask({
			taskId: null,
			agentId: "chat-agent",
			model: null,
			source: "chat",
			projectId: null,
			missionId: null,
			continuationIndex: 0,
			resumeSessionId: null,
		});

		expect(ctx.conversationId).toMatch(/^conv_/);
		expect(ctx.runId).toMatch(/^run_/);

		const conv = await getConversation(ctx.conversationId);
		expect(conv).not.toBeNull();
		expect(conv?.taskId).toBeNull();
		expect(conv?.title).toBe("Chat: chat-agent");
		expect(conv?.status).toBe("starting");
		expect(conv?.executionSource).toBe("chat");
	});
});

describe("attachPidToRun", () => {
	it("sets pid + run status='running' and publishes conversation.updated", async () => {
		const ctx = await makeContext();

		await attachPidToRun(ctx, 42_001);

		const run = await getConversationRun(ctx.runId);
		expect(run?.pid).toBe(42_001);
		expect(run?.status).toBe("running");

		const conv = await getConversation(ctx.conversationId);
		expect(conv?.status).toBe("running");

		const events = await readConversationEvents(ctx.conversationId);
		const updateEvent = events.find((e) => e.type === "conversation.updated");
		expect(updateEvent).toBeDefined();
		if (updateEvent?.type === "conversation.updated") {
			expect(updateEvent.payload.fields.status).toBe("running");
		}
	});
});

describe("appendUserTurn", () => {
	it("appends a user turn to the conversation", async () => {
		const ctx = await makeContext();

		await appendUserTurn(ctx, "Hello from the daemon");

		const turns = await readConversationTurns(ctx.conversationId);
		expect(turns).toHaveLength(1);
		expect(turns[0].role).toBe("user");
		expect(turns[0].content).toBe("Hello from the daemon");
		expect(turns[0].runId).toBe(ctx.runId);
		expect(turns[0].turn).toBe(1);
	});
});

describe("pauseForDecision", () => {
	it("sets sessionHandle, status, paused fields; closes run; publishes paused", async () => {
		const ctx = await makeContext();

		await pauseForDecision(ctx, "dec-42", "Need user input", "sess_xyz");

		const conv = await getConversation(ctx.conversationId);
		expect(conv?.status).toBe("awaiting-decision");
		expect(conv?.pausedDecisionId).toBe("dec-42");
		expect(conv?.pausedReason).toBe("Need user input");
		expect(conv?.pausedAt).not.toBeNull();

		const run = await getConversationRun(ctx.runId);
		expect(run?.sessionHandle).toBe("sess_xyz");
		expect(run?.status).toBe("completed");

		const events = await readConversationEvents(ctx.conversationId);
		const pausedEvent = events.find((e) => e.type === "conversation.paused");
		expect(pausedEvent).toBeDefined();
		if (pausedEvent?.type === "conversation.paused") {
			expect(pausedEvent.payload.reason).toBe("Need user input");
			expect(pausedEvent.payload.decisionId).toBe("dec-42");
		}
	});

	it("accepts null claudeSessionId (no session to save)", async () => {
		const ctx = await makeContext();

		await pauseForDecision(ctx, "dec-0", "Paused without session", null);

		const run = await getConversationRun(ctx.runId);
		expect(run?.sessionHandle).toBeNull();
	});
});

describe("completeConversation", () => {
	it("sets status='completed', run as 'completed', publishes conversation.completed", async () => {
		const ctx = await makeContext();

		await completeConversation(ctx, {
			exitCode: 0,
			tokens: { input: 100, output: 200, total: 300 },
			numTurns: 5,
		});

		const conv = await getConversation(ctx.conversationId);
		expect(conv?.status).toBe("completed");
		expect(conv?.completedAt).not.toBeNull();
		expect(conv?.tokens).toEqual({ input: 100, output: 200, total: 300 });

		const run = await getConversationRun(ctx.runId);
		expect(run?.status).toBe("completed");
		expect(run?.exitCode).toBe(0);
		expect(run?.tokens).toEqual({ input: 100, output: 200, total: 300 });
		expect(run?.numTurns).toBe(5);
		expect(run?.completedAt).not.toBeNull();

		const events = await readConversationEvents(ctx.conversationId);
		const completedEvent = events.find(
			(e) => e.type === "conversation.completed",
		);
		expect(completedEvent).toBeDefined();
		if (completedEvent?.type === "conversation.completed") {
			expect(completedEvent.payload.exitCode).toBe(0);
			expect(completedEvent.payload.runId).toBe(ctx.runId);
		}
	});

	it("aggregates tokens across all runs", async () => {
		const ctx1 = await makeContext({
			taskId: `vitest-agg-${Date.now()}`,
		});

		// First run uses 100 + 200 = 300 total
		await completeConversation(ctx1, {
			exitCode: 0,
			tokens: { input: 100, output: 200, total: 300 },
			numTurns: 3,
		});

		// Second run uses 50 + 50 = 100 total → aggregate should be 400
		const ctx2 = await startConversationForTask({
			taskId: `vitest-agg-${Date.now()}-cont`,
			agentId: "dev",
			model: "haiku",
			source: "task",
			projectId: null,
			missionId: null,
			continuationIndex: 1,
			resumeSessionId: null,
			existingConversationId: ctx1.conversationId,
		});

		await completeConversation(ctx2, {
			exitCode: 0,
			tokens: { input: 50, output: 50, total: 100 },
			numTurns: 2,
		});

		const conv = await getConversation(ctx1.conversationId);
		expect(conv?.tokens).toEqual({ input: 150, output: 250, total: 400 });
	});
});

describe("failConversation", () => {
	it("sets status='failed', run as 'failed', publishes conversation.error", async () => {
		const ctx = await makeContext();

		await failConversation(ctx, {
			message: "CLI binary not found",
			kind: "cli_not_found",
			exitCode: 1,
		});

		const conv = await getConversation(ctx.conversationId);
		expect(conv?.status).toBe("failed");
		expect(conv?.error).toBe("CLI binary not found");
		expect(conv?.errorKind).toBe("cli_not_found");

		const run = await getConversationRun(ctx.runId);
		expect(run?.status).toBe("failed");
		expect(run?.error).toBe("CLI binary not found");
		expect(run?.errorKind).toBe("cli_not_found");
		expect(run?.exitCode).toBe(1);
		expect(run?.completedAt).not.toBeNull();

		const events = await readConversationEvents(ctx.conversationId);
		const errorEvent = events.find((e) => e.type === "conversation.error");
		expect(errorEvent).toBeDefined();
		if (errorEvent?.type === "conversation.error") {
			expect(errorEvent.payload.error).toBe("CLI binary not found");
			expect(errorEvent.payload.errorKind).toBe("cli_not_found");
		}
	});
});

describe("updateRunMetrics", () => {
	it("updates run tokens + numTurns and aggregates conversation tokens", async () => {
		const ctx = await makeContext({
			taskId: `vitest-metrics-${Date.now()}`,
		});

		await updateRunMetrics(ctx, {
			tokens: { input: 100, output: 200, total: 300 },
			numTurns: 5,
		});

		const run = await getConversationRun(ctx.runId);
		expect(run?.tokens).toEqual({ input: 100, output: 200, total: 300 });
		expect(run?.numTurns).toBe(5);

		const conv = await getConversation(ctx.conversationId);
		expect(conv?.tokens).toEqual({ input: 100, output: 200, total: 300 });
	});

	it("aggregates tokens across multiple runs", async () => {
		const ctx1 = await makeContext({
			taskId: `vitest-metrics-agg-${Date.now()}`,
		});

		// First run
		await updateRunMetrics(ctx1, {
			tokens: { input: 200, output: 300, total: 500 },
			numTurns: 4,
		});

		// Second run
		const ctx2 = await startConversationForTask({
			taskId: `vitest-metrics-agg-${Date.now()}-cont`,
			agentId: "dev",
			model: null,
			source: "task",
			projectId: null,
			missionId: null,
			continuationIndex: 1,
			resumeSessionId: null,
			existingConversationId: ctx1.conversationId,
		});

		await updateRunMetrics(ctx2, {
			tokens: { input: 50, output: 50, cache: 10, total: 110 },
			numTurns: 2,
		});

		const conv = await getConversation(ctx1.conversationId);
		// 200+50=250 input, 300+50=350 output, 10 cache, 500+110=610 total
		expect(conv?.tokens).toEqual({
			input: 250,
			output: 350,
			cache: 10,
			total: 610,
		});

		const events = await readConversationEvents(ctx1.conversationId);
		const updateEvents = events.filter(
			(e) => e.type === "conversation.updated",
		);
		// Two runs → two updated events
		expect(updateEvents).toHaveLength(2);
	});
});

// ─── processStreamLine ──────────────────────────────────────────────────────

describe("processStreamLine", () => {
	it("system/init updates run sessionHandle", async () => {
		const ctx = await makeContext();

		await processStreamLine(ctx, {
			type: "system",
			subtype: "init",
			session_id: "sess_claude_001",
		});

		const run = await getConversationRun(ctx.runId);
		expect(run?.sessionHandle).toBe("sess_claude_001");
	});

	it("assistant message with text only appends turn with parts and publishes turn events", async () => {
		const ctx = await makeContext();

		await processStreamLine(ctx, {
			type: "assistant",
			message: {
				content: [{ type: "text", text: "Hello, world!" }],
			},
		});

		const turns = await readConversationTurns(ctx.conversationId);
		expect(turns).toHaveLength(1);
		expect(turns[0].role).toBe("assistant");
		expect(turns[0].content).toBe("Hello, world!");
		expect(turns[0].parts).toEqual([
			{ type: "text", content: "Hello, world!" },
		]);
		expect(turns[0].runId).toBe(ctx.runId);

		const events = await readConversationEvents(ctx.conversationId);
		const types = events.map((e) => e.type);
		expect(types).toContain("turn.started");
		expect(types).toContain("turn.completed");
		expect(types).not.toContain("tool.started");
	});

	it("assistant message with text + thinking builds parts correctly, content=text only", async () => {
		const ctx = await makeContext();

		await processStreamLine(ctx, {
			type: "assistant",
			message: {
				content: [
					{ type: "thinking", thinking: "I need to think..." },
					{ type: "text", text: "Here is my answer." },
				],
			},
		});

		const turns = await readConversationTurns(ctx.conversationId);
		expect(turns).toHaveLength(1);
		expect(turns[0].content).toBe("Here is my answer.");
		expect(turns[0].parts).toEqual([
			{ type: "thinking", content: "I need to think..." },
			{ type: "text", content: "Here is my answer." },
		]);
	});

	it("assistant message with tool_use populates toolCalls + parts and publishes tool.started events", async () => {
		const ctx = await makeContext();

		await processStreamLine(ctx, {
			type: "assistant",
			message: {
				content: [
					{
						type: "tool_use",
						id: "tu_abc123",
						name: "Bash",
						input: { command: "ls -la" },
					},
				],
			},
		});

		const turns = await readConversationTurns(ctx.conversationId);
		expect(turns).toHaveLength(1);
		expect(turns[0].toolCalls).toHaveLength(1);
		expect(turns[0].toolCalls?.[0]).toMatchObject({
			id: "tu_abc123",
			tool: "Bash",
			args: { command: "ls -la" },
			status: "running",
		});
		expect(turns[0].parts).toHaveLength(1);
		expect(turns[0].parts?.[0].type).toBe("tool_use");
		expect(turns[0].parts?.[0].toolCallId).toBe("tu_abc123");

		const events = await readConversationEvents(ctx.conversationId);
		const toolStarted = events.find((e) => e.type === "tool.started") as
			| { type: "tool.started"; payload: { toolCallId: string; tool: string } }
			| undefined;
		expect(toolStarted).toBeDefined();
		expect(toolStarted?.payload.toolCallId).toBe("tu_abc123");
		expect(toolStarted?.payload.tool).toBe("Bash");
	});

	it("user message (tool_result) publishes tool.completed event", async () => {
		const ctx = await makeContext();

		// First an assistant message with a tool_use (to set up state)
		await processStreamLine(ctx, {
			type: "assistant",
			message: {
				content: [
					{
						type: "tool_use",
						id: "tu_xyz",
						name: "Read",
						input: { path: "/tmp/test.txt" },
					},
				],
			},
		});

		// Then the tool_result
		await processStreamLine(ctx, {
			type: "user",
			message: {
				content: [
					{
						type: "tool_result",
						tool_use_id: "tu_xyz",
						content: "file contents here",
						is_error: false,
					},
				],
			},
		});

		const events = await readConversationEvents(ctx.conversationId);
		const toolCompleted = events.find((e) => e.type === "tool.completed") as
			| {
					type: "tool.completed";
					payload: {
						toolCallId: string;
						tool: string;
						status: string;
						result?: string;
					};
			  }
			| undefined;
		expect(toolCompleted).toBeDefined();
		expect(toolCompleted?.payload.toolCallId).toBe("tu_xyz");
		expect(toolCompleted?.payload.tool).toBe("Read");
		expect(toolCompleted?.payload.status).toBe("completed");
		expect(toolCompleted?.payload.result).toBe("file contents here");
	});

	it("result line calls updateRunMetrics with extracted tokens + num_turns", async () => {
		const ctx = await makeContext();

		await processStreamLine(ctx, {
			type: "result",
			subtype: "success",
			usage: {
				input_tokens: 500,
				output_tokens: 1000,
				cache_read_input_tokens: 50,
				cache_creation_input_tokens: 20,
			},
			num_turns: 7,
			session_id: "sess_999",
		});

		const run = await getConversationRun(ctx.runId);
		// 500 + 1000 + (50+20) = 1570
		expect(run?.tokens).toEqual({
			input: 500,
			output: 1000,
			cache: 70,
			total: 1570,
		});
		expect(run?.numTurns).toBe(7);

		const events = await readConversationEvents(ctx.conversationId);
		const updateEvent = events.find((e) => e.type === "conversation.updated");
		expect(updateEvent).toBeDefined();
	});

	it("assistant message turn.completed event includes content + parts snapshot (Bug #2)", async () => {
		const ctx = await makeContext();

		await processStreamLine(ctx, {
			type: "assistant",
			message: {
				content: [
					{ type: "text", text: "Hello, world!" },
					{ type: "thinking", thinking: "I am thinking..." },
				],
			},
		});

		const events = await readConversationEvents(ctx.conversationId);
		const completedEvent = events.find((e) => e.type === "turn.completed") as
			| {
					type: "turn.completed";
					payload: { turnId: string; content?: string; parts?: unknown[] };
			  }
			| undefined;
		expect(completedEvent).toBeDefined();
		expect(completedEvent?.payload.content).toBe("Hello, world!");
		expect(completedEvent?.payload.parts).toEqual([
			{ type: "text", content: "Hello, world!" },
			{ type: "thinking", content: "I am thinking..." },
		]);
	});

	it("unknown line type does not throw and logs warn (no event published)", async () => {
		const ctx = await makeContext();

		await expect(
			processStreamLine(ctx, { type: "rate_limit_event", data: "x" }),
		).resolves.not.toThrow();

		const events = await readConversationEvents(ctx.conversationId);
		// No events should have been published from this line
		expect(events).toHaveLength(1); // only the conversation.started from setup
	});
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe("processStreamLine edge cases", () => {
	it("multiple assistant messages produce multiple turns with monotonic turn numbers", async () => {
		const ctx = await makeContext();

		await processStreamLine(ctx, {
			type: "assistant",
			message: { content: [{ type: "text", text: "First" }] },
		});
		await processStreamLine(ctx, {
			type: "assistant",
			message: { content: [{ type: "text", text: "Second" }] },
		});
		await processStreamLine(ctx, {
			type: "assistant",
			message: { content: [{ type: "text", text: "Third" }] },
		});

		const turns = await readConversationTurns(ctx.conversationId);
		expect(turns).toHaveLength(3);
		expect(turns[0].turn).toBe(1);
		expect(turns[1].turn).toBe(2);
		expect(turns[2].turn).toBe(3);
		expect(turns[0].content).toBe("First");
		expect(turns[1].content).toBe("Second");
		expect(turns[2].content).toBe("Third");
	});

	it("tool result before any assistant message publishes tool.completed with fallback turnId and does not throw", async () => {
		const ctx = await makeContext();

		await expect(
			processStreamLine(ctx, {
				type: "user",
				message: {
					content: [
						{
							type: "tool_result",
							tool_use_id: "tu_orphan",
							content: "result without prior assistant",
							is_error: false,
						},
					],
				},
			}),
		).resolves.not.toThrow();

		const events = await readConversationEvents(ctx.conversationId);
		const toolCompleted = events.find((e) => e.type === "tool.completed");
		// Should still publish the event (UI handles merge)
		expect(toolCompleted).toBeDefined();
	});

	it("malformed line (non-JSON string) does not throw", async () => {
		const ctx = await makeContext();

		await expect(
			processStreamLine(ctx, "this is not json"),
		).resolves.not.toThrow();
		await expect(processStreamLine(ctx, 42)).resolves.not.toThrow();
		await expect(processStreamLine(ctx, null)).resolves.not.toThrow();

		// Only the conversation.started event from setup
		const events = await readConversationEvents(ctx.conversationId);
		expect(events).toHaveLength(1);
	});
});

// ─── Bug #6: sessionHandle readability after new run ─────────────────────

describe("sessionHandle persistence across runs", () => {
	it("previous run sessionHandle remains accessible after new startConversationForTask (Bug #6 scenario)", async () => {
		// Simulate: task runs, pauses for decision (saves sessionHandle)
		const ctx1 = await makeContext({
			taskId: `vitest-bug6-${Date.now()}`,
		});
		await pauseForDecision(ctx1, "dec-bug6", "Need input", "sess_saved_abc");

		// Verify sessionHandle was saved on the first run
		const run1 = await getConversationRun(ctx1.runId);
		expect(run1?.sessionHandle).toBe("sess_saved_abc");

		// Simulate: new run starts for the same task (resume)
		const ctx2 = await startConversationForTask({
			taskId: `vitest-bug6-${Date.now()}-resume`,
			agentId: "dev",
			model: null,
			source: "task",
			projectId: null,
			missionId: null,
			continuationIndex: 1,
			resumeSessionId: null,
			existingConversationId: ctx1.conversationId,
		});

		// The NEW run has sessionHandle: null (resumeSessionId wasn't passed)
		const newRun = await getConversationRun(ctx2.runId);
		expect(newRun?.sessionHandle).toBeNull();

		// The OLD run's sessionHandle is still accessible
		const oldRun = await getConversationRun(ctx1.runId);
		expect(oldRun?.sessionHandle).toBe("sess_saved_abc");

		// Conversation's currentRunId now points to the NEW run
		const conv = await getConversation(ctx1.conversationId);
		expect(conv?.currentRunId).toBe(ctx2.runId);

		// Key invariant: sessionHandle from previous run must be read
		// BEFORE startConversationForTask (Bug #6 fix in run-task.ts)
		// Here we verify the old run is still queryable by its own runId
	});
});
