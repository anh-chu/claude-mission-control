"use client";

import {
	CircleDot,
	Plus,
	Shield,
	ShieldAlert,
	ShieldOff,
	Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { AgentContextMenuContent } from "@/components/context-menus/agent-context-menu";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { CardSkeleton, GridSkeleton, Skeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Tip } from "@/components/ui/tip";
import { useDaemon } from "@/hooks/use-daemon";
import { useAgents, useProjects, useTasks } from "@/hooks/use-data";
import { getAgentIcon } from "@/lib/agent-icons";
import { apiFetch } from "@/lib/api-client";
import type { AgentDefinition } from "@/lib/types";
import { cn } from "@/lib/utils";

function AgentCard({
	agent,
	taskCount,
	onEdit,
	onNewTask,
	onToggleStatus,
}: {
	agent: AgentDefinition;
	taskCount: number;
	onEdit?: (agentId: string) => void;
	onNewTask?: (agentId: string) => void;
	onToggleStatus?: (
		agentId: string,
		currentStatus: AgentDefinition["status"],
	) => void;
}) {
	const Icon = getAgentIcon(agent.id, agent.icon);
	const isInactive = agent.status === "inactive";

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<Link href={`/crew/${agent.id}`}>
					<div
						className={cn(
							"group rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30",
							isInactive && "opacity-60",
						)}
					>
						<div className="flex items-start justify-between">
							<div className="flex items-center gap-3">
								<div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
									<Icon className="h-5 w-5 text-primary" />
								</div>
								<div>
									<h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
										{agent.name}
									</h3>
									<p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
										{agent.description}
									</p>
								</div>
							</div>
							<div className="flex items-center gap-1.5">
								<CircleDot
									className={cn(
										"h-3 w-3",
										agent.status === "active"
											? "text-green-500"
											: "text-muted-foreground",
									)}
								/>
							</div>
						</div>

						{/* Capabilities preview */}
						{agent.capabilities.length > 0 && (
							<div className="flex flex-wrap gap-1 mt-3">
								{agent.capabilities.slice(0, 3).map((cap) => (
									<Badge
										key={cap}
										variant="secondary"
										className="text-[10px] px-1.5 py-0"
									>
										{cap}
									</Badge>
								))}
								{agent.capabilities.length > 3 && (
									<Badge variant="outline" className="text-[10px] px-1.5 py-0">
										+{agent.capabilities.length - 3}
									</Badge>
								)}
							</div>
						)}

						{/* Footer stats */}
						<div className="flex items-center justify-between mt-3 pt-3 border-t">
							<span className="text-xs text-muted-foreground">
								{taskCount} active task{taskCount !== 1 ? "s" : ""}
							</span>
							<div className="flex items-center gap-2">
								{(() => {
									const permField =
										agent.backend === "codex"
											? agent.yolo
											: agent.skipPermissions;
									if (permField === "on") {
										return (
											<span className="flex items-center gap-1 text-[10px] text-amber-500 font-medium">
												<ShieldAlert className="h-3 w-3" />
												Unrestricted
											</span>
										);
									}
									if (permField === "off") {
										return (
											<span className="flex items-center gap-1 text-[10px] text-muted-foreground">
												<ShieldOff className="h-3 w-3" />
												Restricted
											</span>
										);
									}
									return (
										<span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
											<Shield className="h-3 w-3" />
											Default
										</span>
									);
								})()}
								{agent.skillIds.length > 0 && (
									<span className="text-xs text-muted-foreground">
										{agent.skillIds.length} skill
										{agent.skillIds.length !== 1 ? "s" : ""}
									</span>
								)}
							</div>
						</div>
					</div>
				</Link>
			</ContextMenuTrigger>
			<AgentContextMenuContent
				agent={agent}
				href={`/crew/${agent.id}`}
				onEdit={onEdit}
				onNewTask={onNewTask}
				onToggleStatus={onToggleStatus}
			/>
		</ContextMenu>
	);
}

