"use client";

import { makeAssistantToolUI } from "@assistant-ui/react";
import {
	AlertCircle,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	FileText,
	Loader2,
	Search,
	Terminal,
	Wrench,
} from "lucide-react";
import { useState } from "react";
import { MarkdownContent } from "@/components/markdown-content";
import { Badge } from "@/components/ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Read tool UI
const ReadToolUI = makeAssistantToolUI({
	toolName: "Read",
	render: (props: any) => {
		const [open, setOpen] = useState(false);
		const path = props.args?.path || "";
		const lines = props.args?.limit ? `(${props.args.limit} lines)` : "";

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
					<span className="text-xs text-muted-foreground truncate">
						{path} {lines}
					</span>
					{props.status.type === "running" && (
						<Loader2 className="h-3 w-3 animate-spin shrink-0 text-blue-500" />
					)}
					{props.status.type === "incomplete" &&
						props.status.reason === "error" && (
							<AlertCircle className="h-3 w-3 shrink-0 text-destructive" />
						)}
				</CollapsibleTrigger>
				{props.result && (
					<CollapsibleContent>
						<pre className="text-[10px] text-muted-foreground font-mono px-7 py-1 overflow-x-auto max-h-60 whitespace-pre-wrap">
							{typeof props.result === "string"
								? props.result
								: JSON.stringify(props.result, null, 2)}
						</pre>
					</CollapsibleContent>
				)}
			</Collapsible>
		);
	},
});

// Edit tool UI
const EditToolUI = makeAssistantToolUI({
	toolName: "Edit",
	render: (props: any) => {
		const path = props.args?.path || "";
		const editsCount = Array.isArray(props.args?.edits)
			? props.args.edits.length
			: 0;

		return (
			<div className="py-1 px-2">
				<div className="flex items-center gap-1.5">
					<FileText className="h-3 w-3 shrink-0 text-orange-500" />
					<span className="text-xs font-mono text-orange-500">Edit</span>
					<span className="text-xs text-muted-foreground truncate">{path}</span>
					{editsCount > 0 && (
						<Badge variant="secondary" className="text-[10px] px-1 py-0">
							{editsCount} edit{editsCount === 1 ? "" : "s"}
						</Badge>
					)}
					{props.status.type === "running" && (
						<Loader2 className="h-3 w-3 animate-spin shrink-0 text-orange-500" />
					)}
					{props.status.type === "incomplete" &&
						props.status.reason === "error" && (
							<AlertCircle className="h-3 w-3 shrink-0 text-destructive" />
						)}
				</div>
			</div>
		);
	},
});

// Bash tool UI
const BashToolUI = makeAssistantToolUI({
	toolName: "Bash",
	render: (props: any) => {
		const [open, setOpen] = useState(false);
		const command = props.args?.command || "";
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
					<span className="text-xs text-muted-foreground font-mono truncate">
						{preview}
					</span>
					{props.status.type === "running" && (
						<Loader2 className="h-3 w-3 animate-spin shrink-0 text-green-500" />
					)}
					{props.status.type === "incomplete" &&
						props.status.reason === "error" && (
							<AlertCircle className="h-3 w-3 shrink-0 text-destructive" />
						)}
				</CollapsibleTrigger>
				{props.result && (
					<CollapsibleContent>
						<pre className="text-[10px] text-muted-foreground font-mono px-7 py-1 overflow-x-auto max-h-60 whitespace-pre-wrap">
							{typeof props.result === "string"
								? props.result
								: JSON.stringify(props.result, null, 2)}
						</pre>
					</CollapsibleContent>
				)}
			</Collapsible>
		);
	},
});

// Grep tool UI
const GrepToolUI = makeAssistantToolUI({
	toolName: "Grep",
	render: (props: any) => {
		const [open, setOpen] = useState(false);
		const pattern = props.args?.pattern || "";
		const path = props.args?.path || "";
		const resultStr = typeof props.result === "string" ? props.result : "";
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
					<span className="text-xs text-muted-foreground font-mono truncate">
						{pattern}
					</span>
					{matchCount > 0 && (
						<Badge variant="secondary" className="text-[10px] px-1 py-0">
							{matchCount} match{matchCount === 1 ? "" : "es"}
						</Badge>
					)}
					{props.status.type === "running" && (
						<Loader2 className="h-3 w-3 animate-spin shrink-0 text-purple-500" />
					)}
					{props.status.type === "incomplete" &&
						props.status.reason === "error" && (
							<AlertCircle className="h-3 w-3 shrink-0 text-destructive" />
						)}
				</CollapsibleTrigger>
				{props.result && (
					<CollapsibleContent>
						<pre className="text-[10px] text-muted-foreground font-mono px-7 py-1 overflow-x-auto max-h-60 whitespace-pre-wrap">
							{resultStr}
						</pre>
					</CollapsibleContent>
				)}
			</Collapsible>
		);
	},
});

