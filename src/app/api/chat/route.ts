// Phase 1 — enhanced API route with cwd/model/persona validation + concurrency control
// Deviations from plan documented in Phase 0:
// - toUIMessageStreamResponse() instead of toDataStreamResponse()
// - AssistantChatTransport expects UIMessageStream format

import * as fs from "node:fs";
import * as path from "node:path";
import { type ModelMessage, streamText } from "ai";
import { claudeCode } from "ai-sdk-provider-claude-code";

// Process-wide semaphore: max 3 concurrent chats
let activeChatCount = 0;
const waitingQueue: ((value: void) => void)[] = [];

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

export async function POST(request: Request) {
	// Check semaphore first
	if (activeChatCount >= 3) {
		return new Response(null, {
			status: 429,
			headers: { "Retry-After": "5" },
		});
	}

	const body = (await request.json()) as {
		messages: ModelMessage[];
		data?: {
			cwd?: string;
			model?: string;
			persona?: string;
			sessionId?: string;
		};
	};

	const { messages, data } = body;
	const cwd = data?.cwd ?? process.cwd();

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

	try {
		// model: pass data.model ?? 'sonnet' to claudeCode()
		const model = claudeCode(data?.model ?? "sonnet", {
			cwd,
			persistSession: true,
			allowDangerouslySkipPermissions: true,
			...(data?.sessionId ? { sdkOptions: { resume: data.sessionId } } : {}),
		});

		// persona: if provided, prepend a { role: 'system', content: persona } to messages
		const enhancedMessages = data?.persona
			? [{ role: "system" as const, content: data.persona }, ...messages]
			: messages;

		const result = streamText({ model, messages: enhancedMessages });

		return result.toUIMessageStreamResponse();
	} finally {
		// Always release the slot when done
		releaseChatSlot();
	}
}
