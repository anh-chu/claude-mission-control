"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { showError } from "@/lib/toast";
import { generateId } from "@/lib/utils";

interface ConversationComposerProps {
	conversationId: string;
	disabled?: boolean;
	placeholder?: string;
	onSent?: () => void;
	onOptimisticTurn?: (content: string) => void;
}

export function ConversationComposer({
	conversationId,
	disabled,
	placeholder = "Type a message...",
	onSent,
	onOptimisticTurn,
}: ConversationComposerProps) {
	const [text, setText] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Auto-resize textarea
	// biome-ignore lint/correctness/useExhaustiveDependencies: rerun when text changes to resize textarea
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${Math.min(
				textareaRef.current.scrollHeight,
				200,
			)}px`;
		}
	}, [text]);

	const handleSend = async () => {
		if (!text.trim() || disabled || isSending) return;
		const trimmed = text.trim();
		setIsSending(true);
		setError(null);

		// Show message optimistically before the POST completes
		onOptimisticTurn?.(trimmed);

		try {
			const res = await apiFetch(
				`/api/conversations/${conversationId}/continue`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						userMessage: trimmed,
						requestId: generateId("req"),
					}),
				},
			);

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || "Failed to send message");
			}

			setText("");
			onSent?.();
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Failed to send message";
			setError(message);
			showError(message);
		} finally {
			setIsSending(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<div className="flex flex-col gap-1 w-full">
			<div className="relative flex items-end gap-2 p-3 border-t bg-background">
				<textarea
					ref={textareaRef}
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={handleKeyDown}
					disabled={disabled || isSending}
					placeholder={placeholder}
					className="flex-1 resize-none rounded-sm border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[40px] max-h-32"
					rows={1}
				/>
				<Button
					onClick={handleSend}
					disabled={!text.trim() || disabled || isSending}
					size="sm"
					className="h-[40px] px-3 py-2"
				>
					<Send className="h-4 w-4" />
				</Button>
			</div>
			{/* TODO: slash command support */}
			{error && (
				<div className="px-3 pb-2 text-xs text-destructive">{error}</div>
			)}
		</div>
	);
}
