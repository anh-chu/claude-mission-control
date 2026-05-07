import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { publishAndEmit } from "@/lib/conversation-event-bus";
import {
	appendConversationTurn,
	getConversation,
	hasRecentRequestId,
	recordRequestId,
	updateConversation,
} from "@/lib/conversations";
import { resolveScriptEntrypoint } from "@/lib/script-entrypoints";
import type { Conversation } from "@/lib/types";
import { applyWorkspaceContext } from "@/lib/workspace-context";

/**
 * POST /api/conversations/[id]/continue
 *
 * Submit a follow-up user turn. Queues the conversation for execution.
 * For foreground chat (no taskId), spawns run-conversation.ts as a detached
 * process immediately.
 *
 * Body: { userMessage: string, requestId?: string }
 *
 * Returns:
 *   202 — turn queued
 *   200 — idempotent (duplicate requestId, no-op)
 *   409 — conversation already has an active run
 *   404 — conversation not found or soft-deleted
 */

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	await applyWorkspaceContext();
	const { id } = await params;

	// 1. Read conversation
	const conversation = await getConversation(id);
	if (!conversation) {
		return NextResponse.json(
			{ error: "Conversation not found" },
			{ status: 404 },
		);
	}

	// 404 if soft-deleted
	if (conversation.deletedAt) {
		return NextResponse.json(
			{ error: "Conversation not found" },
			{ status: 404 },
		);
	}

	// Parse body
	let body: { userMessage?: string; requestId?: string };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	if (
		!body.userMessage ||
		typeof body.userMessage !== "string" ||
		body.userMessage.trim() === ""
	) {
		return NextResponse.json(
			{ error: "userMessage is required" },
			{ status: 400 },
		);
	}

	// 2. Idempotency: if requestId was already processed, return 200 no-op
	if (body.requestId) {
		const seen = await hasRecentRequestId(id, body.requestId);
		if (seen) {
			return NextResponse.json({ ok: true, idempotent: true }, { status: 200 });
		}
	}

	// 3. Check for active run
	if (
		conversation.currentRunId &&
		(conversation.status === "starting" || conversation.status === "running")
	) {
		return NextResponse.json(
			{
				error: "Conversation is already running",
				currentRunId: conversation.currentRunId,
			},
			{ status: 409 },
		);
	}

	// 4. Append user turn
	const turn = await appendConversationTurn(id, {
		role: "user",
		content: body.userMessage,
	});

	// 5. Update conversation status to "queued" and clear paused state
	await updateConversation(id, {
		status: "queued",
		pausedReason: null,
		pausedDecisionId: null,
	});

	// 6. Record requestId if provided
	if (body.requestId) {
		await recordRequestId(id, body.requestId);
	}

	// 7. Publish turn.started event for the user turn
	await publishAndEmit({
		conversationId: id,
		type: "turn.started",
		payload: {
			turnId: turn.id,
			turn: turn.turn,
			role: "user",
		},
	});

	// 8. Publish conversation.updated event with new status
	await publishAndEmit({
		conversationId: id,
		type: "conversation.updated",
		payload: {
			fields: {
				status: "queued" as Conversation["status"],
			},
		},
	});

	// 9. Spawn run-conversation for foreground chats (no task linkage)
	if (conversation.mode === "foreground" && !conversation.taskId) {
		try {
			const entry = resolveScriptEntrypoint("run-conversation");
			const child = spawn(entry.runner, [...entry.args, id], {
				cwd: process.cwd(),
				detached: true,
				stdio: "ignore",
				shell: false,
				env: {
					...process.env,
					MANDIO_WORKSPACE_ID: process.env.MANDIO_WORKSPACE_ID ?? "default",
				},
			});
			child.unref();
		} catch (err) {
			// Non-fatal — conversation stays queued; user can retry
			console.error(
				`[continue] Failed to spawn run-conversation: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	// 10. Return 202 (queued — not yet executed)
	return NextResponse.json({ ok: true, turnId: turn.id }, { status: 202 });
}
