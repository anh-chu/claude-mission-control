// Phase 2 — enhanced API route with session resume + persistence
// Phase 6 — multi-session support; GET returns sessions list.
// Deviations from plan documented in Phase 0:
// - toUIMessageStreamResponse() instead of toDataStreamResponse()
// - AssistantChatTransport expects UIMessageStream format

import * as fs from "node:fs";
import * as path from "node:path";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { claudeCode } from "ai-sdk-provider-claude-code";
import {
	createSession,
	getCurrentSession,
	listSessions,
	updateSession,
} from "@/lib/chat-sessions";
import { getWikiDir, getWorkspaceDir } from "@/lib/paths";
import { applyWorkspaceContext } from "@/lib/workspace-context";

/** Resolve a default cwd from context when client did not pass one. */
function defaultCwdForContext(
	workspaceId: string,
	context: string | undefined,
): string {
	if (context?.startsWith("wiki:")) return getWikiDir(workspaceId);
	return getWorkspaceDir(workspaceId);
}

// Process-wide semaphore: max 3 concurrent chats
let activeChatCount = 0;
const waitingQueue: (() => void)[] = [];

async function acquireChatSlot(): Promise<void> {
	if (activeChatCount < 3) {
		activeChatCount++;
		return;
	}
	return new Promise((resolve) => {
		waitingQueue.push(resolve);
	});
}

function releaseChatSlot(): void {
	activeChatCount--;
	const next = waitingQueue.shift();
	if (next) {
		activeChatCount++;
		next();
	}
}

/**
 * GET /api/chat — Retrieve sessions + currentId for workspace/context.
 */
export async function GET(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const { searchParams } = new URL(request.url);
	const context = searchParams.get("context") || undefined;

	const sessions = listSessions(workspaceId, context);
	const current = getCurrentSession(workspaceId, context);

	return new Response(
		JSON.stringify({
			sessions,
			currentId: current?.id ?? null,
			// Legacy field — kept for backward compat
			sessionId: current?.sessionId ?? null,
		}),
		{ headers: { "Content-Type": "application/json" } },
	);
}

export async function POST(request: Request) {
	// Check semaphore first
	if (activeChatCount >= 3) {
		return new Response(null, {
			status: 429,
			headers: { "Retry-After": "5" },
		});
	}

	const workspaceId = await applyWorkspaceContext();

	const body = (await request.json()) as {
		messages: UIMessage[];
		data?: {
			cwd?: string;
			model?: string;
			persona?: string;
			sessionId?: string;
			context?: string;
		};
	};

	const { messages, data } = body;
	const context = data?.context;
	const cwd = data?.cwd ?? defaultCwdForContext(workspaceId, context);

	// Ensure at least one session exists
	let currentSession = getCurrentSession(workspaceId, context);
	if (!currentSession) {
		currentSession = createSession(workspaceId, context);
	}

	// Get Claude Code session ID for resume
	const currentClaudeSessionId =
		data?.sessionId ?? currentSession.sessionId ?? null;

	// Validate cwd is an existing absolute path
	if (!path.isAbsolute(cwd)) {
		return new Response(
			JSON.stringify({ error: "cwd must be an absolute path" }),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	if (!fs.existsSync(cwd)) {
		return new Response(JSON.stringify({ error: "cwd does not exist" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	// Patch title on first message of a new session
	if (currentSession.title === "New chat") {
		const firstUserMsg = messages.find((m) => m.role === "user");
		if (firstUserMsg) {
			const titleText = firstUserMsg.parts
				.filter(
					(p): p is { type: "text"; text: string } =>
						p.type === "text" && "text" in p,
				)
				.map((p) => p.text)
				.join(" ")
				.trim()
				.slice(0, 60);
			if (titleText) {
				updateSession(workspaceId, context, currentSession.id, {
					title: titleText,
				});
			}
		}
	}

	// Acquire chat slot
	await acquireChatSlot();

	const sessionId = currentSession.id;

	try {
		const model = claudeCode(data?.model ?? "sonnet", {
			cwd,
			persistSession: true,
			allowDangerouslySkipPermissions: true,
			...(currentClaudeSessionId ? { resume: currentClaudeSessionId } : {}),
		});

		const modelMessages = await convertToModelMessages(messages);
		const enhancedMessages = data?.persona
			? [{ role: "system" as const, content: data.persona }, ...modelMessages]
			: modelMessages;

		const result = streamText({
			model,
			messages: enhancedMessages,
			onFinish: (event) => {
				const meta = event.providerMetadata?.["claude-code"];
				const sid =
					meta && typeof meta.sessionId === "string"
						? meta.sessionId
						: undefined;
				if (sid) {
					try {
						updateSession(workspaceId, context, sessionId, { sessionId: sid });
					} catch (err) {
						console.warn("Failed to save session ID:", err);
					}
				}
			},
		});

		return result.toUIMessageStreamResponse();
	} finally {
		releaseChatSlot();
	}
}
