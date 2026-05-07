import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	_clearWatchers,
	publishAndEmit,
	subscribe,
} from "@/lib/conversation-event-bus";
import {
	createConversation,
	createConversationRun,
	getConversation,
	getConversationRun,
	getCurrentSeq,
	setConversationsWorkspace,
	softDeleteConversation,
	updateConversation,
	updateConversationRun,
} from "@/lib/conversations";
import { backupDataFiles, restoreDataFiles } from "./helpers";

// Mock workspace context so routes don't call next/headers
vi.mock("@/lib/workspace-context", () => ({
	applyWorkspaceContext: vi.fn().mockResolvedValue("default"),
}));

// Prevent continue route from spawning real run-conversation child processes
// that would race on conversations.json across process boundaries.
vi.mock("node:child_process", () => ({
	spawn: vi.fn(() => ({ unref: vi.fn() })),
}));

import { POST as cancelPost } from "@/app/api/conversations/[id]/cancel/route";
// Route handlers (imported after mock is active)
import { POST as continuePost } from "@/app/api/conversations/[id]/continue/route";
import { GET as eventsGet } from "@/app/api/conversations/[id]/events/route";

// ─── Helpers ────────────────────────────────────────────────────────────

function makeUrl(path: string): string {
	return `http://localhost${path}`;
}

function makeContinueRequest(
	id: string,
	body: { userMessage: string; requestId?: string },
): Request {
	return new Request(makeUrl(`/api/conversations/${id}/continue`), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function makeCancelRequest(id: string, body?: { reason?: string }): Request {
	return new Request(makeUrl(`/api/conversations/${id}/cancel`), {
		method: "POST",
		headers: body ? { "Content-Type": "application/json" } : undefined,
		body: body ? JSON.stringify(body) : undefined,
	});
}

function makeEventsRequest(id: string, lastEventId?: number): Request {
	const search = lastEventId !== undefined ? `?lastEventId=${lastEventId}` : "";
	return new Request(makeUrl(`/api/conversations/${id}/events${search}`));
}

const params = (id: string) => Promise.resolve({ id });

/**
 * Read N SSE events from a ReadableStream reader.
 * Splits by "\n\n" to find event boundaries.
 */
async function readSSEEvents(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	count: number,
	abortAfter = 8000,
): Promise<string[]> {
	const decoder = new TextDecoder();
	let buffer = "";
	const events: string[] = [];
	const deadline = Date.now() + abortAfter;

	while (events.length < count && Date.now() < deadline) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });

		// Extract complete SSE events (terminated by \n\n)
		while (buffer.includes("\n\n")) {
			const idx = buffer.indexOf("\n\n");
			const part = buffer.slice(0, idx);
			buffer = buffer.slice(idx + 2);
			if (part.trim()) {
				events.push(part);
				if (events.length >= count) break;
			}
		}
	}
	return events;
}

/** Parse a single SSE event part into structured fields. */
interface ParsedSSE {
	event?: string;
	id?: number;
	data: unknown;
}

function parseSSE(ssePart: string): ParsedSSE {
	const lines = ssePart.split("\n");
	let event: string | undefined;
	let id: number | undefined;
	let data: unknown;
	for (const line of lines) {
		if (line.startsWith("event: ")) {
			event = line.slice(7);
		} else if (line.startsWith("id: ")) {
			id = parseInt(line.slice(4), 10);
		} else if (line.startsWith("data: ")) {
			try {
				data = JSON.parse(line.slice(6));
			} catch {
				data = line.slice(6);
			}
		}
	}
	return { event, id, data };
}

// ─── Setup / Teardown ───────────────────────────────────────────────────

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

// ─── continue: POST /api/conversations/[id]/continue ────────────────────

