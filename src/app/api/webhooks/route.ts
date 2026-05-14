/**
 * POST /api/webhooks
 *
 * Generic webhook endpoint for triggering background agent runs from external
 * services (Slack, GitHub, Gmail via Pub/Sub, etc.) or internal automations
 * (cron scripts, n8n, Zapier).
 *
 * Authentication: HMAC-SHA256 shared-secret via `X-Mandio-Signature: sha256=<hex>`.
 * Secret is read from `MANDIO_WEBHOOK_SECRET` env var; endpoint returns 503 if unset.
 *
 * The endpoint creates a Conversation (executionSource: "webhook", mode: "background"),
 * builds a user turn from the prompt + optional source/eventType/context, spawns
 * run-conversation.ts detached, and returns 202 Accepted.
 *
 * Body: WebhookTriggerInput (see src/lib/validations.ts)
 *
 * Trust boundary note:
 *   The `workspaceId` field overrides the header-derived workspace. With a shared
 *   MANDIO_WEBHOOK_SECRET, any caller can target any workspace by ID. For multi-workspace
 *   deployments, lock webhooks to the x-workspace-id header by omitting workspaceId from
 *   the body, or provision per-workspace secrets.
 *
 * Idempotency note:
 *   requestId deduplication is best-effort, not race-safe under concurrent identical
 *   deliveries. The check-and-record are not atomic — two concurrent requests with the
 *   same requestId may both create conversations before either's requestId is persisted.
 *
 * Returns:
 *   202 — conversation created and daemon spawned
 *   200 — idempotent replay (duplicate requestId)
 *   400 — invalid JSON or schema validation failure
 *   401 — missing or invalid signature
 *   413 — body too large (> 64 KiB)
 *   503 — webhooks disabled (MANDIO_WEBHOOK_SECRET not set)
 */

import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { publishAndEmit } from "@/lib/conversation-event-bus";
import {
	appendConversationTurn,
	createConversation,
	getConversationsFile,
	recordRequestId,
} from "@/lib/conversations";
import { resolveScriptEntrypoint } from "@/lib/script-entrypoints";
import type { Conversation } from "@/lib/types";
import type { WebhookTriggerInput } from "@/lib/validations";
import { webhookTriggerSchema } from "@/lib/validations";
import { verifyHmacSignature } from "@/lib/webhooks/signature";
import { applyWorkspaceContext } from "@/lib/workspace-context";
import { workspaceStore } from "@/lib/workspace-store";

/** Maximum raw body size accepted: 64 KiB */
const MAX_BODY_BYTES = 64 * 1024;

// ─── Prompt builder ────────────────────────────────────────────────────────

/**
 * Build the full user turn content from the webhook input.
 *
 * Wraps the caller's prompt with optional source/eventType metadata and
 * optional structured context as a fenced JSON block so the agent can
 * read it without parsing unstructured strings.
 *
 * Output shape:
 *   [Webhook: <source> — <eventType>]
 *   <prompt>
 *
 *   ```webhook-context
 *   <pretty-printed context>
 *   ```
 */
function buildWebhookPrompt(input: WebhookTriggerInput): string {
	const lines: string[] = [];

	// Header line: source + eventType
	if (input.source || input.eventType) {
		const parts: string[] = [];
		if (input.source) parts.push(`source=${input.source}`);
		if (input.eventType) parts.push(`event=${input.eventType}`);
		lines.push(`### ${parts.join(" — ")}`);
		lines.push("");
	}

	// Main prompt
	lines.push(input.prompt);

	// Fenced context block (if provided)
	if (input.context !== undefined) {
		lines.push("");
		lines.push("```webhook-context");
		lines.push(JSON.stringify(input.context, null, 2));
		lines.push("```");
	}

	return lines.join("\n");
}