// Write tool UI
const WriteToolUI = makeAssistantToolUI({
	toolName: "Write",
	render: (props: any) => {
		const [open, setOpen] = useState(false);
		const path = props.args?.path || "";
		const contentLength = props.args?.content ? props.args.content.length : 0;

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
					<span className="text-xs text-muted-foreground truncate">{path}</span>
					{contentLength > 0 && (
						<Badge variant="secondary" className="text-[10px] px-1 py-0">
							{contentLength} bytes
						</Badge>
					)}
					{props.status.type === "running" && (
						<Loader2 className="h-3 w-3 animate-spin shrink-0 text-indigo-500" />
					)}
					{props.status.type === "incomplete" &&
						props.status.reason === "error" && (
							<AlertCircle className="h-3 w-3 shrink-0 text-destructive" />
						)}
				</CollapsibleTrigger>
				{props.args?.content && (
					<CollapsibleContent>
						<pre className="text-[10px] text-muted-foreground font-mono px-7 py-1 overflow-x-auto max-h-60 whitespace-pre-wrap">
							{typeof props.args.content === "string"
								? props.args.content
								: JSON.stringify(props.args.content, null, 2)}
						</pre>
					</CollapsibleContent>
				)}
			</Collapsible>
		);
	},
});

// Task tool UI
const TaskToolUI = makeAssistantToolUI({
	toolName: "Task",
	render: (props: any) => {
		const subject = props.args?.subject || props.args?.description || "";
		const taskStatus = props.result?.status || "pending";

		return (
			<div className="py-1 px-2">
				<div className="flex items-center gap-1.5">
					<Wrench className="h-3 w-3 shrink-0 text-amber-500" />
					<span className="text-xs font-mono text-amber-500">Task</span>
					<span className="text-xs text-muted-foreground truncate">
						{subject}
					</span>
					<Badge variant="secondary" className="text-[10px] px-1 py-0">
						{taskStatus}
					</Badge>
					{props.status.type === "running" && (
						<Loader2 className="h-3 w-3 animate-spin shrink-0 text-amber-500" />
					)}
					{props.status.type === "incomplete" &&
						props.status.reason === "error" && (
							<AlertCircle className="h-3 w-3 shrink-0 text-destructive" />
						)}
				</div>
			</div>
		);
	},
});

// Generic fallback for unknown tools
const FallbackToolUI = makeAssistantToolUI({
	toolName: "*", // Wildcard to catch all unknown tools
	render: (props: any) => {
		const [open, setOpen] = useState(false);
		const toolName = props.toolCallPart?.toolName || "Unknown Tool";

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
						{toolName}
					</span>
					{props.status.type === "running" && (
						<Loader2 className="h-3 w-3 animate-spin shrink-0 text-muted-foreground" />
					)}
					{props.status.type === "incomplete" &&
						props.status.reason === "error" && (
							<AlertCircle className="h-3 w-3 shrink-0 text-destructive" />
						)}
				</CollapsibleTrigger>
				<CollapsibleContent>
					{props.args && (
						<div className="px-7 py-1">
							<div className="text-[10px] text-muted-foreground font-mono">
								Args:
							</div>
							<pre className="text-[10px] text-muted-foreground font-mono overflow-x-auto max-h-40">
								{JSON.stringify(props.args, null, 2)}
							</pre>
						</div>
					)}
					{props.result && (
						<div className="px-7 py-1">
							<div className="text-[10px] text-muted-foreground font-mono">
								Result:
							</div>
							<pre className="text-[10px] text-muted-foreground font-mono overflow-x-auto max-h-40">
								{typeof props.result === "string"
									? props.result
									: JSON.stringify(props.result, null, 2)}
							</pre>
						</div>
					)}
				</CollapsibleContent>
			</Collapsible>
		);
	},
});

export const claudeCodeToolUIs = [
	ReadToolUI,
	EditToolUI,
	BashToolUI,
	GrepToolUI,
	WriteToolUI,
	TaskToolUI,
	FallbackToolUI,
];
