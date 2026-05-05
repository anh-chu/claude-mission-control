"use client";

// Phase 1 — chat thread with tool UIs, cwd/model/persona forwarding,
// session resume, role-aware bubbles, reasoning + error rendering.
// Phase 6 — slash command menu + multi-session chat history.

import {
	AssistantRuntimeProvider,
	ComposerPrimitive,
	MessagePrimitive,
	ThreadPrimitive,
	useComposer,
	useComposerRuntime,
	useMessage,
} from "@assistant-ui/react";
import {
	AssistantChatTransport,
	useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import {
	ChevronDown,
	ChevronRight,
	Pencil,
	Plus,
	Send,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCommands } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import { claudeCodeToolUIs } from "./tool-uis";

// ---- Types ----------------------------------------------------------------

// Minimal UIMessage shape accepted by useChatRuntime as initialMessages.
// Matches the `parts` subset we produce in readSessionMessages.
type SessionUIMessage = {
	id: string;
	role: "user" | "assistant";
	parts: Array<
		{ type: "text"; text: string } | { type: "reasoning"; text: string }
	>;
};

interface AssistantThreadProps {
	cwd?: string;
	context?: string;
	model?: string;
	persona?: string;
	workspaceId: string;
}

type ClaudeCommand = { name: string; description: string };

// Minimal SessionEntry shape — mirrors src/lib/chat-sessions.ts
export interface SessionEntry {
	id: string;
	sessionId: string | null;
	title: string;
	createdAt: string;
	updatedAt: string;
}

// ---- Permission card types -----------------------------------------------

interface PermissionData {
	requestId: string;
	toolName: string;
	input: Record<string, unknown>;
	title?: string;
	displayName?: string;
	description?: string;
}

interface PermissionSettledData {
	requestId: string;
	behavior: "allow" | "deny";
}

// ---- Permission card -------------------------------------------------------

function PermissionCard({
	data,
	settled,
	streamComplete,
}: {
	data: PermissionData;
	settled: "allow" | "deny" | null;
	streamComplete: boolean;
}) {
	const [pending, setPending] = useState(false);

	const handleDecision = useCallback(
		async (decision: "allow" | "deny") => {
			setPending(true);
			try {
				await fetch("/api/chat/permission", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ requestId: data.requestId, decision }),
				});
			} catch {
				// Ignore network errors; the stream will timeout server-side.
				setPending(false);
			}
		},
		[data.requestId],
	);

	if (settled === "allow") {
		return (
			<span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 font-medium bg-green-500/20 text-green-700 dark:text-green-400 my-1">
				Approved
			</span>
		);
	}

	if (settled === "deny") {
		return (
			<span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 font-medium bg-destructive/20 text-destructive my-1">
				Denied
			</span>
		);
	}

	if (streamComplete) {
		return (
			<span className="text-xs text-muted-foreground italic my-1">
				Pending. Reload to retry.
			</span>
		);
	}

	const label = data.title ?? data.displayName ?? data.toolName;
	const inputPreview = JSON.stringify(data.input).slice(0, 100);

	return (
		<div className="border rounded-md px-3 py-2 my-1 bg-card text-foreground text-xs space-y-1.5 max-w-full">
			<div className="font-medium">{label}</div>
			{data.description && (
				<div className="text-muted-foreground">{data.description}</div>
			)}
			<div className="font-mono text-muted-foreground truncate">
				{data.toolName}: {inputPreview}
			</div>
			<div className="flex gap-2 pt-0.5">
				<button
					type="button"
					disabled={pending}
					onClick={() => handleDecision("allow")}
					className="rounded-sm bg-primary px-2 py-1 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-xs"
				>
					Approve
				</button>
				<button
					type="button"
					disabled={pending}
					onClick={() => handleDecision("deny")}
					className="rounded-sm bg-destructive px-2 py-1 text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 text-xs"
				>
					Deny
				</button>
			</div>
		</div>
	);
}