export async function POST(request: Request) {
	// 1. Guard: webhooks are disabled unless secret is configured
	const secret = process.env.MANDIO_WEBHOOK_SECRET;
	if (!secret || secret.trim() === "") {
		return NextResponse.json({ error: "Webhooks disabled" }, { status: 503 });
	}

	// 2. Read raw body (needed for HMAC over exact bytes)
	const rawBody = await request.text();

	// 3. Enforce body size limit
	if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
		return NextResponse.json(
			{ error: "Request body too large" },
			{ status: 413 },
		);
	}

	// 4. Verify HMAC signature
	const signatureHeader = request.headers.get("x-mandio-signature");
	if (!verifyHmacSignature(rawBody, signatureHeader, secret)) {
		return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
	}

	// 5. Parse JSON
	let json: unknown;
	try {
		json = JSON.parse(rawBody);
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	// 6. Validate schema
	const parsed = webhookTriggerSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: parsed.error.issues[0]?.message ?? "Invalid body" },
			{ status: 400 },
		);
	}

	const input = parsed.data;

	// 7. Build the full prompt — wraps the caller's prompt with source context
	//    so the agent can read structured metadata without parsing strings.
	const fullPrompt = buildWebhookPrompt(input);

	// 8. Resolve workspace: use body.workspaceId if present, else header-derived
	return applyWorkspaceContext(async (headerWorkspaceId) => {
		const effectiveWorkspaceId = input.workspaceId ?? headerWorkspaceId;

		const run = async () => {
			// 8. Idempotency: if requestId already processed, return the existing conversation
			if (input.requestId) {
				const all = await getConversationsFile();
				const existing = all.conversations.find(
					(c) => !c.deletedAt && c.recentRequestIds.includes(input.requestId!),
				);
				if (existing) {
					return NextResponse.json(
						{ ok: true, conversationId: existing.id, idempotent: true },
						{ status: 200 },
					);
				}
			}

			// 9. Create conversation
			const conversation = await createConversation({
				title: input.title,
				agentId: input.agentId ?? null,
				model: input.model ?? null,
				mode: "background",
				executionSource: "webhook",
				taskId: null,
				status: "queued",
			});

			// 10. Append user turn with the built prompt (includes source context)
			const turn = await appendConversationTurn(conversation.id, {
				role: "user",
				content: fullPrompt,
			});

			// 11. Publish turn.started event
			await publishAndEmit({
				conversationId: conversation.id,
				type: "turn.started",
				payload: {
					turnId: turn.id,
					turn: turn.turn,
					role: "user",
				},
			});

			// 13. Publish conversation.updated event
			await publishAndEmit({
				conversationId: conversation.id,
				type: "conversation.updated",
				payload: {
					fields: {
						status: "queued" as Conversation["status"],
					},
				},
			});

			// 14. Spawn run-conversation.ts detached
			let spawnFailed = false;
			try {
				const entry = resolveScriptEntrypoint("run-conversation");
				const child = spawn(entry.runner, [...entry.args, conversation.id], {
					cwd: process.cwd(),
					detached: true,
					stdio: "ignore",
					shell: false,
					env: {
						...process.env,
						MANDIO_WORKSPACE_ID: effectiveWorkspaceId,
					},
				});
				child.unref();
			} catch (err) {
				spawnFailed = true;
				// Conversation stays queued — caller can retry with same requestId
				// (requestId is not recorded on failure, so retry will create a new
				// conversation rather than hitting idempotency)
				console.error(
					`[webhooks] Failed to spawn run-conversation for ${conversation.id}: ${err instanceof Error ? err.message : String(err)}`,
				);
			}

			// 15. Record requestId for idempotency (only if spawn succeeded)
			if (input.requestId && !spawnFailed) {
				await recordRequestId(conversation.id, input.requestId);
			}

			// 16. Return 202
			return NextResponse.json(
				{ ok: true, conversationId: conversation.id, status: "queued" },
				{ status: 202 },
			);
		};

		// Re-scope to body workspace if it differs from the header-derived one
		if (input.workspaceId && input.workspaceId !== headerWorkspaceId) {
			return workspaceStore.run(input.workspaceId, run);
		}

		return run();
	});
}
