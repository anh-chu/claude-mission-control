import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guards";
import {
	createConversation,
	getConversationsFile,
	listConversations,
	recordRequestId,
} from "@/lib/conversations";
import type { Conversation } from "@/lib/types";
import { applyWorkspaceContext } from "@/lib/workspace-context";

// ─── GET /api/conversations ──────────────────────────────────────────────────

export async function GET(request: Request) {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;

	return applyWorkspaceContext(async (_workspaceId) => {
		const { searchParams } = new URL(request.url);

		const taskIdParam = searchParams.get("taskId");
		const status = searchParams.get("status") as Conversation["status"] | null;
		const mode = searchParams.get("mode") as Conversation["mode"] | null;
		const agentId = searchParams.get("agentId");
		const source = searchParams.get("source") as
			| Conversation["executionSource"]
			| null;
		const includeDeleted = searchParams.get("includeDeleted") === "true";
		const includeArchived = searchParams.get("includeArchived") === "true";

		// taskId=null (literal string) means filter for conversations with taskId === null
		const taskId =
			taskIdParam === "null"
				? null
				: taskIdParam !== null
					? taskIdParam
					: undefined;

		try {
			const conversations = await listConversations({
				taskId,
				status: status ?? undefined,
				mode: mode ?? undefined,
				agentId: agentId ?? undefined,
				source: source ?? undefined,
				includeDeleted,
				includeArchived,
			});

			return NextResponse.json({ conversations });
		} catch (error) {
			console.error("[GET /api/conversations]", error);
			return NextResponse.json(
				{ error: "Failed to list conversations" },
				{ status: 500 },
			);
		}
	});
}

// ─── POST /api/conversations ─────────────────────────────────────────────────

export async function POST(request: Request) {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;

	return applyWorkspaceContext(async (_workspaceId) => {
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
		}

		const data = body as Record<string, unknown>;

		// title is required
		if (
			!data.title ||
			typeof data.title !== "string" ||
			data.title.trim() === ""
		) {
			return NextResponse.json({ error: "title is required" }, { status: 400 });
		}

		const title = data.title as string;
		const agentId = (data.agentId as string | undefined) ?? null;
		const model = (data.model as string | undefined) ?? null;
		const mode = (data.mode as "foreground" | "background") ?? "foreground";
		const executionSource =
			(data.executionSource as Conversation["executionSource"]) ?? "chat";
		const taskId = (data.taskId as string | undefined) ?? null;
		const parentConversationId =
			(data.parentConversationId as string | undefined) ?? null;
		const requestId = data.requestId as string | undefined;

		try {
			// Idempotency: if requestId provided, check for existing conversation
			if (requestId) {
				const all = await getConversationsFile();
				const existing = all.conversations.find(
					(c) => !c.deletedAt && c.recentRequestIds.includes(requestId),
				);
				if (existing) {
					return NextResponse.json({ conversation: existing }, { status: 200 });
				}
			}

			// Create new conversation
			const conversation = await createConversation({
				title,
				agentId,
				model,
				mode,
				executionSource,
				taskId,
				parentConversationId,
			});

			// Record requestId for idempotency window
			if (requestId) {
				await recordRequestId(conversation.id, requestId);
			}

			return NextResponse.json({ conversation }, { status: 201 });
		} catch (error) {
			console.error("[POST /api/conversations]", error);
			return NextResponse.json(
				{ error: "Failed to create conversation" },
				{ status: 500 },
			);
		}
	});
}