// ---- Reasoning block -------------------------------------------------------

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

// ---- Message body ----------------------------------------------------------

function MessageBody() {
	const message = useMessage();
	const isUser = message.role === "user";
	const streamComplete = message.status?.type !== "running";

	// Collect settled permission IDs from data-permission-settled parts.
	const settledMap = useMemo(() => {
		const map = new Map<string, "allow" | "deny">();
		for (const part of message.content) {
			if (part.type === "data" && part.name === "permission-settled") {
				const d = part.data as PermissionSettledData;
				map.set(d.requestId, d.behavior);
			}
		}
		return map;
	}, [message.content]);

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
					if (part.type === "data" && part.name === "permission") {
						const perm = part.data as PermissionData;
						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: parts are append-only
							<PermissionCard
								key={i}
								data={perm}
								settled={settledMap.get(perm.requestId) ?? null}
								streamComplete={streamComplete}
							/>
						);
					}
					return null;
				})}
				{message.status?.type === "running" &&
					!message.content.some((p) => p.type === "text") && (
						<span className="text-muted-foreground italic">Thinking...</span>
					)}
			</div>
		</div>
	);
}

// ---- Composer area with slash command menu --------------------------------

function ComposerArea({
	workspaceId,
	sessionId,
}: {
	workspaceId: string;
	sessionId: string | null;
	context?: string;
}) {
	const composerText = useComposer((s) => s.text);
	const composerRuntime = useComposerRuntime();
	const { commands: appCommands } = useCommands(workspaceId);
	const [ccCommands, setCcCommands] = useState<ClaudeCommand[]>([]);
	const [menuOpen, setMenuOpen] = useState(false);
	const [menuQuery, setMenuQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);

	// Fetch Claude Code slash commands once
	useEffect(() => {
		fetch("/api/claude/slash-commands")
			.then((r) => r.json() as Promise<{ commands: ClaudeCommand[] }>)
			.then((data) => setCcCommands(data.commands))
			.catch(() => {});
	}, []);

	// Detect slash trigger from last whitespace-separated token
	const lastToken = useMemo(() => {
		const parts = composerText.split(/\s/);
		const last = parts[parts.length - 1] ?? "";
		return last.startsWith("/") ? last : "";
	}, [composerText]);

	useEffect(() => {
		if (lastToken) {
			setMenuQuery(lastToken.slice(1).toLowerCase());
			setMenuOpen(true);
			setSelectedIndex(0);
		} else {
			setMenuOpen(false);
		}
	}, [lastToken]);

	// Merge app commands (already have "/" prefix in .command) + CC commands
	const filteredCommands = useMemo(() => {
		const appNorm = new Set(
			appCommands.map((c) => c.command.replace(/^\//, "").toLowerCase()),
		);
		const all: { name: string; description: string }[] = [
			...appCommands.map((c) => ({
				name: c.command.startsWith("/") ? c.command : `/${c.command}`,
				description: c.description,
			})),
			...ccCommands
				.filter((c) => !appNorm.has(c.name.toLowerCase()))
				.map((c) => ({ name: `/${c.name}`, description: c.description })),
		];
		if (!menuQuery) return all.slice(0, 10);
		return all
			.filter(
				(c) =>
					c.name.toLowerCase().includes(menuQuery) ||
					c.description.toLowerCase().includes(menuQuery),
			)
			.slice(0, 10);
	}, [appCommands, ccCommands, menuQuery]);

	function selectCommand(cmd: { name: string }) {
		const prefix = composerText.slice(
			0,
			composerText.length - lastToken.length,
		);
		composerRuntime.setText(`${prefix}${cmd.name} `);
		setMenuOpen(false);
	}

	function handleKeyDownCapture(e: React.KeyboardEvent) {
		if (!menuOpen || filteredCommands.length === 0) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			e.stopPropagation();
			setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			e.stopPropagation();
			setSelectedIndex((i) => Math.max(i - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			e.stopPropagation();
			const cmd = filteredCommands[selectedIndex];
			if (cmd) selectCommand(cmd);
		} else if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			setMenuOpen(false);
		}
	}

	return (
		<div className="border-t relative" onKeyDownCapture={handleKeyDownCapture}>
			{menuOpen && filteredCommands.length > 0 && (
				<div className="absolute bottom-full left-0 right-0 bg-popover border rounded-t-md shadow-md overflow-hidden z-50 max-h-60 overflow-y-auto">
					{filteredCommands.map((cmd, i) => (
						<button
							key={cmd.name}
							type="button"
							className={cn(
								"w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent",
								i === selectedIndex && "bg-accent",
							)}
							onMouseDown={(e) => {
								e.preventDefault();
								selectCommand(cmd);
							}}
						>
							<span className="font-mono text-xs shrink-0 text-foreground">
								{cmd.name}
							</span>
							<span className="text-muted-foreground text-xs truncate">
								{cmd.description}
							</span>
						</button>
					))}
				</div>
			)}
			<ComposerPrimitive.Root className="p-3 flex gap-2 items-end">
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
		</div>
	);
}

// ---- Session picker --------------------------------------------------------

function SessionPicker({
	sessions,
	currentId,
	onActivate,
	onNew,
	onDelete,
	onRename,
}: {
	sessions: SessionEntry[];
	currentId: string | null;
	onActivate: (id: string) => void;
	onNew: () => void;
	onDelete: (id: string) => void;
	onRename: (id: string, title: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [draft, setDraft] = useState("");
	const current = sessions.find((s) => s.id === currentId);

	function startEdit(s: SessionEntry, e: React.MouseEvent) {
		e.stopPropagation();
		setEditingId(s.id);
		setDraft(s.title);
	}

	function commitEdit() {
		if (!editingId) return;
		const next = draft.trim();
		const original = sessions.find((s) => s.id === editingId);
		if (next && original && next !== original.title) {
			onRename(editingId, next);
		}
		setEditingId(null);
	}

	return (
		<div className="relative shrink-0 border-b bg-muted/40">
			<div className="flex items-center justify-between px-3 py-1.5">
				<button
					type="button"
					className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground min-w-0"
					onClick={() => setOpen((v) => !v)}
				>
					<span className="max-w-[180px] truncate">
						{current?.title ?? "New chat"}
					</span>
					<ChevronDown className="h-3 w-3 shrink-0" />
				</button>
				<button
					type="button"
					className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground shrink-0"
					onClick={onNew}
					title="New chat"
				>
					<Plus className="h-3.5 w-3.5" />
				</button>
			</div>

			{open && (
				<div className="absolute top-full left-0 right-0 bg-popover border-x border-b rounded-b-md shadow-md z-50 max-h-48 overflow-y-auto">
					{sessions.map((s) => (
						<div
							key={s.id}
							className={cn(
								"flex items-center justify-between px-3 py-2 text-xs hover:bg-accent cursor-pointer group",
								s.id === currentId && "bg-accent/50",
							)}
							onClick={() => {
								onActivate(s.id);
								setOpen(false);
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									onActivate(s.id);
									setOpen(false);
								}
							}}
							role="option"
							aria-selected={s.id === currentId}
							tabIndex={0}
						>
							{editingId === s.id ? (
								<input
									// biome-ignore lint/a11y/noAutofocus: rename UX
									autoFocus
									value={draft}
									onChange={(e) => setDraft(e.target.value)}
									onClick={(e) => e.stopPropagation()}
									onBlur={commitEdit}
									onKeyDown={(e) => {
										e.stopPropagation();
										if (e.key === "Enter") {
											e.preventDefault();
											commitEdit();
										} else if (e.key === "Escape") {
											e.preventDefault();
											setEditingId(null);
										}
									}}
									maxLength={60}
									className="flex-1 bg-background border rounded-sm px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
								/>
							) : (
								<span className="truncate flex-1">{s.title}</span>
							)}
							<button
								type="button"
								className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground ml-2"
								onClick={(e) => startEdit(s, e)}
								title="Rename"
							>
								<Pencil className="h-3 w-3" />
							</button>
							<button
								type="button"
								className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive ml-1"
								onClick={(e) => {
									e.stopPropagation();
									onDelete(s.id);
									setOpen(false);
								}}
								title="Delete session"
							>
								<Trash2 className="h-3 w-3" />
							</button>
						</div>
					))}
					{sessions.length === 0 && (
						<div className="px-3 py-2 text-xs text-muted-foreground">
							No sessions yet
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// ---- Thread with runtime (remounts on session switch) ---------------------

function ThreadWithRuntime({
	cwd,
	model,
	persona,
	context,
	workspaceId,
	claudeSessionId,
	initialMessages,
	onAssistantFinish,
}: {
	cwd?: string;
	model?: string;
	persona?: string;
	context?: string;
	workspaceId: string;
	claudeSessionId: string | null;
	initialMessages: SessionUIMessage[];
	onAssistantFinish?: () => void;
}) {
	const runtime = useChatRuntime({
		transport: new AssistantChatTransport({
			api: "/api/chat",
			body: { cwd, model, persona, context, sessionId: claudeSessionId },
		}),
		messages: initialMessages,
		onFinish: () => {
			onAssistantFinish?.();
		},
	});

	return (
		<AssistantRuntimeProvider runtime={runtime}>
			{/* Mount tool UIs so makeAssistantToolUI components register with the runtime */}
			{claudeCodeToolUIs.map((ToolUI, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: tool UI list is static
				<ToolUI key={i} />
			))}

			<div className="flex flex-col flex-1 overflow-hidden min-h-0">
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

					<ComposerArea
						workspaceId={workspaceId}
						sessionId={claudeSessionId}
						context={context}
					/>
				</ThreadPrimitive.Root>
			</div>
		</AssistantRuntimeProvider>
	);
}

// ---- Public component -----------------------------------------------------

export function AssistantThread({
	cwd,
	context,
	model,
	persona,
	workspaceId,
}: AssistantThreadProps) {
	const [sessions, setSessions] = useState<SessionEntry[]>([]);
	const [currentId, setCurrentId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [initialMessages, setInitialMessages] = useState<SessionUIMessage[]>(
		[],
	);
	const [messagesLoading, setMessagesLoading] = useState(false);
	// runtimeKey forces a chat runtime remount only on explicit session
	// switches (new chat or activate). Lazy promotion from a draft to a real
	// session id keeps the existing runtime and its just-streamed messages.
	const [runtimeKey, setRuntimeKey] = useState("draft");

	async function loadSessions(opts?: { syncRuntimeKey?: boolean }) {
		try {
			const params = new URLSearchParams();
			if (context) params.set("context", context);
			const r = await fetch(`/api/chat?${params.toString()}`);
			if (r.ok) {
				const data = (await r.json()) as {
					sessions?: SessionEntry[];
					currentId?: string | null;
				};
				setSessions(data.sessions ?? []);
				setCurrentId(data.currentId ?? null);
				if (opts?.syncRuntimeKey && data.currentId) {
					setRuntimeKey(data.currentId);
				}
			}
		} catch (err) {
			console.warn("Failed to load sessions:", err);
		} finally {
			setIsLoading(false);
		}
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: load once per context
	useEffect(() => {
		void loadSessions({ syncRuntimeKey: true });
	}, [context]);

	// Fetch historical messages on explicit session switches only. Driven
	// off runtimeKey so a lazy promotion (currentId null -> real id after
	// first send) does not refetch and unmount the live runtime.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runtimeKey is the only trigger
	useEffect(() => {
		if (!runtimeKey || runtimeKey.startsWith("draft")) {
			setInitialMessages([]);
			return;
		}
		setMessagesLoading(true);
		const params = new URLSearchParams({ id: runtimeKey });
		if (context) params.set("context", context);
		fetch(`/api/chat/messages?${params.toString()}`)
			.then((r) => r.json() as Promise<{ messages?: SessionUIMessage[] }>)
			.then((data) => setInitialMessages(data.messages ?? []))
			.catch(() => setInitialMessages([]))
			.finally(() => setMessagesLoading(false));
	}, [runtimeKey]);

	const sortedSessions = useMemo(
		() =>
			[...sessions].sort(
				(a, b) =>
					new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
			),
		[sessions],
	);

	const currentSession = sessions.find((s) => s.id === currentId) ?? null;

	async function handleNewSession() {
		// Lazy: do not persist a session until the first message is sent.
		// Just clear the current pointer so the next POST /api/chat creates a
		// fresh entry server-side.
		try {
			await fetch("/api/chat/session", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "clear", context }),
			});
		} catch (err) {
			console.warn("Failed to clear current session:", err);
		}
		setCurrentId(null);
		setInitialMessages([]);
		setRuntimeKey(`draft-${Date.now()}`);
	}

	async function handleAssistantFinish() {
		// Refresh sessions list so a freshly created session (lazy on first
		// message) and any updated title or sessionId show up immediately.
		await loadSessions();
	}

	async function handleActivate(id: string) {
		try {
			const r = await fetch("/api/chat/session", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "activate", id, context }),
			});
			if (r.ok) {
				setCurrentId(id);
				setRuntimeKey(id);
			}
		} catch (err) {
			console.warn("Failed to activate session:", err);
		}
	}

	async function handleRename(id: string, title: string) {
		try {
			const r = await fetch("/api/chat/session", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, title, context }),
			});
			if (r.ok) {
				const entry = (await r.json()) as SessionEntry;
				setSessions((prev) => prev.map((s) => (s.id === id ? entry : s)));
			}
		} catch (err) {
			console.warn("Failed to rename session:", err);
		}
	}

	async function handleDelete(id: string) {
		if (!window.confirm("Delete this chat session?")) return;
		try {
			const params = new URLSearchParams({ id });
			if (context) params.set("context", context);
			const r = await fetch(`/api/chat/session?${params.toString()}`, {
				method: "DELETE",
			});
			if (r.ok) {
				const data = (await r.json()) as { currentId: string | null };
				setSessions((prev) => prev.filter((s) => s.id !== id));
				setCurrentId(data.currentId);
				// If the deleted session was the one driving the runtime, swap
				// the runtime key so the thread remounts onto the new current
				// session (or a fresh draft if nothing remains).
				if (id === runtimeKey) {
					setRuntimeKey(data.currentId ?? `draft-${Date.now()}`);
				}
			}
		} catch (err) {
			console.warn("Failed to delete session:", err);
		}
	}

	if (isLoading) {
		return (
			<div className="flex flex-col h-full justify-center items-center">
				<div className="text-sm text-muted-foreground">Loading session…</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			<SessionPicker
				sessions={sortedSessions}
				currentId={currentId}
				onActivate={handleActivate}
				onNew={handleNewSession}
				onDelete={handleDelete}
				onRename={handleRename}
			/>
			{messagesLoading ? (
				<div className="flex flex-col flex-1 items-center justify-center">
					<span className="text-xs text-muted-foreground">
						Loading messages...
					</span>
				</div>
			) : (
				<ThreadWithRuntime
					key={runtimeKey}
					cwd={cwd}
					model={model}
					persona={persona}
					context={context}
					workspaceId={workspaceId}
					claudeSessionId={currentSession?.sessionId ?? null}
					initialMessages={initialMessages}
					onAssistantFinish={handleAssistantFinish}
				/>
			)}
		</div>
	);
}
