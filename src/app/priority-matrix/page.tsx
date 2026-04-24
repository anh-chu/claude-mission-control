"use client";

import type { DragEndEvent } from "@dnd-kit/core";
import { Columns3, Filter, Grid2x2, Plus } from "lucide-react";
import { useState } from "react";
import {
	BoardColumn,
	BoardDndWrapper,
	BoardPanels,
	type ColumnConfig,
	useSelection,
	useTaskHandlers,
} from "@/components/board-view";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { ErrorState } from "@/components/error-state";
import { EisenhowerSkeleton, KanbanSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tip } from "@/components/ui/tip";
import {
	useAgents,
	useDecisions,
	useProjects,
	useTasks,
} from "@/hooks/use-data";
import { useFastTaskPoll } from "@/hooks/use-fast-task-poll";
import type { EisenhowerQuadrant, KanbanStatus, Task } from "@/lib/types";
import { getQuadrant, valuesFromQuadrant } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useActiveRunsContext as useActiveRuns } from "@/providers/active-runs-provider";

type ViewMode = "matrix" | "board";

const quadrants: ColumnConfig[] = [
	{
		id: "do",
		label: "DO",
		subtitle: "Important & Urgent",
		borderColor: "border-quadrant-do/40",
		dotColor: "bg-quadrant-do",
		textColor: "text-quadrant-do",
	},
	{
		id: "schedule",
		label: "SCHEDULE",
		subtitle: "Important & Not Urgent",
		borderColor: "border-quadrant-schedule/40",
		dotColor: "bg-quadrant-schedule",
		textColor: "text-quadrant-schedule",
	},
	{
		id: "delegate",
		label: "DELEGATE",
		subtitle: "Not Important & Urgent",
		borderColor: "border-quadrant-delegate/40",
		dotColor: "bg-quadrant-delegate",
		textColor: "text-quadrant-delegate",
	},
	{
		id: "eliminate",
		label: "ELIMINATE",
		subtitle: "Not Important & Not Urgent",
		borderColor: "border-quadrant-eliminate/40",
		dotColor: "bg-quadrant-eliminate",
		textColor: "text-quadrant-eliminate",
	},
];

const kanbanColumns: ColumnConfig[] = [
	{
		id: "not-started",
		label: "Not Started",
		dotColor: "bg-status-not-started",
		borderColor: "border-status-not-started/30",
	},
	{
		id: "in-progress",
		label: "In Progress",
		dotColor: "bg-status-in-progress",
		borderColor: "border-status-in-progress/30",
	},
	{
		id: "done",
		label: "Done",
		dotColor: "bg-status-done",
		borderColor: "border-status-done/30",
	},
];

