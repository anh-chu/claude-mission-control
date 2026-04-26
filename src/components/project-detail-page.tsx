"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { Plus, Users, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { ProjectRunProgress } from "@/components/mission-progress";
import { RunButton } from "@/components/run-button";
import { TaskCard } from "@/components/task-card";
import type { TaskFormData } from "@/components/task-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	useAgents,
	useDecisions,
	useProjects,
	useTasks,
} from "@/hooks/use-data";
import { useFastTaskPoll } from "@/hooks/use-fast-task-poll";
import { getAgentIcon } from "@/lib/agent-icons";
import type { EisenhowerQuadrant, KanbanStatus, Task } from "@/lib/types";
import { getQuadrant, valuesFromQuadrant } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useActiveRunsContext as useActiveRuns } from "@/providers/active-runs-provider";

function DraggableTask({
	task,
	onClick,
	isRunning,
	onRun,
	pendingDecisionTaskIds,
	onStatusChange,
	onDuplicate,
	onDelete,
}: {
	task: Task;
	onClick: () => void;
	isRunning?: boolean;
	onRun?: (taskId: string) => void;
	pendingDecisionTaskIds?: Set<string>;
	onStatusChange?: (taskId: string, status: KanbanStatus) => void;
	onDuplicate?: (task: Task) => void;
	onDelete?: (taskId: string) => void;
}) {
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useDraggable({ id: task.id });
	const style = transform
		? { transform: `translate(${transform.x}px, ${transform.y}px)` }
		: undefined;
	const dndListeners = listeners as
		| Record<string, (e: React.PointerEvent) => void>
		| undefined;
	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (e.button !== 0) return;
			dndListeners?.onPointerDown?.(e);
		},
		[dndListeners],
	);
	return (
		<div
			ref={setNodeRef}
			style={style}
			onPointerDown={handlePointerDown}
			{...attributes}
		>
			<TaskCard
				task={task}
				isDragging={isDragging}
				onClick={onClick}
				isRunning={isRunning}
				onRun={onRun}
				pendingDecisionTaskIds={pendingDecisionTaskIds}
				onStatusChange={onStatusChange}
				onDuplicate={onDuplicate}
				onDelete={onDelete}
			/>
		</div>
	);
}

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
					<DraggableTask
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

	async function _handleKanbanDragEnd(event: DragEndEvent) {
		setActiveTask(null);
		const { active, over } = event;
		if (!over) return;
		const task = tasks.find((t) => t.id === active.id);
		if (!task) return;
		const targetStatus = over.id as KanbanStatus;
		if (task.kanban === targetStatus) return;
		await updateTask(task.id, { kanban: targetStatus });
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

	return (
		<div className="space-y-4">
			<BreadcrumbNav
				items={[
					{ label: parentLabel, href: parentHref },
					{ label: project.name },
				]}
			/>

			{/* Project Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div
						className="h-4 w-4 rounded-full"
						style={{ backgroundColor: project.color }}
					/>
					<h1 className="text-xl font-normal">{project.name}</h1>
					<Badge variant="outline" className="text-xs capitalize">
						{project.status}
					</Badge>
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
			</div>
			{project.description && (
				<p className="text-sm text-muted-foreground">{project.description}</p>
			)}

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
								<div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
									<MemberIcon className="h-3 w-3 text-primary" />
								</div>
								<span className="text-xs font-normal">
									{agent?.name ?? memberId}
								</span>
								<button
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

			{/* Tabs */}
			<Tabs defaultValue="priority-matrix" className="space-y-4">
				<TabsList>
					<TabsTrigger value="priority-matrix">Priority Matrix</TabsTrigger>
				</TabsList>

				<TabsContent value="priority-matrix">
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
				</TabsContent>
			</Tabs>

			<CreateTaskDialog
				open={showCreateTask}
				onOpenChange={setShowCreateTask}
				projects={projects}
				onSubmit={handleCreateTask}
				defaultValues={{ projectId }}
			/>
		</div>
	);
}
