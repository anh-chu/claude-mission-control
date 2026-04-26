"use client";

import {
	Brain,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Loader2,
	MessageSquare,
	Square,
	Terminal,
	Wrench,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MarkdownContent } from "@/components/markdown-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { type StreamLine, useAgentStream } from "@/hooks/use-agent-stream";

interface AgentConsoleProps {
	runId: string;
	onStop?: () => void;
}

// Content block types inside assistant/user messages
interface TextBlock {
	type: "text";
	text: string;
}
interface ToolUseBlock {
	type: "tool_use";
	id: string;
	name: string;
	input: unknown;
}
interface ToolResultBlock {
	type: "tool_result";
	tool_use_id: string;
	content: unknown;
}
interface ThinkingBlock {
	type: "thinking";
	thinking?: string;
	text?: string;
}
type ContentBlock =
	| TextBlock
	| ToolUseBlock
	| ToolResultBlock
	| ThinkingBlock
	| { type: string; [key: string]: unknown };

interface ThinkingDisplayLine extends StreamLine {
	type: "merged_thinking";
	thinking: string;
}

interface TextDisplayLine extends StreamLine {
	type: "merged_text";
	text: string;
}

interface ToolUseGroupDisplayLine extends StreamLine {
	type: "merged_tool_use";
	entries: Array<
		| { type: "tool_use"; block: ToolUseBlock }
		| { type: "tool_result"; block: ToolResultBlock }
	>;
}

function getThinkingFromBlock(block: ContentBlock): string {
	if (block.type !== "thinking") return "";
	return (
		(typeof (block as ThinkingBlock).thinking === "string"
			? (block as ThinkingBlock).thinking
			: typeof (block as ThinkingBlock).text === "string"
				? (block as ThinkingBlock).text
				: "") ?? ""
	);
}

function ResponseTextEntry({ text }: { text: string }) {
	return (
		<div className="flex gap-2 py-1.5 px-2">
			<MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" />
			<MarkdownContent
				content={text}
				className="min-w-0 flex-1 text-sm text-foreground/90"
			/>
		</div>
	);
}

function ThinkingEntry({ thinking }: { thinking: string }) {
	const [open, setOpen] = useState(false);
	const preview = thinking.trim().replace(/\s+/g, " ");
	const hint = preview.length > 90 ? `${preview.slice(0, 90)}…` : preview;

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger className="flex items-start gap-1.5 py-1.5 px-2 w-full hover:bg-sunshine-700/10 rounded-sm text-left bg-sunshine-700/5">
				{open ? (
					<ChevronDown className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
				) : (
					<ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
				)}
				<Brain className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning-ink" />
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className="text-[10px] font-mono uppercase tracking-wide text-warning-ink">
							Thinking
						</span>
						{!open && hint && (
							<span className="text-[10px] text-warning-ink truncate">
								{hint}
							</span>
						)}
					</div>
				</div>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<pre className="text-xs text-warning-ink whitespace-pre-wrap break-words font-mono leading-relaxed px-7 py-1.5">
					{thinking}
				</pre>
			</CollapsibleContent>
		</Collapsible>
	);
}

