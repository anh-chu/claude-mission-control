"use client";

import { Bot, ChevronDown, ChevronRight } from "lucide-react";
import { memo, useState } from "react";
import { MarkdownContent } from "@/components/markdown-content";
import type { ConversationTurn } from "@/lib/types";
import { ToolCallCard } from "./ToolCallCard";

interface TurnBlockProps {
	turn: ConversationTurn;
	compact?: boolean;
}

function turnBlockComparator(
	prev: TurnBlockProps,
	next: TurnBlockProps,
): boolean {
	const p = prev.turn;
	const n = next.turn;
	return (
		p === n ||
		(p.id === n.id &&
			p.role === n.role &&
			p.ts === n.ts &&
			p.content === n.content &&
			p.pending === n.pending &&
			p.error === n.error &&
			p.tokens === n.tokens &&
			p.parts === n.parts &&
			p.toolCalls === n.toolCalls &&
			prev.compact === next.compact)
	);
}

function ThinkingBlock({ text }: { text: string }) {
	const [open, setOpen] = useState(false);
	if (!text.trim()) return null;
	return (
		<div className="text-xs text-muted-foreground border rounded-sm bg-muted/30 mt-1 mb-2">
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

function TurnBlockInner({ turn, compact }: TurnBlockProps) {
	const isUser = turn.role === "user";

	const timestamp = new Date(turn.ts).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});

	if (isUser) {
		return (
			<div className="flex w-full justify-end group">
				<div className="max-w-[85%] rounded-md px-3 py-2 text-sm break-words bg-primary text-primary-foreground whitespace-pre-wrap relative">
					{turn.content}
					<span className="absolute -left-12 top-2 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
						{timestamp}
					</span>
				</div>
			</div>
		);
	}

	// Assistant turn
	return (
		<div className="flex w-full justify-start group">
			<div className="flex gap-3 max-w-[95%]">
				<div className="w-8 h-8 rounded-sm bg-muted flex items-center justify-center shrink-0 mt-0.5">
					<Bot className="h-4 w-4 text-muted-foreground" />
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<span className="text-xs font-medium">Assistant</span>
						<span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
							{timestamp}
						</span>
					</div>

					{turn.parts?.map((part, i) => {
						if (part.type === "thinking") {
							return <ThinkingBlock key={`th-${i}`} text={part.content} />;
						}
						if (part.type === "text" && part.content) {
							return (
								<div key={`txt-${i}`} className="mb-2">
									<MarkdownContent content={part.content} className="text-sm" />
								</div>
							);
						}
						return null;
					})}

					{/* Fallback to raw content if no parts are present */}
					{(!turn.parts || turn.parts.length === 0) && turn.content && (
						<div className="mb-2">
							<MarkdownContent content={turn.content} className="text-sm" />
						</div>
					)}

					{turn.toolCalls?.map((tc) => (
						<div key={tc.id} className="mb-1 border rounded-sm bg-muted/20">
							<ToolCallCard toolCall={tc} />
						</div>
					))}

					{turn.pending && (
						<div className="flex items-center gap-1 text-muted-foreground text-xs italic mt-2">
							<span className="animate-pulse">●</span>
							<span className="animate-pulse delay-150">●</span>
							<span className="animate-pulse delay-300">●</span>
						</div>
					)}

					{turn.error && (
						<div className="text-xs text-destructive bg-destructive/10 p-2 rounded-sm mt-2">
							{turn.error}
						</div>
					)}

					{turn.tokens &&
						(turn.tokens.input > 0 || turn.tokens.output > 0) &&
						!compact && (
							<div className="text-[10px] text-muted-foreground mt-2">
								Tokens: {turn.tokens.input} in, {turn.tokens.output} out
							</div>
						)}
				</div>
			</div>
		</div>
	);
}

export const TurnBlock = memo(TurnBlockInner, turnBlockComparator);
