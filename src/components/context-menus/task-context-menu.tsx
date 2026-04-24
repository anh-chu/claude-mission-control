"use client";

import {
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import type { Task, KanbanStatus } from "@/lib/types";

interface TaskContextMenuContentProps {
	task: Task;
	onOpen?: () => void;
	onStatusChange?: (taskId: string, status: KanbanStatus) => void;
	onDuplicate?: (task: Task) => void;
	onRun?: (taskId: string) => void;
	onDelete?: (taskId: string) => void;
}

export function TaskContextMenuContent({
	task,
	onOpen,
	onStatusChange,
	onDuplicate,
	onRun,
	onDelete,
}: TaskContextMenuContentProps) {
	const showRun =
		onRun &&
		task.assignedTo &&
		task.assignedTo !== "me" &&
		task.kanban !== "done";

	return (
		<ContextMenuContent>
			{onOpen && (
				<ContextMenuItem onClick={onOpen}>Open detail</ContextMenuItem>
			)}

			{onStatusChange && (
				<>
					<ContextMenuSeparator />
					<ContextMenuSub>
						<ContextMenuSubTrigger>Mark as…</ContextMenuSubTrigger>
						<ContextMenuSubContent>
							{task.kanban !== "not-started" && (
								<ContextMenuItem
									onClick={() => onStatusChange(task.id, "not-started")}
								>
									Not Started
								</ContextMenuItem>
							)}
							{task.kanban !== "in-progress" && (
								<ContextMenuItem
									onClick={() => onStatusChange(task.id, "in-progress")}
								>
									In Progress
								</ContextMenuItem>
							)}
							{task.kanban !== "done" && (
								<ContextMenuItem
									onClick={() => onStatusChange(task.id, "done")}
								>
									Done
								</ContextMenuItem>
							)}
						</ContextMenuSubContent>
					</ContextMenuSub>
				</>
			)}

			{onDuplicate && (
				<ContextMenuItem onClick={() => onDuplicate(task)}>
					Duplicate
				</ContextMenuItem>
			)}

			{showRun && (
				<>
					<ContextMenuSeparator />
					<ContextMenuItem onClick={() => onRun(task.id)}>Run</ContextMenuItem>
				</>
			)}

			{onDelete && (
				<>
					<ContextMenuSeparator />
					<ContextMenuItem
						className="text-destructive focus:text-destructive"
						onClick={() => onDelete(task.id)}
					>
						Delete
					</ContextMenuItem>
				</>
			)}
		</ContextMenuContent>
	);
}
