"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { Conversation } from "@/lib/types";
import { cn, generateId } from "@/lib/utils";
import { ConversationStatusBadge } from "./ConversationStatusBadge";

const DEFAULT_CONVERSATION_MODEL = "haiku";

interface ConversationListProps {
	currentId?: string | null;
	onSelect: (id: string) => void;
	taskId?: string | null;
}

export function ConversationList({
	currentId,
	onSelect,
	taskId,
}: ConversationListProps) {
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const fetchConversations = async () => {
			setIsLoading(true);
			try {
				const url = taskId
					? `/api/conversations?taskId=${taskId}`
					: `/api/conversations`;
				const res = await apiFetch(url);
				if (res.ok) {
					const data = await res.json();
					setConversations(data.conversations || []);
				}
			} catch (err) {
				console.error("Failed to fetch conversations", err);
			} finally {
				setIsLoading(false);
			}
		};

		fetchConversations();
	}, [taskId]);

	const handleCreate = async () => {
		try {
			const res = await apiFetch("/api/conversations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: "New Conversation",
					taskId,
					model: DEFAULT_CONVERSATION_MODEL,
					requestId: generateId("req"),
				}),
			});
			if (res.ok) {
				const data = await res.json();
				setConversations((prev) => [data.conversation, ...prev]);
				onSelect(data.conversation.id);
			}
		} catch (err) {
			console.error("Failed to create conversation", err);
		}
	};

	const formatDate = (iso: string) => {
		const d = new Date(iso);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffHrs = diffMs / (1000 * 60 * 60);
		if (diffHrs < 1) return `${Math.round(diffMs / 60000)}m ago`;
		if (diffHrs < 24) return `${Math.round(diffHrs)}h ago`;
		return d.toLocaleDateString();
	};

	return (
		<div className="flex flex-col h-full border-r">
			<div className="p-3 border-b flex items-center justify-between">
				<h3 className="text-sm font-medium">Conversations</h3>
				<button
					onClick={handleCreate}
					className="p-1 hover:bg-muted rounded-sm text-muted-foreground hover:text-foreground"
					title="New conversation"
				>
					<Plus className="h-4 w-4" />
				</button>
			</div>
			<div className="flex-1 overflow-y-auto">
				{isLoading ? (
					<div className="p-4 text-xs text-muted-foreground text-center">
						Loading...
					</div>
				) : conversations.length === 0 ? (
					<div className="p-4 text-xs text-muted-foreground text-center">
						No conversations
					</div>
				) : (
					conversations.map((conv) => (
						<div
							key={conv.id}
							onClick={() => onSelect(conv.id)}
							className={cn(
								"p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors",
								currentId === conv.id && "bg-muted",
							)}
						>
							<div className="flex items-start justify-between gap-2 mb-1">
								<span className="text-sm font-medium truncate flex-1">
									{conv.title || "Untitled"}
								</span>
								<span className="text-[10px] text-muted-foreground whitespace-nowrap">
									{formatDate(conv.updatedAt)}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<ConversationStatusBadge status={conv.status} />
								<span className="text-[10px] text-muted-foreground">
									{conv.turnCount} turns
								</span>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}
