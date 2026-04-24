"use client";

import {
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
} from "@/components/ui/context-menu";
import type { Project } from "@/lib/types";

interface ProjectContextMenuContentProps {
	project: Project;
	href: string;
	onEdit?: (projectId: string) => void;
	onRun?: (projectId: string) => void;
	onArchive?: (projectId: string) => void;
	onDelete?: (projectId: string) => void;
}

export function ProjectContextMenuContent({
	project,
	href,
	onEdit,
	onRun,
	onArchive,
	onDelete,
}: ProjectContextMenuContentProps) {
	return (
		<ContextMenuContent>
			<ContextMenuItem onClick={() => window.open(href, "_blank")}>
				Open in New Tab
			</ContextMenuItem>

			{onEdit && (
				<>
					<ContextMenuSeparator />
					<ContextMenuItem onClick={() => onEdit(project.id)}>
						Edit
					</ContextMenuItem>
				</>
			)}

			{onRun && (
				<ContextMenuItem onClick={() => onRun(project.id)}>
					Run all tasks
				</ContextMenuItem>
			)}

			{onArchive && (
				<>
					<ContextMenuSeparator />
					<ContextMenuItem onClick={() => onArchive(project.id)}>
						{project.status === "archived" ? "Unarchive" : "Archive"}
					</ContextMenuItem>
				</>
			)}

			{onDelete && (
				<>
					<ContextMenuSeparator />
					<ContextMenuItem
						className="text-destructive focus:text-destructive"
						onClick={() => onDelete(project.id)}
					>
						Delete
					</ContextMenuItem>
				</>
			)}
		</ContextMenuContent>
	);
}
