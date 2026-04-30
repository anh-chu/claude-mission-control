"use client";

import { Archive, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { ProjectContextMenuContent } from "@/components/context-menus/project-context-menu";
import { RunButton } from "@/components/run-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Project, Task } from "@/lib/types";
import { getQuadrant } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProjectCardLargeProps {
	project: Project;
	tasks: Task[];
	isRunning?: boolean;
	isProjectRunActive?: boolean;
	onRun?: (projectId: string) => void;
	onStop?: (projectId: string) => void;
	onArchive?: (projectId: string) => void;
	onDelete?: (projectId: string) => void;
}

export function ProjectCardLarge({
	project,
	tasks,
	isRunning,
	isProjectRunActive,
	onRun,
	onStop,
	onArchive,
	onDelete,
}: ProjectCardLargeProps) {
	const projectTasks = tasks.filter((t) => t.projectId === project.id);
	const notStarted = projectTasks.filter(
		(t) => t.kanban === "not-started",
	).length;
	const inProgress = projectTasks.filter(
		(t) => t.kanban === "in-progress",
	).length;
	const done = projectTasks.filter((t) => t.kanban === "done").length;
	const total = projectTasks.length;
	const progress = total > 0 ? Math.round((done / total) * 100) : 0;

	// Eisenhower mini counts
	const qCounts = { do: 0, schedule: 0, delegate: 0, eliminate: 0 };
	projectTasks
		.filter((t) => t.kanban !== "done")
		.forEach((t) => {
			qCounts[getQuadrant(t)]++;
		});

	// Check if project has tasks eligible to run (not done, has AI agent)
	const hasEligibleTasks = projectTasks.some(
		(t) => t.kanban !== "done" && t.assignedTo && t.assignedTo !== "me",
	);

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<Link href={`/projects/${project.id}`}>
					<Card
						className={cn(
							"group cursor-pointer border border-transparent transition-all hover:shadow-e-4 hover:border-primary/30 hover:-translate-y-0.5 animate-fade-in-up",
							isRunning &&
								"ring-2 ring-accent/50 border-accent/30 shadow-golden",
						)}
					>
						<CardHeader
							className={cn("pb-3", isRunning && "bg-accent-soft rounded-t-sm")}
						>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<div
										className="h-3 w-3 rounded-full"
										style={{ backgroundColor: project.color }}
									/>
									<CardTitle className="text-base">{project.name}</CardTitle>
								</div>
								<div className="flex items-center gap-1.5">
									{/* Run button — runs all eligible project tasks */}
									{onRun && hasEligibleTasks && (
										<RunButton
											isRunning={isRunning ?? false}
											isProjectRunActive={isProjectRunActive}
											onClick={() => onRun(project.id)}
											onStop={onStop ? () => onStop(project.id) : undefined}
											size="md"
											title={
												isProjectRunActive
													? "Project running — click to stop"
													: "Run all project tasks"
											}
										/>
									)}
									<Badge variant="outline" className="text-xs capitalize">
										{project.status}
									</Badge>
									{/* More actions dropdown */}
									{(onArchive || onDelete) && (
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
													onClick={(e) => {
														e.preventDefault();
														e.stopPropagation();
													}}
													aria-label="Project actions"
												>
													<MoreHorizontal className="h-3.5 w-3.5" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent
												align="end"
												onClick={(e) => {
													e.preventDefault();
													e.stopPropagation();
												}}
											>
												{onArchive && project.status !== "archived" && (
													<DropdownMenuItem
														onClick={() => onArchive(project.id)}
													>
														<Archive className="h-3.5 w-3.5 mr-2" />
														Archive
													</DropdownMenuItem>
												)}
												{onArchive && project.status === "archived" && (
													<DropdownMenuItem
														onClick={() => onArchive(project.id)}
													>
														<Archive className="h-3.5 w-3.5 mr-2" />
														Unarchive
													</DropdownMenuItem>
												)}
												{onDelete && (
													<DropdownMenuItem
														className="text-destructive focus:text-destructive"
														onClick={() => onDelete(project.id)}
													>
														<Trash2 className="h-3.5 w-3.5 mr-2" />
														Delete
													</DropdownMenuItem>
												)}
											</DropdownMenuContent>
										</DropdownMenu>
									)}
								</div>
							</div>
							{project.description && (
								<p className="text-sm text-muted-foreground line-clamp-2 mt-1">
									{project.description}
								</p>
							)}
						</CardHeader>
						<CardContent className="space-y-3">
							{/* Progress bar */}
							<div className="space-y-1">
								<div className="flex justify-between text-xs text-muted-foreground">
									<span>Progress</span>
									<span>{progress}%</span>
								</div>
								<div className="h-1.5 w-full rounded-sm bg-muted overflow-hidden">
									<div
										className="h-full rounded-sm bg-primary transition-all"
										style={{ width: `${progress}%` }}
									/>
								</div>
							</div>

							{/* Task counts */}
							<div className="flex gap-3 text-xs">
								<span className="text-muted-foreground">
									<span className="font-normal text-foreground">
										{notStarted}
									</span>{" "}
									todo
								</span>
								<span className="text-muted-foreground">
									<span className="font-normal text-status-in-progress">
										{inProgress}
									</span>{" "}
									active
								</span>
								<span className="text-muted-foreground">
									<span className="font-normal text-status-done">{done}</span>{" "}
									done
								</span>
							</div>

							{/* Eisenhower mini heat */}
							<div className="grid grid-cols-4 gap-1">
								{[
									{ key: "do" as const, label: "DO", color: "bg-quadrant-do" },
									{
										key: "schedule" as const,
										label: "SCH",
										color: "bg-quadrant-schedule",
									},
									{
										key: "delegate" as const,
										label: "DEL",
										color: "bg-quadrant-delegate",
									},
									{
										key: "eliminate" as const,
										label: "ELM",
										color: "bg-quadrant-eliminate",
									},
								].map(({ key, label, color }) => (
									<div
										key={key}
										className="flex items-center gap-1 text-xs text-muted-foreground"
									>
										<div className={`h-2 w-2 rounded-full ${color}`} />
										<span>{qCounts[key]}</span>
										<span className="hidden sm:inline">{label}</span>
									</div>
								))}
							</div>

							{/* Tags */}
							{project.tags.length > 0 && (
								<div className="flex flex-wrap gap-1">
									{project.tags.map((tag) => (
										<Badge
											key={tag}
											variant="secondary"
											className="text-xs px-1.5 py-0"
										>
											{tag}
										</Badge>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</Link>
			</ContextMenuTrigger>
			<ProjectContextMenuContent
				project={project}
				href={`/projects/${project.id}`}
				onRun={hasEligibleTasks ? onRun : undefined}
				onArchive={onArchive}
				onDelete={onDelete}
			/>
		</ContextMenu>
	);
}
