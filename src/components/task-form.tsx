"use client";

import {
	CalendarDays,
	CheckSquare,
	Clock,
	Link2,
	Paperclip,
	Plus,
	Square,
	Users,
	X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { MarkdownContent } from "@/components/markdown-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAgents, useInitiatives } from "@/hooks/use-data";
import { getAgentIcon } from "@/lib/agent-icons";
import type {
	AgentRole,
	Importance,
	KanbanStatus,
	Project,
	Subtask,
	Task,
	Urgency,
} from "@/lib/types";
import { cn } from "@/lib/utils";
// AGENT_ROLES kept for backward compat reference
// import { AGENT_ROLES } from "@/lib/types";
import { LIMITS } from "@/lib/validations";

export interface TaskFormData {
	title: string;
	description: string;
	importance: Importance;
	urgency: Urgency;
	kanban: KanbanStatus;
	projectId: string | null;
	milestoneId: string | null;
	initiativeId: string | null;
	assignedTo: AgentRole | null;
	collaborators: string[];
	tags: string;
	subtasks: Subtask[];
	blockedBy: string[];
	estimatedMinutes: number | null;
	dueDate: string | null;
	acceptanceCriteria: string;
}

interface TaskFormProps {
	initial?: Partial<TaskFormData>;
	projects: Project[];
	allTasks?: Task[];
	currentTaskId?: string;
	onSubmit: (data: TaskFormData) => void;
	onCancel: () => void;
	submitLabel?: string;
}

// projects kept in props for backward compat with callers
export function TaskForm({
	initial,
	allTasks,
	currentTaskId,
	onSubmit,
	onCancel,
	submitLabel = "Save",
}: TaskFormProps) {
	const { agents } = useAgents();
	const activeAgents = agents.filter((a) => a.status === "active");
	const { initiatives } = useInitiatives();
	const activeInitiatives = initiatives.filter((i) => !i.deletedAt);

	const [editingDesc, setEditingDesc] = useState(false);
	const descFileInputRef = useRef<HTMLInputElement>(null);
	const handleDescFileAttach = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;
			e.target.value = "";
			try {
				const formData = new FormData();
				formData.append("file", file);
				const res = await fetch("/api/upload", {
					method: "POST",
					body: formData,
				});
				if (!res.ok) return;
				const data = (await res.json()) as { url: string; filename: string };
				const md = file.type.startsWith("image/")
					? `![${data.filename}](${data.url})`
					: `[${data.filename}](${data.url})`;
				setForm((prev) => ({
					...prev,
					description: prev.description ? `${prev.description}\n${md}` : md,
				}));
			} catch {
				/* non-fatal */
			}
		},
		[],
	);

	const [form, setForm] = useState<TaskFormData>({
		title: initial?.title ?? "",
		description: initial?.description ?? "",
		importance: initial?.importance ?? "not-important",
		urgency: initial?.urgency ?? "not-urgent",
		kanban: initial?.kanban ?? "not-started",
		projectId: initial?.projectId ?? null,
		milestoneId: initial?.milestoneId ?? null,
		initiativeId: initial?.initiativeId ?? null,
		assignedTo: initial?.assignedTo ?? null,
		collaborators: initial?.collaborators ?? [],
		tags: initial?.tags ?? "",
		subtasks: initial?.subtasks ?? [],
		blockedBy: initial?.blockedBy ?? [],
		estimatedMinutes: initial?.estimatedMinutes ?? null,
		dueDate: initial?.dueDate ?? null,
		acceptanceCriteria: initial?.acceptanceCriteria ?? "",
	});

	const [newSubtask, setNewSubtask] = useState("");
	const [showDeps, setShowDeps] = useState(form.blockedBy.length > 0);
	const [depSearch, setDepSearch] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [isSubmitting, setIsSubmitting] = useState(false);

	const clearError = (field: string) => {
		setErrors((prev) => {
			if (!(field in prev)) return prev;
			const next = { ...prev };
			delete next[field];
			return next;
		});
	};

	// Available tasks for dependency picker (exclude self)
	const depTasks = allTasks?.filter((t) => t.id !== currentTaskId) ?? [];
	const filteredDepTasks = depSearch.trim()
		? depTasks.filter((t) =>
				t.title.toLowerCase().includes(depSearch.toLowerCase()),
			)
		: depTasks;

	// ─── Subtask handlers ──────────────────────────────────────────────────────

	const addSubtask = () => {
		const trimmed = newSubtask.trim();
		if (!trimmed) return;
		const sub: Subtask = {
			id: `sub_${Date.now()}`,
			title: trimmed,
			done: false,
		};
		setForm({ ...form, subtasks: [...form.subtasks, sub] });
		setNewSubtask("");
	};

	const toggleSubtask = (id: string) => {
		setForm({
			...form,
			subtasks: form.subtasks.map((s) =>
				s.id === id ? { ...s, done: !s.done } : s,
			),
		});
	};

	const removeSubtask = (id: string) => {
		setForm({ ...form, subtasks: form.subtasks.filter((s) => s.id !== id) });
	};

	// ─── Dependency handlers ───────────────────────────────────────────────────

	const toggleDependency = (taskId: string) => {
		setForm({
			...form,
			blockedBy: form.blockedBy.includes(taskId)
				? form.blockedBy.filter((id) => id !== taskId)
				: [...form.blockedBy, taskId],
		});
	};

	// ─── Validation ────────────────────────────────────────────────────────────

	const validate = (): Record<string, string> => {
		const errs: Record<string, string> = {};
		if (!form.title.trim()) errs.title = "Title is required";
		else if (form.title.length > LIMITS.TITLE)
			errs.title = `Title must be under ${LIMITS.TITLE} characters`;
		if (form.description.length > LIMITS.DESCRIPTION)
			errs.description = `Description must be under ${LIMITS.DESCRIPTION} characters`;
		if (form.acceptanceCriteria.length > LIMITS.DESCRIPTION)
			errs.acceptanceCriteria = `Acceptance criteria must be under ${LIMITS.DESCRIPTION} characters`;
		return errs;
	};

	// ─── Submit ────────────────────────────────────────────────────────────────

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const fieldErrors = validate();
		setErrors(fieldErrors);
		if (Object.keys(fieldErrors).length > 0) return;
		setIsSubmitting(true);
		try {
			onSubmit(form);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label htmlFor="title">Title</Label>
					<span
						className={cn(
							"text-[10px] tabular-nums",
							form.title.length > LIMITS.TITLE
								? "text-destructive"
								: "text-muted-foreground",
						)}
					>
						{form.title.length}/{LIMITS.TITLE}
					</span>
				</div>
				<Input
					id="title"
					value={form.title}
					onChange={(e) => {
						setForm({ ...form, title: e.target.value });
						if (errors.title) clearError("title");
					}}
					placeholder="Task title"
					autoFocus
					aria-invalid={!!errors.title}
					aria-describedby={errors.title ? "title-error" : undefined}
					className={cn(
						errors.title && "border-destructive focus-visible:ring-destructive",
					)}
				/>
				{errors.title && (
					<p id="title-error" className="text-xs text-destructive">
						{errors.title}
					</p>
				)}
			</div>

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label htmlFor="description">Description</Label>
					<div className="flex items-center gap-2">
						<span
							className={cn(
								"text-[10px] tabular-nums",
								form.description.length > LIMITS.DESCRIPTION
									? "text-destructive"
									: "text-muted-foreground",
							)}
						>
							{form.description.length}/{LIMITS.DESCRIPTION}
						</span>
						<button
							type="button"
							title="Attach file"
							className="h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
							onClick={() => descFileInputRef.current?.click()}
						>
							<Paperclip className="h-3 w-3" />
						</button>
						<input
							ref={descFileInputRef}
							type="file"
							className="hidden"
							accept="image/*,.pdf,.txt,.md"
							onChange={handleDescFileAttach}
						/>
					</div>
				</div>
				{editingDesc ? (
					<Textarea
						id="description"
						autoFocus
						value={form.description}
						onChange={(e) => {
							setForm({ ...form, description: e.target.value });
							if (errors.description) clearError("description");
						}}
						onBlur={() => setEditingDesc(false)}
						onKeyDown={(e) => {
							if (e.key === "Escape") setEditingDesc(false);
						}}
						placeholder="Describe the task..."
						rows={3}
						aria-invalid={!!errors.description}
						aria-describedby={
							errors.description ? "description-error" : undefined
						}
						className={cn(
							errors.description &&
								"border-destructive focus-visible:ring-destructive",
						)}
					/>
				) : (
					<button
						type="button"
						className="cursor-text hover:bg-muted/40 rounded-sm p-2 -mx-1 transition-colors min-h-[60px] border border-transparent hover:border-border/40 w-full text-left appearance-none bg-transparent"
						onClick={() => setEditingDesc(true)}
						title="Click to edit"
					>
						{form.description ? (
							<MarkdownContent content={form.description} />
						) : (
							<p className="text-xs text-muted-foreground/40 italic">
								Click to add description...
							</p>
						)}
					</button>
				)}
				{errors.description && (
					<p id="description-error" className="text-xs text-destructive">
						{errors.description}
					</p>
				)}
			</div>

			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-2">
					<Label>Importance</Label>
					<Select
						value={form.importance}
						onValueChange={(v) =>
							setForm({ ...form, importance: v as Importance })
						}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="important">Important</SelectItem>
							<SelectItem value="not-important">Not Important</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label>Urgency</Label>
					<Select
						value={form.urgency}
						onValueChange={(v) => setForm({ ...form, urgency: v as Urgency })}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="urgent">Urgent</SelectItem>
							<SelectItem value="not-urgent">Not Urgent</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-2">
					<Label>Status</Label>
					<Select
						value={form.kanban}
						onValueChange={(v) =>
							setForm({ ...form, kanban: v as KanbanStatus })
						}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="not-started">Not Started</SelectItem>
							<SelectItem value="in-progress">In Progress</SelectItem>
							<SelectItem value="done">Done</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-2">
					<Label>Assigned To</Label>
					<Select
						value={form.assignedTo ?? "unassigned"}
						onValueChange={(v) => {
							const newAssignee = v === "unassigned" ? null : (v as AgentRole);
							setForm({
								...form,
								assignedTo: newAssignee,
								// Remove new assignee from collaborators if they were there
								collaborators: newAssignee
									? form.collaborators.filter((c) => c !== newAssignee)
									: form.collaborators,
							});
						}}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="unassigned">Unassigned</SelectItem>
							{activeAgents.map((agent) => (
								<SelectItem key={agent.id} value={agent.id}>
									{agent.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* ─── Collaborators ───────────────────────────────────────────────── */}
			{activeAgents.length > 0 && (
				<div className="space-y-2">
					<Label className="flex items-center gap-1.5">
						<Users className="h-3.5 w-3.5" />
						Collaborators
						{form.collaborators.length > 0 && (
							<span className="text-xs text-muted-foreground ml-1 tabular-nums">
								{form.collaborators.length} selected
							</span>
						)}
					</Label>
					{/* Selected collaborators as chips */}
					{form.collaborators.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{form.collaborators.map((collab) => {
								const agent = activeAgents.find((a) => a.id === collab);
								const CollabIcon = getAgentIcon(collab, agent?.icon);
								return (
									<Badge
										key={collab}
										variant="secondary"
										className="gap-1 pr-1 text-xs"
									>
										<CollabIcon className="h-3 w-3" />
										{agent?.name ?? collab}
										<button
											type="button"
											onClick={() =>
												setForm({
													...form,
													collaborators: form.collaborators.filter(
														(c) => c !== collab,
													),
												})
											}
											className="rounded-full hover:bg-muted-foreground/20 p-0.5 ml-0.5"
										>
											<X className="h-3 w-3" />
										</button>
									</Badge>
								);
							})}
						</div>
					)}
					{/* Available agents to add (exclude lead + already selected) */}
					{(() => {
						const available = activeAgents.filter(
							(a) =>
								a.id !== form.assignedTo &&
								a.id !== "me" &&
								!form.collaborators.includes(a.id),
						);
						if (available.length === 0) return null;
						return (
							<div className="flex flex-wrap gap-1.5">
								{available.map((agent) => {
									const AgentIcon = getAgentIcon(agent.id, agent.icon);
									return (
										<button
											key={agent.id}
											type="button"
											onClick={() =>
												setForm({
													...form,
													collaborators: [...form.collaborators, agent.id],
												})
											}
											className="flex items-center gap-1 rounded-sm border border-dashed px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
										>
											<AgentIcon className="h-3 w-3" />
											<Plus className="h-2.5 w-2.5" />
											{agent.name}
										</button>
									);
								})}
							</div>
						);
					})()}
				</div>
			)}

			<div className="space-y-2">
				<Label>Initiative</Label>
				<Select
					value={form.initiativeId ?? "none"}
					onValueChange={(v) =>
						setForm({ ...form, initiativeId: v === "none" ? null : v })
					}
				>
					<SelectTrigger>
						<SelectValue placeholder="No Initiative" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">No Initiative</SelectItem>
						{activeInitiatives.map((initiative) => (
							<SelectItem key={initiative.id} value={initiative.id}>
								<span className="flex items-center gap-2">
									{initiative.color && (
										<span
											className="inline-block h-2 w-2 rounded-full shrink-0"
											style={{ backgroundColor: initiative.color }}
										/>
									)}
									{initiative.title}
								</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Estimated time */}
			<div className="space-y-2">
				<Label htmlFor="est-minutes" className="flex items-center gap-1.5">
					<Clock className="h-3.5 w-3.5" />
					Estimated Minutes
				</Label>
				<Input
					id="est-minutes"
					type="number"
					min={0}
					value={form.estimatedMinutes ?? ""}
					onChange={(e) =>
						setForm({
							...form,
							estimatedMinutes: e.target.value
								? parseInt(e.target.value, 10)
								: null,
						})
					}
					placeholder="e.g. 30"
				/>
			</div>

			{/* Due date */}
			<div className="space-y-2">
				<Label htmlFor="due-date" className="flex items-center gap-1.5">
					<CalendarDays className="h-3.5 w-3.5" />
					Due Date
				</Label>
				<Input
					id="due-date"
					type="date"
					value={form.dueDate ?? ""}
					onChange={(e) =>
						setForm({ ...form, dueDate: e.target.value || null })
					}
				/>
			</div>

			{/* ─── Subtasks ─────────────────────────────────────────────────────── */}
			<div className="space-y-2">
				<Label className="flex items-center gap-1.5">
					<CheckSquare className="h-3.5 w-3.5" />
					Subtasks
					{form.subtasks.length > 0 && (
						<span className="text-xs text-muted-foreground ml-1 tabular-nums">
							{form.subtasks.filter((s) => s.done).length}/
							{form.subtasks.length}
						</span>
					)}
				</Label>

				{/* Subtask list */}
				{form.subtasks.length > 0 && (
					<div className="space-y-1 rounded-sm border bg-muted/30 p-2">
						{form.subtasks.map((sub) => (
							<div key={sub.id} className="flex items-center gap-2 group">
								<button
									type="button"
									onClick={() => toggleSubtask(sub.id)}
									className="shrink-0 text-muted-foreground hover:text-foreground"
									aria-label={
										sub.done
											? "Mark subtask incomplete"
											: "Mark subtask complete"
									}
								>
									{sub.done ? (
										<CheckSquare className="h-4 w-4 text-primary" />
									) : (
										<Square className="h-4 w-4" />
									)}
								</button>
								<span
									className={cn(
										"flex-1 text-xs",
										sub.done && "line-through text-muted-foreground",
									)}
								>
									{sub.title}
								</span>
								<button
									type="button"
									onClick={() => removeSubtask(sub.id)}
									className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
									aria-label="Remove subtask"
								>
									<X className="h-3 w-3" />
								</button>
							</div>
						))}
					</div>
				)}

				{/* Add subtask input */}
				<div className="flex gap-2">
					<Input
						value={newSubtask}
						onChange={(e) => setNewSubtask(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								addSubtask();
							}
						}}
						placeholder="Add a subtask..."
						className="flex-1 h-8 text-xs"
					/>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={addSubtask}
						disabled={!newSubtask.trim()}
						className="h-8 px-2"
						aria-label="Add subtask"
					>
						<Plus className="h-3.5 w-3.5" />
					</Button>
				</div>
			</div>

			{/* ─── Dependencies (Blocked By) ────────────────────────────────────── */}
			{depTasks.length > 0 && (
				<div className="space-y-2">
					<button
						type="button"
						onClick={() => setShowDeps(!showDeps)}
						className="flex items-center gap-1.5 text-sm font-normal"
					>
						<Link2 className="h-3.5 w-3.5" />
						Dependencies
						{form.blockedBy.length > 0 && (
							<span className="text-xs text-sunshine-700 ml-1 tabular-nums">
								{form.blockedBy.length} selected
							</span>
						)}
						<span className="text-muted-foreground text-xs">
							{showDeps ? "▾" : "▸"}
						</span>
					</button>

					{showDeps && (
						<div className="rounded-sm border bg-muted/30 p-2 space-y-1.5">
							<Input
								value={depSearch}
								onChange={(e) => setDepSearch(e.target.value)}
								placeholder="Search tasks..."
								className="h-7 text-xs"
							/>
							<div className="max-h-40 overflow-y-auto space-y-1">
								{filteredDepTasks.map((t) => {
									const checked = form.blockedBy.includes(t.id);
									return (
										<button
											key={t.id}
											type="button"
											onClick={() => toggleDependency(t.id)}
											className={cn(
												"flex items-center gap-2 w-full text-left px-2 py-1 rounded-sm text-xs hover:bg-accent/50 transition-colors",
												checked && "bg-accent/30",
											)}
										>
											{checked ? (
												<CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
											) : (
												<Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
											)}
											<span className="flex-1 truncate">{t.title}</span>
											<span
												className={cn(
													"text-xs shrink-0",
													t.kanban === "done"
														? "text-status-done"
														: "text-muted-foreground",
												)}
											>
												{t.kanban === "done"
													? "Done"
													: t.kanban === "in-progress"
														? "Active"
														: "Todo"}
											</span>
										</button>
									);
								})}
							</div>
						</div>
					)}
				</div>
			)}

			{/* ─── Acceptance Criteria ───────────────────────────────────────────── */}
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label htmlFor="acceptance-criteria">
						Acceptance Criteria
						<span className="text-xs text-muted-foreground ml-1.5">
							(one per line)
						</span>
					</Label>
					<span
						className={cn(
							"text-[10px] tabular-nums",
							form.acceptanceCriteria.length > LIMITS.DESCRIPTION
								? "text-destructive"
								: "text-muted-foreground",
						)}
					>
						{form.acceptanceCriteria.length}/{LIMITS.DESCRIPTION}
					</span>
				</div>
				<Textarea
					id="acceptance-criteria"
					value={form.acceptanceCriteria}
					onChange={(e) => {
						setForm({ ...form, acceptanceCriteria: e.target.value });
						if (errors.acceptanceCriteria) clearError("acceptanceCriteria");
					}}
					placeholder={
						"User can see subtask progress\nBlocked tasks show warning\nAll tests pass"
					}
					rows={3}
					className={cn(
						"text-xs",
						errors.acceptanceCriteria &&
							"border-destructive focus-visible:ring-destructive",
					)}
					aria-invalid={!!errors.acceptanceCriteria}
					aria-describedby={
						errors.acceptanceCriteria ? "criteria-error" : undefined
					}
				/>
				{errors.acceptanceCriteria && (
					<p id="criteria-error" className="text-xs text-destructive">
						{errors.acceptanceCriteria}
					</p>
				)}
			</div>

			<div className="space-y-2">
				<Label htmlFor="tags">Tags (comma-separated)</Label>
				<Input
					id="tags"
					value={form.tags}
					onChange={(e) => setForm({ ...form, tags: e.target.value })}
					placeholder="ui, backend, planning..."
				/>
			</div>

			<div className="flex justify-end gap-2 pt-2">
				<Button
					type="button"
					variant="ghost"
					onClick={onCancel}
					disabled={isSubmitting}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={!form.title.trim() || isSubmitting}>
					{isSubmitting ? "Saving..." : submitLabel}
				</Button>
			</div>
		</form>
	);
}
