"use client";

import {
	AlertTriangle,
	BarChart3,
	CheckSquare,
	CircleDot,
	Code,
	FolderOpen,
	Megaphone,
	Plus,
	Rocket,
	Search,
	ShieldAlert,
	Sparkles,
	Square,
	User,
	Users,
	Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { DashboardActivity } from "@/components/dashboard-activity";
import { DashboardInbox } from "@/components/dashboard-inbox";
import { DashboardLogs } from "@/components/dashboard-logs";
import { ProjectCardLarge } from "@/components/project-card-large";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CreateTaskDialog = dynamic(
	() =>
		import("@/components/create-task-dialog").then((mod) => ({
			default: mod.CreateTaskDialog,
		})),
	{ ssr: false },
);
const ProjectDialog = dynamic(
	() =>
		import("@/components/project-dialog").then((mod) => ({
			default: mod.ProjectDialog,
		})),
	{ ssr: false },
);

import { ErrorState } from "@/components/error-state";
import type { TaskFormData } from "@/components/task-form";
import { Tip } from "@/components/ui/tip";
import { useDaemon } from "@/hooks/use-daemon";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useAgents } from "@/hooks/use-data";
import { useFastTaskPoll } from "@/hooks/use-fast-task-poll";
import { apiFetch } from "@/lib/api-client";
import { showError, showSuccess } from "@/lib/toast";
import type { AgentRole } from "@/lib/types";
import { AGENT_ROLES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useActiveRunsContext as useActiveRuns } from "@/providers/active-runs-provider";
import DashboardLoading from "./loading";

