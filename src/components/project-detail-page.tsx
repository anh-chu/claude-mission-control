"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { Plus, Users, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { MarkdownContent } from "@/components/markdown-content";
import { ProjectRunProgress } from "@/components/mission-progress";
import { RunButton } from "@/components/run-button";
import { TaskCard } from "@/components/task-card";
import type { TaskFormData } from "@/components/task-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

import {
	useAgents,
	useDecisions,
	useProjects,
	useTasks,
} from "@/hooks/use-data";
import { useFastTaskPoll } from "@/hooks/use-fast-task-poll";
import { getAgentIcon } from "@/lib/agent-icons";
import { COLOR_SWATCHES } from "@/lib/constants";
import type {
	EisenhowerQuadrant,
	KanbanStatus,
	ProjectStatus,
	Task,
} from "@/lib/types";
import { getQuadrant, valuesFromQuadrant } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useActiveRunsContext as useActiveRuns } from "@/providers/active-runs-provider";
import { DraggableTaskCard } from "./board-view";

function DroppableZone({
	id,
	label,
	dotColor,
	tasks,
	onTaskClick,
	children,
	isTaskRunning,
	onRunTask,
	pendingDecisionTaskIds,
	onStatusChange,
	onDuplicate,
	onDelete,
}: {
	id: string;
	label: string;
	dotColor: string;
	tasks: Task[];
	onTaskClick: (t: Task) => void;
	children?: React.ReactNode;
	isTaskRunning?: (taskId: string) => boolean;
	onRunTask?: (taskId: string) => void;
	pendingDecisionTaskIds?: Set<string>;
	onStatusChange?: (taskId: string, status: KanbanStatus) => void;
	onDuplicate?: (task: Task) => void;
	onDelete?: (taskId: string) => void;
}) {
	const { setNodeRef, isOver } = useDroppable({ id });
	return (
		<div
			ref={setNodeRef}
			className={cn(
				"flex flex-col rounded-sm border bg-card min-h-[200px] transition-all",
				isOver && "ring-2 ring-primary/50",
			)}
		>
			<div className="flex items-center justify-between px-3 py-2 border-b">
				<div className="flex items-center gap-2">
					<div className={cn("h-2 w-2 rounded-full", dotColor)} />
					<span className="text-xs font-normal">{label}</span>
				</div>
				<Badge
					variant="secondary"
					className="text-xs tabular-nums h-5 min-w-[1.25rem] justify-center"
				>
					{tasks.length}
				</Badge>
			</div>
			<div className="flex-1 space-y-2 p-2 overflow-y-auto max-h-[60vh]">
				{tasks.length === 0 && (
					<p className="py-6 text-center text-xs text-muted-foreground/40">
						Drop tasks here
					</p>
				)}
				{tasks.map((t) => (
					<DraggableTaskCard
						key={t.id}
						task={t}
						onClick={() => onTaskClick(t)}
						isRunning={isTaskRunning?.(t.id)}
						onRun={onRunTask}
						pendingDecisionTaskIds={pendingDecisionTaskIds}
						onStatusChange={onStatusChange}
						onDuplicate={onDuplicate}
						onDelete={onDelete}
					/>
				))}
				{children}
			</div>
		</div>
	);
}

interface ProjectDetailPageProps {
	parentLabel: string;
	parentHref: string;
}