describe("POST /api/conversations/[id]/continue", () => {
	it("returns 202 on success with turnId", async () => {
		const conv = await createConversation({
			title: "continue-test-202",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		const response = await continuePost(
			makeContinueRequest(conv.id, { userMessage: "Hello" }),
			{ params: params(conv.id) },
		);

		expect(response.status).toBe(202);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(body.turnId).toBeDefined();
		expect(typeof body.turnId).toBe("string");
	});

	it("appends user turn and sets status to queued", async () => {
		const conv = await createConversation({
			title: "continue-test-turn",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		await continuePost(
			makeContinueRequest(conv.id, { userMessage: "Test message" }),
			{ params: params(conv.id) },
		);

		const updated = await getConversation(conv.id);
		expect(updated).not.toBeNull();
		expect(updated?.status).toBe("queued");
		expect(updated?.turnCount).toBe(1);
		expect(updated?.pausedReason).toBeNull();
		expect(updated?.pausedDecisionId).toBeNull();
	});

	it("returns 404 for non-existent conversation", async () => {
		const response = await continuePost(
			makeContinueRequest("conv_nonexistent_test_id", { userMessage: "Hi" }),
			{ params: params("conv_nonexistent_test_id") },
		);
		expect(response.status).toBe(404);
	});

	it("returns 404 for soft-deleted conversation", async () => {
		const conv = await createConversation({
			title: "continue-test-deleted",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await softDeleteConversation(conv.id);

		const response = await continuePost(
			makeContinueRequest(conv.id, { userMessage: "Hi" }),
			{ params: params(conv.id) },
		);
		expect(response.status).toBe(404);
	});

	it("returns 409 when conversation is already running", async () => {
		const conv = await createConversation({
			title: "continue-test-409",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await updateConversation(conv.id, {
			status: "running",
			currentRunId: "run_active_test",
		});

		const response = await continuePost(
			makeContinueRequest(conv.id, { userMessage: "Hi" }),
			{ params: params(conv.id) },
		);
		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.error).toBeDefined();
		expect(body.currentRunId).toBe("run_active_test");
	});

	it("returns 409 when status is 'starting'", async () => {
		const conv = await createConversation({
			title: "continue-test-starting",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await updateConversation(conv.id, {
			status: "starting",
			currentRunId: "run_starting_test",
		});

		const response = await continuePost(
			makeContinueRequest(conv.id, { userMessage: "Hi" }),
			{ params: params(conv.id) },
		);
		expect(response.status).toBe(409);
	});

	it("allows continue when conversation is idle (no active run)", async () => {
		const conv = await createConversation({
			title: "continue-test-idle",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		const response = await continuePost(
			makeContinueRequest(conv.id, { userMessage: "Continue me" }),
			{ params: params(conv.id) },
		);
		expect(response.status).toBe(202);
	});

	it("returns 400 when userMessage is missing", async () => {
		const conv = await createConversation({
			title: "continue-test-400",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		const response = await continuePost(
			new Request(makeUrl(`/api/conversations/${conv.id}/continue`), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			}),
			{ params: params(conv.id) },
		);
		expect(response.status).toBe(400);
	});

	it("returns 200 idempotent when requestId was already processed", async () => {
		const conv = await createConversation({
			title: "continue-test-idem",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		const requestId = `req-${Date.now()}`;

		// First call — should succeed
		const resp1 = await continuePost(
			makeContinueRequest(conv.id, { userMessage: "First", requestId }),
			{ params: params(conv.id) },
		);
		expect(resp1.status).toBe(202);

		// Second call with same requestId — idempotent
		const resp2 = await continuePost(
			makeContinueRequest(conv.id, { userMessage: "Second", requestId }),
			{ params: params(conv.id) },
		);
		expect(resp2.status).toBe(200);
		const body2 = await resp2.json();
		expect(body2.idempotent).toBe(true);
	});

	it("still processes continue when requestId is different from previous", async () => {
		const conv = await createConversation({
			title: "continue-test-diff-idem",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		await continuePost(
			makeContinueRequest(conv.id, {
				userMessage: "First",
				requestId: "req-aaa",
			}),
			{ params: params(conv.id) },
		);

		// Different requestId should succeed normally
		const resp2 = await continuePost(
			makeContinueRequest(conv.id, {
				userMessage: "Second",
				requestId: "req-bbb",
			}),
			{ params: params(conv.id) },
		);
		expect(resp2.status).toBe(202);
	});

	it("publishes turn.started and conversation.updated events", async () => {
		const conv = await createConversation({
			title: "continue-test-events",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		// Collect events that are published via the event bus
		const received: Array<{ type: string; seq?: number }> = [];
		const unsub = subscribe(conv.id, (e) => {
			received.push({ type: e.type, seq: e.seq });
		});

		// Small delay for file watcher init
		await new Promise((r) => setTimeout(r, 100));

		await continuePost(
			makeContinueRequest(conv.id, { userMessage: "Event check" }),
			{ params: params(conv.id) },
		);

		// Wait for any file-watcher-based delivery
		await new Promise((r) => setTimeout(r, 500));

		expect(received.length).toBeGreaterThanOrEqual(2);
		const types = received.map((e) => e.type);
		expect(types).toContain("turn.started");
		expect(types).toContain("conversation.updated");

		unsub();
	});

	it("clears pausedReason and pausedDecisionId", async () => {
		const conv = await createConversation({
			title: "continue-test-clear-paused",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await updateConversation(conv.id, {
			status: "awaiting-decision",
			pausedReason: "Need input",
			pausedDecisionId: "dec_test_id",
		});

		await continuePost(
			makeContinueRequest(conv.id, { userMessage: "Resume" }),
			{ params: params(conv.id) },
		);

		const updated = await getConversation(conv.id);
		expect(updated?.status).toBe("queued");
		expect(updated?.pausedReason).toBeNull();
		expect(updated?.pausedDecisionId).toBeNull();
	});
});

// ─── cancel: POST /api/conversations/[id]/cancel ────────────────────────

describe("POST /api/conversations/[id]/cancel", () => {
	it("returns 404 for non-existent conversation", async () => {
		const response = await cancelPost(
			makeCancelRequest("conv_nonexistent_test_id"),
			{ params: params("conv_nonexistent_test_id") },
		);
		expect(response.status).toBe(404);
	});

	it.each([
		"completed",
		"failed",
		"cancelled",
	] as const)("returns 200 with alreadyTerminal=true if conversation is %s", async (status) => {
		const conv = await createConversation({
			title: `cancel-test-${status}`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await updateConversation(conv.id, { status });

		const response = await cancelPost(makeCancelRequest(conv.id), {
			params: params(conv.id),
		});
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.alreadyTerminal).toBe(true);
	});

	it("sets status to cancelled, sets cancelledAt, clears currentRunId", async () => {
		const conv = await createConversation({
			title: "cancel-test-update",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await updateConversation(conv.id, {
			status: "running",
			currentRunId: "run_cancel_test",
		});

		const response = await cancelPost(makeCancelRequest(conv.id), {
			params: params(conv.id),
		});
		expect(response.status).toBe(200);

		const updated = await getConversation(conv.id);
		expect(updated?.status).toBe("cancelled");
		expect(updated?.cancelledAt).not.toBeNull();
		expect(typeof updated?.cancelledAt).toBe("string");
		expect(updated?.currentRunId).toBeNull();
	});

	it("publishes conversation.cancelled event", async () => {
		const conv = await createConversation({
			title: "cancel-test-event",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});
		await updateConversation(conv.id, { status: "running" });

		const received: Array<{ type: string; payload?: unknown }> = [];
		const unsub = subscribe(conv.id, (e) => {
			received.push({ type: e.type, payload: e.payload });
		});

		await new Promise((r) => setTimeout(r, 100));

		await cancelPost(makeCancelRequest(conv.id, { reason: "User requested" }), {
			params: params(conv.id),
		});

		await new Promise((r) => setTimeout(r, 500));

		const cancelledEvents = received.filter(
			(e) => e.type === "conversation.cancelled",
		);
		expect(cancelledEvents.length).toBeGreaterThanOrEqual(1);
		expect(cancelledEvents[0].payload).toBeDefined();

		unsub();
	});

	it("calls process.kill for active run with PID", async () => {
		const killSpy = vi
			.spyOn(process, "kill")
			.mockImplementation(() => true as true);

		try {
			const conv = await createConversation({
				title: "cancel-test-pid-kill",
				agentId: null,
				model: null,
				mode: "foreground",
				executionSource: "chat",
			});

			// Create a run with a dummy PID
			const run = await createConversationRun({
				conversationId: conv.id,
				source: "chat",
			});
			await updateConversationRun(run.id, { pid: 99999 });
			// conversation.currentRunId was already set by createConversationRun

			const response = await cancelPost(makeCancelRequest(conv.id), {
				params: params(conv.id),
			});
			expect(response.status).toBe(200);

			// process.kill should have been called to check liveness (pid, 0)
			// and then SIGTERM
			expect(killSpy).toHaveBeenCalledWith(99999, 0);
			expect(killSpy).toHaveBeenCalledWith(99999, "SIGTERM");

			// The run should be marked stopped
			const updatedRun = await getConversationRun(run.id);
			expect(updatedRun).not.toBeNull();
			expect(updatedRun?.status).toBe("stopped");
			expect(updatedRun?.completedAt).not.toBeNull();
		} finally {
			killSpy.mockRestore();
		}
	});

	it("updates run status to stopped even when process.kill throws ESRCH", async () => {
		// Mock process.kill to throw ESRCH (process already gone)
		const esrchError = Object.assign(new Error("ESRCH"), { code: "ESRCH" });
		const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
			throw esrchError;
		});

		try {
			const conv = await createConversation({
				title: "cancel-test-esrch",
				agentId: null,
				model: null,
				mode: "foreground",
				executionSource: "chat",
			});

			const run = await createConversationRun({
				conversationId: conv.id,
				source: "chat",
			});
			await updateConversationRun(run.id, { pid: 99998 });

			const response = await cancelPost(makeCancelRequest(conv.id), {
				params: params(conv.id),
			});
			expect(response.status).toBe(200);

			// Run should still be marked stopped despite ESRCH
			const updatedRun = await getConversationRun(run.id);
			expect(updatedRun?.status).toBe("stopped");

			const updated = await getConversation(conv.id);
			expect(updated?.status).toBe("cancelled");
		} finally {
			killSpy.mockRestore();
		}
	});

	it("succeeds even when no currentRunId is set", async () => {
		const conv = await createConversation({
			title: "cancel-test-no-run",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		const response = await cancelPost(makeCancelRequest(conv.id), {
			params: params(conv.id),
		});
		expect(response.status).toBe(200);

		const updated = await getConversation(conv.id);
		expect(updated?.status).toBe("cancelled");
	});
});

// ─── events SSE: GET /api/conversations/[id]/events ─────────────────────

describe("GET /api/conversations/[id]/events (SSE)", () => {
	it("returns text/event-stream headers", async () => {
		const conv = await createConversation({
			title: "sse-test-headers",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		const response = await eventsGet(makeEventsRequest(conv.id), {
			params: params(conv.id),
		});

		expect(response.headers.get("Content-Type")).toBe("text/event-stream");
		expect(response.headers.get("Cache-Control")).toBe(
			"no-cache, no-transform",
		);
		expect(response.headers.get("X-Accel-Buffering")).toBe("no");
	});

	it("sends an initial ping event", async () => {
		const conv = await createConversation({
			title: "sse-test-ping",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		const ac = new AbortController();
		const request = new Request(
			makeUrl(`/api/conversations/${conv.id}/events`),
			{
				signal: ac.signal,
			},
		);
		const response = await eventsGet(request, { params: params(conv.id) });

		const body = response.body;
		if (!body) throw new Error("Response body missing");
		const reader = body.getReader();
		const events = await readSSEEvents(reader, 1);
		ac.abort();
		reader.cancel().catch(() => {});
		await new Promise((r) => setTimeout(r, 50));

		expect(events.length).toBeGreaterThanOrEqual(1);
		const parsed = parseSSE(events[0]);
		expect(parsed.event).toBe("ping");
		expect(parsed.data).toBeDefined();
	});

	it("replays events after Last-Event-ID", async () => {
		const conv = await createConversation({
			title: "sse-test-replay",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		// Publish 3 events
		await publishAndEmit({
			conversationId: conv.id,
			type: "turn.started",
			payload: { turnId: "t1", turn: 1, role: "user" },
		});
		await publishAndEmit({
			conversationId: conv.id,
			type: "turn.started",
			payload: { turnId: "t2", turn: 2, role: "assistant" },
		});
		await publishAndEmit({
			conversationId: conv.id,
			type: "turn.started",
			payload: { turnId: "t3", turn: 3, role: "user" },
		});

		// Verify seq: 1, 2, 3
		const seq = await getCurrentSeq(conv.id);
		expect(seq).toBe(3);

		// GET with Last-Event-ID=1 — should get back events with seq 2 and 3
		const ac = new AbortController();
		const request = new Request(
			makeUrl(`/api/conversations/${conv.id}/events`),
			{
				signal: ac.signal,
				headers: { "Last-Event-ID": "1" },
			},
		);
		const response = await eventsGet(request, { params: params(conv.id) });

		const body = response.body;
		if (!body) throw new Error("Response body missing");
		const reader = body.getReader();
		// Expect: ping + 2 replayed events = 3 total
		const events = await readSSEEvents(reader, 3);
		ac.abort();
		reader.cancel().catch(() => {});
		await new Promise((r) => setTimeout(r, 50));

		// First should be ping
		expect(parseSSE(events[0]).event).toBe("ping");

		// Next two should be the replayed events (seq 2 and 3)
		const evt1 = parseSSE(events[1]);
		const evt2 = parseSSE(events[2]);

		expect(evt1.id).toBe(2);
		expect(evt1.data).toBeDefined();
		expect(evt2.id).toBe(3);
		expect(evt2.data).toBeDefined();
	});

	it("delivers live events after subscription", async () => {
		const conv = await createConversation({
			title: "sse-test-live",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		const ac = new AbortController();
		const request = new Request(
			makeUrl(`/api/conversations/${conv.id}/events`),
			{
				signal: ac.signal,
			},
		);
		const response = await eventsGet(request, { params: params(conv.id) });

		const body = response.body;
		if (!body) throw new Error("Response body missing");
		const reader = body.getReader();

		// Read the initial ping first
		const pingEvents = await readSSEEvents(reader, 1);
		expect(pingEvents.length).toBeGreaterThanOrEqual(1);
		expect(parseSSE(pingEvents[0]).event).toBe("ping");

		// Now publish a new event while SSE is connected
		const published = await publishAndEmit({
			conversationId: conv.id,
			type: "turn.started",
			payload: { turnId: "t_live", turn: 1, role: "user" },
		});

		// Read the live event
		const liveEvents = await readSSEEvents(reader, 1);
		ac.abort();
		reader.cancel().catch(() => {});
		await new Promise((r) => setTimeout(r, 50));

		expect(liveEvents.length).toBeGreaterThanOrEqual(1);
		const parsed = parseSSE(liveEvents[0]);
		expect(parsed.id).toBe(published.seq);
		expect(parsed.data).toBeDefined();
	});

	it("avoids duplicate events from replay + live overlap", async () => {
		const conv = await createConversation({
			title: "sse-test-dedup",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		// Publish a first event
		await publishAndEmit({
			conversationId: conv.id,
			type: "turn.started",
			payload: { turnId: "t1", turn: 1, role: "user" },
		});

		// Connect SSE with ?lastEventId=0 (no replay)
		const ac = new AbortController();
		const request = new Request(
			makeUrl(`/api/conversations/${conv.id}/events`),
			{
				signal: ac.signal,
			},
		);
		const response = await eventsGet(request, { params: params(conv.id) });

		const body = response.body;
		if (!body) throw new Error("Response body missing");
		const reader = body.getReader();

		// Read ping
		await readSSEEvents(reader, 1);

		// Publish two more events
		await publishAndEmit({
			conversationId: conv.id,
			type: "turn.started",
			payload: { turnId: "t2", turn: 2, role: "assistant" },
		});
		await publishAndEmit({
			conversationId: conv.id,
			type: "turn.completed",
			payload: { turnId: "t2" },
		});

		// Read — should get exactly 2 events (no duplicates)
		const liveEvents = await readSSEEvents(reader, 2);
		ac.abort();
		reader.cancel().catch(() => {});
		await new Promise((r) => setTimeout(r, 50));

		const seenSeqs = new Set<number>();
		for (const evt of liveEvents) {
			const parsed = parseSSE(evt);
			if (parsed.id !== undefined) {
				expect(seenSeqs.has(parsed.id)).toBe(false);
				seenSeqs.add(parsed.id);
			}
		}
		expect(seenSeqs.size).toBe(2);
	});

	it("cleans up subscriber on abort", async () => {
		const conv = await createConversation({
			title: "sse-test-cleanup",
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "chat",
		});

		const ac = new AbortController();
		const request = new Request(
			makeUrl(`/api/conversations/${conv.id}/events`),
			{
				signal: ac.signal,
			},
		);

		const response = await eventsGet(request, { params: params(conv.id) });
		const body = response.body;
		if (!body) throw new Error("Response body missing");
		const reader = body.getReader();

		// Read something to ensure the stream is active and start() ran
		const events = await readSSEEvents(reader, 1);
		expect(events.length).toBeGreaterThanOrEqual(1);

		// Abort the connection — the SSE route's abort listener should fire,
		// unsubscribe from the event bus, and close the stream.
		ac.abort();
		// After abort the stream is either closed (reader returns done:true)
		// or errored (reader throws). Either means cleanup ran.
		try {
			const { done } = await reader.read();
			// If the read succeeds, the stream should be done
			expect(done).toBe(true);
		} catch {
			// Stream was already errored/closed — also fine, cleanup succeeded
		}
	});
});