function formatRelativeTime(isoString: string): string {
	const diff = Date.now() - new Date(isoString).getTime();
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

const agentIcons: Record<AgentRole, typeof User> = {
	me: User,
	researcher: Search,
	developer: Code,
	marketer: Megaphone,
	"business-analyst": BarChart3,
};

function AttentionRow({
	icon,
	children,
	actions,
}: {
	icon: string;
	children: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<div className="rounded-sm border border-border/50 bg-background p-3 space-y-2">
			<div className="flex items-start gap-2">
				<span className="text-base leading-none mt-0.5">{icon}</span>
				<div className="flex-1 min-w-0">{children}</div>
			</div>
			{actions && (
				<div className="flex items-center gap-1.5 ml-6 flex-wrap">
					{actions}
				</div>
			)}
		</div>
	);
}

export default function CommandCenterPage() {
	const { data, loading, error, refetch } = useDashboardData();
	const { agents } = useAgents();
	const {
		isRunning: daemonRunning,
		status: daemonStatus,
		updateConfig,
	} = useDaemon();
	const {
		runningTaskIds,
		isProjectRunning,
		isProjectRunActive,
		runProject,
		stopProject,
	} = useActiveRuns();
	useFastTaskPoll(runningTaskIds.size > 0, refetch);

	const [showCreateTask, setShowCreateTask] = useState(false);
	const [showCreateProject, setShowCreateProject] = useState(false);
	const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());

	const searchParams = useSearchParams();
	const tab = searchParams.get("tab") ?? "overview";

	// Derived data from batched /api/dashboard response
	const tasks = data?.tasks ?? [];
	const projects = data?.projects ?? [];
	const unprocessedEntries = data?.entries ?? [];
	const unreadMessages = data?.messages ?? [];
	const pendingDecisions = data?.decisions ?? [];

	// Agent workload — compute status per agent
	const pendingDecisionTaskIds = new Set(
		pendingDecisions.filter((d) => d.taskId).map((d) => d.taskId as string),
	);
	const agentWorkload = AGENT_ROLES.filter((r) => r.id !== "me").map((role) => {
		const agentTasks = tasks.filter(
			(t) => t.assignedTo === role.id && t.kanban !== "done",
		);
		const inProgress = agentTasks.filter((t) => t.kanban === "in-progress");
		const withDeps = agentTasks.filter((t) => {
			if (!t.blockedBy || t.blockedBy.length === 0) return false;
			return t.blockedBy.some((depId) => {
				const dep = tasks.find((d) => d.id === depId);
				return dep && dep.kanban !== "done";
			});
		});
		const withDecisions = agentTasks.filter((t) =>
			pendingDecisionTaskIds.has(t.id),
		);
		const currentTask = inProgress[0];
		const status:
			| "idle"
			| "on-track"
			| "dependencies"
			| "awaiting-decision"
			| "overloaded" =
			agentTasks.length === 0
				? "idle"
				: agentTasks.length >= 5
					? "overloaded"
					: withDecisions.length > 0
						? "awaiting-decision"
						: withDeps.length > 0
							? "dependencies"
							: "on-track";
		return {
			...role,
			activeCount: agentTasks.length,
			dependencyCount: withDeps.length,
			awaitingDecisionCount: withDecisions.length,
			currentTask,
			status,
		};
	});

	// Crew exceptions: agents that need attention (not idle or on-track)
	const exceptionAgents = agentWorkload.filter(
		(a) => a.status !== "idle" && a.status !== "on-track",
	);

	const doQuadrantMyTasks = tasks.filter(
		(t) =>
			t.importance === "important" &&
			t.urgency === "urgent" &&
			t.assignedTo === "me" &&
			t.kanban === "not-started",
	);
	const unreadReports = unreadMessages.filter((m) => m.type === "report");
	const recentCompletions = tasks.filter(
		(t) =>
			t.kanban === "done" &&
			t.assignedTo &&
			t.assignedTo !== "me" &&
			t.completedAt &&
			Date.now() - new Date(t.completedAt).getTime() < 7 * 24 * 60 * 60 * 1000,
	);
	// Action handlers for inline attention items
	const markItemLoading = (id: string) =>
		setLoadingItems((s) => new Set(s).add(id));
	const clearItemLoading = (id: string) =>
		setLoadingItems((s) => {
			const next = new Set(s);
			next.delete(id);
			return next;
		});

	const handleDecisionAnswer = async (id: string, answer: string) => {
		markItemLoading(id);
		try {
			const res = await apiFetch("/api/decisions", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, answer, status: "answered" }),
			});
			if (!res.ok) throw new Error("Failed to answer decision");
			showSuccess(`Decision answered: ${answer}`);
			refetch();
		} catch {
			showError("Failed to answer decision");
		} finally {
			clearItemLoading(id);
		}
	};

	const handleAckReport = async (id: string) => {
		markItemLoading(id);
		try {
			const res = await apiFetch("/api/inbox", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, status: "read" }),
			});
			if (!res.ok) throw new Error("Failed to mark as read");
			showSuccess("Report acknowledged");
			refetch();
		} catch {
			showError("Failed to acknowledge report");
		} finally {
			clearItemLoading(id);
		}
	};

	const totalAttentionCount =
		pendingDecisions.length +
		unreadReports.length +
		(data?.stats?.unprocessedBrainDump ?? 0) +
		doQuadrantMyTasks.length +
		recentCompletions.length;

	const handleCreateTask = async (formData: TaskFormData) => {
		try {
			const res = await apiFetch("/api/tasks", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...formData,
					tags: formData.tags
						.split(",")
						.map((t) => t.trim())
						.filter(Boolean),
					acceptanceCriteria: formData.acceptanceCriteria,
				}),
			});
			if (!res.ok) throw new Error("Failed to create task");
			showSuccess("Task created");
			refetch();
		} catch {
			showError("Failed to create task");
		}
	};

	const handleCreateProject = async (formData: {
		name: string;
		description: string;
		color: string;
		tags: string[];
		teamMembers?: string[];
		status?: string;
	}) => {
		try {
			const res = await apiFetch("/api/projects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: formData.name,
					description: formData.description,
					status: formData.status ?? "active",
					color: formData.color,
					teamMembers: formData.teamMembers ?? [],
					tags: formData.tags,
				}),
			});
			if (!res.ok) throw new Error("Failed to create project");
			showSuccess("Project created");
			refetch();
		} catch {
			showError("Failed to create project");
		}
	};

	if (loading) {
		return <DashboardLoading />;
	}

	if (error) {
		return (
			<div className="space-y-6">
				<BreadcrumbNav items={[]} />
				<ErrorState message={error} onRetry={refetch} />
			</div>
		);
	}

	// Welcome screen when workspace is empty
	const isEmpty = tasks.length === 0 && projects.length === 0;

	if (isEmpty) {
		return (
			<div className="space-y-6">
				<BreadcrumbNav items={[]} />

				<div className="flex flex-col items-center justify-center py-12 md:py-20">
					<div className="text-center max-w-lg mx-auto space-y-6">
						<div className="h-16 w-16 rounded-sm bg-primary-soft flex items-center justify-center mx-auto">
							<Rocket className="h-8 w-8 text-primary" />
						</div>
						<div>
							<h1 className="text-section font-normal">Welcome to Mandio</h1>
							<p className="text-muted-foreground mt-2">
								Your hub for orchestrating AI agents. Create projects, delegate
								tasks, and let your agents handle the rest.
							</p>
						</div>

						<div className="grid gap-3 sm:grid-cols-2 text-left">
							<Card
								className="cursor-pointer hover:border-primary/30 transition-all"
								onClick={() => setShowCreateProject(true)}
							>
								<CardContent className="p-4 flex items-start gap-3">
									<div className="h-9 w-9 rounded-sm bg-accent-soft flex items-center justify-center shrink-0">
										<FolderOpen className="h-4 w-4 text-accent" />
									</div>
									<div>
										<p className="text-sm font-normal">Create a project</p>
										<p className="text-xs text-muted-foreground mt-0.5">
											Organize your work into projects
										</p>
									</div>
								</CardContent>
							</Card>

							<Card
								className="cursor-pointer hover:border-primary/30 transition-all"
								onClick={() => setShowCreateTask(true)}
							>
								<CardContent className="p-4 flex items-start gap-3">
									<div className="h-9 w-9 rounded-sm bg-accent-soft flex items-center justify-center shrink-0">
										<Zap className="h-4 w-4 text-accent" />
									</div>
									<div>
										<p className="text-sm font-normal">Add your first task</p>
										<p className="text-xs text-muted-foreground mt-0.5">
											Break work into actionable items
										</p>
									</div>
								</CardContent>
							</Card>

							<Card className="sm:col-span-2 bg-muted">
								<CardContent className="p-4 flex items-start gap-3">
									<div className="h-9 w-9 rounded-sm bg-accent-soft flex items-center justify-center shrink-0">
										<Users className="h-4 w-4 text-sunshine-700" />
									</div>
									<div>
										<p className="text-sm font-normal">Deploy AI agents</p>
										<p className="text-xs text-muted-foreground mt-0.5">
											Assign tasks to Researcher, Developer, Marketer, or
											Business Analyst agents. They work through Claude Code and
											report back here.
										</p>
									</div>
								</CardContent>
							</Card>
						</div>
					</div>
				</div>

				<CreateTaskDialog
					open={showCreateTask}
					onOpenChange={setShowCreateTask}
					onSubmit={handleCreateTask}
				/>
				<ProjectDialog
					open={showCreateProject}
					onOpenChange={setShowCreateProject}
					agents={agents}
					onSubmit={handleCreateProject}
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-8">
			<BreadcrumbNav items={[]} />

			<div className="flex items-center gap-0.5 -mt-4 mb-0">
				<Link
					href="/?tab=overview"
					className={cn(
						"px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
						tab === "overview"
							? "bg-accent text-accent-foreground"
							: "text-muted-foreground hover:bg-accent/50",
					)}
				>
					Overview
				</Link>
				<Link
					href="/?tab=inbox"
					className={cn(
						"px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
						tab === "inbox"
							? "bg-accent text-accent-foreground"
							: "text-muted-foreground hover:bg-accent/50",
					)}
				>
					Inbox
				</Link>
				<Link
					href="/?tab=activity"
					className={cn(
						"px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
						tab === "activity"
							? "bg-accent text-accent-foreground"
							: "text-muted-foreground hover:bg-accent/50",
					)}
				>
					Activity
				</Link>
				<Link
					href="/?tab=logs"
					className={cn(
						"px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
						tab === "logs"
							? "bg-accent text-accent-foreground"
							: "text-muted-foreground hover:bg-accent/50",
					)}
				>
					Logs
				</Link>
			</div>

			{tab === "overview" && (
				<div className="flex flex-col gap-8">
					<Link href="/autopilot">
						<Card
							className={cn(
								"cursor-pointer transition-all hover:shadow-e-3 hover:border-primary/30",
								daemonRunning && "border-sunshine-700/20 bg-accent-soft",
							)}
						>
							<CardContent className="p-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div
											className={cn(
												"h-9 w-9 rounded-sm flex items-center justify-center",
												daemonRunning ? "bg-accent-soft" : "bg-muted",
											)}
										>
											<Rocket
												className={cn(
													"h-4 w-4",
													daemonRunning
														? "text-accent"
														: "text-muted-foreground",
												)}
											/>
										</div>
										<div>
											<div className="flex items-center gap-2">
												<div
													className={cn(
														"h-2 w-2 rounded-full shrink-0",
														daemonRunning
															? "bg-sunshine-700 animate-pulse"
															: "bg-muted-foreground",
													)}
												/>
												<p className="text-sm font-normal">Automation</p>
											</div>
											<p className="text-xs text-muted-foreground mt-0.5">
												{daemonRunning
													? `${daemonStatus.activeSessions.length} agents active · ${daemonStatus.stats.tasksCompleted} completed${daemonStatus.lastPollAt ? ` · Last poll: ${formatRelativeTime(daemonStatus.lastPollAt)}` : ""}`
													: "Autonomous task execution is disabled"}
											</p>
										</div>
									</div>
									<div className="flex items-center gap-2">
										{daemonRunning ? (
											<Badge
												variant="outline"
												className="bg-sunshine-700/10 text-sunshine-700 border-sunshine-700/20 text-xs"
											>
												Active
											</Badge>
										) : (
											<Badge variant="outline" className="text-xs">
												Paused
											</Badge>
										)}
										<span className="text-xs text-muted-foreground">
											View Details →
										</span>
									</div>
								</div>
							</CardContent>
						</Card>
					</Link>

					<Card className="border-sunshine-700/20">
						<CardContent className="p-4">
							<div className="flex items-center gap-2 mb-3">
								<AlertTriangle className="h-4 w-4 text-sunshine-700" />
								<h3 className="text-sm font-normal text-sunshine-700">
									Attention Required
								</h3>
								{totalAttentionCount > 0 && (
									<Badge
										variant="secondary"
										className="text-xs tabular-nums border-sunshine-700/30 text-sunshine-700 ml-auto"
									>
										{totalAttentionCount}
									</Badge>
								)}
							</div>

							{totalAttentionCount === 0 ? (
								<p className="text-sm text-muted-foreground py-2">
									Nothing needs your attention
								</p>
							) : (
								<div className="space-y-2">
									{pendingDecisions.map((decision) => (
										<AttentionRow
											key={decision.id}
											icon="🔴"
											actions={
												decision.options.length > 0 ? (
													decision.options.slice(0, 4).map((opt) => (
														<Button
															key={opt}
															size="sm"
															variant="outline"
															className="text-xs h-6 px-2"
															disabled={loadingItems.has(decision.id)}
															onClick={() =>
																handleDecisionAnswer(decision.id, opt)
															}
														>
															{loadingItems.has(decision.id) ? "…" : opt}
														</Button>
													))
												) : (
													<>
														<Button
															size="sm"
															className="text-xs h-6 px-2"
															disabled={loadingItems.has(decision.id)}
															onClick={() =>
																handleDecisionAnswer(decision.id, "approved")
															}
														>
															{loadingItems.has(decision.id) ? "…" : "Approve"}
														</Button>
														<Button
															size="sm"
															variant="outline"
															className="text-xs h-6 px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
															disabled={loadingItems.has(decision.id)}
															onClick={() =>
																handleDecisionAnswer(decision.id, "rejected")
															}
														>
															{loadingItems.has(decision.id) ? "…" : "Reject"}
														</Button>
													</>
												)
											}
										>
											<p className="text-xs font-normal text-foreground leading-snug">
												{decision.question}
											</p>
											{decision.context && (
												<p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
													{decision.context}
												</p>
											)}
										</AttentionRow>
									))}

									{unreadReports.map((msg) => (
										<AttentionRow
											key={msg.id}
											icon="🟡"
											actions={
												<Button
													size="sm"
													variant="outline"
													className="text-xs h-6 px-2"
													disabled={loadingItems.has(msg.id)}
													onClick={() => handleAckReport(msg.id)}
												>
													{loadingItems.has(msg.id) ? "…" : "Ack"}
												</Button>
											}
										>
											<p className="text-xs font-normal text-foreground leading-snug">
												{msg.subject}
											</p>
											<p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
												{msg.body}
											</p>
										</AttentionRow>
									))}

									{unprocessedEntries.map((entry) => (
										<AttentionRow
											key={entry.id}
											icon="🟡"
											actions={
												<Button
													asChild
													size="sm"
													variant="outline"
													className="text-xs h-6 px-2"
												>
													<Link href="/brain-dump">Triage</Link>
												</Button>
											}
										>
											<p className="text-[11px] text-muted-foreground font-normal">
												Brain dump
											</p>
											<p className="text-xs text-foreground leading-snug line-clamp-2 mt-0.5">
												{entry.content}
											</p>
										</AttentionRow>
									))}

									{doQuadrantMyTasks.length > 0 && (
										<Link href="/priority-matrix">
											<div className="flex items-center gap-2 rounded-sm px-3 py-2 hover:bg-accent/50 transition-colors">
												<ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
												<span className="text-foreground text-xs">
													{doQuadrantMyTasks.length} DO-quadrant task
													{doQuadrantMyTasks.length > 1 ? "s" : ""} not started
												</span>
											</div>
										</Link>
									)}

									{recentCompletions.length > 0 && (
										<Link href="/priority-matrix">
											<div className="flex items-center gap-2 rounded-sm px-3 py-2 hover:bg-accent/50 transition-colors">
												<CheckSquare className="h-4 w-4 shrink-0 text-success" />
												<span className="text-foreground text-xs">
													{recentCompletions.length} completed task
													{recentCompletions.length > 1 ? "s" : ""} to review
												</span>
											</div>
										</Link>
									)}
								</div>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm flex items-center gap-2">
								<User className="h-4 w-4 text-primary" />
								Crew Status
								<Link
									href="/crew"
									className="ml-auto text-xs text-muted-foreground hover:text-foreground font-normal"
								>
									View all →
								</Link>
							</CardTitle>
						</CardHeader>
						<CardContent>
							{exceptionAgents.length === 0 ? (
								<div className="flex items-center justify-between py-1">
									<p className="text-sm text-muted-foreground">
										All agents nominal
									</p>
									<Link
										href="/crew"
										className="text-xs text-muted-foreground hover:text-foreground"
									>
										/crew →
									</Link>
								</div>
							) : (
								<div className="space-y-3">
									{exceptionAgents.map((agent) => {
										const Icon = agentIcons[agent.id];
										const statusIndicator =
											agent.status === "overloaded"
												? "bg-destructive"
												: agent.status === "awaiting-decision"
													? "bg-sunshine-700"
													: "bg-primary";
										const statusLabel =
											agent.status === "overloaded"
												? "Overloaded"
												: agent.status === "awaiting-decision"
													? "Awaiting Decision"
													: "Dependencies";
										return (
											<Link
												key={agent.id}
												href={`/crew/${agent.id}`}
												className="block"
											>
												<div className="group hover:bg-accent/30 rounded-sm px-2 py-1.5 -mx-2 transition-colors">
													<div className="flex items-center gap-2">
														<div className="relative">
															<Icon className="h-4 w-4 text-muted-foreground shrink-0" />
															<CircleDot
																className={cn(
																	"h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 rounded-full",
																	statusIndicator,
																)}
															/>
														</div>
														<span className="text-xs font-normal flex-1 truncate">
															{agent.label}
														</span>
														<span
															className={cn(
																"text-[10px] px-1.5 py-0 rounded-sm",
																agent.status === "dependencies" &&
																	"text-sunshine-700 dark:text-sunshine-700 bg-accent-soft",
																agent.status === "awaiting-decision" &&
																	"text-warning dark:text-warning bg-accent-soft",
																agent.status === "overloaded" &&
																	"text-destructive dark:text-destructive bg-destructive-soft",
															)}
														>
															{statusLabel}
														</span>
														<span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
															{agent.activeCount} task
															{agent.activeCount !== 1 ? "s" : ""}
														</span>
													</div>
													{agent.currentTask && (
														<p className="text-[11px] text-muted-foreground ml-6 mt-0.5 truncate">
															Working on: {agent.currentTask.title}
														</p>
													)}
													{agent.dependencyCount > 0 && (
														<p className="text-[11px] text-sunshine-700 ml-6 mt-0.5">
															{agent.dependencyCount} waiting on dependencies
														</p>
													)}
													{agent.awaitingDecisionCount > 0 && (
														<p className="text-[11px] text-warning ml-6 mt-0.5">
															{agent.awaitingDecisionCount} awaiting decision
														</p>
													)}
												</div>
											</Link>
										);
									})}
								</div>
							)}
						</CardContent>
					</Card>

					<section aria-label="Projects">
						<div className="flex items-center justify-between mb-3">
							<h2 className="text-lg font-normal flex items-center gap-2">
								<Sparkles className="h-4 w-4 text-primary" />
								Projects
							</h2>
							<div className="flex items-center gap-2">
								<Button
									size="sm"
									variant="outline"
									className="text-xs gap-1"
									onClick={() => setShowCreateTask(true)}
								>
									<Plus className="h-3 w-3" /> New Task
								</Button>
								<Button
									size="sm"
									variant="outline"
									className="text-xs gap-1"
									onClick={() => setShowCreateProject(true)}
								>
									<Plus className="h-3 w-3" /> New Project
								</Button>
								<Link
									href="/map"
									className="text-xs text-muted-foreground hover:text-foreground"
								>
									View all →
								</Link>
							</div>
						</div>
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{projects
								.filter((p) => p.status === "active")
								.map((project) => (
									<ProjectCardLarge
										key={project.id}
										project={project}
										tasks={tasks}
										isRunning={isProjectRunning(project.id)}
										isProjectRunActive={isProjectRunActive(project.id)}
										onRun={runProject}
										onStop={stopProject}
									/>
								))}
							{projects.filter((p) => p.status === "active").length === 0 && (
								<Card
									className="border-dashed cursor-pointer hover:border-primary/30"
									onClick={() => setShowCreateProject(true)}
								>
									<CardContent className="p-6 flex flex-col items-center justify-center text-muted-foreground">
										<Plus className="h-8 w-8 mb-2" />
										<p className="text-sm">Create your first project</p>
									</CardContent>
								</Card>
							)}
						</div>
					</section>

					<CreateTaskDialog
						open={showCreateTask}
						onOpenChange={setShowCreateTask}
						onSubmit={handleCreateTask}
					/>
					<ProjectDialog
						open={showCreateProject}
						onOpenChange={setShowCreateProject}
						agents={agents}
						onSubmit={handleCreateProject}
					/>
				</div>
			)}

			{tab === "inbox" && <DashboardInbox />}
			{tab === "activity" && <DashboardActivity />}
			{tab === "logs" && <DashboardLogs />}
		</div>
	);
}
