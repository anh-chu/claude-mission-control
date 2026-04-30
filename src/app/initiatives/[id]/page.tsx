"use client";

import {
	Activity,
	ArrowLeft,
	Check,
	CheckCircle2,
	Loader2,
	Pause,
	Play,
	Plus,
	Rocket,
	Trash2,
	X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MarkdownContent } from "@/components/markdown-content";
import { TaskForm, type TaskFormData } from "@/components/task-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

import {
	useActivityLog,
	useInitiatives,
	useInitiativeTasks,
	useProjects,
} from "@/hooks/use-data";
import { apiFetch } from "@/lib/api-client";
import { COLOR_SWATCHES } from "@/lib/constants";
import { showError, showSuccess } from "@/lib/toast";
import type { InitiativeStatus, Task } from "@/lib/types";

function kanbanBadge(kanban: Task["kanban"]) {
	switch (kanban) {
		case "done":
			return (
				<Badge className="bg-success-soft text-success border-success/30 text-[10px]">
					Done
				</Badge>
			);
		case "in-progress":
			return (
				<Badge className="bg-sunshine-500/20 text-sunshine-700 border-sunshine-500/30 text-[10px]">
					In Progress
				</Badge>
			);
		case "not-started":
			return (
				<Badge variant="outline" className="text-[10px] text-muted-foreground">
					Not Started
				</Badge>
			);
	}
}

