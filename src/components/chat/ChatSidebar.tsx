"use client";

import { ChevronLeft, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AssistantThread } from "@/components/chat/AssistantThread";
import { ModelSelect } from "@/components/model-select";
import { useAgents } from "@/hooks/use-data";
import { useWorkspace } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";

const DOC_MAINTAINER_AGENT_ID = "doc-maintainer";
const CHAT_CONTEXT = "global";
const AGENT_STORAGE_KEY = "mandio.chat.agent";
const MODEL_STORAGE_KEY = "mandio.chat.model";

interface ChatSidebarProps {
	open: boolean;
	onToggle: () => void;
	isMobile: boolean;
}

export function ChatSidebar({ open, onToggle, isMobile }: ChatSidebarProps) {
	const { currentId: workspaceId } = useWorkspace();
	const { agents } = useAgents();
	const activeAgents = agents.filter((a) => a.status === "active");
	const hasDocMaintainer = activeAgents.some(
		(a) => a.id === DOC_MAINTAINER_AGENT_ID,
	);

	const [selectedAgentId, setSelectedAgentId] = useState(
		DOC_MAINTAINER_AGENT_ID,
	);
	const [selectedModel, setSelectedModel] = useState("sonnet");
	const agentChangedByUser = useRef(false);

	// Restore selections from localStorage after hydration
	useEffect(() => {
		try {
			const storedAgent = localStorage.getItem(AGENT_STORAGE_KEY);
			const storedModel = localStorage.getItem(MODEL_STORAGE_KEY);
			if (storedAgent) setSelectedAgentId(storedAgent);
			if (storedModel) setSelectedModel(storedModel);
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

	const selectedAgent = activeAgents.find((a) => a.id === selectedAgentId);

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
							<span className="text-[10px] text-muted-foreground bg-background border px-1.5 py-0.5 rounded-sm shrink-0">
								{CHAT_CONTEXT}
							</span>
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

					{/* Chat body */}
					<div className="flex-1 overflow-hidden min-h-0">
						<AssistantThread
							workspaceId={workspaceId}
							context={CHAT_CONTEXT}
							model={selectedModel}
							persona={selectedAgent?.instructions}
						/>
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
