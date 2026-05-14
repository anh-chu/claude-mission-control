"use client";

import { MessageSquare, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActivePanel = "chat" | "terminal" | null;

interface ActivityRailProps {
	active: ActivePanel;
	onSelect: (panel: "chat" | "terminal") => void;
}

export function ActivityRail({ active, onSelect }: ActivityRailProps) {
	return (
		<div className="flex flex-col items-center gap-1 w-10 shrink-0 border-l bg-muted/30 pt-2">
			<button
				type="button"
				onClick={() => onSelect("chat")}
				className={cn(
					"p-2 rounded-sm hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-colors",
					active === "chat" && "bg-primary text-primary-foreground",
				)}
				title="Chat"
				aria-label="Toggle chat panel"
				aria-pressed={active === "chat"}
			>
				<MessageSquare className="h-4 w-4" />
			</button>
			<button
				type="button"
				onClick={() => onSelect("terminal")}
				className={cn(
					"p-2 rounded-sm hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-colors",
					active === "terminal" && "bg-primary text-primary-foreground",
				)}
				title="Terminal"
				aria-label="Toggle terminal panel"
				aria-pressed={active === "terminal"}
			>
				<Terminal className="h-4 w-4" />
			</button>
		</div>
	);
}