export default function TasksPage() {
	const {
		tasks,
		update: updateTask,
		create: createTask,
		remove: deleteTask,
		loading,
		error: tasksError,
		refetch,
	} = useTasks();
	const { projects } = useProjects();
	const { agents } = useAgents();
	const { decisions } = useDecisions();
	const { runningTaskIds, runTask } = useActiveRuns();
	useFastTaskPoll(runningTaskIds.size > 0, refetch);

	const [viewMode, setViewMode] = useState<ViewMode>("board");
	const [filterProject, setFilterProject] = useState<string>("all");
	const [filterAssignee, setFilterAssignee] = useState<string>("all");

	const pendingDecisionTaskIds = new Set(
		decisions
			.filter((d) => d.status === "pending" && d.taskId)
			.map((d) => d.taskId as string),
	);
	const selection = useSelection();

	const {
		activeTask,
		selectedTask,
		setSelectedTask,
		showCreateTask,
		setShowCreateTask,
		handleDragStart,
		handleDragEnd: baseDragEnd,
		handleUpdateTask,
		handleCreateTask,
		handleDeleteTask,
	} = useTaskHandlers(tasks, updateTask, createTask, deleteTask);

	// Matrix view: only active tasks, grouped by quadrant
	let activeTasks = tasks.filter((t) => t.kanban !== "done");
	if (filterProject !== "all")
		activeTasks = activeTasks.filter((t) => t.projectId === filterProject);
	if (filterAssignee !== "all")
		activeTasks = activeTasks.filter(
			(t) => (t.assignedTo ?? "unassigned") === filterAssignee,
		);

	const groupedByQuadrant: Record<EisenhowerQuadrant, Task[]> = {
		do: [],
		schedule: [],
		delegate: [],
		eliminate: [],
	};
	for (const task of activeTasks) {
		groupedByQuadrant[getQuadrant(task)].push(task);
	}

	// Board view: all tasks, grouped by kanban status
	let boardTasks = tasks;
	if (filterProject !== "all")
		boardTasks = boardTasks.filter((t) => t.projectId === filterProject);
	if (filterAssignee !== "all")
		boardTasks = boardTasks.filter(
			(t) => (t.assignedTo ?? "unassigned") === filterAssignee,
		);

	const groupedByKanban: Record<KanbanStatus, Task[]> = {
		"not-started": [],
		"in-progress": [],
		done: [],
		"awaiting-decision": [],
	};
	for (const task of boardTasks) {
		groupedByKanban[task.kanban].push(task);
	}

	async function handleStatusChange(taskId: string, status: KanbanStatus) {
		await updateTask(taskId, { kanban: status });
		refetch();
	}

	async function handleDuplicate(task: Task) {
		await createTask({
			...task,
			id: `task_${Date.now()}`,
			title: `${task.title} (copy)`,
			kanban: "not-started",
			completedAt: null,
		});
		refetch();
	}

	async function handleDelete(taskId: string) {
		await deleteTask(taskId);
	}

	async function handleMatrixDragEnd(event: DragEndEvent) {
		baseDragEnd();
		const { active, over } = event;
		if (!over) return;
		const targetQuadrant = over.id as EisenhowerQuadrant;
		const task = tasks.find((t) => t.id === active.id);
		if (!task || getQuadrant(task) === targetQuadrant) return;
		const { importance, urgency } = valuesFromQuadrant(targetQuadrant);
		await updateTask(task.id, { importance, urgency });
	}

	async function handleBoardDragEnd(event: DragEndEvent) {
		baseDragEnd();
		const { active, over } = event;
		if (!over) return;
		const targetStatus = over.id as KanbanStatus;
		const task = tasks.find((t) => t.id === active.id);
		if (!task || task.kanban === targetStatus) return;
		await updateTask(task.id, { kanban: targetStatus });
	}

	if (loading) {
		return (
			<div className="space-y-6">
				<BreadcrumbNav items={[{ label: "Tasks" }]} />
				{viewMode === "matrix" ? <EisenhowerSkeleton /> : <KanbanSkeleton />}
			</div>
		);
	}

	if (tasksError) {
		return (
			<div className="space-y-6">
				<BreadcrumbNav items={[{ label: "Tasks" }]} />
				<ErrorState message={tasksError} onRetry={refetch} />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<BreadcrumbNav items={[{ label: "Tasks" }]} />

			<div className="flex items-center justify-between flex-wrap gap-2">
				<h1 className="text-xl font-bold">Tasks</h1>
				<div className="flex items-center gap-2">
					{/* View toggle */}
					<div className="flex items-center rounded-md border bg-muted/30 p-0.5">
						<Tip content="Priority Matrix">
							<button
								type="button"
								onClick={() => setViewMode("matrix")}
								className={cn(
									"flex items-center justify-center rounded px-2 py-1 transition-colors",
									viewMode === "matrix"
										? "bg-background shadow-sm text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
								aria-label="Priority Matrix view"
							>
								<Grid2x2 className="h-3.5 w-3.5" />
							</button>
						</Tip>
						<Tip content="Status Board">
							<button
								type="button"
								onClick={() => setViewMode("board")}
								className={cn(
									"flex items-center justify-center rounded px-2 py-1 transition-colors",
									viewMode === "board"
										? "bg-background shadow-sm text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
								aria-label="Status Board view"
							>
								<Columns3 className="h-3.5 w-3.5" />
							</button>
						</Tip>
					</div>

					<Filter className="h-3.5 w-3.5 text-muted-foreground" />
					<Select value={filterProject} onValueChange={setFilterProject}>
						<SelectTrigger className="h-8 w-[140px] text-xs">
							<SelectValue placeholder="Project" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Projects</SelectItem>
							{projects.map((p) => (
								<SelectItem key={p.id} value={p.id}>
									{p.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select value={filterAssignee} onValueChange={setFilterAssignee}>
						<SelectTrigger className="h-8 w-[130px] text-xs">
							<SelectValue placeholder="Assignee" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Assignees</SelectItem>
							<SelectItem value="unassigned">Unassigned</SelectItem>
							{agents
								.filter((a) => a.status === "active")
								.map((a) => (
									<SelectItem key={a.id} value={a.id}>
										{a.name}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
					<Tip content="Create a new task">
						<Button
							size="sm"
							onClick={() => setShowCreateTask(true)}
							className="gap-1.5 h-8"
						>
							<Plus className="h-3.5 w-3.5" /> Task
						</Button>
					</Tip>
				</div>
			</div>

			{viewMode === "matrix" ? (
				<BoardDndWrapper
					activeTask={activeTask}
					projects={projects}
					onDragStart={handleDragStart}
					onDragEnd={handleMatrixDragEnd}
				>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{quadrants.map((q) => (
							<BoardColumn
								key={q.id}
								config={q}
								tasks={groupedByQuadrant[q.id as EisenhowerQuadrant]}
								projects={projects}
								onTaskClick={setSelectedTask}
								maxHeight="max-h-[calc(100vh-320px)]"
								selected={selection.selected}
								onToggleSelect={selection.toggle}
								runningTaskIds={runningTaskIds}
								onRunTask={runTask}
								pendingDecisionTaskIds={pendingDecisionTaskIds}
								onStatusChange={handleStatusChange}
								onDuplicate={handleDuplicate}
								onDelete={handleDelete}
							/>
						))}
					</div>
				</BoardDndWrapper>
			) : (
				<BoardDndWrapper
					activeTask={activeTask}
					projects={projects}
					onDragStart={handleDragStart}
					onDragEnd={handleBoardDragEnd}
				>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
						{kanbanColumns.map((col) => (
							<BoardColumn
								key={col.id}
								config={col}
								tasks={groupedByKanban[col.id as KanbanStatus]}
								projects={projects}
								onTaskClick={setSelectedTask}
								minHeight="min-h-[400px]"
								selected={selection.selected}
								onToggleSelect={selection.toggle}
								runningTaskIds={runningTaskIds}
								onRunTask={runTask}
								pendingDecisionTaskIds={pendingDecisionTaskIds}
								onStatusChange={handleStatusChange}
								onDuplicate={handleDuplicate}
								onDelete={handleDelete}
							/>
						))}
					</div>
				</BoardDndWrapper>
			)}

			<BoardPanels
				tasks={tasks}
				projects={projects}
				selectedTask={selectedTask}
				showCreateTask={showCreateTask}
				onUpdate={handleUpdateTask}
				onDelete={handleDeleteTask}
				onCloseDetail={() => setSelectedTask(null)}
				onCloseCreate={setShowCreateTask}
				onSubmitCreate={handleCreateTask}
			/>
		</div>
	);
}
