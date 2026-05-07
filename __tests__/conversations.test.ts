import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	appendConversationTurn,
	createConversation,
	createConversationRun,
	getConversation,
	getConversationRun,
	getCurrentSeq,
	hasRecentRequestId,
	listConversations,
	listRunsForConversation,
	mutateConversationsFile,
	publishConversationEvent,
	readConversationEvents,
	readConversationTurns,
	reapStaleRuns,
	recordRequestId,
	seqFilePath,
	setConversationsWorkspace,
	softDeleteConversation,
	updateConversation,
	updateConversationRun,
} from "@/lib/conversations";
import { backupDataFiles, restoreDataFiles } from "./helpers";

let backups: Record<string, string>;

beforeAll(async () => {
	backups = await backupDataFiles();
	setConversationsWorkspace("default");
});

afterAll(async () => {
	await restoreDataFiles(backups);
});

// ─── Create Conversation ─────────────────────────────────────────────────────

describe("createConversation", () => {
	it("creates a conversation with version=1, default empty arrays, status='idle'", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-1`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		expect(conv.version).toBe(1);
		expect(conv.status).toBe("idle");
		expect(conv.artifactRefs).toEqual([]);
		expect(conv.mentionedPaths).toEqual([]);
		expect(conv.attachmentPaths).toEqual([]);
		expect(conv.recentRequestIds).toEqual([]);
		expect(conv.tokens).toEqual({ input: 0, output: 0, total: 0 });
		expect(conv.runCount).toBe(0);
		expect(conv.turnCount).toBe(0);
		expect(conv.currentRunId).toBeNull();
		expect(conv.error).toBeNull();
		expect(conv.errorKind).toBeNull();
		expect(conv.pausedReason).toBeNull();
		expect(conv.pausedDecisionId).toBeNull();
		expect(conv.summary).toBeNull();
		expect(conv.startedAt).toBeNull();
		expect(conv.completedAt).toBeNull();
		expect(conv.cancelledAt).toBeNull();
		expect(conv.archivedAt).toBeNull();
		expect(conv.deletedAt).toBeNull();
		expect(conv.pausedAt).toBeNull();
	});

	it("generates an id with 'conv_' prefix", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-2`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		expect(conv.id).toMatch(/^conv_/);
	});

	it("persists to conversations.json (verify via getConversation)", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-3`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		const fetched = await getConversation(conv.id);
		expect(fetched).not.toBeNull();
		expect(fetched?.id).toBe(conv.id);
		expect(fetched?.title).toBe(conv.title);
		expect(fetched?.mode).toBe("foreground");
		expect(fetched?.executionSource).toBe("chat");
	});

	it("creates the per-conversation directory", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-4`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		const sPath = seqFilePath(conv.id);
		const convDir = path.dirname(sPath);
		expect(existsSync(convDir)).toBe(true);
	});
});

// ─── Get Conversation / List Conversations ───────────────────────────────────

