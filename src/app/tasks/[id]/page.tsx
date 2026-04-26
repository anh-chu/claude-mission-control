"use client";

import {
	Activity,
	ArrowLeft,
	CheckCircle2,
	Clock,
	Link2,
	ListChecks,
	MessageSquare,
	Rocket,
	Send,
	Trash2,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MarkdownContent } from "@/components/markdown-content";
import { MentionTextarea } from "@/components/mention-textarea";
import { TaskForm, type TaskFormData } from "@/components/task-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/tip";
import {
	useActivityLog,
	useAgents,
	useDecisions,
	useInbox,
	useProjects,
	useTasks,
} from "@/hooks/use-data";
import { getAgentIcon } from "@/lib/agent-icons";
import { apiFetch } from "@/lib/api-client";
import type { AgentRole, Task } from "@/lib/types";
import { getQuadrant } from "@/lib/types";
import { cn, parseAgentMentions } from "@/lib/utils";

const quadrantLabels: Record<string, { label: string; color: string }> = {
	do: {
		label: "DO",
		color: "bg-quadrant-do-soft text-quadrant-do border-quadrant-do/30",
	},
	schedule: {
		label: "SCHEDULE",
		color:
			"bg-quadrant-schedule-soft text-quadrant-schedule border-quadrant-schedule/30",
	},
	delegate: {
		label: "DELEGATE",
		color:
			"bg-quadrant-delegate-soft text-quadrant-delegate border-quadrant-delegate/30",
	},
	eliminate: {
		label: "ELIMINATE",
		color:
			"bg-quadrant-eliminate-soft text-quadrant-eliminate border-quadrant-eliminate/30",
	},
};