export function prepareConsoleLines(
	lines: StreamLine[],
): (
	| StreamLine
	| ThinkingDisplayLine
	| TextDisplayLine
	| ToolUseGroupDisplayLine
)[] {
	const rendered: StreamLine[] = [];
	let thinking = "";

	for (const line of lines) {
		if (line.type === "stream_event") {
			const event = (line.event ?? {}) as Record<string, unknown>;
			if (event.type === "content_block_delta") {
				const delta = (event.delta ?? {}) as Record<string, unknown>;
				if (delta.type === "thinking_delta") {
					const chunk =
						(typeof delta.thinking === "string"
							? delta.thinking
							: typeof delta.text === "string"
								? delta.text
								: "") ?? "";
					if (chunk) thinking += chunk;
				}
			}

			continue;
		}

		if (line.type === "assistant") {
			const message =
				(line.message as { content?: ContentBlock[] } | undefined) ?? {};
			const blocks = message.content ?? [];
			const assistantThinking = blocks
				.filter((block) => block.type === "thinking")
				.map(getThinkingFromBlock)
				.join("");
			const nonThinkingBlocks = blocks.filter(
				(block) => block.type !== "thinking",
			);

			if (assistantThinking) {
				if (thinking && assistantThinking.startsWith(thinking)) {
					thinking = assistantThinking;
				} else if (!thinking.endsWith(assistantThinking)) {
					thinking += assistantThinking;
				}
			}

			if (nonThinkingBlocks.length > 0) {
				rendered.push({
					...line,
					message: {
						...(typeof line.message === "object" && line.message !== null
							? (line.message as Record<string, unknown>)
							: {}),
						content: nonThinkingBlocks,
					},
				});
			}

			continue;
		}

		rendered.push(line);
	}

	const withThinking: (StreamLine | ThinkingDisplayLine)[] = !thinking.trim()
		? rendered
		: (() => {
				const thinkingLine: ThinkingDisplayLine = {
					type: "merged_thinking",
					thinking,
				};
				const resultIndex = rendered.findIndex(
					(line) => line.type === "result",
				);
				if (resultIndex === -1) {
					return [...rendered, thinkingLine];
				}

				return [
					...rendered.slice(0, resultIndex),
					thinkingLine,
					...rendered.slice(resultIndex),
				];
			})();

	const grouped: (
		| StreamLine
		| ThinkingDisplayLine
		| TextDisplayLine
		| ToolUseGroupDisplayLine
	)[] = [];
	let pendingToolEntries: ToolUseGroupDisplayLine["entries"] = [];
	let pendingText = "";

	const flushToolUses = () => {
		if (pendingToolEntries.length === 0) return;
		grouped.push({
			type: "merged_tool_use",
			entries: pendingToolEntries,
		});
		pendingToolEntries = [];
	};

	const flushText = () => {
		if (!pendingText.trim()) return;
		grouped.push({ type: "merged_text", text: pendingText });
		pendingText = "";
	};

	for (const line of withThinking) {
		if (
			line.type === "system" ||
			line.type === "rate_limit_event" ||
			line.type === "stream_event"
		) {
			continue;
		}
		if (line.type === "assistant") {
			const blocks =
				(line.message as { content?: ContentBlock[] } | undefined)?.content ??
				[];
			const onlyText =
				blocks.length > 0 && blocks.every((block) => block.type === "text");
			if (onlyText) {
				pendingText += (blocks as TextBlock[])
					.map((block) => block.text)
					.join("");
				continue;
			}

			const onlyToolUses =
				blocks.length > 0 && blocks.every((block) => block.type === "tool_use");
			if (onlyToolUses) {
				flushText();
				pendingToolEntries.push(
					...(blocks as ToolUseBlock[]).map((block) => ({
						type: "tool_use" as const,
						block,
					})),
				);
				continue;
			}
		}

		if (line.type === "user") {
			const blocks =
				(line.message as { content?: ContentBlock[] } | undefined)?.content ??
				[];
			const onlyToolResults =
				blocks.length > 0 &&
				blocks.every((block) => block.type === "tool_result");
			if (onlyToolResults && pendingToolEntries.length > 0) {
				flushText();
				pendingToolEntries.push(
					...(blocks as ToolResultBlock[]).map((block) => ({
						type: "tool_result" as const,
						block,
					})),
				);
				continue;
			}
		}

		flushText();
		flushToolUses();
		grouped.push(line);
	}

	flushText();
	flushToolUses();
	const mergedAdjacentToolGroups: (
		| StreamLine
		| ThinkingDisplayLine
		| TextDisplayLine
		| ToolUseGroupDisplayLine
	)[] = [];
	for (const line of grouped) {
		const prev = mergedAdjacentToolGroups[mergedAdjacentToolGroups.length - 1];
		if (line.type === "merged_tool_use" && prev?.type === "merged_tool_use") {
			(prev as ToolUseGroupDisplayLine).entries.push(
				...((line as ToolUseGroupDisplayLine)
					.entries as ToolUseGroupDisplayLine["entries"]),
			);
			continue;
		}
		mergedAdjacentToolGroups.push(line);
	}

	return mergedAdjacentToolGroups;
}

function ToolUseGroupEntry({
	entries,
}: {
	entries: ToolUseGroupDisplayLine["entries"];
}) {
	const [open, setOpen] = useState(false);
	const count = entries.filter((entry) => entry.type === "tool_use").length;
	const label = `${count} tool call${count === 1 ? "" : "s"}`;

	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger className="flex items-center gap-1.5 py-1 px-2 w-full hover:bg-warning/10 rounded-sm text-left">
				{open ? (
					<ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
				) : (
					<ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
				)}
				<Wrench className="h-3 w-3 shrink-0 text-warning-ink" />
				<span className="text-xs font-mono text-warning-ink">{label}</span>
			</CollapsibleTrigger>
			<CollapsibleContent className="space-y-0.5">
				{entries.map((entry, index) =>
					entry.type === "tool_use" ? (
						<ToolUseEntry key={entry.block.id} block={entry.block} />
					) : (
						<ToolResultEntry
							key={`${entry.block.tool_use_id}_${index}`}
							block={entry.block}
						/>
					),
				)}
			</CollapsibleContent>
		</Collapsible>
	);
}

