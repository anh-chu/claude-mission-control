import { requireSession } from "@/lib/auth-guards";
import { subscribe } from "@/lib/conversation-event-bus";
import { getConversation, readConversationEvents } from "@/lib/conversations";
import type { ConversationEvent } from "@/lib/types";
import { applyWorkspaceContext } from "@/lib/workspace-context";

/**
 * GET /api/conversations/[id]/events
 *
 * Server-Sent Events endpoint that streams conversation events.
 *
 * - Replay: supports Last-Event-ID header or ?lastEventId=<seq> query param.
 * - Live: subscribes to the in-process event bus for real-time delivery.
 * - Heartbeat: sends a `ping` event every 15 seconds.
 * - Cleanup: unsubscribes and clears the heartbeat interval on request abort.
 *
 * Headers:
 *   Content-Type: text/event-stream
 *   Cache-Control: no-cache, no-transform
 *   Connection: keep-alive
 *   X-Accel-Buffering: no
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;

	return applyWorkspaceContext(async () => {
		const { id } = await params;

		// 1. Validate conversation exists
		const conversation = await getConversation(id);
		if (!conversation) {
			return new Response("Conversation not found", { status: 404 });
		}

		// 2. Determine replay start seq from Last-Event-ID header or query param
		const url = new URL(request.url);
		const lastEventId =
			request.headers.get("Last-Event-ID") ??
			url.searchParams.get("lastEventId") ??
			null;
		const afterSeq = lastEventId !== null ? parseInt(lastEventId, 10) : 0;

		const encoder = new TextEncoder();

		const stream = new ReadableStream({
			start: async (controller) => {
				let closed = false;
				let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
				/** Track already-sent seq numbers to avoid duplicates from local-emit + file-watcher overlap. */
				const sentSeqs = new Set<number>();

				function cleanup() {
					if (closed) return;
					closed = true;
					if (heartbeatTimer) {
						clearInterval(heartbeatTimer);
						heartbeatTimer = null;
					}
					try {
						controller.close();
					} catch {
						/* already closed */
					}
				}

				function writeSSE(event: string | null, data: string, seq?: number) {
					if (closed) return;
					// Dedup: skip if this seq was already sent
					if (seq !== undefined && sentSeqs.has(seq)) return;
					if (seq !== undefined) sentSeqs.add(seq);
					try {
						let message = "";
						if (seq !== undefined) {
							message += `id: ${seq}\n`;
						}
						if (event) {
							message += `event: ${event}\n`;
						}
						message += `data: ${data}\n\n`;
						controller.enqueue(encoder.encode(message));
					} catch {
						cleanup();
					}
				}

				try {
					// 3. Send initial ping
					writeSSE("ping", JSON.stringify({ ts: new Date().toISOString() }));

					// 4. Replay past events (if Last-Event-ID was explicitly provided)
					if (lastEventId !== null) {
						const events = await readConversationEvents(id, {
							afterSeq,
						});
						for (const evt of events) {
							writeSSE(evt.type, JSON.stringify(evt), evt.seq);
						}
					}

					// 5. Subscribe to live events
					const unsub = subscribe(id, (event: ConversationEvent) => {
						writeSSE(event.type, JSON.stringify(event), event.seq);
					});

					// 6. Heartbeat every 15 seconds
					heartbeatTimer = setInterval(() => {
						writeSSE("ping", JSON.stringify({ ts: new Date().toISOString() }));
					}, 15_000);

					// 7. Cleanup on abort
					request.signal.addEventListener("abort", () => {
						unsub();
						cleanup();
					});
				} catch (err) {
					console.error("[SSE events]", err);
					cleanup();
				}
			},
		});

		return new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache, no-transform",
				Connection: "keep-alive",
				"X-Accel-Buffering": "no",
			},
		});
	});
}
