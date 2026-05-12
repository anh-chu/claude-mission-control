"use client";

import {
	AlertCircle,
	ChevronDown,
	ChevronRight,
	FileText,
	Loader2,
	Search,
	Terminal,
	Wrench,
} from "lucide-react";
import { memo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ToolCallRecord } from "@/lib/types";

interface ToolCallCardProps {
	toolCall: ToolCallRecord;
	onRetry?: () => void;
}

function ToolCallCardImpl({ toolCall }: ToolCallCardProps) {
	const [open, setOpen] = useState(false);
	const args = toolCall.args || {};
	const status = toolCall.status;
	const isRunning = status === "running";
	const isError = status === "error";

	// Status icon renderer
	const StatusIcon = () => {
		if (isRunning)
			return (
				<Loader2 className="h-3 w-3 animate-spin shrink-0 text-blue-500" />
			);
		if (isError)
			return <AlertCircle className="h-3 w-3 shrink-0 text-destructive" />;
		return null;
	};

	// Tool-specific renderers
	if (toolCall.tool === "Read") {
		const path = (args.path as string) || "";
		const lines = args.limit ? `(${args.limit} lines)` : "";
		return (
			<Collapsible open={open} onOpenChange={setOpen}>
				<CollapsibleTrigger className="flex items-center gap-1.5 py-1 px-2 w-full hover:bg-muted/50 rounded-sm text-left">
					{open ? (
						<ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
					) : (
						<ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
					)}
					<FileText className="h-3 w-3 shrink-0 text-blue-500" />
					<span className="text-xs font-mono text-blue-500">Read</span>
					<span className="text-xs text-muted-foreground truncate flex-1">
						{path} {lines}
					</span>
					<StatusIcon />
				</CollapsibleTrigger>
				{toolCall.result && (
					<CollapsibleContent>
						<pre className="text-[10px] text-muted-foreground font-mono px-7 py-1 overflow-x-auto max-h-60 whitespace-pre-wrap">
							{toolCall.result}
						</pre>
					</CollapsibleContent>
				)}
			</Collapsible>
		);
	}

	if (toolCall.tool === "Edit") {
		const path = (args.path as string) || "";
		const editsCount = Array.isArray(args.edits) ? args.edits.length : 0;
		return (
			<div className="py-1 px-2">
				<div className="flex items-center gap-1.5">
					<FileText className="h-3 w-3 shrink-0 text-orange-500" />
					<span className="text-xs font-mono text-orange-500">Edit</span>
					<span className="text-xs text-muted-foreground truncate flex-1">
						{path}
					</span>
					{editsCount > 0 && (
						<Badge variant="secondary" className="text-[10px] px-1 py-0">
							{editsCount} edit{editsCount === 1 ? "" : "s"}
						</Badge>
					)}
					<StatusIcon />
				</div>
			</div>
		);
	}

	if (toolCall.tool === "Bash") {
		const command = (args.command as string) || "";
		const preview =
			command.length > 50 ? `${command.slice(0, 50)}...` : command;
		return (
			<Collapsible open={open} onOpenChange={setOpen}>
				<CollapsibleTrigger className="flex items-center gap-1.5 py-1 px-2 w-full hover:bg-muted/50 rounded-sm text-left">
					{open ? (
						<ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
					) : (
						<ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
					)}
					<Terminal className="h-3 w-3 shrink-0 text-green-500" />
					<span className="text-xs font-mono text-green-500">Bash</span>
					<span className="text-xs text-muted-foreground font-mono truncate flex-1">
						{preview}
					</span>
					<StatusIcon />
				</CollapsibleTrigger>
				{toolCall.result && (
					<CollapsibleContent>
						<pre className="text-[10px] text-muted-foreground font-mono px-7 py-1 overflow-x-auto max-h-60 whitespace-pre-wrap">
							{toolCall.result}
						</pre>
					</CollapsibleContent>
				)}
			</Collapsible>
		);
	}

	if (toolCall.tool === "Grep") {
		const pattern = (args.pattern as string) || "";
		const resultStr = toolCall.result || "";
		const matchCount = resultStr
			? resultStr.split("\n").filter((line: string) => line.trim()).length
			: 0;
		return (
			<Collapsible open={open} onOpenChange={setOpen}>
				<CollapsibleTrigger className="flex items-center gap-1.5 py-1 px-2 w-full hover:bg-muted/50 rounded-sm text-left">
					{open ? (
						<ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
					) : (
						<ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
					)}
					<Search className="h-3 w-3 shrink-0 text-purple-500" />
					<span className="text-xs font-mono text-purple-500">Grep</span>
					<span className="text-xs text-muted-foreground font-mono truncate flex-1">
						{pattern}
					</span>
					{matchCount > 0 && (
						<Badge variant="secondary" className="text-[10px] px-1 py-0">
							{matchCount} match{matchCount === 1 ? "" : "es"}
						</Badge>
					)}
					<StatusIcon />
				</CollapsibleTrigger>
				{toolCall.result && (
					<CollapsibleContent>
						<pre className="text-[10px] text-muted-foreground font-mono px-7 py-1 overflow-x-auto max-h-60 whitespace-pre-wrap">
							{toolCall.result}
						</pre>
					</CollapsibleContent>
				)}
			</Collapsible>
		);
	}

	if (toolCall.tool === "Write") {
		const path = (args.path as string) || "";
		const content = (args.content as string) || "";
		const contentLength = content.length;
		return (
			<Collapsible open={open} onOpenChange={setOpen}>
				<CollapsibleTrigger className="flex items-center gap-1.5 py-1 px-2 w-full hover:bg-muted/50 rounded-sm text-left">
					{open ? (
						<ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
					) : (
						<ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
					)}
					<FileText className="h-3 w-3 shrink-0 text-indigo-500" />
					<span className="text-xs font-mono text-indigo-500">Write</span>
					<span className="text-xs text-muted-foreground truncate flex-1">
						{path}
					</span>
					{contentLength > 0 && (
						<Badge variant="secondary" className="text-[10px] px-1 py-0">
							{contentLength} bytes
						</Badge>
					)}
					<StatusIcon />
				</CollapsibleTrigger>
				{content && (
					<CollapsibleContent>
						<pre className="text-[10px] text-muted-foreground font-mono px-7 py-1 overflow-x-auto max-h-60 whitespace-pre-wrap">
							{content}
						</pre>
					</CollapsibleContent>
				)}
			</Collapsible>
		);
	}

	if (toolCall.tool === "Task") {
		const subject =
			(args.subject as string) || (args.description as string) || "";
		let taskStatus = "pending";
		if (toolCall.result) {
			try {
				const parsed = JSON.parse(toolCall.result);
				taskStatus = parsed.status || taskStatus;
			} catch {}
		}
		return (
			<div className="py-1 px-2">
				<div className="flex items-center gap-1.5">
					<Wrench className="h-3 w-3 shrink-0 text-amber-500" />
					<span className="text-xs font-mono text-amber-500">Task</span>
					<span className="text-xs text-muted-foreground truncate flex-1">
						{subject}
					</span>
					<Badge variant="secondary" className="text-[10px] px-1 py-0">
						{taskStatus}
					</Badge>
					<StatusIcon />
				</div>
			</div>
		);
	}

	// Fallback
	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger className="flex items-center gap-1.5 py-1 px-2 w-full hover:bg-muted/50 rounded-sm text-left">
				{open ? (
					<ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
				) : (
					<ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
				)}
				<Wrench className="h-3 w-3 shrink-0 text-muted-foreground" />
				<span className="text-xs font-mono text-muted-foreground">
					{toolCall.tool}
				</span>
				<div className="flex-1" />
				<StatusIcon />
			</CollapsibleTrigger>
			<CollapsibleContent>
				{args && (
					<div className="px-7 py-1">
						<div className="text-[10px] text-muted-foreground font-mono">
							Args:
						</div>
						<pre className="text-[10px] text-muted-foreground font-mono overflow-x-auto max-h-40">
							{JSON.stringify(args, null, 2)}
						</pre>
					</div>
				)}
				{toolCall.result && (
					<div className="px-7 py-1">
						<div className="text-[10px] text-muted-foreground font-mono">
							Result:
						</div>
						<pre className="text-[10px] text-muted-foreground font-mono overflow-x-auto max-h-40 whitespace-pre-wrap">
							{toolCall.result}
						</pre>
					</div>
				)}
			</CollapsibleContent>
		</Collapsible>
	);
}

export const ToolCallCard = memo(ToolCallCardImpl);