export function ProjectDetailPage({
	parentLabel,
	parentHref,
}: ProjectDetailPageProps) {
	const params = useParams();
	const router = useRouter();
	const projectId = params.id as string;

	const {
		tasks,
		update: updateTask,
		create: createTask,
		remove: deleteTask,
		refetch,
	} = useTasks();

	const { projects, update: updateProject } = useProjects();
	const { agents } = useAgents();
	const { decisions } = useDecisions();
	const {
		runs,
		runningTaskIds,
		isTaskRunning,
		runTask,
		isProjectRunning,
		isProjectRunActive,
		getProjectRun,
		runProject,
		stopProject,
	} = useActiveRuns();
	const pendingDecisionTaskIds = new Set(
		decisions
			.filter((d) => d.status === "pending" && d.taskId)
			.map((d) => d.taskId as string),
	);
	useFastTaskPoll(runningTaskIds.size > 0, refetch);

	// Require 8px of movement before starting a drag — allows clicks to pass through
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

	const [activeTask, setActiveTask] = useState<Task | null>(null);
	const [showCreateTask, setShowCreateTask] = useState(false);

	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState("");
	const [editingDesc, setEditingDesc] = useState(false);
	const [descDraft, setDescDraft] = useState("");
	const cancelTitleRef = useRef(false);
	const cancelDescRef = useRef(false);
	const [tagInput, setTagInput] = useState("");

	const project = projects.find((p) => p.id === projectId);
	const projectTasks = tasks.filter((t) => t.projectId === projectId);

	if (!project) {
		return (
			<div className="space-y-4">
				<BreadcrumbNav
					items={[
						{ label: parentLabel, href: parentHref },
						{ label: "Not Found" },
					]}
				/>
				<p className="text-muted-foreground">Project not found.</p>
			</div>
		);
	}

	// Eisenhower groups (exclude done)
	const eActive = projectTasks.filter((t) => t.kanban !== "done");
	const eGrouped: Record<EisenhowerQuadrant, Task[]> = {
		do: [],
		schedule: [],
		delegate: [],
		eliminate: [],
	};
	eActive.forEach((t) => {
		eGrouped[getQuadrant(t)].push(t);
	});

	// Kanban groups
	const kGrouped: Record<KanbanStatus, Task[]> = {
		"not-started": [],
		"in-progress": [],
		done: [],
		"awaiting-decision": [],
	};
	projectTasks.forEach((t) => {
		kGrouped[t.kanban].push(t);
	});

	const progress =
		projectTasks.length > 0
			? Math.round(
					(projectTasks.filter((t) => t.kanban === "done").length /
						projectTasks.length) *
						100,
				)
			: 0;

	function handleDragStart(event: DragStartEvent) {
		setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null);
	}

	async function handleEisenhowerDragEnd(event: DragEndEvent) {
		setActiveTask(null);
		const { active, over } = event;
		if (!over) return;
		const task = tasks.find((t) => t.id === active.id);
		if (!task) return;
		const targetQ = over.id as EisenhowerQuadrant;
		if (getQuadrant(task) === targetQ) return;
		const { importance, urgency } = valuesFromQuadrant(targetQ);
		await updateTask(task.id, { importance, urgency });
	}

	const handleCreateTask = async (data: TaskFormData) => {
		await createTask({
			id: `task_${Date.now()}`,
			...data,
			tags: data.tags
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean),
			acceptanceCriteria: data.acceptanceCriteria,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			completedAt: null,
		});
	};

	const handleStatusChange = async (taskId: string, status: KanbanStatus) => {
		await updateTask(taskId, { kanban: status });
	};

	const handleDuplicate = async (task: Task) => {
		await createTask({
			...task,
			id: `task_${Date.now()}`,
			title: `${task.title} (copy)`,
			kanban: "not-started",
			completedAt: null,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
	};

	const handleDeleteById = async (taskId: string) => {
		await deleteTask(taskId);
	};

	async function handleSaveTitle() {
		if (!project) return;
		if (!titleDraft.trim() || titleDraft === project.name) {
			setEditingTitle(false);
			return;
		}
		await updateProject(project.id, { name: titleDraft.trim() });
		setEditingTitle(false);
	}

	async function handleSaveDesc() {
		if (!project) return;
		if (descDraft === project.description) {
			setEditingDesc(false);
			return;
		}
		await updateProject(project.id, { description: descDraft.trim() });
		setEditingDesc(false);
	}

	return (
		<div className="space-y-4">
			<BreadcrumbNav
				items={[
					{ label: parentLabel, href: parentHref },
					{ label: project.name },
				]}
			/>

			{/* Project Header */}
			<div className="flex items-start gap-3 min-w-0">
				<Popover>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="h-4 w-4 rounded-full shrink-0 mt-2 cursor-pointer ring-offset-background transition-all hover:ring-2 hover:ring-ring hover:ring-offset-2"
							style={{ backgroundColor: project.color }}
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
										borderColor: project.color === c ? "white" : "transparent",
										outline: project.color === c ? `2px solid ${c}` : "none",
										outlineOffset: "2px",
									}}
									onClick={() => updateProject(project.id, { color: c })}
								/>
							))}
						</div>
					</PopoverContent>
				</Popover>
				<div className="min-w-0 flex-1 space-y-1">
					<div className="flex items-center gap-2">
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
										setTitleDraft(project.name);
										setEditingTitle(false);
									}
								}}
							/>
						) : (
							<h1
								className="text-2xl font-normal cursor-text hover:opacity-80 transition-opacity"
								onClick={() => {
									setTitleDraft(project.name);
									setEditingTitle(true);
								}}
								title="Click to edit"
							>
								{project.name}
							</h1>
						)}
					</div>
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
									setDescDraft(project.description ?? "");
									setEditingDesc(false);
								}
							}}
						/>
					) : (
						<div
							className="cursor-text hover:opacity-80 transition-opacity"
							onClick={() => {
								setDescDraft(project.description ?? "");
								setEditingDesc(true);
							}}
							title="Click to edit"
						>
							{project.description ? (
								<MarkdownContent
									content={project.description}
									className="text-sm"
								/>
							) : (
								<p className="text-sm text-muted-foreground/40 italic">
									Click to add description
								</p>
							)}
						</div>
					)}
					<div className="flex flex-wrap items-center gap-1.5 pt-1">
						{(project.tags ?? []).map((tag) => (
							<Badge
								key={tag}
								variant="secondary"
								className="gap-1 pr-1 text-xs"
							>
								{tag}
								<button
									type="button"
									onClick={() =>
										updateProject(project.id, {
											tags: project.tags.filter((t) => t !== tag),
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
									if (!project.tags.includes(newTag)) {
										updateProject(project.id, {
											tags: [...project.tags, newTag],
										});
									}
									setTagInput("");
								}
							}}
							onBlur={() => {
								if (tagInput.trim()) {
									const newTag = tagInput.trim();
									if (!project.tags.includes(newTag)) {
										updateProject(project.id, {
											tags: [...project.tags, newTag],
										});
									}
									setTagInput("");
								}
							}}
						/>
					</div>
				</div>
			</div>

			{/* Status */}
			<div className="flex flex-wrap items-center gap-2">
				<span className="text-xs text-muted-foreground">Status:</span>
				{(["active", "paused", "completed", "archived"] as ProjectStatus[]).map(
					(s) => (
						<button
							key={s}
							type="button"
							onClick={() => updateProject(project.id, { status: s })}
							className={`text-xs px-2.5 py-1 rounded-sm border transition-all capitalize ${
								project.status === s
									? "bg-primary text-primary-foreground border-primary"
									: "bg-card text-muted-foreground border-border hover:bg-accent"
							}`}
						>
							{s}
						</button>
					),
				)}
			</div>

			<div className="flex items-center gap-2">
				<RunButton
					isRunning={isProjectRunning(projectId)}
					isProjectRunActive={isProjectRunActive(projectId)}
					onClick={() => runProject(projectId)}
					onStop={() => stopProject(projectId)}
					size="md"
					title={
						isProjectRunActive(projectId)
							? "Project running — click to stop"
							: "Run all project tasks"
					}
				/>
				<Button
					size="sm"
					onClick={() => setShowCreateTask(true)}
					className="gap-1.5"
				>
					<Plus className="h-3.5 w-3.5" /> Task
				</Button>
			</div>

			{/* Progress */}
			<div className="flex items-center gap-3">
				<div className="h-1.5 flex-1 rounded-sm bg-muted overflow-hidden">
					<div
						className="h-full rounded-sm bg-primary transition-all"
						style={{ width: `${progress}%` }}
					/>
				</div>
				<span className="text-xs text-muted-foreground tabular-nums">
					{progress}% · {projectTasks.length} tasks
				</span>
			</div>

			{/* Project Run Progress */}
			{(() => {
				const run = getProjectRun(projectId);
				return run ? (
					<ProjectRunProgress
						projectRun={run}
						runs={runs}
						onStop={() => stopProject(projectId)}
					/>
				) : null;
			})()}

			{/* Team Section */}
			<div className="space-y-2">
				<div className="flex items-center gap-2">
					<Users className="h-4 w-4 text-muted-foreground" />
					<h2 className="text-sm font-normal">Team</h2>
					<span className="text-xs text-muted-foreground">
						{(project.teamMembers ?? []).length} member
						{(project.teamMembers ?? []).length !== 1 ? "s" : ""}
					</span>
				</div>
				<div className="flex flex-wrap gap-2">
					{/* Current team members */}
					{(project.teamMembers ?? []).map((memberId) => {
						const agent = agents.find((a) => a.id === memberId);
						const MemberIcon = getAgentIcon(memberId, agent?.icon);
						return (
							<div
								key={memberId}
								className="flex items-center gap-1.5 rounded-sm border bg-card px-2.5 py-1.5 text-sm group"
							>
								<div className="h-5 w-5 rounded-full bg-primary-soft flex items-center justify-center">
									<MemberIcon className="h-3 w-3 text-primary" />
								</div>
								<span className="text-xs font-normal">
									{agent?.name ?? memberId}
								</span>
								<button
									type="button"
									onClick={async () => {
										const newMembers = (project.teamMembers ?? []).filter(
											(m) => m !== memberId,
										);
										await updateProject(project.id, {
											teamMembers: newMembers,
										});
									}}
									className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity ml-0.5"
								>
									<X className="h-3 w-3" />
								</button>
							</div>
						);
					})}
					{/* Add member buttons */}
					{agents
						.filter(
							(a) =>
								a.status === "active" &&
								!(project.teamMembers ?? []).includes(a.id),
						)
						.map((agent) => {
							const AgentIcon = getAgentIcon(agent.id, agent.icon);
							return (
								<button
									type="button"
									key={agent.id}
									onClick={async () => {
										const newMembers = [
											...(project.teamMembers ?? []),
											agent.id,
										];
										await updateProject(project.id, {
											teamMembers: newMembers,
										});
									}}
									className="flex items-center gap-1.5 rounded-sm border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
								>
									<AgentIcon className="h-3 w-3" />
									<Plus className="h-2.5 w-2.5" />
									{agent.name}
								</button>
							);
						})}
				</div>
			</div>

			{/* Priority Matrix */}
			<div className="space-y-4">
				<h2 className="text-sm font-normal">Priority Matrix</h2>
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragStart={handleDragStart}
					onDragEnd={handleEisenhowerDragEnd}
				>
					<div className="grid grid-cols-2 gap-3">
						<DroppableZone
							id="do"
							label="DO"
							dotColor="bg-quadrant-do"
							tasks={eGrouped.do}
							onTaskClick={(t) => router.push(`/tasks/${t.id}`)}
							isTaskRunning={isTaskRunning}
							onRunTask={runTask}
							pendingDecisionTaskIds={pendingDecisionTaskIds}
							onStatusChange={handleStatusChange}
							onDuplicate={handleDuplicate}
							onDelete={handleDeleteById}
						/>
						<DroppableZone
							id="schedule"
							label="SCHEDULE"
							dotColor="bg-quadrant-schedule"
							tasks={eGrouped.schedule}
							onTaskClick={(t) => router.push(`/tasks/${t.id}`)}
							isTaskRunning={isTaskRunning}
							onRunTask={runTask}
							pendingDecisionTaskIds={pendingDecisionTaskIds}
							onStatusChange={handleStatusChange}
							onDuplicate={handleDuplicate}
							onDelete={handleDeleteById}
						/>
						<DroppableZone
							id="delegate"
							label="DELEGATE"
							dotColor="bg-quadrant-delegate"
							tasks={eGrouped.delegate}
							onTaskClick={(t) => router.push(`/tasks/${t.id}`)}
							isTaskRunning={isTaskRunning}
							onRunTask={runTask}
							pendingDecisionTaskIds={pendingDecisionTaskIds}
							onStatusChange={handleStatusChange}
							onDuplicate={handleDuplicate}
							onDelete={handleDeleteById}
						/>
						<DroppableZone
							id="eliminate"
							label="ELIMINATE"
							dotColor="bg-quadrant-eliminate"
							tasks={eGrouped.eliminate}
							onTaskClick={(t) => router.push(`/tasks/${t.id}`)}
							isTaskRunning={isTaskRunning}
							onRunTask={runTask}
							pendingDecisionTaskIds={pendingDecisionTaskIds}
							onStatusChange={handleStatusChange}
							onDuplicate={handleDuplicate}
							onDelete={handleDeleteById}
						/>
					</div>
					<DragOverlay>
						{activeTask ? (
							<TaskCard task={activeTask} className="shadow-golden" />
						) : null}
					</DragOverlay>
				</DndContext>
			</div>

			<CreateTaskDialog
				open={showCreateTask}
				onOpenChange={setShowCreateTask}
				onSubmit={handleCreateTask}
				defaultValues={{ projectId }}
			/>
		</div>
	);
}
