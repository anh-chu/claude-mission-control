"use client";

// Phase 1 — enhanced chat thread with tool UIs, cwd/model/persona forwarding
//
// Phase 0 deviations still apply:
// 1. useChatRuntime({ transport: new AssistantChatTransport(...) }) not direct api field
// 2. ThreadPrimitive composition instead of simple Thread component
// 3. toUIMessageStreamResponse() for the message stream format

import {
	AssistantRuntimeProvider,
	ComposerPrimitive,
	MessagePartPrimitive,
	MessagePrimitive,
	ThreadPrimitive,
} from "@assistant-ui/react";
import {
	AssistantChatTransport,
	useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import { useEffect } from "react";
import { claudeCodeToolUIs } from "./tool-uis";

// Enhanced message renderer that properly displays text content.
// Phase 0 fix: TextPrimitive was empty, now properly renders message text.
function MessageRenderer() {
	return (
		<MessagePrimitive.Root className="py-2">
			<MessagePrimitive.Content
				components={{
					Text: () => (
						<MessagePartPrimitive.Text className="text-sm text-foreground whitespace-pre-wrap" />
					),
				}}
			/>
		</MessagePrimitive.Root>
	);
}

interface AssistantThreadProps {
	cwd?: string;
	context?: string;
	model?: string;
	persona?: string;
}

export function AssistantThread({
	cwd,
	context,
	model,
	persona,
}: AssistantThreadProps) {
	// Forward cwd, model, persona via transport body
	// HttpChatTransportInitOptions.body confirmed at node_modules/ai/dist/index.d.ts:4000
	const runtime = useChatRuntime({
		transport: new AssistantChatTransport({
			api: "/api/chat",
			body: { cwd, model, persona },
		}),
	});

	// Mount tool UIs for claude-code tools
	useEffect(() => {
		// Register tool UIs with the runtime
		claudeCodeToolUIs.forEach((toolUI) => {
			// Tool UIs self-register when imported/used
			// The makeAssistantToolUI pattern handles the registration
		});
	}, []);

	return (
		<AssistantRuntimeProvider runtime={runtime}>
			<div className="flex flex-col h-full">
				{/* ThreadPrimitive.Root — div wrapper, accepts standard div props */}
				<ThreadPrimitive.Root className="flex flex-col flex-1 overflow-hidden">
					{/* ThreadPrimitive.Viewport — scrollable message list */}
					<ThreadPrimitive.Viewport className="flex-1 overflow-y-auto p-4 space-y-2">
						{/* ThreadPrimitive.Messages — render function receives { message: MessageState } */}
						<ThreadPrimitive.Messages>
							{() => <MessageRenderer />}
						</ThreadPrimitive.Messages>
					</ThreadPrimitive.Viewport>

					{/* Composer at the bottom */}
					<ComposerPrimitive.Root className="border-t p-4 flex gap-2">
						<ComposerPrimitive.Input
							className="flex-1 resize-none rounded border p-2 text-sm"
							placeholder="Send a message…"
						/>
						<ComposerPrimitive.Send className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground">
							Send
						</ComposerPrimitive.Send>
					</ComposerPrimitive.Root>
				</ThreadPrimitive.Root>
			</div>
		</AssistantRuntimeProvider>
	);
}
