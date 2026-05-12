"use client";

import { Bot, User } from "lucide-react";
import { useEffect, useRef } from "react";
import { useConversationStream } from "@/hooks/use-conversation-stream";
import { ConversationComposer } from "./ConversationComposer";
import { ConversationStatusBadge } from "./ConversationStatusBadge";
import { DecisionPanel } from "./DecisionPanel";
import { TurnBlock } from "./TurnBlock";

interface ConversationViewProps {
	conversationId: string;
	embed?: boolean;
}

export function ConversationView({
	conversationId,
	embed,
}: ConversationViewProps) {
	const { conversation, turns, connected, refresh, addOptimisticTurn } =
		useConversationStream(conversationId);
	const viewportRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom
	// biome-ignore lint/correctness/useExhaustiveDependencies: rerun when turns changes to scroll new content
	useEffect(() => {
		if (viewportRef.current) {
			viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
		}
	}, [turns]);

	if (!conversation) {
		return (
			<div className="flex flex-col h-full items-center justify-center text-sm text-muted-foreground">
				Loading conversation...
			</div>
		);
	}

	const isDecisionNeeded = conversation.status === "awaiting-decision";
	const canCompose = [
		"idle",
		"queued",
		"completed",
		"failed",
		"cancelled",
		"awaiting-decision",
	].includes(conversation.status);

	return (
		<div className="flex flex-col h-full w-full bg-background">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
				<div className="flex flex-col gap-1">
					<h2 className="text-sm font-semibold truncate max-w-md">
						{conversation.title || "Untitled Conversation"}
					</h2>
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<ConversationStatusBadge status={conversation.status} />
						{conversation.model && <span>• {conversation.model}</span>}
						{conversation.tokens?.total > 0 && (
							<span>• {conversation.tokens.total.toLocaleString()} tokens</span>
						)}
						{!connected && (
							<span className="text-destructive">• Disconnected</span>
						)}
					</div>
				</div>
				<div className="flex items-center gap-2">
					<div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
						{conversation.agentId ? (
							<Bot className="h-4 w-4" />
						) : (
							<User className="h-4 w-4" />
						)}
					</div>
				</div>
			</div>

			{/* Body */}
			<div ref={viewportRef} className="flex-1 overflow-y-auto p-4 space-y-4">
				{turns.length === 0 ? (
					<div className="h-full flex items-center justify-center text-xs text-muted-foreground">
						Start a conversation…
					</div>
				) : (
					turns.map((turn) => (
						<TurnBlock key={turn.id} turn={turn} compact={embed} />
					))
				)}

				{isDecisionNeeded && <DecisionPanel conversation={conversation} />}
			</div>

			{/* Footer */}
			<div className="shrink-0">
				<ConversationComposer
					conversationId={conversationId}
					disabled={!canCompose}
					placeholder={
						canCompose ? "Type a message..." : "Waiting for agent..."
					}
					onSent={refresh}
					onOptimisticTurn={addOptimisticTurn}
				/>
			</div>
		</div>
	);
}