describe("getConversation / listConversations", () => {
	it("getConversation returns null for unknown id", async () => {
		const result = await getConversation("conv_nonexistent_test_id");
		expect(result).toBeNull();
	});

	it("listConversations excludes soft-deleted by default", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-deleted`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await softDeleteConversation(conv.id);
		const list = await listConversations();
		expect(list.find((c) => c.id === conv.id)).toBeUndefined();
	});

	it("listConversations excludes archived by default", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-archived`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await updateConversation(conv.id, {
			archivedAt: new Date().toISOString(),
		});
		const list = await listConversations();
		expect(list.find((c) => c.id === conv.id)).toBeUndefined();
	});

	it("listConversations filters by taskId", async () => {
		const taskId = `vitest-task-${Date.now()}`;
		const conv = await createConversation({
			title: `vitest-${Date.now()}-filter-task`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
			taskId,
		});
		const list = await listConversations({ taskId });
		expect(list.find((c) => c.id === conv.id)).toBeDefined();
		// Should not match other taskId
		const other = await listConversations({ taskId: "nonexistent-task" });
		expect(other.find((c) => c.id === conv.id)).toBeUndefined();
	});

	it("listConversations filters by status", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-filter-status`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
			status: "running",
		});
		const list = await listConversations({ status: "running" });
		expect(list.find((c) => c.id === conv.id)).toBeDefined();
		const idle = await listConversations({ status: "idle" });
		expect(idle.find((c) => c.id === conv.id)).toBeUndefined();
	});

	it("listConversations filters by mode", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-filter-mode`,
			agentId: null,
			model: null,
			mode: "background",
			executionSource: "chat",
		});
		const list = await listConversations({ mode: "background" });
		expect(list.find((c) => c.id === conv.id)).toBeDefined();
		const foreground = await listConversations({ mode: "foreground" });
		expect(foreground.find((c) => c.id === conv.id)).toBeUndefined();
	});

	it("listConversations filters by source", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-filter-source`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "task",
		});
		const list = await listConversations({ source: "task" });
		expect(list.find((c) => c.id === conv.id)).toBeDefined();
		const chat = await listConversations({ source: "chat" });
		expect(chat.find((c) => c.id === conv.id)).toBeUndefined();
	});
});

// ─── Update Conversation ─────────────────────────────────────────────────────

describe("updateConversation", () => {
	it("patches fields and bumps updatedAt", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-update-1`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		const before = conv.updatedAt;

		// Ensure enough time passes so the new timestamp differs
		await new Promise((r) => setTimeout(r, 5));

		const updated = await updateConversation(conv.id, {
			title: "updated-title",
			summary: "a test summary",
		});
		expect(updated).not.toBeNull();
		expect(updated?.title).toBe("updated-title");
		expect(updated?.summary).toBe("a test summary");
		expect(updated?.updatedAt).not.toBe(before);

		// Verify persistence
		const fetched = await getConversation(conv.id);
		expect(fetched?.title).toBe("updated-title");
		expect(fetched?.summary).toBe("a test summary");
	});

	it("returns null for unknown id", async () => {
		const result = await updateConversation("conv_nonexistent_test_id", {
			title: "noop",
		});
		expect(result).toBeNull();
	});

	it("does not affect other conversations", async () => {
		const conv1 = await createConversation({
			title: `vitest-${Date.now()}-update-other-1`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		const conv2 = await createConversation({
			title: `vitest-${Date.now()}-update-other-2`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await updateConversation(conv1.id, { title: "only-conv1-changed" });

		const c1 = await getConversation(conv1.id);
		expect(c1?.title).toBe("only-conv1-changed");

		const c2 = await getConversation(conv2.id);
		expect(c2?.title).not.toBe("only-conv1-changed");
	});
});

// ─── Soft Delete ─────────────────────────────────────────────────────────────

describe("softDeleteConversation", () => {
	it("sets deletedAt", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-softdel-1`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		const ok = await softDeleteConversation(conv.id);
		expect(ok).toBe(true);

		const fetched = await getConversation(conv.id);
		expect(fetched).not.toBeNull();
		expect(fetched?.deletedAt).not.toBeNull();
		expect(typeof fetched?.deletedAt).toBe("string");
	});

	it("conversation no longer appears in listConversations()", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-softdel-2`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await softDeleteConversation(conv.id);
		const list = await listConversations();
		expect(list.find((c) => c.id === conv.id)).toBeUndefined();
	});

	it("still appears with includeDeleted: true", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-softdel-3`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await softDeleteConversation(conv.id);
		const list = await listConversations({ includeDeleted: true });
		expect(list.find((c) => c.id === conv.id)).toBeDefined();
	});
});

// ─── Create Conversation Run ─────────────────────────────────────────────────

describe("createConversationRun", () => {
	it("creates a run with 'run_' prefix id, status='starting', continuationIndex defaulting to 0", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-run-1`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		const run = await createConversationRun({
			conversationId: conv.id,
			source: "chat",
		});
		expect(run.id).toMatch(/^run_/);
		expect(run.status).toBe("starting");
		expect(run.continuationIndex).toBe(0);
		expect(run.conversationId).toBe(conv.id);
	});

	it("sets conversation.currentRunId to the new run id", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-run-2`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		const run = await createConversationRun({
			conversationId: conv.id,
			source: "chat",
		});
		const fetched = await getConversation(conv.id);
		expect(fetched?.currentRunId).toBe(run.id);
	});

	it("increments conversation.runCount", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-run-3`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		expect(conv.runCount).toBe(0);

		await createConversationRun({
			conversationId: conv.id,
			source: "chat",
		});
		const c1 = await getConversation(conv.id);
		expect(c1?.runCount).toBe(1);

		await createConversationRun({
			conversationId: conv.id,
			source: "chat",
		});
		const c2 = await getConversation(conv.id);
		expect(c2?.runCount).toBe(2);
	});
});

