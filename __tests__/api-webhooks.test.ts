/**
 * Integration tests for POST /api/webhooks
 *
 * Validates the webhook endpoint end-to-end: signature verification,
 * schema validation, conversation creation, daemon spawn, idempotency.
 */

import { createHmac } from "node:crypto";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { _clearWatchers } from "@/lib/conversation-event-bus";
import {
	getConversation,
	readConversationTurns,
	setConversationsWorkspace,
} from "@/lib/conversations";
import { backupDataFiles, restoreDataFiles } from "./helpers";

// ─── Mocks ─────────────────────────────────────────────────────────────────
// vi.mock() factories are hoisted above imports; use vi.hoisted() for shared
// mock references that the factory closure needs to capture.
const { spawnMock } = vi.hoisted(() => ({
	spawnMock: vi.fn(() => ({ unref: vi.fn() })),
}));

vi.mock("@/lib/workspace-context", () => ({
	applyWorkspaceContext: vi
		.fn()
		.mockImplementation((fn: (id: string) => Promise<unknown>) =>
			fn("default"),
		),
}));

vi.mock("node:child_process", () => ({
	spawn: spawnMock,
}));

// ─── Constants ──────────────────────────────────────────────────────────────

const TEST_SECRET = "test-webhook-secret-abc123";
const BASE_URL = "http://localhost";

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeSignature(body: string, secret = TEST_SECRET): string {
	return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function makeWebhookRequest(
	body: unknown,
	opts: {
		secret?: string;
		signature?: string | null;
		headers?: Record<string, string>;
	} = {},
): Request {
	const rawBody = JSON.stringify(body);
	const sig =
		opts.signature !== undefined
			? opts.signature
			: computeSignature(rawBody, opts.secret ?? TEST_SECRET);

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...(sig !== null ? { "x-mandio-signature": sig } : {}),
		...opts.headers,
	};

	return new Request(`${BASE_URL}/api/webhooks`, {
		method: "POST",
		headers,
		body: rawBody,
	});
}

// ─── Import route handler after mocks are set ────────────────────────────────

import { POST } from "@/app/api/webhooks/route";

// ─── Setup / Teardown ───────────────────────────────────────────────────────

let backups: Record<string, string>;
const originalSecret = process.env.MANDIO_WEBHOOK_SECRET;

beforeAll(async () => {
	backups = await backupDataFiles();
	setConversationsWorkspace("default");
	process.env.MANDIO_WEBHOOK_SECRET = TEST_SECRET;
});

afterAll(async () => {
	_clearWatchers();
	await restoreDataFiles(backups);
	if (originalSecret === undefined) {
		delete process.env.MANDIO_WEBHOOK_SECRET;
	} else {
		process.env.MANDIO_WEBHOOK_SECRET = originalSecret;
	}
});

beforeEach(() => {
	spawnMock.mockClear();
});

