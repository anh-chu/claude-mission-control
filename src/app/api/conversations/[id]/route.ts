import { NextResponse } from "next/server";
import { publishAndEmit } from "@/lib/conversation-event-bus";
import {
	getConversation,
	listRunsForConversation,
	readConversationTurns,
	softDeleteConversation,
	updateConversation,
} from "@/lib/conversations";
import type { Conversation, ConversationUpdatedEvent } from "@/lib/types";
import { applyWorkspaceContext } from "@/lib/workspace-context";

// ─── GET /api/conversations/[id] ─────────────────────────────────────────────

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	await applyWorkspaceContext();
	const { id } = await params;
	const { searchParams } = new URL(request.url);

	const withTurns =
		searchParams.get("withTurns") === "1" ||
		searchParams.get("withTurns") === "true";
	const withRuns =
		searchParams.get("withRuns") === "1" ||
		searchParams.get("withRuns") === "true";

	try {
		const conversation = await getConversation(id);
		if (!conversation) {
			return NextResponse.json(
				{ error: "Conversation not found" },
				{ status: 404 },
			);
		}

		const result: Record<string, unknown> = { conversation };

		if (withTurns) {
			result.turns = await readConversationTurns(id);
		}

		if (withRuns) {
			result.runs = await listRunsForConversation(id);
		}

		return NextResponse.json(result);
	} catch (error) {
		console.error("[GET /api/conversations/[id]]", error);
		return NextResponse.json(
			{ error: "Failed to fetch conversation" },
			{ status: 500 },
		);
	}
}

// ─── PATCH /api/conversations/[id] ───────────────────────────────────────────

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	await applyWorkspaceContext();
	const { id } = await params;

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const patch = body as Partial<Conversation>;

	try {
		const conversation = await getConversation(id);
		if (!conversation) {
			return NextResponse.json(
				{ error: "Conversation not found" },
				{ status: 404 },
			);
		}

		const updated = await updateConversation(id, patch);
		if (!updated) {
			return NextResponse.json(
				{ error: "Conversation not found" },
				{ status: 404 },
			);
		}

		// Publish update event
		const eventFields: Partial<
			Pick<
				Conversation,
				"title" | "status" | "summary" | "tokens" | "turnCount" | "currentRunId"
			>
		> = {};
		if ("title" in patch) eventFields.title = patch.title;
		if ("status" in patch) eventFields.status = patch.status;
		if ("summary" in patch) eventFields.summary = patch.summary;
		if ("tokens" in patch) eventFields.tokens = patch.tokens;
		if ("turnCount" in patch) eventFields.turnCount = patch.turnCount;
		if ("currentRunId" in patch) eventFields.currentRunId = patch.currentRunId;

		if (Object.keys(eventFields).length > 0) {
			await publishAndEmit({
				conversationId: id,
				type: "conversation.updated",
				payload: { fields: eventFields },
			} as Omit<ConversationUpdatedEvent, "ts" | "seq">);
		}

		return NextResponse.json({ conversation: updated });
	} catch (error) {
		console.error("[PATCH /api/conversations/[id]]", error);
		return NextResponse.json(
			{ error: "Failed to update conversation" },
			{ status: 500 },
		);
	}
}

// ─── DELETE /api/conversations/[id] ──────────────────────────────────────────

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	await applyWorkspaceContext();
	const { id } = await params;
	const { searchParams } = new URL(request.url);

	const hard = searchParams.get("hard") === "true";

	if (hard) {
		return NextResponse.json(
			{ error: "Hard delete is not supported for conversations" },
			{ status: 400 },
		);
	}

	try {
		const deleted = await softDeleteConversation(id);
		if (!deleted) {
			return NextResponse.json(
				{ error: "Conversation not found" },
				{ status: 404 },
			);
		}

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("[DELETE /api/conversations/[id]]", error);
		return NextResponse.json(
			{ error: "Failed to delete conversation" },
			{ status: 500 },
		);
	}
}