// ─── Update Conversation Run / List Runs ─────────────────────────────────────

describe("updateConversationRun / listRunsForConversation", () => {
	it("updateConversationRun patches a run", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-upd-run-1`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		const run = await createConversationRun({
			conversationId: conv.id,
			source: "chat",
		});
		const updated = await updateConversationRun(run.id, {
			status: "completed",
			exitCode: 0,
		});
		expect(updated).not.toBeNull();
		expect(updated?.status).toBe("completed");
		expect(updated?.exitCode).toBe(0);

		// Verify persisted
		const fetched = await getConversationRun(run.id);
		expect(fetched?.status).toBe("completed");
		expect(fetched?.exitCode).toBe(0);
	});

	it("listRunsForConversation returns runs sorted by continuationIndex", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-list-runs`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		const run0 = await createConversationRun({
			conversationId: conv.id,
			source: "chat",
			continuationIndex: 0,
		});
		const run2 = await createConversationRun({
			conversationId: conv.id,
			source: "chat",
			continuationIndex: 2,
		});
		const run1 = await createConversationRun({
			conversationId: conv.id,
			source: "chat",
			continuationIndex: 1,
		});

		const runs = await listRunsForConversation(conv.id);
		expect(runs.map((r) => r.continuationIndex)).toEqual([0, 1, 2]);
		expect(runs.map((r) => r.id)).toEqual([run0.id, run1.id, run2.id]);
	});
});

// ─── Append Conversation Turn ────────────────────────────────────────────────

describe("appendConversationTurn", () => {
	it("appends turns with monotonically increasing turn numbers (1, 2, 3...)", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-turn-seq`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		const t1 = await appendConversationTurn(conv.id, {
			role: "user",
			content: "first",
		});
		expect(t1.turn).toBe(1);

		const t2 = await appendConversationTurn(conv.id, {
			role: "assistant",
			content: "second",
		});
		expect(t2.turn).toBe(2);

		const t3 = await appendConversationTurn(conv.id, {
			role: "user",
			content: "third",
		});
		expect(t3.turn).toBe(3);
	});

	it("persists to turns.jsonl", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-turn-persist`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await appendConversationTurn(conv.id, {
			role: "user",
			content: "persist-me",
		});

		const filePath = path.join(
			path.dirname(seqFilePath(conv.id)),
			"turns.jsonl",
		);
		const raw = await readFile(filePath, "utf-8");
		const lines = raw.trim().split("\n");
		expect(lines).toHaveLength(1);
		const parsed = JSON.parse(lines[0]);
		expect(parsed.content).toBe("persist-me");
		expect(parsed.turn).toBe(1);
	});

	it("increments conversation.turnCount", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-turn-count`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		expect(conv.turnCount).toBe(0);

		await appendConversationTurn(conv.id, {
			role: "user",
			content: "a",
		});
		const c1 = await getConversation(conv.id);
		expect(c1?.turnCount).toBe(1);

		await appendConversationTurn(conv.id, {
			role: "assistant",
			content: "b",
		});
		const c2 = await getConversation(conv.id);
		expect(c2?.turnCount).toBe(2);
	});

	it("throws if conversation doesn't exist", async () => {
		await expect(
			appendConversationTurn("conv_nonexistent_test_id", {
				role: "user",
				content: "boom",
			}),
		).rejects.toThrow("Conversation not found");
	});

	it("readConversationTurns returns all appended turns in order", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-turn-readall`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await appendConversationTurn(conv.id, {
			role: "user",
			content: "hello",
		});
		await appendConversationTurn(conv.id, {
			role: "assistant",
			content: "world",
		});
		await appendConversationTurn(conv.id, {
			role: "user",
			content: "again",
		});

		const turns = await readConversationTurns(conv.id);
		expect(turns).toHaveLength(3);
		expect(turns[0].content).toBe("hello");
		expect(turns[0].turn).toBe(1);
		expect(turns[1].content).toBe("world");
		expect(turns[1].turn).toBe(2);
		expect(turns[2].content).toBe("again");
		expect(turns[2].turn).toBe(3);
	});
});