afterEach(() => {
	_clearWatchers();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/webhooks", () => {
	// ── Authentication / guard ─────────────────────────────────────────────

	it("returns 503 when MANDIO_WEBHOOK_SECRET is not set", async () => {
		const saved = process.env.MANDIO_WEBHOOK_SECRET;
		delete process.env.MANDIO_WEBHOOK_SECRET;
		try {
			const res = await POST(makeWebhookRequest({ title: "t", prompt: "p" }));
			expect(res.status).toBe(503);
			const body = await res.json();
			expect(body.error).toBe("Webhooks disabled");
		} finally {
			process.env.MANDIO_WEBHOOK_SECRET = saved;
		}
	});

	it("returns 503 when MANDIO_WEBHOOK_SECRET is an empty string", async () => {
		const saved = process.env.MANDIO_WEBHOOK_SECRET;
		process.env.MANDIO_WEBHOOK_SECRET = "";
		try {
			const res = await POST(makeWebhookRequest({ title: "t", prompt: "p" }));
			expect(res.status).toBe(503);
		} finally {
			process.env.MANDIO_WEBHOOK_SECRET = saved;
		}
	});

	it("returns 401 when X-Mandio-Signature header is missing", async () => {
		const res = await POST(
			makeWebhookRequest({ title: "t", prompt: "p" }, { signature: null }),
		);
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error).toBe("Invalid signature");
	});

	it("returns 401 when X-Mandio-Signature header is wrong", async () => {
		const res = await POST(
			makeWebhookRequest(
				{ title: "t", prompt: "p" },
				{ secret: "wrong-secret" },
			),
		);
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error).toBe("Invalid signature");
	});

	// ── Body validation ────────────────────────────────────────────────────

	it("returns 400 for invalid JSON body (valid signature)", async () => {
		const rawBody = "not-json-at-all";
		const sig = computeSignature(rawBody);
		const res = await POST(
			new Request(`${BASE_URL}/api/webhooks`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-mandio-signature": sig,
				},
				body: rawBody,
			}),
		);
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Invalid JSON");
	});

	it("returns 400 when title is missing", async () => {
		const res = await POST(makeWebhookRequest({ prompt: "do something" }));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBeDefined();
	});

	it("returns 400 when prompt is missing", async () => {
		const res = await POST(makeWebhookRequest({ title: "My webhook" }));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBeDefined();
	});

	it("returns 400 when prompt is blank whitespace only", async () => {
		const res = await POST(
			makeWebhookRequest({ title: "My webhook", prompt: "   " }),
		);
		expect(res.status).toBe(400);
	});

	it("returns 413 when body exceeds 64 KiB", async () => {
		const oversized = {
			title: "big",
			prompt: "a".repeat(64 * 1024 + 1),
		};
		const rawBody = JSON.stringify(oversized);
		const sig = computeSignature(rawBody);
		const res = await POST(
			new Request(`${BASE_URL}/api/webhooks`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-mandio-signature": sig,
				},
				body: rawBody,
			}),
		);
		expect(res.status).toBe(413);
	});

	// ── Happy path ─────────────────────────────────────────────────────────

	it("returns 202 with conversationId on valid request", async () => {
		const res = await POST(
			makeWebhookRequest({
				title: "Webhook test",
				prompt: "Summarize the latest activity",
			}),
		);
		expect(res.status).toBe(202);
		const body = await res.json();
		expect(body.ok).toBe(true);
		expect(typeof body.conversationId).toBe("string");
		expect(body.conversationId).toMatch(/^conv_/);
		expect(body.status).toBe("queued");
	});

	it("creates conversation with executionSource=webhook and mode=background", async () => {
		const res = await POST(
			makeWebhookRequest({
				title: "Source check",
				prompt: "Test source",
			}),
		);
		expect(res.status).toBe(202);
		const { conversationId } = await res.json();

		const conv = await getConversation(conversationId);
		expect(conv).not.toBeNull();
		expect(conv?.executionSource).toBe("webhook");
		expect(conv?.mode).toBe("background");
		expect(conv?.status).toBe("queued");
	});

	it("appends a user turn containing the prompt", async () => {
		const prompt = "Please do the thing";
		const res = await POST(makeWebhookRequest({ title: "Turn check", prompt }));
		expect(res.status).toBe(202);
		const { conversationId } = await res.json();

		const turns = await readConversationTurns(conversationId);
		expect(turns.length).toBe(1);
		expect(turns[0].role).toBe("user");
		expect(turns[0].content).toContain(prompt.trim());
	});

	it("trims whitespace from the prompt in the stored turn", async () => {
		const res = await POST(
			makeWebhookRequest({
				title: "Trim check",
				prompt: "  trimmed prompt  ",
			}),
		);
		expect(res.status).toBe(202);
		const { conversationId } = await res.json();

		const turns = await readConversationTurns(conversationId);
		expect(turns[0].content).toContain("trimmed prompt");
		expect(turns[0].content).not.toContain("  trimmed prompt  ");
	});

	it("stores agentId and model on the conversation when provided", async () => {
		const res = await POST(
			makeWebhookRequest({
				title: "Agent model check",
				prompt: "Do something",
				agentId: "my-agent",
				model: "claude-opus-4-5",
			}),
		);
		expect(res.status).toBe(202);
		const { conversationId } = await res.json();

		const conv = await getConversation(conversationId);
		expect(conv?.agentId).toBe("my-agent");
		expect(conv?.model).toBe("claude-opus-4-5");
	});

	it("spawns run-conversation with the conversationId as argument", async () => {
		const res = await POST(
			makeWebhookRequest({ title: "Spawn check", prompt: "Run me" }),
		);
		expect(res.status).toBe(202);
		const { conversationId } = await res.json();

		expect(spawnMock).toHaveBeenCalledOnce();
		const [, args] = spawnMock.mock.calls[0] as [string, string[], unknown];
		expect(args).toContain(conversationId);
	});

	it("calls child.unref() so the daemon is detached", async () => {
		const unrefMock = vi.fn();
		spawnMock.mockReturnValueOnce({ unref: unrefMock });

		await POST(makeWebhookRequest({ title: "Unref check", prompt: "Run" }));

		expect(unrefMock).toHaveBeenCalledOnce();
	});

	// ── Prompt builder (source / eventType / context) ────────────────────

	it("includes source and eventType in the user turn when provided", async () => {
		const res = await POST(
			makeWebhookRequest({
				title: "Source check",
				prompt: "Handle this event",
				source: "slack",
				eventType: "message.channels",
			}),
		);
		expect(res.status).toBe(202);
		const { conversationId } = await res.json();
		const turns = await readConversationTurns(conversationId);
		expect(turns[0].content).toContain("source=slack");
		expect(turns[0].content).toContain("event=message.channels");
	});

	it("includes fenced context JSON in the user turn when context is provided", async () => {
		const context = { channel: "alerts", user: "U123", priority: "high" };
		const res = await POST(
			makeWebhookRequest({
				title: "Context check",
				prompt: "Process notification",
				context,
			}),
		);
		expect(res.status).toBe(202);
		const { conversationId } = await res.json();
		const turns = await readConversationTurns(conversationId);
		expect(turns[0].content).toContain("```webhook-context");
		expect(turns[0].content).toContain('"channel": "alerts"');
		expect(turns[0].content).toContain('"priority": "high"');
	});

	it("omits the context block when context is not provided", async () => {
		const res = await POST(
			makeWebhookRequest({ title: "No context", prompt: "Do it" }),
		);
		expect(res.status).toBe(202);
		const { conversationId } = await res.json();
		const turns = await readConversationTurns(conversationId);
		expect(turns[0].content).not.toContain("```webhook-context");
	});

	// ── Source validation ────────────────────────────────────────────────

	it("returns 400 when source is not a valid slug", async () => {
		const res = await POST(
			makeWebhookRequest({
				title: "Bad source",
				prompt: "Test",
				source: "Slack/Channel",
			}),
		);
		expect(res.status).toBe(400);
	});

	it("accepts valid source slugs", async () => {
		const res = await POST(
			makeWebhookRequest({
				title: "Good source",
				prompt: "Test",
				source: "gmail-pubsub",
			}),
		);
		expect(res.status).toBe(202);
	});

	// ── Context size limit ───────────────────────────────────────────────

	it("returns 400 when context JSON exceeds the size limit", async () => {
		// Build a context object that serializes to more than 8192 bytes
		const context = {
			items: Array.from(
				{ length: 500 },
				(_, i) => `item-${i}-${"x".repeat(20)}`,
			),
		};
		const payload = { title: "Oversized context", prompt: "Test", context };
		const rawBody = JSON.stringify(payload);
		const sig = computeSignature(rawBody);
		const res = await POST(
			new Request(`${BASE_URL}/api/webhooks`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-mandio-signature": sig,
				},
				body: rawBody,
			}),
		);
		expect(res.status).toBe(400);
	});

	// ── Prompt size limit (20,000 chars) ─────────────────────────────────

	it("accepts prompts up to 20,000 characters", async () => {
		const largePrompt = "a".repeat(20000);
		const payload = { title: "Large prompt", prompt: largePrompt };
		const rawBody = JSON.stringify(payload);
		const sig = computeSignature(rawBody);
		const res = await POST(
			new Request(`${BASE_URL}/api/webhooks`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-mandio-signature": sig,
				},
				body: rawBody,
			}),
		);
		expect(res.status).toBe(202);
	});

	it("returns 400 when prompt exceeds 20,000 characters", async () => {
		const oversized = "a".repeat(20001);
		const payload = { title: "Over prompt", prompt: oversized };
		const rawBody = JSON.stringify(payload);
		const sig = computeSignature(rawBody);
		const res = await POST(
			new Request(`${BASE_URL}/api/webhooks`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-mandio-signature": sig,
				},
				body: rawBody,
			}),
		);
		expect(res.status).toBe(400);
	});

	// ── Idempotency ────────────────────────────────────────────────────────

	it("returns 200 with idempotent=true on duplicate requestId", async () => {
		const requestId = `req-webhook-${Date.now()}`;
		const payload = { title: "Idempotent", prompt: "First", requestId };

		// First call — should succeed
		const res1 = await POST(makeWebhookRequest(payload));
		expect(res1.status).toBe(202);
		const body1 = await res1.json();
		const firstConvId = body1.conversationId;

		// Second call — idempotent replay
		const res2 = await POST(makeWebhookRequest(payload));
		expect(res2.status).toBe(200);
		const body2 = await res2.json();
		expect(body2.ok).toBe(true);
		expect(body2.idempotent).toBe(true);
		expect(body2.conversationId).toBe(firstConvId);

		// Spawn should only be called once (not on replay)
		expect(spawnMock).toHaveBeenCalledOnce();
	});

	it("processes a new request when requestId differs", async () => {
		const res1 = await POST(
			makeWebhookRequest({
				title: "Diff requestId",
				prompt: "First",
				requestId: `req-a-${Date.now()}`,
			}),
		);
		expect(res1.status).toBe(202);

		const res2 = await POST(
			makeWebhookRequest({
				title: "Diff requestId",
				prompt: "Second",
				requestId: `req-b-${Date.now()}`,
			}),
		);
		expect(res2.status).toBe(202);

		// Two separate spawns
		expect(spawnMock).toHaveBeenCalledTimes(2);
	});

	// ── Signature format ───────────────────────────────────────────────────

	it("accepts a bare hex signature without sha256= prefix", async () => {
		const rawBody = JSON.stringify({
			title: "Bare hex",
			prompt: "Test bare hex signature",
		});
		const bareHex = createHmac("sha256", TEST_SECRET)
			.update(rawBody)
			.digest("hex");
		const res = await POST(
			new Request(`${BASE_URL}/api/webhooks`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-mandio-signature": bareHex,
				},
				body: rawBody,
			}),
		);
		expect(res.status).toBe(202);
	});

	// ── Spawn failure ──────────────────────────────────────────────────────

	it("still returns 202 when spawn throws (conversation stays queued)", async () => {
		spawnMock.mockImplementationOnce(() => {
			throw new Error("spawn ENOENT");
		});

		const res = await POST(
			makeWebhookRequest({ title: "Spawn fail", prompt: "Run anyway" }),
		);
		// The route logs the error but still returns 202 (conversation was created)
		expect(res.status).toBe(202);
		const body = await res.json();

		// Conversation should still exist in a queued state
		const conv = await getConversation(body.conversationId);
		expect(conv).not.toBeNull();
		expect(conv?.status).toBe("queued");
	});
});
