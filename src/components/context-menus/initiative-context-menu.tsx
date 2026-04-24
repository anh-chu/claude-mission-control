"use client";

import {
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
} from "@/components/ui/context-menu";
import type { Initiative } from "@/lib/types";

interface InitiativeContextMenuContentProps {
	initiative: Initiative;
	onTogglePause?: (initiative: Initiative) => void;
	onArchive?: (initiativeId: string) => void;
	onDelete?: (initiativeId: string) => void;
}

export function InitiativeContextMenuContent({
	initiative,
	onTogglePause,
	onArchive,
	onDelete,
}: InitiativeContextMenuContentProps) {
	return (
		<ContextMenuContent>
			{onTogglePause && initiative.status === "active" && (
				<ContextMenuItem onClick={() => onTogglePause(initiative)}>
					Pause
				</ContextMenuItem>
			)}
			{onTogglePause && initiative.status === "paused" && (
				<ContextMenuItem onClick={() => onTogglePause(initiative)}>
					Resume
				</ContextMenuItem>
			)}

			{onArchive && initiative.status !== "archived" && (
				<>
					<ContextMenuSeparator />
					<ContextMenuItem onClick={() => onArchive(initiative.id)}>
						Archive
					</ContextMenuItem>
				</>
			)}

			{onDelete && (
				<>
					<ContextMenuSeparator />
					<ContextMenuItem
						className="text-destructive focus:text-destructive"
						onClick={() => onDelete(initiative.id)}
					>
						Delete
					</ContextMenuItem>
				</>
			)}
		</ContextMenuContent>
	);
}
