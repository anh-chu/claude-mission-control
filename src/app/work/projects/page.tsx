"use client";

import { Archive, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
	BreadcrumbNav,
	type BreadcrumbPeer,
} from "@/components/breadcrumb-nav";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProjectDialog } from "@/components/project-dialog";
import { RunButton } from "@/components/run-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAgents, useProjects, useTasks } from "@/hooks/use-data";
import type { ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useActiveRunsContext as useActiveRuns } from "@/providers/active-runs-provider";

const STATUS_OPTIONS: { value: string; label: string }[] = [
	{ value: "all", label: "All statuses" },
	{ value: "active", label: "Active" },
	{ value: "archived", label: "Archived" },
];

const workPeers: BreadcrumbPeer[] = [
	{ label: "Tasks", href: "/work" },
	{ label: "Projects", href: "/work/projects" },
	{ label: "Initiatives", href: "/work/initiatives" },
	{ label: "Map", href: "/work/map" },
];

export default function WorkProjectsPage() {
	const _router = useRouter();
	const {
		projects,
		create,
		remove,
		update,
		loading,
		refetch: _refetch,
	} = useProjects();
	const { agents } = useAgents();
	const { tasks } = useTasks();
	const {
		runningTaskIds: _runningTaskIds,
		isTaskRunning: _isTaskRunning,
		runTask: _runTask,
		isProjectRunning,
		isProjectRunActive,
		runProject,
		stopProject,
	} = useActiveRuns();

	const [filterStatus, setFilterStatus] = useState<string>("all");
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

	const filteredProjects = useMemo(() => {
		let list = projects.filter((p) => !p.deletedAt);
		if (filterStatus === "active") {
			list = list.filter((p) => p.status === "active");
		} else if (filterStatus === "archived") {
			list = list.filter((p) => p.status === "archived");
		}
		return list;
	}, [projects, filterStatus]);

	function getTaskCount(projectId: string) {
		return tasks.filter((t) => t.projectId === projectId).length;
	}

	function getProgress(projectId: string) {
		const projectTasks = tasks.filter(
			(t) => t.projectId === projectId && !t.isScheduled,
		);
		if (projectTasks.length === 0) return 0;
		return Math.round(
			(projectTasks.filter((t) => t.kanban === "done").length /
				projectTasks.length) *
				100,
		);
	}

	async function handleCreate(data: {
		name: string;
		description: string;
		status: ProjectStatus;
		color: string;
		teamMembers: string[];
		tags: string[];
	}) {
		await create({
			name: data.name,
			description: data.description,
			status: data.status ?? "active",
			color: data.color,
			teamMembers: data.teamMembers,
			tags: data.tags,
		});
		setShowCreateDialog(false);
	}

	async function handleArchive(projectId: string) {
		const project = projects.find((p) => p.id === projectId);
		if (!project) return;
		const newStatus = project.status === "archived" ? "active" : "archived";
		await update(projectId, { status: newStatus });
	}

	async function handleDelete(projectId: string) {
		await remove(projectId);
		setDeleteTarget(null);
	}

	return (
		<div className="space-y-4">
			<BreadcrumbNav
				items={[{ label: "Work", href: "/work" }, { label: "Projects" }]}
				peers={workPeers}
			/>

			<div className="flex items-center justify-between flex-wrap gap-2">
				<h1 className="text-xl font-normal">Projects</h1>
				<div className="flex items-center gap-2">
					<Select value={filterStatus} onValueChange={setFilterStatus}>
						<SelectTrigger className="h-8 w-[140px] text-xs">
							<SelectValue placeholder="All statuses" />
						</SelectTrigger>
						<SelectContent>
							{STATUS_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						size="sm"
						onClick={() => setShowCreateDialog(true)}
						className="gap-1.5 h-8"
					>
						<Plus className="h-3.5 w-3.5" /> New Project
					</Button>
				</div>
			</div>

			{loading ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{[1, 2, 3].map((i) => (
						<Card key={i}>
							<CardHeader className="pb-3">
								<div className="flex items-center gap-2">
									<Skeleton className="h-3 w-3 rounded-full" />
									<Skeleton className="h-5 w-32" />
								</div>
							</CardHeader>
							<CardContent className="space-y-3">
								<Skeleton className="h-3 w-full" />
								<Skeleton className="h-1.5 w-full rounded-sm" />
								<div className="flex gap-3">
									<Skeleton className="h-3 w-12" />
									<Skeleton className="h-3 w-12" />
									<Skeleton className="h-3 w-12" />
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			) : filteredProjects.length === 0 ? (
				<Card>
					<CardContent className="py-12 text-center">
						<p className="text-sm text-muted-foreground">
							{filterStatus !== "all"
								? `No ${filterStatus} projects found.`
								: "No projects yet. Create your first project to get started."}
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{filteredProjects.map((project) => {
						const taskCount = getTaskCount(project.id);
						const progress = getProgress(project.id);
						const hasEligibleTasks = tasks.some(
							(t) =>
								t.projectId === project.id &&
								t.kanban !== "done" &&
								t.assignedTo &&
								t.assignedTo !== "me",
						);

						return (
							<Card
								key={project.id}
								className={cn(
									"group cursor-pointer border border-transparent transition-all hover:shadow-e-4 hover:border-primary/30 hover:-translate-y-0.5",
									isProjectRunning(project.id) &&
										"ring-2 ring-accent/50 border-accent/30 shadow-golden",
								)}
							>
								<Link href={`/projects/${project.id}`} className="block">
									<CardHeader
										className={cn(
											"pb-3",
											isProjectRunning(project.id) &&
												"bg-accent-soft rounded-t-sm",
										)}
									>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2 min-w-0">
												<div
													className="h-3 w-3 rounded-full shrink-0"
													style={{
														backgroundColor: project.color,
													}}
												/>
												<CardTitle className="text-base truncate">
													{project.name}
												</CardTitle>
											</div>
											<div className="flex items-center gap-1.5 shrink-0">
												{hasEligibleTasks && (
													<RunButton
														isRunning={isProjectRunning(project.id)}
														isProjectRunActive={isProjectRunActive(project.id)}
														onClick={() => runProject(project.id)}
														onStop={
															isProjectRunActive(project.id)
																? () => stopProject(project.id)
																: undefined
														}
														size="md"
														title={
															isProjectRunActive(project.id)
																? "Project running — click to stop"
																: "Run all project tasks"
														}
													/>
												)}
												<Badge variant="outline" className="text-xs capitalize">
													{project.status}
												</Badge>
											</div>
										</div>
										{project.description && (
											<p className="text-sm text-muted-foreground line-clamp-2 mt-1">
												{project.description}
											</p>
										)}
									</CardHeader>
								</Link>
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
									<div className="flex items-center justify-between">
										<span className="text-xs text-muted-foreground">
											{taskCount} task{taskCount !== 1 ? "s" : ""}
										</span>

										{/* Actions dropdown */}
										<div
											className="opacity-0 group-hover:opacity-100 transition-opacity"
											onClick={(e) => e.stopPropagation()}
										>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="icon"
														className="h-6 w-6 text-muted-foreground"
														aria-label="Project actions"
													>
														<MoreHorizontal className="h-3.5 w-3.5" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={() => handleArchive(project.id)}
													>
														<Archive className="h-3.5 w-3.5 mr-2" />
														{project.status === "archived"
															? "Unarchive"
															: "Archive"}
													</DropdownMenuItem>
													<DropdownMenuItem
														className="text-destructive focus:text-destructive"
														onClick={() => setDeleteTarget(project.id)}
													>
														<Trash2 className="h-3.5 w-3.5 mr-2" />
														Delete
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}

			<ProjectDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
				agents={agents}
				onSubmit={handleCreate}
			/>

			<ConfirmDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
				title="Delete Project"
				description="Are you sure you want to delete this project? This action can be undone within 5 seconds."
				confirmLabel="Delete"
				onConfirm={() => {
					if (deleteTarget) handleDelete(deleteTarget);
				}}
			/>
		</div>
	);
}