export default function CrewPage() {
	const { agents, loading, error: agentsError, refetch } = useAgents();
	const { tasks, create: createTask } = useTasks();
	const { projects } = useProjects();
	const { config, updateConfig } = useDaemon();
	const router = useRouter();
	const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
	const [newTaskForAgentId, setNewTaskForAgentId] = useState<string | null>(
		null,
	);

	async function toggleGlobalPermissions(on: boolean) {
		await updateConfig({
			concurrency: config.concurrency,
			execution: { ...config.execution, skipPermissions: on },
			polling: config.polling,
		});
	}

	function handleEditAgent(agentId: string) {
		router.push(`/crew/${agentId}/edit`);
	}

	function handleNewTask(agentId: string) {
		setNewTaskForAgentId(agentId);
	}

	async function handleToggleStatus(
		agentId: string,
		currentStatus: AgentDefinition["status"],
	) {
		const newStatus = currentStatus === "active" ? "inactive" : "active";
		await apiFetch(`/api/agents/${agentId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: newStatus }),
		});
		refetch();
	}

	const filteredAgents =
		filter === "all" ? agents : agents.filter((a) => a.status === filter);

	// Count active (non-done) tasks per agent
	const taskCountByAgent = (agentId: string) =>
		tasks.filter(
			(t) =>
				t.kanban !== "done" &&
				(t.assignedTo === agentId || t.collaborators?.includes(agentId)),
		).length;

	if (loading) {
		return (
			<div className="space-y-6">
				<BreadcrumbNav items={[{ label: "Agents" }]} />
				<GridSkeleton
					className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
					count={3}
					renderItem={() => (
						<CardSkeleton className="p-5 space-y-3">
							<div className="flex items-start justify-between">
								<div className="flex items-center gap-3">
									<Skeleton className="h-10 w-10 rounded-full" />
									<div className="space-y-1.5">
										<Skeleton className="h-4 w-28" />
										<Skeleton className="h-3 w-40" />
									</div>
								</div>
								<Skeleton className="h-3 w-3 rounded-full" />
							</div>
							<div className="flex gap-1">
								<Skeleton className="h-4 w-16 rounded-full" />
								<Skeleton className="h-4 w-20 rounded-full" />
								<Skeleton className="h-4 w-14 rounded-full" />
							</div>
							<div className="flex items-center justify-between pt-3 border-t">
								<Skeleton className="h-3 w-20" />
								<Skeleton className="h-3 w-16" />
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
				<BreadcrumbNav items={[{ label: "Agents" }]} />
				<ErrorState message={agentsError} onRetry={refetch} />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<BreadcrumbNav items={[{ label: "Agents" }]} />

			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-xl font-bold">Agents</h1>
					<p className="text-sm text-muted-foreground mt-0.5">
						{agents.length} agent{agents.length !== 1 ? "s" : ""} registered
					</p>
				</div>
				<Tip content="Create a custom AI agent">
					<Button
						size="sm"
						onClick={() => router.push("/crew/new")}
						className="gap-1.5"
					>
						<Plus className="h-3.5 w-3.5" /> New Agent
					</Button>
				</Tip>
			</div>

			{/* Global permission default */}
			<div className="flex items-center justify-between rounded-lg border px-4 py-3 gap-4">
				<div className="min-w-0">
					<p className="text-sm font-medium">Global permission default</p>
					<p className="text-xs text-muted-foreground mt-0.5">
						Skip all permission prompts for all agents (can be restricted per
						agent)
					</p>
				</div>
				<div className="flex gap-1 shrink-0">
					<Button
						size="sm"
						variant={!config.execution.skipPermissions ? "default" : "outline"}
						onClick={() => toggleGlobalPermissions(false)}
					>
						Off
					</Button>
					<Button
						size="sm"
						variant={config.execution.skipPermissions ? "default" : "outline"}
						className={
							config.execution.skipPermissions
								? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
								: ""
						}
						onClick={() => toggleGlobalPermissions(true)}
					>
						On
					</Button>
				</div>
			</div>

			{/* Filter tabs */}
			<div className="flex gap-1">
				{(["all", "active", "inactive"] as const).map((f) => (
					<Button
						key={f}
						variant={filter === f ? "default" : "ghost"}
						size="sm"
						className="text-xs capitalize"
						onClick={() => setFilter(f)}
					>
						{f}
					</Button>
				))}
			</div>

			{filteredAgents.length === 0 ? (
				<EmptyState
					icon={Users}
					title="No agents found"
					description={
						filter === "all"
							? "Create your first agent to get started."
							: `No ${filter} agents.`
					}
					actionLabel="Create an agent"
					onAction={() => router.push("/crew/new")}
				/>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{filteredAgents.map((agent) => (
						<AgentCard
							key={agent.id}
							agent={agent}
							taskCount={taskCountByAgent(agent.id)}
							onEdit={handleEditAgent}
							onNewTask={handleNewTask}
							onToggleStatus={handleToggleStatus}
						/>
					))}
				</div>
			)}

			{newTaskForAgentId && (
				<CreateTaskDialog
					open={!!newTaskForAgentId}
					onOpenChange={(open) => {
						if (!open) setNewTaskForAgentId(null);
					}}
					projects={projects}
					onSubmit={async (data) => {
						await createTask({
							id: `task_${Date.now()}`,
							...data,
							dailyActions: [],
							tags: data.tags
								.split(",")
								.map((t) => t.trim())
								.filter(Boolean),
							acceptanceCriteria: data.acceptanceCriteria
								.split("\n")
								.map((s) => s.trim())
								.filter(Boolean),
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
							completedAt: null,
						});
						setNewTaskForAgentId(null);
					}}
				/>
			)}
		</div>
	);
}