// ─── Publish / Read Events ───────────────────────────────────────────────────

describe("publishConversationEvent / readConversationEvents", () => {
	it("publishConversationEvent assigns monotonic seq starting at 1", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-event-seq1`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		const event = await publishConversationEvent({
			conversationId: conv.id,
			type: "conversation.started",
			payload: { runId: "test-run", source: "chat" },
		});
		expect(event.seq).toBe(1);
		expect(event.conversationId).toBe(conv.id);
		expect(event.type).toBe("conversation.started");
	});

	it("multiple events get sequential seq numbers", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-event-seqN`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		const e1 = await publishConversationEvent({
			conversationId: conv.id,
			type: "turn.started",
			payload: { turnId: "t1", turn: 1, role: "user" },
		});
		const e2 = await publishConversationEvent({
			conversationId: conv.id,
			type: "turn.started",
			payload: { turnId: "t2", turn: 2, role: "assistant" },
		});
		const e3 = await publishConversationEvent({
			conversationId: conv.id,
			type: "turn.started",
			payload: { turnId: "t3", turn: 3, role: "user" },
		});
		expect(e1.seq).toBe(1);
		expect(e2.seq).toBe(2);
		expect(e3.seq).toBe(3);
	});

	it("readConversationEvents returns all events", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-event-readall`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await publishConversationEvent({
			conversationId: conv.id,
			type: "conversation.started",
			payload: { runId: "r1", source: "chat" },
		});
		await publishConversationEvent({
			conversationId: conv.id,
			type: "turn.started",
			payload: { turnId: "t1", turn: 1, role: "user" },
		});

		const events = await readConversationEvents(conv.id);
		expect(events).toHaveLength(2);
		expect(events[0].seq).toBe(1);
		expect(events[1].seq).toBe(2);
	});

	it("readConversationEvents with afterSeq filter returns only events after that seq", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-event-after`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await publishConversationEvent({
			conversationId: conv.id,
			type: "turn.started",
			payload: { turnId: "t1", turn: 1, role: "user" },
		});
		await publishConversationEvent({
			conversationId: conv.id,
			type: "turn.started",
			payload: { turnId: "t2", turn: 2, role: "user" },
		});
		await publishConversationEvent({
			conversationId: conv.id,
			type: "turn.started",
			payload: { turnId: "t3", turn: 3, role: "user" },
		});

		const after1 = await readConversationEvents(conv.id, { afterSeq: 1 });
		expect(after1).toHaveLength(2);
		expect(after1[0].seq).toBe(2);
		expect(after1[1].seq).toBe(3);

		const after3 = await readConversationEvents(conv.id, { afterSeq: 3 });
		expect(after3).toHaveLength(0);
	});

	it("seq is durable: simulate 'restart' by reading seq.txt directly and verifying it matches highest seq", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-event-durable`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		// Publish 4 events — highest seq should be 4
		for (let i = 0; i < 4; i++) {
			await publishConversationEvent({
				conversationId: conv.id,
				type: "turn.started",
				payload: { turnId: `t${i}`, turn: i + 1, role: "user" },
			});
		}

		// Read the seq file directly (simulates a restart)
		const sPath = seqFilePath(conv.id);
		const raw = await readFile(sPath, "utf-8");
		const seqFromFile = parseInt(raw.trim(), 10);
		expect(seqFromFile).toBe(4);

		// getCurrentSeq should also agree
		const seq = await getCurrentSeq(conv.id);
		expect(seq).toBe(4);
	});
});

// ─── Idempotency ─────────────────────────────────────────────────────────────

describe("Idempotency: hasRecentRequestId / recordRequestId", () => {
	it("initially returns false for any requestId", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-idem-init`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		expect(await hasRecentRequestId(conv.id, "req-abc")).toBe(false);
		expect(await hasRecentRequestId(conv.id, "req-xyz")).toBe(false);
	});

	it("after recordRequestId, hasRecentRequestId returns true", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-idem-record`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await recordRequestId(conv.id, "req-abc");
		expect(await hasRecentRequestId(conv.id, "req-abc")).toBe(true);
	});

	it("recording the same requestId twice doesn't duplicate", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-idem-dedup`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await recordRequestId(conv.id, "req-dup");
		await recordRequestId(conv.id, "req-dup");

		const fetched = await getConversation(conv.id);
		if (!fetched) throw new Error("Expected conversation to exist");
		const count = fetched.recentRequestIds.filter(
			(id) => id === "req-dup",
		).length;
		expect(count).toBe(1);
	});

	it("cap at 10 entries (record 11+ and verify oldest is dropped)", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-idem-cap`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		for (let i = 0; i < 11; i++) {
			await recordRequestId(conv.id, `req-${i}`);
		}

		const fetched = await getConversation(conv.id);
		expect(fetched?.recentRequestIds).toHaveLength(10);
		// "req-0" should be dropped, "req-1" through "req-10" remain
		expect(fetched?.recentRequestIds[0]).toBe("req-1");
		expect(fetched?.recentRequestIds[9]).toBe("req-10");
	});
});

// ─── Concurrency ─────────────────────────────────────────────────────────────

describe("Concurrency: per-conversation locking", () => {
	it("5 parallel appendConversationTurn calls produce turn numbers 1..5 with no gaps or duplicates, and final turnCount is 5", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-concurrency`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		const promises = Array.from({ length: 5 }, (_, i) =>
			appendConversationTurn(conv.id, {
				role: "user",
				content: `msg-${i}`,
			}),
		);
		const turns = await Promise.all(promises);

		const turnNumbers = turns.map((t) => t.turn).sort((a, b) => a - b);
		expect(turnNumbers).toEqual([1, 2, 3, 4, 5]);

		const fetched = await getConversation(conv.id);
		expect(fetched?.turnCount).toBe(5);

		const allTurns = await readConversationTurns(conv.id);
		expect(allTurns).toHaveLength(5);
		expect(allTurns.map((t) => t.turn)).toEqual([1, 2, 3, 4, 5]);
	});
});