export default function TaskDetailPage() {
	const params = useParams();
	const router = useRouter();
	const taskId = params.id as string;

	const {
		tasks,
		loading: loadingTasks,
		update: updateTask,
		remove: deleteTask,
	} = useTasks();
	const { projects } = useProjects();
	const { events } = useActivityLog();
	const { messages } = useInbox();
	const { agents } = useAgents();
	const { decisions } = useDecisions();

	const task = tasks.find((t) => t.id === taskId);

	const [commentText, setCommentText] = useState("");
	const [stagedFiles, setStagedFiles] = useState<File[]>([]);
	const [localComments, setLocalComments] = useState<Task["comments"]>([]);
	const [timelineOpen, setTimelineOpen] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	// Sync local comments when task data changes
	useEffect(() => {
		if (task) {
			setLocalComments(task.comments ?? []);
		}
	}, [task]);

	const activeAgents = agents.filter((a) => a.status === "active");
	const deployableAgents = activeAgents.filter((a) => a.id !== "me");
	const mentionedAgentIds = parseAgentMentions(commentText);

	const handleUpdate = useCallback(
		async (data: TaskFormData) => {
			if (!task) return;
			await updateTask(task.id, {
				...data,
				tags: data.tags
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean),
				acceptanceCriteria: data.acceptanceCriteria ?? "",
			});
			toast.success("Task saved");
		},
		[task, updateTask],
	);

	const handleDeploy = useCallback(
		async (role: AgentRole) => {
			if (!task) return;
			const deployData: TaskFormData = {
				title: task.title,
				description: task.description,
				importance: task.importance,
				urgency: task.urgency,
				kanban: task.kanban === "not-started" ? "in-progress" : task.kanban,
				projectId: task.projectId,
				milestoneId: task.milestoneId,
				initiativeId: task.initiativeId ?? null,
				assignedTo: role,
				collaborators: task.collaborators ?? [],
				tags: task.tags.join(", "),
				subtasks: task.subtasks ?? [],
				blockedBy: task.blockedBy ?? [],
				estimatedMinutes: task.estimatedMinutes ?? null,
				dueDate: task.dueDate ?? null,
				acceptanceCriteria: task.acceptanceCriteria ?? "",
			};
			const agent = agents.find((a) => a.id === role);
			const agentLabel = agent?.name ?? role;

			await fetch("/api/tasks", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: task.id, ...deployData }),
			});

			const runRes = await fetch(`/api/tasks/${task.id}/run`, {
				method: "POST",
			});
			if (runRes.ok) {
				toast.success(`Agent started: ${agentLabel}`, { icon: "🚀" });
			} else {
				const err = (await runRes.json()) as { error?: string };
				toast.error(`Deploy failed: ${err.error ?? "unknown error"}`);
			}
		},
		[task, agents],
	);

	const handleDelete = useCallback(async () => {
		if (!task) return;
		await deleteTask(task.id);
		router.back();
	}, [task, deleteTask, router]);

	const handleAddComment = useCallback(async () => {
		if (!task) return;
		const trimmed = commentText.trim();
		if (!trimmed && stagedFiles.length === 0) return;
		if (!trimmed) return;

		// Upload staged files first
		const uploadedAttachments: Array<{
			id: string;
			type: "image" | "file";
			url: string;
			filename: string;
		}> = [];
		for (const file of stagedFiles) {
			try {
				const formData = new FormData();
				formData.append("file", file);
				const uploadRes = await fetch("/api/upload", {
					method: "POST",
					body: formData,
				});
				if (uploadRes.ok) {
					const uploadData = (await uploadRes.json()) as {
						url: string;
						filename: string;
					};
					uploadedAttachments.push({
						id: `att_${Date.now()}_${Math.random().toString(36).slice(2)}`,
						type: file.type.startsWith("image/") ? "image" : "file",
						url: uploadData.url,
						filename: uploadData.filename,
					});
				}
			} catch {
				/* non-fatal upload error */
			}
		}

		try {
			const res = await apiFetch(`/api/tasks/${task.id}/comment`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content: trimmed,
					author: "me",
					...(uploadedAttachments.length > 0
						? { attachments: uploadedAttachments }
						: {}),
				}),
			});

			if (!res.ok) {
				const data = await res.json();
				toast.error(data.error ?? "Failed to add comment");
				return;
			}

			const data = await res.json();
			setLocalComments((prev) => [...(prev ?? []), data.comment]);
			setCommentText("");
			setStagedFiles([]);

			const mentions = data.mentionedAgents as string[];
			if (mentions.length > 0) {
				toast.success(`Comment sent, @${mentions.join(", @")} notified`);
			} else {
				toast.success("Comment added");
			}
		} catch {
			toast.error("Failed to add comment");
		}
	}, [commentText, stagedFiles, task]);

	const handleDeleteComment = useCallback(
		async (commentId: string) => {
			if (!task) return;
			try {
				const res = await apiFetch(
					`/api/tasks/${task.id}/comment?commentId=${encodeURIComponent(commentId)}`,
					{ method: "DELETE" },
				);
				if (!res.ok) {
					toast.error("Failed to delete comment");
					return;
				}
				setLocalComments((prev) =>
					(prev ?? []).filter((c) => c.id !== commentId),
				);
				toast.success("Comment deleted");
			} catch {
				toast.error("Failed to delete comment");
			}
		},
		[task],
	);

	if (loadingTasks) {
		return (
			<div className="container mx-auto py-6 max-w-screen-2xl space-y-6">
				<Skeleton className="h-8 w-64" />
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
					<div className="lg:col-span-8 space-y-4">
						<Skeleton className="h-32 w-full" />
						<Skeleton className="h-64 w-full" />
					</div>
					<div className="lg:col-span-4 space-y-4">
						<Skeleton className="h-48 w-full" />
						<Skeleton className="h-32 w-full" />
					</div>
				</div>
			</div>
		);
	}

	if (!task) {
		return (
			<div className="container mx-auto py-6 max-w-screen-2xl space-y-6">
				<BreadcrumbNav
					items={[{ label: "Tasks", href: "/tasks" }, { label: "Not Found" }]}
				/>
				<Card>
					<CardContent className="py-12 text-center">
						<h2 className="text-lg font-normal">Task not found</h2>
						<p className="text-sm text-muted-foreground mt-1">
							This task may have been deleted.
						</p>
						<Button className="mt-4 gap-1.5" onClick={() => router.back()}>
							<ArrowLeft className="h-4 w-4" /> Go back
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const quadrant = getQuadrant(task);
	const qi = quadrantLabels[quadrant];
	const project = projects.find((p) => p.id === task.projectId);

	// Summary stats
	const subtaskCount = task.subtasks?.length ?? 0;
	const subtaskDone = task.subtasks?.filter((s) => s.done).length ?? 0;
	const depCount = task.blockedBy?.length ?? 0;
	const unmetDepCount = (task.blockedBy ?? []).filter((depId) => {
		const dep = tasks.find((t) => t.id === depId);
		return dep && dep.kanban !== "done";
	}).length;
	const hasAwaitingDecision = decisions.some(
		(d) => d.taskId === task.id && d.status === "pending",
	);
	const criteriaCount = (task.acceptanceCriteria ?? "")
		.split("\n")
		.map((s) => s.trim())
		.filter(Boolean).length;

	// Build breadcrumb based on project or initiative
	const breadcrumbItems = [
		...(project
			? [
					{ label: "Projects", href: "/projects" },
					{ label: project.name, href: `/projects/${project.id}` },
				]
			: [{ label: "Tasks", href: "/tasks" }]),
		{ label: task.title },
	];

	// Timeline: merge activity events and inbox messages for this task
	const taskEvents = events
		.filter((e) => e.taskId === task.id)
		.map((e) => ({
			id: e.id,
			type: "event" as const,
			actor: e.actor,
			summary: e.summary,
			timestamp: e.timestamp,
		}));
	const taskMessages = messages
		.filter((m) => m.taskId === task.id)
		.map((m) => ({
			id: m.id,
			type: "message" as const,
			actor: m.from,
			summary: `${m.type}: ${m.subject}`,
			timestamp: m.createdAt,
		}));
	const timeline = [...taskEvents, ...taskMessages].sort(
		(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
	);

	const comments = localComments ?? [];

	return (
		<div className="container mx-auto py-6 max-w-screen-2xl space-y-6">
			{/* Top nav row */}
			<div className="flex items-center gap-4 mb-4">
				<Button variant="ghost" size="icon" onClick={() => router.back()}>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<BreadcrumbNav items={breadcrumbItems} />
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
				{/* Left column: badges, actions, form, timestamps */}
				<div className="lg:col-span-8 space-y-6">
					<Card>
						<CardHeader className="pb-3">
							{/* Badges + actions row */}
							<div className="flex items-start justify-between gap-3 flex-wrap">
								<div className="flex items-center gap-2 flex-wrap">
									<Badge variant="outline" className={cn("text-xs", qi.color)}>
										{qi.label}
									</Badge>
									{project && (
										<Badge
											variant="outline"
											className="text-xs"
											style={{
												borderColor: project.color,
												color: project.color,
											}}
										>
											{project.name}
										</Badge>
									)}
									{subtaskCount > 0 && (
										<Badge variant="secondary" className="text-xs gap-1">
											<ListChecks className="h-3 w-3" />
											{subtaskDone}/{subtaskCount}
										</Badge>
									)}
									{depCount > 0 && (
										<Badge
											variant="secondary"
											className={cn(
												"text-xs gap-1",
												unmetDepCount > 0
													? "border-accent/30 text-accent"
													: "",
											)}
										>
											<Link2 className="h-3 w-3" />
											{unmetDepCount > 0
												? `${unmetDepCount} pending dep${unmetDepCount > 1 ? "s" : ""}`
												: `${depCount} dep${depCount > 1 ? "s" : ""}`}
										</Badge>
									)}
									{hasAwaitingDecision && (
										<Badge
											variant="secondary"
											className="text-xs gap-1 border-sunshine-700/30 text-sunshine-700"
										>
											<Clock className="h-3 w-3" />
											Awaiting Decision
										</Badge>
									)}
									{criteriaCount > 0 && (
										<Badge variant="secondary" className="text-xs gap-1">
											<CheckCircle2 className="h-3 w-3" />
											{criteriaCount}{" "}
											{criteriaCount === 1 ? "criterion" : "criteria"}
										</Badge>
									)}
								</div>
								<div className="flex items-center gap-1 shrink-0">
									<DropdownMenu>
										<Tip content="Deploy to agent">
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													className="text-primary hover:bg-primary/10"
													aria-label="Deploy to agent"
												>
													<Rocket className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
										</Tip>
										<DropdownMenuContent align="end" className="min-w-[180px]">
											{deployableAgents.map((agent) => {
												const Icon = getAgentIcon(agent.id, agent.icon);
												const isCurrentAssignee = task.assignedTo === agent.id;
												return (
													<DropdownMenuItem
														key={agent.id}
														onClick={() => handleDeploy(agent.id)}
														className={cn(isCurrentAssignee && "bg-accent")}
													>
														<Icon className="mr-2 h-4 w-4" />
														<span className="flex-1">{agent.name}</span>
														{isCurrentAssignee && (
															<Badge
																variant="secondary"
																className="ml-2 text-[10px] px-1.5 py-0"
															>
																active
															</Badge>
														)}
													</DropdownMenuItem>
												);
											})}
										</DropdownMenuContent>
									</DropdownMenu>
									<Tip content="Delete task">
										<Button
											variant="ghost"
											size="icon"
											className="text-destructive hover:bg-destructive/10"
											onClick={() => setShowDeleteConfirm(true)}
											aria-label="Delete task"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</Tip>
								</div>
							</div>
						</CardHeader>
						<CardContent className="pt-0">
							<TaskForm
								initial={{
									title: task.title,
									description: task.description,
									importance: task.importance,
									urgency: task.urgency,
									kanban: task.kanban,
									projectId: task.projectId,
									milestoneId: task.milestoneId,
									initiativeId: task.initiativeId ?? null,
									assignedTo: task.assignedTo,
									collaborators: task.collaborators ?? [],
									tags: task.tags.join(", "),
									subtasks: task.subtasks ?? [],
									blockedBy: task.blockedBy ?? [],
									estimatedMinutes: task.estimatedMinutes ?? null,
									dueDate: task.dueDate ?? null,
									acceptanceCriteria: task.acceptanceCriteria ?? "",
								}}
								projects={projects}
								allTasks={tasks}
								currentTaskId={task.id}
								onSubmit={handleUpdate}
								onCancel={() => router.back()}
								submitLabel="Save Changes"
							/>
						</CardContent>
					</Card>

					{/* Timestamps footer */}
					<div className="text-xs text-muted-foreground flex gap-4 px-1">
						<span>
							Created: {new Date(task.createdAt).toLocaleDateString()}
						</span>
						<span>
							Updated: {new Date(task.updatedAt).toLocaleDateString()}
						</span>
						{task.estimatedMinutes && (
							<span>Est: {task.estimatedMinutes}m</span>
						)}
					</div>
				</div>

				{/* Right column: comments + timeline, sticky */}
				<div className="lg:col-span-4 space-y-6 sticky top-6">
					{/* Comments card */}
					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-center gap-2 text-sm font-normal">
								<MessageSquare className="h-4 w-4" />
								Comments {comments.length > 0 && `(${comments.length})`}
							</div>
						</CardHeader>
						<CardContent className="pt-0 space-y-3">
							{/* Scrollable comment list */}
							<div className="max-h-[500px] overflow-y-auto space-y-3 pr-1">
								{comments.length > 0 ? (
									comments.map((comment) => {
										const authorAgent = agents.find(
											(a) => a.id === comment.author,
										);
										const AuthorIcon =
											comment.author === "system"
												? Activity
												: getAgentIcon(comment.author, authorAgent?.icon);
										const isAgent =
											comment.author !== "me" && comment.author !== "system";
										return (
											<div
												key={comment.id}
												className={cn(
													"flex gap-2 group/comment",
													isAgent && "pl-2 border-l-2 border-accent/30",
												)}
											>
												<div
													className={cn(
														"h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
														isAgent ? "bg-accent-soft" : "bg-muted",
													)}
												>
													<AuthorIcon
														className={cn(
															"h-3 w-3",
															isAgent
																? "text-accent"
																: "text-muted-foreground",
														)}
													/>
												</div>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<span
															className={cn(
																"text-xs font-normal",
																isAgent && "text-accent",
															)}
														>
															{comment.author === "system"
																? "System"
																: (authorAgent?.name ?? comment.author)}
														</span>
														<span className="text-[10px] text-muted-foreground">
															{new Date(comment.createdAt).toLocaleDateString()}{" "}
															{new Date(comment.createdAt).toLocaleTimeString(
																[],
																{
																	hour: "2-digit",
																	minute: "2-digit",
																},
															)}
														</span>
														<button
															type="button"
															className="opacity-0 group-hover/comment:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-auto"
															onClick={() => handleDeleteComment(comment.id)}
															aria-label="Delete comment"
														>
															<Trash2 className="h-3 w-3" />
														</button>
													</div>
													<MarkdownContent content={comment.content} />
													{comment.attachments &&
														comment.attachments.length > 0 && (
															<div className="flex flex-wrap gap-2 mt-1.5">
																{comment.attachments.map((att) =>
																	att.type === "image" ? (
																		// biome-ignore lint/performance/noImgElement: user-uploaded content with dynamic URLs
																		// eslint-disable-next-line @next/next/no-img-element
																		<img
																			key={att.id}
																			src={att.url}
																			alt={att.filename}
																			className="rounded-sm max-h-32 max-w-[200px] object-contain border border-border/50"
																		/>
																	) : (
																		<a
																			key={att.id}
																			href={att.url}
																			target="_blank"
																			rel="noopener noreferrer"
																			className="flex items-center gap-1 bg-muted rounded-sm px-2 py-0.5 text-xs text-accent hover:text-sunshine-700"
																		>
																			📎 {att.filename}
																		</a>
																	),
																)}
															</div>
														)}
												</div>
											</div>
										);
									})
								) : (
									<p className="text-xs text-muted-foreground py-1">
										No comments yet
									</p>
								)}
							</div>

							{/* Comment input, pinned at bottom of card */}
							<div className="flex gap-2 items-end pt-2 border-t border-border/50">
								<div className="flex-1 min-w-0">
									<MentionTextarea
										value={commentText}
										onChange={setCommentText}
										agents={activeAgents}
										onSubmit={handleAddComment}
										stagedFiles={stagedFiles}
										onFilesChange={setStagedFiles}
									/>
								</div>
								<Tip
									content={
										mentionedAgentIds.length > 0
											? `Send to @${mentionedAgentIds.join(", @")}`
											: "Post comment"
									}
								>
									<Button
										size="icon"
										variant="ghost"
										className={cn(
											"shrink-0 self-end",
											mentionedAgentIds.length > 0 &&
												"text-accent hover:text-sunshine-700",
										)}
										onClick={handleAddComment}
										disabled={!commentText.trim() && stagedFiles.length === 0}
										aria-label={
											mentionedAgentIds.length > 0
												? `Send to @${mentionedAgentIds.join(", @")}`
												: "Send comment"
										}
									>
										<Send className="h-4 w-4" />
									</Button>
								</Tip>
							</div>
						</CardContent>
					</Card>

					{/* Activity timeline card */}
					<Card>
						<Collapsible open={timelineOpen} onOpenChange={setTimelineOpen}>
							<CollapsibleTrigger className="flex items-center gap-2 w-full text-left px-6 py-4 hover:text-foreground text-muted-foreground transition-colors">
								<Clock className="h-4 w-4" />
								<span className="text-sm font-normal">
									Timeline {timeline.length > 0 && `(${timeline.length})`}
								</span>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<CardContent className="pt-0 pb-4">
									{timeline.length > 0 ? (
										<div className="relative space-y-0 pl-3 border-l border-border">
											{timeline.map((item) => {
												const actorAgent = agents.find(
													(a) => a.id === item.actor,
												);
												const ActorIcon =
													item.actor === "system"
														? Activity
														: getAgentIcon(item.actor, actorAgent?.icon);
												return (
													<div
														key={item.id}
														className="relative pb-3 last:pb-0"
													>
														<div className="absolute -left-[calc(0.75rem+4.5px)] top-1 h-2 w-2 rounded-full bg-border" />
														<div className="flex items-start gap-2">
															<ActorIcon className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
															<div className="flex-1 min-w-0">
																<p className="text-xs text-muted-foreground truncate">
																	{item.summary}
																</p>
																<p className="text-[10px] text-muted-foreground/60">
																	{new Date(
																		item.timestamp,
																	).toLocaleDateString()}{" "}
																	{new Date(item.timestamp).toLocaleTimeString(
																		[],
																		{
																			hour: "2-digit",
																			minute: "2-digit",
																		},
																	)}
																</p>
															</div>
															<Badge
																variant="secondary"
																className="text-[10px] px-1.5 py-0 shrink-0"
															>
																{item.type === "event" ? "activity" : "message"}
															</Badge>
														</div>
													</div>
												);
											})}
										</div>
									) : (
										<p className="text-xs text-muted-foreground py-1">
											No activity yet
										</p>
									)}
								</CardContent>
							</CollapsibleContent>
						</Collapsible>
					</Card>
				</div>
			</div>

			<ConfirmDialog
				open={showDeleteConfirm}
				onOpenChange={setShowDeleteConfirm}
				title="Delete task?"
				description={`"${task.title}" will be permanently deleted. This action cannot be undone.`}
				confirmLabel="Delete"
				variant="destructive"
				onConfirm={handleDelete}
			/>
		</div>
	);
}
