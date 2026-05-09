"use client";

import {
	Activity,
	BarChart3,
	BookOpen,
	Bot,
	Brain,
	Code,
	Globe,
	HeartPulse,
	Megaphone,
	Palette,
	Plus,
	Save,
	Search,
	Send,
	Shield,
	User,
	Wrench,
	X,
	Zap,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { CardSkeleton, GridSkeleton, Skeleton } from "@/components/skeletons";
import { TaskCard } from "@/components/task-card";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	useActivityLog,
	useAgents,
	useDecisions,
	useInbox,
	useProjects,
	useSkills,
	useTasks,
} from "@/hooks/use-data";
import { useFastTaskPoll } from "@/hooks/use-fast-task-poll";
import type { ActiveRun, KanbanStatus, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useActiveRunsContext as useActiveRuns } from "@/providers/active-runs-provider";

const iconMap: Record<string, typeof User> = {
	User,
	Search,
	Code,
	Megaphone,
	BarChart3,
	Bot,
	Zap,
	Shield,
	Wrench,
	BookOpen,
	Globe,
	Brain,
	Palette,
	HeartPulse,
};

function getAgentIcon(iconName: string) {
	return iconMap[iconName] ?? Bot;
}

export default function AgentPage() {
	const router = useRouter();
	const params = useParams();
	const id = params.id as string;
	const {
		tasks,
		loading,
		update: updateTask,
		create: createTask,
		remove: deleteTask,
		refetch: refetchTasks,
	} = useTasks();
	const { projects } = useProjects();
	const { messages } = useInbox();
	const { events } = useActivityLog();
	const {
		agents,
		update: updateAgent,
		error: agentsError,
		refetch,
	} = useAgents();
	const { skills: allSkills } = useSkills();
	const { decisions } = useDecisions();
	const { runningTaskIds, isTaskRunning, runTask } = useActiveRuns();
	useFastTaskPoll(runningTaskIds.size > 0, refetchTasks);
	const pendingDecisionTaskIds = new Set(
		decisions
			.filter((d) => d.status === "pending" && d.taskId)
			.map((d) => d.taskId as string),
	);

	// Profile editing state
	const [editingInstructions, setEditingInstructions] = useState(false);
	const [instructionsText, setInstructionsText] = useState("");
	const [editingDescription, setEditingDescription] = useState(false);
	const [descriptionText, setDescriptionText] = useState("");
	const [savingProfile, setSavingProfile] = useState(false);
	const [runs, setRuns] = useState<ActiveRun[]>([]);
	const [runsLoading, setRunsLoading] = useState(false);
	const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		setRunsLoading(true);
		fetch(`/api/runs?agentId=${encodeURIComponent(id)}`, {
			signal: controller.signal,
		})
			.then((res) => {
				if (!res.ok) throw new Error(`Failed to fetch runs: ${res.status}`);
				return res.json() as Promise<{ runs: ActiveRun[] }>;
			})
			.then((data) => {
				const sorted = (data.runs ?? []).sort(
					(a, b) =>
						new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
				);
				setRuns(sorted.slice(0, 20));
			})
			.catch((err) => {
				if (err instanceof Error && err.name === "AbortError") return; // unmounted
				setRuns([]);
			})
			.finally(() => setRunsLoading(false));
		return () => controller.abort();
	}, [id]);

	const agent = agents.find((a) => a.id === id);

	if (loading) {
		return (
			<div className="space-y-6">
				<BreadcrumbNav
					items={[{ label: "Agents", href: "/agents" }, { label: id }]}
				/>
				<GridSkeleton
					className="grid gap-3 sm:grid-cols-2"
					count={3}
					renderItem={() => (
						<CardSkeleton
							className="p-3 space-y-2"
							lines={[
								{ key: "line-1", className: "h-3 w-full" },
								{ key: "line-2", className: "h-3 w-2/3" },
							]}
							footer={[
								{ key: "tag-1", className: "h-4 w-16 rounded-sm" },
								{ key: "tag-2", className: "h-4 w-14 rounded-sm" },
							]}
						>
							<div className="flex items-start justify-between gap-2">
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-2 w-2 rounded-full" />
							</div>
						</CardSkeleton>
					)}
				/>
			</div>
		);
	}

	if (agentsError) {
		return (
			<div className="space-y-6">
				<BreadcrumbNav
					items={[{ label: "Agents", href: "/agents" }, { label: id }]}
				/>
				<ErrorState message={agentsError} onRetry={refetch} />
			</div>
		);
	}

	if (!agent) {
		return (
			<div className="space-y-6">
				<BreadcrumbNav
					items={[{ label: "Agents", href: "/agents" }, { label: "Not Found" }]}
				/>
				<p className="text-muted-foreground">
					Agent &ldquo;{id}&rdquo; not found.
				</p>
			</div>
		);
	}

	const Icon = getAgentIcon(agent.icon);
	const agentTasks = tasks.filter(
		(t) =>
			!t.isScheduled &&
			(t.assignedTo === agent.id || t.collaborators?.includes(agent.id)),
	);
	const inProgress = agentTasks.filter((t) => t.kanban === "in-progress");
	const todo = agentTasks.filter((t) => t.kanban === "not-started");
	const completed = agentTasks.filter((t) => t.kanban === "done");
	const agentMessages = messages
		.filter((m) => m.from === agent.id || m.to === agent.id)
		.slice(0, 5);
	const agentEvents = events.filter((e) => e.actor === agent.id).slice(0, 5);
	const linkedSkills = allSkills.filter((s) => agent.skillIds.includes(s.id));

	const handleStatusChange = async (taskId: string, status: KanbanStatus) => {
		await updateTask(taskId, { kanban: status });
		refetchTasks();
	};

	const handleDuplicate = async (task: Task) => {
		await createTask({
			...task,
			id: `task_${Date.now()}`,
			title: `${task.title} (copy)`,
			kanban: "not-started",
			completedAt: null,
		});
		refetchTasks();
	};

	const handleDeleteById = async (taskId: string) => {
		await deleteTask(taskId);
		refetchTasks();
	};

	const getProject = (projectId: string | null) =>
		projects.find((p) => p.id === projectId) ?? null;

	const handleSaveInstructions = async () => {
		setSavingProfile(true);
		try {
			await updateAgent(agent.id, { instructions: instructionsText });
			setEditingInstructions(false);
		} finally {
			setSavingProfile(false);
		}
	};

	const handleSaveDescription = async () => {
		setSavingProfile(true);
		try {
			await updateAgent(agent.id, { description: descriptionText });
			setEditingDescription(false);
		} finally {
			setSavingProfile(false);
		}
	};

	const addSkill = async (skillId: string) => {
		if (agent.skillIds.includes(skillId)) return;
		await updateAgent(agent.id, { skillIds: [...agent.skillIds, skillId] });
	};

	const removeSkill = async (skillId: string) => {
		await updateAgent(agent.id, {
			skillIds: agent.skillIds.filter((s) => s !== skillId),
		});
	};

	return (
		<div className="space-y-6">
			<BreadcrumbNav
				items={[{ label: "Agents", href: "/agents" }, { label: agent.name }]}
			/>

			{/* Agent Profile Header */}
			<div className="flex items-start gap-4">
				<div className="h-14 w-14 rounded-sm bg-primary-soft flex items-center justify-center shrink-0">
					<Icon className="h-7 w-7 text-primary" />
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<h1 className="text-xl font-normal">{agent.name}</h1>
						<Badge
							variant={agent.status === "active" ? "default" : "secondary"}
							className="text-xs"
						>
							{agent.status}
						</Badge>
						<Button
							variant="outline"
							size="sm"
							className="h-6 text-xs px-2 ml-1"
							onClick={() => router.push(`/agents/${agent.id}/edit`)}
						>
							Edit
						</Button>
					</div>
					{editingDescription ? (
						<div className="flex items-center gap-2 mt-1">
							<Input
								value={descriptionText}
								onChange={(e) => setDescriptionText(e.target.value)}
								className="text-sm h-8"
								autoFocus
							/>
							<Button
								size="sm"
								variant="ghost"
								onClick={handleSaveDescription}
								disabled={savingProfile}
							>
								<Save className="h-3.5 w-3.5" />
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onClick={() => setEditingDescription(false)}
							>
								<X className="h-3.5 w-3.5" />
							</Button>
						</div>
					) : (
						<button
							type="button"
							className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors mt-0.5 text-left w-full"
							onClick={() => {
								setDescriptionText(agent.description);
								setEditingDescription(true);
							}}
							title="Click to edit"
						>
							{agent.description || "Click to add a description..."}
						</button>
					)}
				</div>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-3 gap-4">
				<Card className="bg-card">
					<CardContent className="text-center pt-6">
						<p className="text-2xl font-normal tabular-nums">
							{agentTasks.length}
						</p>
						<p className="text-xs text-muted-foreground">Total Tasks</p>
					</CardContent>
				</Card>
				<Card className="bg-card">
					<CardContent className="text-center pt-6">
						<p className="text-2xl font-normal tabular-nums text-status-in-progress">
							{inProgress.length}
						</p>
						<p className="text-xs text-muted-foreground">In Progress</p>
					</CardContent>
				</Card>
				<Card className="bg-card">
					<CardContent className="text-center pt-6">
						<p className="text-2xl font-normal tabular-nums text-status-done">
							{completed.length}
						</p>
						<p className="text-xs text-muted-foreground">Completed</p>
					</CardContent>
				</Card>
			</div>

			{/* Instructions Section */}
			<section className="rounded-sm border bg-card p-4 space-y-3">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-normal">Instructions (System Prompt)</h2>
					{!editingInstructions && (
						<Button
							variant="ghost"
							size="sm"
							className="text-xs"
							onClick={() => {
								setInstructionsText(agent.instructions);
								setEditingInstructions(true);
							}}
						>
							Edit
						</Button>
					)}
				</div>
				{editingInstructions ? (
					<div className="space-y-2">
						<Textarea
							value={instructionsText}
							onChange={(e) => setInstructionsText(e.target.value)}
							rows={12}
							className="font-mono text-sm"
						/>
						<div className="flex items-center justify-between">
							<p className="text-xs text-muted-foreground">
								{instructionsText.length.toLocaleString()} characters
							</p>
							<div className="flex gap-2">
								<Button
									size="sm"
									variant="ghost"
									onClick={() => setEditingInstructions(false)}
								>
									Cancel
								</Button>
								<Button
									size="sm"
									onClick={handleSaveInstructions}
									disabled={savingProfile}
									className="gap-1"
								>
									<Save className="h-3.5 w-3.5" /> Save
								</Button>
							</div>
						</div>
					</div>
				) : (
					<pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted rounded-sm p-3 max-h-48 overflow-y-auto">
						{agent.instructions ||
							"No instructions set. Click Edit to add a system prompt."}
					</pre>
				)}
			</section>

			{/* Skills Section */}
			<section className="rounded-sm border bg-card p-4 space-y-3">
				<h2 className="text-sm font-normal">Assigned Skills</h2>
				{linkedSkills.length > 0 ? (
					<div className="space-y-2">
						{linkedSkills.map((skill) => (
							<div
								key={skill.id}
								className="flex items-center justify-between rounded-sm border p-2.5"
							>
								<div>
									<p className="text-sm font-normal">{skill.name}</p>
									<p className="text-xs text-muted-foreground">
										{skill.description}
									</p>
								</div>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => removeSkill(skill.id)}
								>
									<X className="h-3.5 w-3.5" />
								</Button>
							</div>
						))}
					</div>
				) : (
					<p className="text-xs text-muted-foreground">No skills assigned.</p>
				)}
				{/* Available skills to add */}
				{allSkills.filter((s) => !agent.skillIds.includes(s.id)).length > 0 && (
					<div className="pt-2 border-t space-y-1">
						<p className="text-xs text-muted-foreground">Available skills:</p>
						<div className="flex flex-wrap gap-1.5">
							{allSkills
								.filter((s) => !agent.skillIds.includes(s.id))
								.map((skill) => (
									<button
										type="button"
										key={skill.id}
										onClick={() => addSkill(skill.id)}
										className="inline-flex items-center gap-1 rounded-sm border px-2.5 py-0.5 text-xs hover:bg-primary/10 hover:border-primary/30 transition-colors"
									>
										<Plus className="h-3 w-3" />
										{skill.name}
									</button>
								))}
						</div>
					</div>
				)}
			</section>

			{/* Task Sections */}
			{inProgress.length > 0 && (
				<section className="space-y-3">
					<h2 className="text-sm font-normal flex items-center gap-2">
						<div className="h-2 w-2 rounded-full bg-status-in-progress" />
						In Progress ({inProgress.length})
					</h2>
					<div className="grid gap-3 sm:grid-cols-2">
						{inProgress.map((task) => (
							<TaskCard
								key={task.id}
								task={task}
								project={getProject(task.projectId)}
								onClick={() => router.push(`/tasks/${task.id}`)}
								isRunning={isTaskRunning(task.id)}
								onRun={runTask}
								allTasks={tasks}
								pendingDecisionTaskIds={pendingDecisionTaskIds}
								onStatusChange={handleStatusChange}
								onDuplicate={handleDuplicate}
								onDelete={handleDeleteById}
							/>
						))}
					</div>
				</section>
			)}

			{todo.length > 0 && (
				<section className="space-y-3">
					<h2 className="text-sm font-normal flex items-center gap-2">
						<div className="h-2 w-2 rounded-full bg-status-not-started" />
						To Do ({todo.length})
					</h2>
					<div className="grid gap-3 sm:grid-cols-2">
						{todo.map((task) => (
							<TaskCard
								key={task.id}
								task={task}
								project={getProject(task.projectId)}
								onClick={() => router.push(`/tasks/${task.id}`)}
								isRunning={isTaskRunning(task.id)}
								onRun={runTask}
								allTasks={tasks}
								pendingDecisionTaskIds={pendingDecisionTaskIds}
								onStatusChange={handleStatusChange}
								onDuplicate={handleDuplicate}
								onDelete={handleDeleteById}
							/>
						))}
					</div>
				</section>
			)}

			{completed.length > 0 && (
				<section className="space-y-3">
					<h2 className="text-sm font-normal flex items-center gap-2 text-muted-foreground">
						<div className="h-2 w-2 rounded-full bg-status-done" />
						Completed ({completed.length})
					</h2>
					<div className="grid gap-3 sm:grid-cols-2">
						{completed.map((task) => (
							<TaskCard
								key={task.id}
								task={task}
								project={getProject(task.projectId)}
								onClick={() => router.push(`/tasks/${task.id}`)}
								className="opacity-60"
								isRunning={isTaskRunning(task.id)}
								onRun={runTask}
								allTasks={tasks}
								pendingDecisionTaskIds={pendingDecisionTaskIds}
								onStatusChange={handleStatusChange}
								onDuplicate={handleDuplicate}
								onDelete={handleDeleteById}
							/>
						))}
					</div>
				</section>
			)}

			{agentTasks.length === 0 && (
				<EmptyState
					icon={Bot}
					title="No tasks assigned"
					description={`Assign tasks to ${agent.name} from the Eisenhower or Kanban views.`}
				/>
			)}

			{/* Recent Messages */}
			{agentMessages.length > 0 && (
				<section className="space-y-3">
					<h2 className="text-sm font-normal flex items-center gap-2">
						<Send className="h-3.5 w-3.5" />
						Recent Messages
					</h2>
					<div className="space-y-2">
						{agentMessages.map((msg) => (
							<Card key={msg.id} className="bg-card">
								<CardContent className="p-3 flex items-center gap-3">
									<Badge
										variant={msg.status === "unread" ? "default" : "secondary"}
										className="text-xs shrink-0"
									>
										{msg.type}
									</Badge>
									<div className="flex-1 min-w-0">
										<p className="text-xs font-normal truncate">
											{msg.subject}
										</p>
										<p className="text-xs text-muted-foreground">
											{msg.from} → {msg.to}
										</p>
									</div>
									<p className="text-xs text-muted-foreground shrink-0">
										{new Date(msg.createdAt).toLocaleDateString()}
									</p>
								</CardContent>
							</Card>
						))}
					</div>
				</section>
			)}

			{/* Recent Activity */}
			{agentEvents.length > 0 && (
				<section className="space-y-3">
					<h2 className="text-sm font-normal flex items-center gap-2">
						Recent Activity
					</h2>
					<div className="space-y-1">
						{agentEvents.map((evt) => (
							<div
								key={evt.id}
								className="flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs text-muted-foreground"
							>
								<div className="h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
								<span className="flex-1">{evt.summary}</span>
								<span className="text-xs shrink-0">
									{new Date(evt.timestamp).toLocaleDateString()}
								</span>
							</div>
						))}
					</div>
				</section>
			)}

			{/* Runs */}
			<section className="space-y-3">
				<h2 className="text-sm font-normal flex items-center gap-2">
					<Activity className="h-3.5 w-3.5" />
					Runs
					{runs.length > 0 && (
						<Badge variant="secondary" className="text-[10px] px-1.5 py-0">
							{runs.length}
						</Badge>
					)}
				</h2>
				{runsLoading ? (
					<p className="text-xs text-muted-foreground">Loading...</p>
				) : runs.length === 0 ? (
					<p className="text-xs text-muted-foreground">No runs yet</p>
				) : (
					<div className="space-y-1">
						{runs.map((run) => (
							<div key={run.id}>
								<button
									type="button"
									className="w-full flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs hover:bg-muted transition-colors text-left"
									onClick={() =>
										setExpandedRunId(expandedRunId === run.id ? null : run.id)
									}
								>
									<Badge
										variant="outline"
										className={cn(
											"text-[10px] px-1.5 py-0 shrink-0",
											run.status === "running" &&
												"border-blue-300 text-blue-600 bg-blue-50",
											run.status === "completed" &&
												"border-green-300 text-green-600 bg-green-50",
											run.status === "failed" &&
												"border-red-300 text-red-600 bg-red-50",
											run.status === "timeout" &&
												"border-orange-300 text-orange-600 bg-orange-50",
											run.status === "stopped" &&
												"border-gray-300 text-gray-500 bg-gray-50",
										)}
									>
										{run.status}
									</Badge>
									<span className="flex-1 truncate">{run.taskId}</span>
									<span className="text-muted-foreground shrink-0">
										{new Date(run.startedAt).toLocaleDateString()}
									</span>
									<span className="text-muted-foreground shrink-0 ml-2">
										{run.completedAt
											? `${Math.round(
													(new Date(run.completedAt).getTime() -
														new Date(run.startedAt).getTime()) /
														1000,
												)}s`
											: "..."}
									</span>
								</button>
								{expandedRunId === run.id &&
									run.status === "failed" &&
									run.error && (
										<div className="px-3 pb-2 pt-1">
											<p className="text-xs text-destructive bg-destructive/5 rounded-sm p-2 border border-destructive/10">
												{run.error}
											</p>
										</div>
									)}
							</div>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