function relativeTime(iso: string): string {
	const diffMs = Date.now() - new Date(iso).getTime();
	if (diffMs < 0) return "just now";
	const seconds = Math.floor(diffMs / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return new Date(iso).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}

function InitiativeActivitySection({ taskIds }: { taskIds: string[] }) {
	const { events, loading } = useActivityLog();
	const taskIdSet = new Set(taskIds);
	const filtered = events
		.filter((e) => e.taskId && taskIdSet.has(e.taskId))
		.slice(0, 10);

	if (loading) return null;
	if (filtered.length === 0) return null;

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base flex items-center gap-2">
					<Activity className="h-4 w-4" />
					Activity
					<Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1">
						{filtered.length}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent className="pt-0">
				<div className="divide-y">
					{filtered.map((event) => (
						<div key={event.id} className="flex items-start gap-3 py-2.5">
							<div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0 mt-1.5" />
							<div className="min-w-0 flex-1">
								<p className="text-sm">{event.summary}</p>
								<div className="flex items-center gap-2 mt-0.5">
									{event.actor && event.actor !== "system" && (
										<span className="text-xs text-muted-foreground">
											{event.actor}
										</span>
									)}
									<span className="text-xs text-muted-foreground">
										{relativeTime(event.timestamp)}
									</span>
								</div>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

export default function InitiativeDetailPage() {
	const params = useParams();
	const router = useRouter();
	const initiativeId = params.id as string;

	const {
		initiatives,
		update,
		remove,
		loading: loadingInitiatives,
	} = useInitiatives();
	const {
		tasks,
		loading: loadingTasks,
		refetch: refetchTasks,
	} = useInitiativeTasks(initiativeId);
	const { projects } = useProjects();

	const [addTaskOpen, setAddTaskOpen] = useState(false);
	const [togglingStatus, setTogglingStatus] = useState(false);
	const [deployingAll, setDeployingAll] = useState(false);

	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [tagInput, setTagInput] = useState("");
	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState("");
	const [editingDesc, setEditingDesc] = useState(false);
	const [descDraft, setDescDraft] = useState("");
	const cancelTitleRef = useRef(false);
	const cancelDescRef = useRef(false);

	const initiative = initiatives.find((i) => i.id === initiativeId);

	const project = initiative?.projectId
		? projects.find((p) => p.id === initiative.projectId)
		: null;

	const doneCount = tasks.filter((t) => t.kanban === "done").length;
	const totalCount = tasks.length;

	async function handleTogglePause() {
		if (!initiative) return;
		const newStatus = initiative.status === "paused" ? "active" : "paused";
		setTogglingStatus(true);
		try {
			await update(initiative.id, { status: newStatus });
			showSuccess(
				newStatus === "paused" ? "Initiative paused" : "Initiative resumed",
			);
		} catch {
			showError("Failed to update status");
		} finally {
			setTogglingStatus(false);
		}
	}

	async function handleSaveTitle() {
		if (!initiative) return;
		if (!titleDraft.trim() || titleDraft === initiative.title) {
			setEditingTitle(false);
			return;
		}
		await update(initiative.id, { title: titleDraft.trim() });
		setEditingTitle(false);
	}

	async function handleSaveDesc() {
		if (!initiative) return;
		if (descDraft === initiative.description) {
			setEditingDesc(false);
			return;
		}
		await update(initiative.id, { description: descDraft.trim() });
		setEditingDesc(false);
	}

	async function handleStatusChange(newStatus: InitiativeStatus) {
		if (!initiative) return;
		await update(initiative.id, { status: newStatus });
	}

	async function handleDeployAll() {
		if (!initiative) return;

		setDeployingAll(true);
		try {
			const res = await apiFetch(`/api/initiatives/${initiative.id}/deploy`, {
				method: "POST",
			});
			const data = (await res.json().catch(() => ({}))) as {
				error?: string;
				started?: number;
			};

			if (!res.ok) {
				showError(data.error ?? "Failed to deploy initiative");
				return;
			}

			const started = data.started ?? 0;
			showSuccess(
				started === 1 ? "Started 1 task" : `Started ${started} tasks`,
			);
			refetchTasks();
		} catch {
			showError("Failed to deploy initiative");
		} finally {
			setDeployingAll(false);
		}
	}

	if (loadingInitiatives) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-32 w-full" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	if (!initiative) {
		return (
			<div className="space-y-6">
				<BreadcrumbNav
					items={[
						{ label: "Initiatives", href: "/initiatives" },
						{ label: "Not Found" },
					]}
				/>
				<Card>
					<CardContent className="py-12 text-center">
						<h2 className="text-lg font-normal">Initiative not found</h2>
						<p className="text-sm text-muted-foreground mt-1">
							This initiative may have been deleted.
						</p>
						<Button
							className="mt-4 gap-1.5"
							onClick={() => router.push("/initiatives")}
						>
							<ArrowLeft className="h-4 w-4" /> Back to Initiatives
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<BreadcrumbNav
				items={[
					{ label: "Initiatives", href: "/initiatives" },
					{ label: initiative.title },
				]}
			/>

			<div className="space-y-3">
				<div className="flex items-start gap-3 min-w-0">
					<Popover>
						<PopoverTrigger asChild>
							<button
								type="button"
								className="h-4 w-4 rounded-full shrink-0 mt-2 cursor-pointer ring-offset-background transition-all hover:ring-2 hover:ring-ring hover:ring-offset-2"
								style={{ backgroundColor: initiative.color }}
								title="Click to change color"
							/>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-3" align="start">
							<div className="flex flex-wrap gap-2">
								{COLOR_SWATCHES.map((c) => (
									<button
										key={c}
										type="button"
										className="h-6 w-6 rounded-full border-2 transition-all"
										style={{
											backgroundColor: c,
											borderColor:
												initiative.color === c ? "white" : "transparent",
											outline:
												initiative.color === c ? `2px solid ${c}` : "none",
											outlineOffset: "2px",
										}}
										onClick={() => update(initiative.id, { color: c })}
									/>
								))}
							</div>
						</PopoverContent>
					</Popover>
					<div className="min-w-0 flex-1 space-y-1">
						{editingTitle ? (
							<input
								autoFocus
								className="w-full text-2xl font-normal bg-transparent border-b border-primary outline-none"
								value={titleDraft}
								onChange={(e) => setTitleDraft(e.target.value)}
								onBlur={() => {
									if (cancelTitleRef.current) {
										cancelTitleRef.current = false;
										return;
									}
									handleSaveTitle();
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										e.currentTarget.blur();
									}
									if (e.key === "Escape") {
										e.preventDefault();
										cancelTitleRef.current = true;
										setTitleDraft(initiative.title);
										setEditingTitle(false);
									}
								}}
							/>
						) : (
							<h1
								className="text-2xl font-normal cursor-text hover:opacity-80 transition-opacity"
								onClick={() => {
									setTitleDraft(initiative.title);
									setEditingTitle(true);
								}}
								title="Click to edit"
							>
								{initiative.title}
							</h1>
						)}
						{editingDesc ? (
							<textarea
								autoFocus
								className="w-full text-sm text-muted-foreground bg-transparent border-b border-primary outline-none resize-none"
								value={descDraft}
								rows={2}
								onChange={(e) => setDescDraft(e.target.value)}
								onBlur={() => {
									if (cancelDescRef.current) {
										cancelDescRef.current = false;
										return;
									}
									handleSaveDesc();
								}}
								onKeyDown={(e) => {
									if (e.key === "Escape") {
										e.preventDefault();
										cancelDescRef.current = true;
										setDescDraft(initiative.description ?? "");
										setEditingDesc(false);
									}
								}}
							/>
						) : (
							<div
								className="cursor-text hover:opacity-80 transition-opacity"
								onClick={() => {
									setDescDraft(initiative.description ?? "");
									setEditingDesc(true);
								}}
								title="Click to edit"
							>
								{initiative.description ? (
									<MarkdownContent
										content={initiative.description}
										className="text-sm"
									/>
								) : (
									<p className="text-sm text-muted-foreground/40 italic">
										Click to add description
									</p>
								)}
							</div>
						)}
						{project && (
							<p className="text-xs text-muted-foreground">
								Project:{" "}
								<Link
									href={`/projects/${project.id}`}
									className="hover:underline text-primary"
								>
									{project.name}
								</Link>
							</p>
						)}
						<div className="flex flex-wrap items-center gap-1.5 pt-1">
							{(initiative.tags ?? []).map((tag) => (
								<Badge
									key={tag}
									variant="secondary"
									className="gap-1 pr-1 text-xs"
								>
									{tag}
									<button
										type="button"
										onClick={() =>
											update(initiative.id, {
												tags: initiative.tags.filter((t) => t !== tag),
											})
										}
										className="rounded-full hover:bg-muted-foreground/20 p-0.5 ml-0.5"
									>
										<X className="h-3 w-3" />
									</button>
								</Badge>
							))}
							<Input
								className="h-6 w-24 text-xs px-1.5"
								placeholder="Add tag…"
								value={tagInput}
								onChange={(e) => setTagInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && tagInput.trim()) {
										e.preventDefault();
										const newTag = tagInput.trim();
										if (!initiative.tags.includes(newTag)) {
											update(initiative.id, {
												tags: [...initiative.tags, newTag],
											});
										}
										setTagInput("");
									}
								}}
								onBlur={() => {
									if (tagInput.trim()) {
										const newTag = tagInput.trim();
										if (!initiative.tags.includes(newTag)) {
											update(initiative.id, {
												tags: [...initiative.tags, newTag],
											});
										}
										setTagInput("");
									}
								}}
							/>
						</div>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2 pl-7">
					<span className="text-xs text-muted-foreground">Status:</span>
					{(
						["active", "paused", "completed", "archived"] as InitiativeStatus[]
					).map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => handleStatusChange(s)}
							className={`text-xs px-2.5 py-1 rounded-sm border transition-all capitalize ${
								initiative.status === s
									? s === "active"
										? "bg-sunshine-500/20 text-sunshine-700 border-sunshine-500/40"
										: s === "paused"
											? "bg-muted text-muted-foreground border-border"
											: s === "completed"
												? "bg-success-soft text-success border-success/40"
												: "bg-muted text-muted-foreground border-border"
									: "bg-transparent text-muted-foreground border-border hover:border-muted-foreground/50"
							}`}
						>
							{s}
						</button>
					))}
					{(initiative.status === "active" ||
						initiative.status === "paused") && (
						<Button
							variant="outline"
							size="sm"
							className="h-6 text-xs gap-1 px-2 ml-1"
							onClick={handleTogglePause}
							disabled={togglingStatus}
						>
							{initiative.status === "paused" ? (
								<>
									<Play className="h-3 w-3" /> Resume
								</>
							) : (
								<>
									<Pause className="h-3 w-3" /> Pause
								</>
							)}
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						className="h-6 text-xs gap-1 px-2"
						onClick={handleDeployAll}
						disabled={deployingAll}
					>
						{deployingAll ? (
							<Loader2 className="h-3 w-3 animate-spin" />
						) : (
							<Rocket className="h-3 w-3" />
						)}
						Deploy All
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-6 w-6 p-0 ml-auto text-destructive hover:text-destructive"
						onClick={() => setShowDeleteConfirm(true)}
						title="Delete initiative"
					>
						<Trash2 className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>

			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-normal">
						Tasks{" "}
						{!loadingTasks && (
							<span className="text-xs opacity-60">({tasks.length})</span>
						)}
					</h2>
					{!loadingTasks && totalCount > 0 && (
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<CheckCircle2 className="h-3.5 w-3.5 text-success" />
							<span>
								{doneCount} of {totalCount} done
							</span>
						</div>
					)}
				</div>

				<div>
					<Card>
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<CardTitle className="text-base">Tasks</CardTitle>
								<Button
									size="sm"
									className="gap-1.5"
									onClick={() => setAddTaskOpen(true)}
								>
									<Plus className="h-4 w-4" /> Add Task
								</Button>
							</div>
						</CardHeader>
						<CardContent>
							{loadingTasks ? (
								<div className="space-y-2">
									{[1, 2].map((i) => (
										<Skeleton key={i} className="h-10 w-full" />
									))}
								</div>
							) : tasks.length === 0 ? (
								<div className="text-center py-8 text-muted-foreground">
									<p className="text-sm">
										No tasks linked to this initiative yet.
									</p>
								</div>
							) : (
								<div className="divide-y">
									{tasks.map((task) => (
										<div
											key={task.id}
											className="flex items-center justify-between py-2.5 gap-3"
										>
											<div className="flex items-center gap-2 min-w-0 flex-1">
												{task.kanban === "done" ? (
													<Check className="h-3.5 w-3.5 text-success shrink-0" />
												) : (
													<div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 shrink-0" />
												)}
												<span
													className={`text-sm truncate ${task.kanban === "done" ? "line-through text-muted-foreground" : ""}`}
												>
													{task.title}
												</span>
											</div>
											<div className="flex items-center gap-2 shrink-0">
												{task.assignedTo && (
													<span className="text-xs text-muted-foreground">
														{task.assignedTo}
													</span>
												)}
												{kanbanBadge(task.kanban)}
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>

			<InitiativeActivitySection taskIds={initiative.taskIds} />

			<Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
				<DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Add Task</DialogTitle>
					</DialogHeader>
					<TaskForm
						initial={{ initiativeId }}
						allTasks={tasks}
						onSubmit={async (data: TaskFormData) => {
							const res = await apiFetch("/api/tasks", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									...data,
									tags: data.tags
										? data.tags
												.split(",")
												.map((t) => t.trim())
												.filter(Boolean)
										: [],
									acceptanceCriteria: data.acceptanceCriteria ?? "",
									initiativeId,
								}),
							});
							if (!res.ok) {
								const err = (await res.json().catch(() => ({}))) as {
									error?: string;
								};
								throw new Error(err.error ?? "Failed to create task");
							}
							showSuccess("Task created");
							setAddTaskOpen(false);
							refetchTasks();
						}}
						onCancel={() => setAddTaskOpen(false)}
						submitLabel="Add Task"
					/>
				</DialogContent>
			</Dialog>

			<ConfirmDialog
				open={showDeleteConfirm}
				onOpenChange={setShowDeleteConfirm}
				title="Delete initiative?"
				description={`"${initiative.title}" will be deleted. Tasks and actions linked to it will remain.`}
				confirmLabel="Delete"
				variant="destructive"
				onConfirm={async () => {
					await remove(initiative.id);
					router.push("/initiatives");
				}}
			/>
		</div>
	);
}
