import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	_clearWatchers,
	_watcherCount,
	emitLocal,
	publishAndEmit,
	subscribe,
	subscribeLocal,
} from "@/lib/conversation-event-bus";
import {
	createConversation,
	publishConversationEvent,
	setConversationsWorkspace,
} from "@/lib/conversations";
import type { ConversationEvent } from "@/lib/types";
import { backupDataFiles, restoreDataFiles } from "./helpers";

let backups: Record<string, string>;

beforeAll(async () => {
	backups = await backupDataFiles();
	setConversationsWorkspace("default");
});

afterAll(async () => {
	_clearWatchers();
	await restoreDataFiles(backups);
});

afterEach(() => {
	_clearWatchers();
});

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeTestEvent(
	conversationId: string,
	seq = 1,
	ts?: string,
): ConversationEvent {
	return {
		conversationId,
		type: "turn.started",
		ts: ts ?? new Date().toISOString(),
		seq,
		payload: { turnId: "t1", turn: 1, role: "user" },
	} as ConversationEvent;
}

// ─── emitLocal / subscribeLocal ───────────────────────────────────────────

describe("emitLocal / subscribeLocal", () => {
	it("subscriber receives events for its conversationId", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-local-1`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		const received: ConversationEvent[] = [];
		const unsub = subscribeLocal(conv.id, (e) => received.push(e));

		emitLocal(makeTestEvent(conv.id, 1));

		expect(received).toHaveLength(1);
		expect(received[0].seq).toBe(1);
		expect(received[0].conversationId).toBe(conv.id);

		unsub();
	});

	it("subscriber does not receive events for other conversationIds", async () => {
		const conv1 = await createConversation({
			title: `vitest-${Date.now()}-local-other-1`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		const conv2 = await createConversation({
			title: `vitest-${Date.now()}-local-other-2`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		const received: ConversationEvent[] = [];
		const unsub = subscribeLocal(conv1.id, (e) => received.push(e));

		emitLocal(makeTestEvent(conv2.id, 1));

		expect(received).toHaveLength(0);

		unsub();
	});

	it("unsubscribe stops delivery", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-local-unsub`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		const received: ConversationEvent[] = [];
		const unsub = subscribeLocal(conv.id, (e) => received.push(e));

		unsub();

		emitLocal(makeTestEvent(conv.id, 1));

		expect(received).toHaveLength(0);
	});
});

// ─── File-watching ────────────────────────────────────────────────────────

describe("file-watching", () => {
	it("subscribe + publishConversationEvent delivers event via file watcher", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-fw-1`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		const received: ConversationEvent[] = [];
		const unsub = subscribe(conv.id, (e) => received.push(e));

		// Give the file watcher a moment to initialise
		await new Promise((r) => setTimeout(r, 100));

		// Write via publishConversationEvent (NOT publishAndEmit) to simulate
		// a cross-process write (e.g. the daemon writing events.jsonl)
		await publishConversationEvent({
			conversationId: conv.id,
			type: "turn.started",
			payload: { turnId: "t1", turn: 1, role: "user" },
		});

		// Wait for the file watcher to detect the change, read the file, and emit
		await new Promise((r) => setTimeout(r, 500));

		expect(received.length).toBeGreaterThanOrEqual(1);
		expect(received[0].conversationId).toBe(conv.id);
		expect(received[0].type).toBe("turn.started");

		unsub();
	});

	it("multiple subscribers to same conversation all receive each event", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-fw-multi`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		const received1: ConversationEvent[] = [];
		const received2: ConversationEvent[] = [];
		const unsub1 = subscribe(conv.id, (e) => received1.push(e));
		const unsub2 = subscribe(conv.id, (e) => received2.push(e));

		await new Promise((r) => setTimeout(r, 100));

		await publishConversationEvent({
			conversationId: conv.id,
			type: "turn.started",
			payload: { turnId: "t1", turn: 1, role: "user" },
		});

		await new Promise((r) => setTimeout(r, 500));

		expect(received1.length).toBeGreaterThanOrEqual(1);
		expect(received2.length).toBeGreaterThanOrEqual(1);
		expect(received1[0].seq).toBe(received2[0].seq);

		unsub1();
		unsub2();
	});

	it("watcher is cleaned up after last subscriber unsubscribes", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-fw-cleanup`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		const unsub = subscribe(conv.id, () => {});

		// Allow watcher to initialise
		await new Promise((r) => setTimeout(r, 50));

		expect(_watcherCount()).toBe(1);

		unsub();

		// After unsubscribe, the watcher should be removed synchronously
		expect(_watcherCount()).toBe(0);
	});
});

// ─── publishAndEmit ───────────────────────────────────────────────────────

describe("publishAndEmit", () => {
	it("delivers synchronously to local subscribers", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-pae-1`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		let received: ConversationEvent | null = null;
		const unsub = subscribeLocal(conv.id, (e) => {
			received = e;
		});

		const before = Date.now();
		const full = await publishAndEmit({
			conversationId: conv.id,
			type: "turn.started",
			payload: { turnId: "t1", turn: 1, role: "user" },
		});
		const after = Date.now();

		expect(received).not.toBeNull();
		// The local subscriber gets the exact same event object
		const event = received as unknown as ConversationEvent;
		expect(event.seq).toBe(full.seq);
		expect(event.conversationId).toBe(full.conversationId);
		expect(event.type).toBe(full.type);
		// Delivery should be near-instant (< 50ms) because there is no
		// file-watcher round-trip for local subscribers
		expect(after - before).toBeLessThan(50);

		unsub();
	});
});

// ─── Cross-process simulation ─────────────────────────────────────────────

describe("cross-process simulation", () => {
	it("file write by 'daemon' triggers subscribed listener", async () => {
		const conv = await createConversation({
			title: `vitest-${Date.now()}-cross-1`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		const received: ConversationEvent[] = [];
		const unsub = subscribe(conv.id, (e) => received.push(e));

		await new Promise((r) => setTimeout(r, 100));

		// Simulate daemon writing to events.jsonl via the persistence layer
		await publishConversationEvent({
			conversationId: conv.id,
			type: "conversation.started",
			payload: { runId: "daemon-run-001", source: "chat" },
		});

		await new Promise((r) => setTimeout(r, 500));

		expect(received.length).toBeGreaterThanOrEqual(1);
		expect(received[0].type).toBe("conversation.started");
		expect(received[0].conversationId).toBe(conv.id);
		// Verify the payload survived the round-trip through JSON
		const started = received[0] as ConversationEvent & {
			type: "conversation.started";
		};
		expect(started.payload.runId).toBe("daemon-run-001");

		unsub();
	});
});
