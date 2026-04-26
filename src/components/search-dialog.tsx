"use client";

import { ArrowRight, CheckSquare, Lightbulb, Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import { useBrainDump, useProjects, useTasks } from "@/hooks/use-data";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUADRANT_LABELS: Record<string, { label: string; className: string }> = {
	do: { label: "DO", className: "bg-destructive-soft text-destructive" },
	schedule: {
		label: "SCHEDULE",
		className: "bg-sunshine-700/20 text-sunshine-700",
	},
	delegate: {
		label: "DELEGATE",
		className: "bg-accent-soft text-accent",
	},
	eliminate: {
		label: "ELIMINATE",
		className: "bg-muted text-muted-foreground",
	},
};

const KANBAN_LABELS: Record<string, { label: string; className: string }> = {
	"not-started": { label: "Todo", className: "bg-muted text-muted-foreground" },
	"in-progress": {
		label: "Active",
		className: "bg-accent-soft text-accent",
	},
	done: { label: "Done", className: "bg-success-soft text-success" },
};

function getQuadrantKey(task: Task): string {
	if (task.importance === "important" && task.urgency === "urgent") return "do";
	if (task.importance === "important" && task.urgency === "not-urgent")
		return "schedule";
	if (task.importance === "not-important" && task.urgency === "urgent")
		return "delegate";
	return "eliminate";
}

const MAX_RESULTS = 5;

export function SearchDialog() {
	const [open, setOpen] = useState(false);
	const router = useRouter();
	const { tasks } = useTasks();
	const { projects } = useProjects();
	const { entries: brainDumpEntries } = useBrainDump();

	// Listen for Ctrl+K / Cmd+K
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setOpen((prev) => !prev);
			}
		}
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	// Sort by most recent first
	const sortedTasks = useMemo(
		() =>
			[...tasks]
				.sort(
					(a, b) =>
						new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
				)
				.slice(0, MAX_RESULTS),
		[tasks],
	);

	const sortedProjects = useMemo(
		() =>
			[...projects]
				.sort(
					(a, b) =>
						new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
				)
				.slice(0, MAX_RESULTS),
		[projects],
	);

	const sortedBrainDump = useMemo(
		() =>
			[...brainDumpEntries]
				.filter((e) => !e.processed)
				.sort(
					(a, b) =>
						new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
				)
				.slice(0, MAX_RESULTS),
		[brainDumpEntries],
	);

	function handleSelect(type: string) {
		setOpen(false);
		switch (type) {
			case "task":
				router.push("/priority-matrix");
				break;
			case "project":
				router.push("/projects");
				break;
			case "braindump":
				router.push("/brain-dump");
				break;
		}
	}

	return (
		<CommandDialog open={open} onOpenChange={setOpen}>
			<CommandInput placeholder="Search tasks, initiatives, projects, ideas..." />
			<CommandList>
				<CommandEmpty>No results found.</CommandEmpty>

				{/* Tasks */}
				{sortedTasks.length > 0 && (
					<CommandGroup heading="Tasks">
						{sortedTasks.map((task) => {
							const quad = QUADRANT_LABELS[getQuadrantKey(task)];
							const kanban = KANBAN_LABELS[task.kanban];
							return (
								<CommandItem
									key={task.id}
									value={`task ${task.title} ${task.description}`}
									onSelect={() => handleSelect("task")}
									className="flex items-center gap-2"
								>
									<CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
									<span className="flex-1 truncate">{task.title}</span>
									{quad && (
										<span
											className={cn(
												"rounded-sm px-1.5 py-0.5 text-[10px] font-normal",
												quad.className,
											)}
										>
											{quad.label}
										</span>
									)}
									{kanban && (
										<span
											className={cn(
												"rounded-sm px-1.5 py-0.5 text-[10px] font-normal",
												kanban.className,
											)}
										>
											{kanban.label}
										</span>
									)}
									<ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
								</CommandItem>
							);
						})}
					</CommandGroup>
				)}

				{sortedTasks.length > 0 && sortedProjects.length > 0 && (
					<CommandSeparator />
				)}

				{/* Projects */}
				{sortedProjects.length > 0 && (
					<CommandGroup heading="Projects">
						{sortedProjects.map((project) => (
							<CommandItem
								key={project.id}
								value={`project ${project.name} ${project.description}`}
								onSelect={() => handleSelect("project")}
								className="flex items-center gap-2"
							>
								<Rocket className="h-4 w-4 shrink-0 text-muted-foreground" />
								<span className="flex-1 truncate">{project.name}</span>
								<span
									className={cn(
										"rounded-sm px-1.5 py-0.5 text-[10px] font-normal",
										project.status === "active"
											? "bg-sunshine-700/20 text-sunshine-700"
											: project.status === "paused"
												? "bg-accent-soft text-accent"
												: project.status === "completed"
													? "bg-sunshine-700/20 text-sunshine-700"
													: "bg-muted text-muted-foreground",
									)}
								>
									{project.status}
								</span>
								<ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{sortedProjects.length > 0 && sortedBrainDump.length > 0 && (
					<CommandSeparator />
				)}

				{/* Quick Capture */}
				{sortedBrainDump.length > 0 && (
					<CommandGroup heading="Quick Capture">
						{sortedBrainDump.map((entry) => (
							<CommandItem
								key={entry.id}
								value={`braindump idea ${entry.content}`}
								onSelect={() => handleSelect("braindump")}
								className="flex items-center gap-2"
							>
								<Lightbulb className="h-4 w-4 shrink-0 text-muted-foreground" />
								<span className="flex-1 truncate">{entry.content}</span>
								<span className="rounded-sm px-1.5 py-0.5 text-[10px] font-normal bg-accent-soft text-accent">
									unprocessed
								</span>
								<ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
							</CommandItem>
						))}
					</CommandGroup>
				)}
			</CommandList>
		</CommandDialog>
	);
}
