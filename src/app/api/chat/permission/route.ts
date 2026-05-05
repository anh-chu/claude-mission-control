// POST /api/chat/permission — resolve a pending tool-permission request
// from the inline approve/deny UI in the chat thread.

import { resolvePending } from "@/lib/permission-bus";
import { applyWorkspaceContext } from "@/lib/workspace-context";

export async function POST(request: Request) {
	await applyWorkspaceContext();

	const body = (await request.json()) as {
		requestId?: string;
		decision?: string;
		message?: string;
	};

	const { requestId, decision } = body;

	if (typeof requestId !== "string" || !requestId) {
		return new Response(JSON.stringify({ error: "requestId is required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	if (decision !== "allow" && decision !== "deny") {
		return new Response(
			JSON.stringify({ error: "decision must be 'allow' or 'deny'" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	const resolved = resolvePending(
		requestId,
		decision === "allow"
			? { behavior: "allow" }
			: { behavior: "deny", message: body.message ?? "Denied by user." },
	);

	if (!resolved) {
		return new Response(
			JSON.stringify({ error: "No pending permission request for that id" }),
			{ status: 404, headers: { "Content-Type": "application/json" } },
		);
	}

	return new Response(JSON.stringify({ ok: true }), {
		headers: { "Content-Type": "application/json" },
	});
}
