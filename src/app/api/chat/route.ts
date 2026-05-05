// Phase 2 — enhanced API route with session resume + persistence
// Deviations from plan documented in Phase 0:
// - toUIMessageStreamResponse() instead of toDataStreamResponse()
// - AssistantChatTransport expects UIMessageStream format

import * as fs from "node:fs";
import * as path from "node:path";
import type { Query } from "@anthropic-ai/claude-agent-sdk";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { claudeCode } from "ai-sdk-provider-claude-code";
import { getSessionId, saveSessionId } from "@/lib/chat-sessions";
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
	// Queue is full, wait for a slot
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
 * GET /api/chat/session - Retrieve current session ID for workspace/context
 */
export async function GET(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const { searchParams } = new URL(request.url);
	const context = searchParams.get("context") || undefined;

	const sessionId = getSessionId(workspaceId, context);

	return new Response(JSON.stringify({ sessionId }), {
		headers: { "Content-Type": "application/json" },
	});
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

	// Get current session ID if not provided in body
	const currentSessionId =
		data?.sessionId ?? getSessionId(workspaceId, context);

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

	// Acquire chat slot
	await acquireChatSlot();

	// Track the new session ID from claude-code
	let newSessionId: string | undefined;

	try {
		// model: pass data.model ?? 'sonnet' to claudeCode() with session management
		const model = claudeCode(data?.model ?? "sonnet", {
			cwd,
			persistSession: true,
			allowDangerouslySkipPermissions: true,
			...(currentSessionId ? { resume: currentSessionId } : {}),
			onQueryCreated: (query: Query) => {
				// Capture the session ID - it may be available on query properties
				const q = query as { sessionId?: string; id?: string };
				newSessionId = q.sessionId || q.id;
			},
		});

		const modelMessages = await convertToModelMessages(messages);
		// persona: if provided, prepend a { role: 'system', content: persona } to messages
		const enhancedMessages = data?.persona
			? [{ role: "system" as const, content: data.persona }, ...modelMessages]
			: modelMessages;

		const result = streamText({ model, messages: enhancedMessages });

		// Save session ID after stream completes (async)
		Promise.resolve(result.text)
			.then(() => {
				if (newSessionId) {
					try {
						saveSessionId(workspaceId, newSessionId, context);
					} catch (error) {
						console.warn("Failed to save session ID:", error);
					}
				}
			})
			.catch((error: unknown) => {
				console.warn("Stream completion error:", error);
			});

		return result.toUIMessageStreamResponse();
	} finally {
		// Always release the slot when done
		releaseChatSlot();
	}
}