// ─── Stale Run Reaper ─────────────────────────────────────────────────────────

describe("reapStaleRuns", () => {
	beforeEach(async () => {
		// Clear conversations index so leftover state from previous tests
		// doesn't cause unexpected reaping.
		await mutateConversationsFile(async (data) => {
			data.conversations = [];
			data.runs = {};
		});
	});
	it("reaps conversation with status='running' and dead pid", async () => {
		const conv = await createConversation({
			title: `vitest-reap-deadpid-${Date.now()}`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
			status: "running",
		});
		const run = await createConversationRun({
			conversationId: conv.id,
			source: "chat",
		});
		// Set the run pid to a non-existent PID and mark as running
		await updateConversationRun(run.id, {
			pid: 999999,
			status: "running",
		});

		const count = await reapStaleRuns({ gracePeriodMs: 0 });

		expect(count).toBe(1);

		const updatedConv = await getConversation(conv.id);
		expect(updatedConv?.status).toBe("failed");
		expect(updatedConv?.errorKind).toBe("unknown");
		expect(updatedConv?.currentRunId).toBeNull();

		const updatedRun = await getConversationRun(run.id);
		expect(updatedRun?.status).toBe("failed");
		expect(updatedRun?.error).toBe("Process not running (crash recovery)");
	});

	it("does NOT reap conversation with running process (test runner's pid)", async () => {
		const conv = await createConversation({
			title: `vitest-reap-alive-${Date.now()}`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
			status: "running",
		});
		const run = await createConversationRun({
			conversationId: conv.id,
			source: "chat",
		});
		await updateConversationRun(run.id, {
			pid: process.pid,
			status: "running",
		});

		const count = await reapStaleRuns({ gracePeriodMs: 0 });

		expect(count).toBe(0);

		const updatedConv = await getConversation(conv.id);
		expect(updatedConv?.status).toBe("running");
	});

	it("does NOT reap conversation with status='starting' + pid null + young (< gracePeriod)", async () => {
		const conv = await createConversation({
			title: `vitest-reap-young-${Date.now()}`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
			status: "starting",
		});
		await createConversationRun({
			conversationId: conv.id,
			source: "chat",
		});
		// Run has pid: null by default, status: "starting" by default
		// created just now so it's well within the default 10s grace period

		const count = await reapStaleRuns();

		expect(count).toBe(0);

		const updatedConv = await getConversation(conv.id);
		expect(updatedConv?.status).toBe("starting");
	});

	it("reaps conversation with status='starting' + pid null + older than gracePeriod", async () => {
		const conv = await createConversation({
			title: `vitest-reap-old-nullpid-${Date.now()}`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
			status: "starting",
		});
		const run = await createConversationRun({
			conversationId: conv.id,
			source: "chat",
		});
		// Manually backdate the run's startedAt to be well past the grace period
		await mutateConversationsFile((data) => {
			const r = data.runs[run.id];
			if (r) {
				r.startedAt = new Date(Date.now() - 60_000).toISOString();
			}
			return;
		});

		const count = await reapStaleRuns({ gracePeriodMs: 1000 });

		expect(count).toBe(1);

		const updatedConv = await getConversation(conv.id);
		expect(updatedConv?.status).toBe("failed");
	});

	it("does NOT reap conversation with terminal status (completed)", async () => {
		await createConversation({
			title: `vitest-reap-terminal-${Date.now()}`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
			status: "completed",
		});

		const count = await reapStaleRuns({ gracePeriodMs: 0 });

		expect(count).toBe(0);
	});

	it("publishes conversation.error event for reaped conversation", async () => {
		const conv = await createConversation({
			title: `vitest-reap-event-${Date.now()}`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
			status: "running",
		});
		const run = await createConversationRun({
			conversationId: conv.id,
			source: "chat",
		});
		await updateConversationRun(run.id, {
			pid: 999998,
			status: "running",
		});

		await reapStaleRuns({ gracePeriodMs: 0 });

		// Verify a conversation.error event was published
		const events = await readConversationEvents(conv.id);
		const errorEvents = events.filter((e) => e.type === "conversation.error");
		expect(errorEvents.length).toBe(1);
		const errEvt = errorEvents[0];
		if (errEvt.type === "conversation.error") {
			expect(errEvt.payload.error).toBe("Process not running (crash recovery)");
			expect(errEvt.payload.errorKind).toBe("unknown");
			expect(errEvt.payload.runId).toBe(run.id);
		}
	});

	it("returns correct count (dead pid + old null pid = 2)", async () => {
		const conv1 = await createConversation({
			title: `vitest-reap-count1-${Date.now()}`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
			status: "running",
		});
		const run1 = await createConversationRun({
			conversationId: conv1.id,
			source: "chat",
		});
		await updateConversationRun(run1.id, { pid: 999997, status: "running" });

		const conv2 = await createConversation({
			title: `vitest-reap-count2-${Date.now()}`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
			status: "starting",
		});
		const run2 = await createConversationRun({
			conversationId: conv2.id,
			source: "chat",
		});
		// Backdate run2 to be old
		await mutateConversationsFile((data) => {
			const r = data.runs[run2.id];
			if (r) {
				r.startedAt = new Date(Date.now() - 60_000).toISOString();
			}
			return;
		});

		const count = await reapStaleRuns({ gracePeriodMs: 1000 });

		expect(count).toBe(2);
	});

	it("is idempotent: second call returns 0", async () => {
		const conv = await createConversation({
			title: `vitest-reap-idempotent-${Date.now()}`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
			status: "running",
		});
		const run = await createConversationRun({
			conversationId: conv.id,
			source: "chat",
		});
		await updateConversationRun(run.id, { pid: 999996, status: "running" });

		const first = await reapStaleRuns({ gracePeriodMs: 0 });
		expect(first).toBe(1);

		const second = await reapStaleRuns({ gracePeriodMs: 0 });
		expect(second).toBe(0);
	});
});
