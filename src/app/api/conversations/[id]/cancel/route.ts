import { NextResponse } from "next/server";
import { publishAndEmit } from "@/lib/conversation-event-bus";
import {
	getConversation,
	getConversationRun,
	updateConversation,
	updateConversationRun,
} from "@/lib/conversations";
import { applyWorkspaceContext } from "@/lib/workspace-context";

// ─── PID liveness check ──────────────────────────────────────────────────────

function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

// ─── POST /api/conversations/[id]/cancel ─────────────────────────────────────

/**
 * POST /api/conversations/[id]/cancel
 *
 * Cancel a running conversation. Sends SIGTERM to the active run's process
 * (if alive), marks the run as "stopped", updates the conversation to
 * "cancelled", and publishes a `conversation.cancelled` event.
 *
 * Body: { reason?: string }
 */

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	return applyWorkspaceContext(async () => {
		const { id } = await params;

		// 1. Read conversation
		const conversation = await getConversation(id);
		if (!conversation) {
			return NextResponse.json(
				{ error: "Conversation not found" },
				{ status: 404 },
			);
		}

		// 2. Already in terminal state
		const terminalStates = new Set(["completed", "failed", "cancelled"]);
		if (terminalStates.has(conversation.status)) {
			return NextResponse.json(
				{ ok: true, alreadyTerminal: true },
				{ status: 200 },
			);
		}

		// Parse optional reason from body
		let reason: string | undefined;
		try {
			const body = await request.json();
			if (body && typeof body.reason === "string") {
				reason = body.reason;
			}
		} catch {
			// no body or invalid JSON — that's fine, reason stays undefined
		}

		const now = new Date().toISOString();
		const previousRunId = conversation.currentRunId;

		// 3. If there's an active run, try to kill the process and update the run
		if (previousRunId) {
			const run = await getConversationRun(previousRunId);
			if (run?.pid && isAlive(run.pid)) {
				try {
					process.kill(run.pid, "SIGTERM");
				} catch {
					// ESRCH or permission error — process already gone or can't be signalled
				}
			}

			await updateConversationRun(previousRunId, {
				status: "stopped",
				completedAt: now,
			});
		}

		// 4. Update conversation
		await updateConversation(id, {
			status: "cancelled",
			cancelledAt: now,
			currentRunId: null,
		});

		// 5. Publish conversation.cancelled event
		await publishAndEmit({
			conversationId: id,
			type: "conversation.cancelled",
			payload: {
				runId: previousRunId,
				reason,
			},
		});

		return NextResponse.json({ ok: true }, { status: 200 });
	});
}
