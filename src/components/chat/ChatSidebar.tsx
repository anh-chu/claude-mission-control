"use client";

import { ChevronDown, ChevronLeft, MessageSquare, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ConversationList } from "@/components/conversation/ConversationList";
import { ConversationView } from "@/components/conversation/ConversationView";
import { ModelSelect } from "@/components/model-select";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useAgents } from "@/hooks/use-data";
import { apiFetch } from "@/lib/api-client";
import type { Conversation } from "@/lib/types";
import { cn, generateId } from "@/lib/utils";

const DOC_MAINTAINER_AGENT_ID = "doc-maintainer";
const DEFAULT_CHAT_MODEL = "haiku";
const AGENT_STORAGE_KEY = "mandio.chat.agent";
const MODEL_STORAGE_KEY = "mandio.chat.model";
const CONVERSATION_ID_KEY = "cmc:lastConversationId";

interface ChatSidebarProps {
	open: boolean;
	onToggle: () => void;
	isMobile: boolean;
}

export function ChatSidebar({ open, onToggle, isMobile }: ChatSidebarProps) {
	const { agents } = useAgents();
	const activeAgents = agents.filter((a) => a.status === "active");
	const hasDocMaintainer = activeAgents.some(
		(a) => a.id === DOC_MAINTAINER_AGENT_ID,
	);

	const [selectedAgentId, setSelectedAgentId] = useState(
		DOC_MAINTAINER_AGENT_ID,
	);
	const [selectedModel, setSelectedModel] = useState(DEFAULT_CHAT_MODEL);
	const agentChangedByUser = useRef(false);

	// Conversation state
	const [currentId, setCurrentId] = useState<string | null>(null);
	const [conversations, setConversations] = useState<Conversation[]>([]);

	// Restore selections from localStorage after hydration
	useEffect(() => {
		try {
			const storedAgent = localStorage.getItem(AGENT_STORAGE_KEY);
			const storedModel = localStorage.getItem(MODEL_STORAGE_KEY);
			const storedConvId = localStorage.getItem(CONVERSATION_ID_KEY);
			if (storedAgent) setSelectedAgentId(storedAgent);
			if (storedModel) setSelectedModel(storedModel);
			if (storedConvId) setCurrentId(storedConvId);
		} catch {
			// localStorage unavailable
		}
	}, []);

	// Persist selections
	useEffect(() => {
		try {
			localStorage.setItem(AGENT_STORAGE_KEY, selectedAgentId);
		} catch {
			// localStorage unavailable
		}
	}, [selectedAgentId]);

	useEffect(() => {
		try {
			localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
		} catch {
			// localStorage unavailable
		}
	}, [selectedModel]);

	// Persist current conversation ID
	useEffect(() => {
		try {
			if (currentId) {
				localStorage.setItem(CONVERSATION_ID_KEY, currentId);
			} else {
				localStorage.removeItem(CONVERSATION_ID_KEY);
			}
		} catch {
			// localStorage unavailable
		}
	}, [currentId]);

	// Sync model when agent changes by user action only
	useEffect(() => {
		if (!agentChangedByUser.current) return;
		agentChangedByUser.current = false;
		const agent = activeAgents.find((a) => a.id === selectedAgentId);
		if (agent?.model) setSelectedModel(agent.model);
	}, [selectedAgentId, activeAgents]);

	// Keep selectedAgentId valid
	useEffect(() => {
		if (activeAgents.length === 0) return;
		if (!activeAgents.some((a) => a.id === selectedAgentId)) {
			agentChangedByUser.current = true;
			setSelectedAgentId(DOC_MAINTAINER_AGENT_ID);
		}
	}, [activeAgents, selectedAgentId]);

	const handleSelectConversation = async (id: string) => {
		if (id === currentId) return;
		const outgoing = conversations.find((c) => c.id === currentId);
		if (outgoing && outgoing.turnCount === 0) {
			try {
				await apiFetch(`/api/conversations/${outgoing.id}`, {
					method: "DELETE",
				});
				setConversations((prev) => prev.filter((c) => c.id !== outgoing.id));
			} catch {
				// best-effort, don't block the switch
			}
		}
		setCurrentId(id);
	};

	const handleNewConversation = async () => {
		const current = conversations.find((c) => c.id === currentId);
		if (current && current.turnCount === 0) return;
		try {
			const res = await apiFetch("/api/conversations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: "New Conversation",
					agentId: selectedAgentId,
					model: selectedModel || DEFAULT_CHAT_MODEL,
					requestId: generateId("req"),
				}),
			});
			if (res.ok) {
				const data = await res.json();
				setCurrentId(data.conversation.id);
				setConversations((prev) => [data.conversation, ...prev]);
			}
		} catch (err) {
			console.error("Failed to create conversation", err);
		}
	};

	// Hidden on mobile
	if (isMobile) return null;

	return (
		<div
			className={cn(
				"fixed top-14 right-0 bottom-0 z-30 flex flex-col border-l bg-card text-foreground transition-all duration-200",
				open ? "w-[380px]" : "w-10",
			)}
		>
			{open ? (
				<>
					{/* Header */}
					<div className="flex items-center justify-between px-3 py-2 border-b bg-muted shrink-0">
						<div className="flex items-center gap-2 min-w-0">
							<span className="text-sm font-medium">Chat</span>
						</div>
						<button
							type="button"
							onClick={onToggle}
							className="p-1 rounded-sm hover:bg-accent text-muted-foreground hover:text-foreground shrink-0"
							title="Collapse chat"
						>
							<ChevronLeft className="h-4 w-4" />
						</button>
					</div>

					{/* Controls: agent + model selectors */}
					<div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
						<select
							className="h-7 rounded-sm border bg-secondary px-2 text-xs flex-1 min-w-0"
							value={selectedAgentId}
							onChange={(e) => {
								agentChangedByUser.current = true;
								setSelectedAgentId(e.target.value);
							}}
						>
							{!hasDocMaintainer && (
								<option value={DOC_MAINTAINER_AGENT_ID}>Doc Maintainer</option>
							)}
							{activeAgents.map((a) => (
								<option key={a.id} value={a.id}>
									{a.name}
								</option>
							))}
						</select>
						<ModelSelect value={selectedModel} onChange={setSelectedModel} />
					</div>

					{/* Conversation history popover */}
					<div className="flex items-center border-b shrink-0">
						<Popover>
							<PopoverTrigger asChild>
								<button
									type="button"
									className="flex flex-1 items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
								>
									<MessageSquare className="h-3 w-3" />
									<span>History</span>
									<ChevronDown className="h-3 w-3 ml-auto opacity-60" />
								</button>
							</PopoverTrigger>
							<PopoverContent
								align="start"
								side="bottom"
								className="w-[360px] p-0 max-h-[280px] overflow-y-auto"
							>
								<ConversationList
									currentId={currentId}
									onSelect={handleSelectConversation}
									source="chat"
									onConversationsChange={setConversations}
									onConversationDeleted={(id) => {
										setConversations((prev) => prev.filter((c) => c.id !== id));
										if (id === currentId) setCurrentId(null);
									}}
								/>
							</PopoverContent>
						</Popover>
						<button
							type="button"
							onClick={handleNewConversation}
							className="px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
							title="New conversation"
						>
							<Plus className="h-3.5 w-3.5" />
						</button>
					</div>

					{/* Chat body */}
					<div className="flex-1 overflow-hidden min-h-0">
						{currentId ? (
							<ConversationView conversationId={currentId} embed />
						) : (
							<div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
								<MessageSquare className="h-8 w-8 text-muted-foreground/50" />
								<p className="text-sm text-muted-foreground">
									No conversation selected
								</p>
								<button
									type="button"
									onClick={handleNewConversation}
									className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
								>
									<Plus className="h-3.5 w-3.5" />
									Start new conversation
								</button>
							</div>
						)}
					</div>
				</>
			) : (
				/* Collapsed rail */
				<div className="flex flex-col items-center pt-2">
					<button
						type="button"
						onClick={onToggle}
						className="p-2 rounded-sm hover:bg-accent text-muted-foreground hover:text-foreground"
						title="Open chat"
					>
						<MessageSquare className="h-4 w-4" />
					</button>
				</div>
			)}
		</div>
	);
}