function ToolUseEntry({ block }: { block: ToolUseBlock }) {
	const [open, setOpen] = useState(false);
	const input = block.input ? JSON.stringify(block.input, null, 2) : "";
	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger className="flex items-center gap-1.5 py-1 px-2 w-full hover:bg-muted/50 rounded-sm text-left">
				{open ? (
					<ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
				) : (
					<ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
				)}
				<Wrench className="h-3 w-3 shrink-0 text-warning-ink" />
				<span className="text-xs font-mono text-warning-ink">{block.name}</span>
			</CollapsibleTrigger>
			{input && (
				<CollapsibleContent>
					<pre className="text-[10px] text-muted-foreground font-mono px-7 py-1 overflow-x-auto max-h-40">
						{input.length > 2000 ? input.slice(0, 2000) + "\n..." : input}
					</pre>
				</CollapsibleContent>
			)}
		</Collapsible>
	);
}

function ToolResultEntry({ block }: { block: ToolResultBlock }) {
	const [open, setOpen] = useState(false);
	const raw =
		typeof block.content === "string"
			? block.content
			: JSON.stringify(block.content, null, 2);
	const hint = (() => {
		const trimmed = raw.trim();
		if (trimmed.startsWith("{") || trimmed.startsWith("["))
			return `(${raw.length} bytes JSON)`;
		const first = trimmed.split("\n")[0] ?? "";
		return first.length > 60 ? first.slice(0, 60) + "…" : first;
	})();
	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger className="flex items-center gap-1.5 py-1 px-2 w-full hover:bg-muted/50 rounded-sm text-left">
				{open ? (
					<ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
				) : (
					<ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
				)}
				<CheckCircle2 className="h-3 w-3 shrink-0 text-success" />
				<span className="text-xs font-mono text-success">result</span>
				{hint && !open && (
					<span className="text-[10px] text-muted-foreground truncate max-w-[300px]">
						{hint}
					</span>
				)}
			</CollapsibleTrigger>
			{raw && (
				<CollapsibleContent>
					<pre className="text-[10px] text-muted-foreground font-mono px-7 py-1 overflow-x-auto max-h-40">
						{raw.length > 2000 ? raw.slice(0, 2000) + "\n..." : raw}
					</pre>
				</CollapsibleContent>
			)}
		</Collapsible>
	);
}

