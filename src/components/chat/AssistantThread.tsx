"use client";

// Phase 1 — chat thread with tool UIs, cwd/model/persona forwarding,
// session resume, role-aware bubbles, reasoning + error rendering.

import {
	AssistantRuntimeProvider,
	ComposerPrimitive,
	MessagePrimitive,
	ThreadPrimitive,
	useMessage,
} from "@assistant-ui/react";
import {
	AssistantChatTransport,
	useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import { ChevronDown, ChevronRight, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { claudeCodeToolUIs } from "./tool-uis";

interface AssistantThreadProps {
	cwd?: string;
	context?: string;
	model?: string;
	persona?: string;
}

function ReasoningBlock({ text }: { text: string }) {
	const [open, setOpen] = useState(false);
	if (!text.trim()) return null;
	return (
		<div className="text-xs text-muted-foreground border rounded-sm bg-muted/30 mt-1">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="flex items-center gap-1 px-2 py-1 w-full text-left hover:bg-muted/60"
			>
				{open ? (
					<ChevronDown className="h-3 w-3" />
				) : (
					<ChevronRight className="h-3 w-3" />
				)}
				<span className="uppercase tracking-wide text-[10px]">Thinking</span>
			</button>
			{open && (
				<pre className="px-3 py-2 whitespace-pre-wrap break-words font-sans leading-relaxed">
					{text}
				</pre>
			)}
		</div>
	);
}

function MessageBody() {
	const message = useMessage();
	const isUser = message.role === "user";

	return (
		<div
			className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
		>
			<div
				className={cn(
					"max-w-[85%] rounded-md px-3 py-2 text-sm whitespace-pre-wrap break-words",
					isUser
						? "bg-primary text-primary-foreground"
						: "bg-muted text-foreground",
				)}
			>
				{message.content.map((part, i) => {
					if (part.type === "text") {
						// biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only
						return <span key={i}>{part.text}</span>;
					}
					if (part.type === "reasoning") {
						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only
							<ReasoningBlock key={i} text={part.text} />
						);
					}
					return null;
				})}
				{message.status?.type === "running" &&
					!message.content.some((p) => p.type === "text") && (
						<span className="text-muted-foreground italic">Thinking…</span>
					)}
			</div>
		</div>
	);
}

export function AssistantThread({
	cwd,
	context,
	model,
	persona,
}: AssistantThreadProps) {
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		async function fetchSessionId() {
			try {
				const params = new URLSearchParams();
				if (context) params.set("context", context);
				const response = await fetch(`/api/chat?${params.toString()}`);
				if (response.ok) {
					const data = (await response.json()) as { sessionId: string | null };
					setSessionId(data.sessionId);
				}
			} catch (error) {
				console.warn("Failed to fetch session ID:", error);
			} finally {
				setIsLoading(false);
			}
		}
		fetchSessionId();
	}, [context]);

	const runtime = useChatRuntime({
		transport: new AssistantChatTransport({
			api: "/api/chat",
			body: { cwd, model, persona, context, sessionId },
		}),
	});

	if (isLoading) {
		return (
			<div className="flex flex-col h-full justify-center items-center">
				<div className="text-sm text-muted-foreground">Loading session…</div>
			</div>
		);
	}

	return (
		<AssistantRuntimeProvider runtime={runtime}>
			{/* Mount tool UIs so makeAssistantToolUI components register with the runtime */}
			{claudeCodeToolUIs.map((ToolUI, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: tool UI list is static
				<ToolUI key={i} />
			))}

			<div className="flex flex-col h-full">
				<ThreadPrimitive.Root className="flex flex-col flex-1 overflow-hidden">
					<ThreadPrimitive.Viewport
						autoScroll
						className="flex-1 overflow-y-auto p-4 space-y-3"
					>
						<ThreadPrimitive.Empty>
							<div className="h-full flex items-center justify-center text-xs text-muted-foreground">
								Start a conversation…
							</div>
						</ThreadPrimitive.Empty>
						<ThreadPrimitive.Messages
							components={{
								Message: () => (
									<MessagePrimitive.Root>
										<MessageBody />
									</MessagePrimitive.Root>
								),
							}}
						/>
					</ThreadPrimitive.Viewport>

					<ComposerPrimitive.Root className="border-t p-3 flex gap-2 items-end">
						<ComposerPrimitive.Input
							rows={1}
							className="flex-1 resize-none rounded-sm border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[40px] max-h-32"
							placeholder={
								sessionId ? "Continue conversation…" : "Start a conversation…"
							}
						/>
						<ComposerPrimitive.Send className="rounded-sm bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1">
							<Send className="h-3.5 w-3.5" />
							Send
						</ComposerPrimitive.Send>
					</ComposerPrimitive.Root>
				</ThreadPrimitive.Root>
			</div>
		</AssistantRuntimeProvider>
	);
}