export function StreamEntry({ line }: { line: StreamLine }) {
	const [open, setOpen] = useState(false);
	if (line.type === "merged_text") {
		const text = typeof line.text === "string" ? line.text : "";
		if (!text.trim()) return null;
		return <ResponseTextEntry text={text} />;
	}
	if (line.type === "merged_thinking") {
		const thinking = typeof line.thinking === "string" ? line.thinking : "";
		if (!thinking.trim()) return null;
		return <ThinkingEntry thinking={thinking} />;
	}
	if (line.type === "merged_tool_use") {
		const entries = Array.isArray(line.entries)
			? (line.entries as ToolUseGroupDisplayLine["entries"])
			: [];
		if (entries.length === 0) return null;
		return <ToolUseGroupEntry entries={entries} />;
	}

	if (line.type === "assistant") {
		const blocks =
			(line.message as { content?: ContentBlock[] })?.content ?? [];
		const rendered = blocks.flatMap((block, i) => {
			if (block.type === "text") {
				const text = (block as TextBlock).text;
				if (!text?.trim()) return [];
				return [<ResponseTextEntry key={i} text={text} />];
			}
			if (block.type === "tool_use") {
				return [<ToolUseEntry key={i} block={block as ToolUseBlock} />];
			}
			return [];
		});
		if (rendered.length === 0) return null;
		return <>{rendered}</>;
	}
	// user: line.message.content[] has tool_result blocks
	if (line.type === "user") {
		const blocks =
			(line.message as { content?: ContentBlock[] })?.content ?? [];
		const rendered = blocks.flatMap((block, i) => {
			if (block.type === "tool_result") {
				return [<ToolResultEntry key={i} block={block as ToolResultBlock} />];
			}
			return [];
		});
		if (rendered.length === 0) return null;
		return <>{rendered}</>;
	}

	// SDK partial stream events
	if (line.type === "stream_event") {
		// hide low-level stream events by default (text deltas, signatures, etc.)
		return null;
	}
	if (line.type === "result") {
		const cost =
			typeof line.total_cost_usd === "number"
				? `$${line.total_cost_usd.toFixed(4)}`
				: null;
		const turns = typeof line.num_turns === "number" ? line.num_turns : null;
		return (
			<div className="flex items-center gap-2 py-1.5 px-2 bg-muted rounded-sm">
				<CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
				<span className="text-xs text-muted-foreground">
					Session complete
					{cost && <> &middot; {cost}</>}
					{turns != null && <> &middot; {turns} turns</>}
				</span>
			</div>
		);
	}
	// Skip system events (hook lifecycle, init, etc.)
	if (line.type === "system" || line.type === "rate_limit_event") return null;
	const unknownContent = JSON.stringify(line, null, 2);
	const unknownHint = (() => {
		for (const key of [
			"subtype",
			"message",
			"content",
			"text",
			"error",
			"summary",
		]) {
			const val = line[key];
			if (typeof val === "string" && val.trim()) {
				const s = val.trim().split("\n")[0] ?? "";
				return s.length > 80 ? s.slice(0, 80) + "…" : s;
			}
		}
		return null;
	})();
	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger className="flex items-center gap-1.5 py-1 px-2 w-full hover:bg-muted/50 rounded-sm text-left opacity-60">
				{open ? (
					<ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
				) : (
					<ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
				)}
				<Terminal className="h-3 w-3 shrink-0 text-muted-foreground" />
				<span className="text-[10px] text-muted-foreground font-mono">
					{line.type}
				</span>
				{unknownHint && !open && (
					<span className="text-[10px] text-muted-foreground truncate max-w-[300px]">
						{unknownHint}
					</span>
				)}
			</CollapsibleTrigger>
			<CollapsibleContent>
				<pre className="text-[10px] text-muted-foreground font-mono px-7 py-1 overflow-x-auto max-h-40">
					{unknownContent.length > 2000
						? unknownContent.slice(0, 2000) + "\n..."
						: unknownContent}
				</pre>
			</CollapsibleContent>
		</Collapsible>
	);
}

export function AgentConsole({ runId, onStop }: AgentConsoleProps) {
	const { lines, isConnected, isDone } = useAgentStream(runId);
	const displayLines = useMemo(() => prepareConsoleLines(lines), [lines]);
	const scrollRef = useRef<HTMLDivElement>(null);
	const [autoScroll, setAutoScroll] = useState(true);

	// Auto-scroll to bottom when new lines arrive
	useEffect(() => {
		if (autoScroll && scrollRef.current) {
			const el = scrollRef.current;
			el.scrollTop = el.scrollHeight;
		}
	}, [lines.length, autoScroll]);

	// Detect manual scroll-up to disable auto-scroll
	const handleScroll = () => {
		if (!scrollRef.current) return;
		const el = scrollRef.current;
		const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
		setAutoScroll(isAtBottom);
	};

	const elapsed = lines.length > 0 ? `${lines.length} events` : "waiting...";

	return (
		<div className="border rounded-sm bg-secondary overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b bg-muted">
				<div className="flex items-center gap-2">
					<Terminal className="h-3.5 w-3.5 text-muted-foreground" />
					<span className="text-xs font-normal">Live Console</span>
					{isConnected && !isDone && (
						<Badge
							variant="outline"
							className="text-[10px] px-1.5 py-0 bg-accent-soft text-accent border-accent/40"
						>
							<Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
							streaming
						</Badge>
					)}
					{isDone && (
						<Badge variant="outline" className="text-[10px] px-1.5 py-0">
							done
						</Badge>
					)}
					<span className="text-[10px] text-muted-foreground">{elapsed}</span>
				</div>
				{onStop && !isDone && (
					<Button
						variant="ghost"
						size="sm"
						className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
						onClick={onStop}
					>
						<Square className="h-3 w-3 mr-1 fill-current" />
						Stop
					</Button>
				)}
			</div>

			{/* Stream output */}
			<div
				ref={scrollRef}
				onScroll={handleScroll}
				className="h-[300px] overflow-y-auto p-1 space-y-0.5"
			>
				{displayLines.length === 0 && !isDone && (
					<div className="flex items-center justify-center h-full text-xs text-muted-foreground">
						<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						Waiting for agent output...
					</div>
				)}
				{displayLines.length === 0 && isDone && (
					<div className="flex items-center justify-center h-full text-xs text-muted-foreground">
						No output captured
					</div>
				)}
				{displayLines.map((line, i) => (
					<StreamEntry key={i} line={line} />
				))}
			</div>
		</div>
	);
}
