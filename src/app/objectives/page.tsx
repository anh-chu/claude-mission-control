"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Target, Pencil, Trash2, Rocket, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CreateGoalDialog } from "@/components/create-goal-dialog";
import { EditGoalDialog } from "@/components/edit-goal-dialog";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { GoalContextMenuContent } from "@/components/context-menus/goal-context-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useGoals, useTasks, useInitiatives } from "@/hooks/use-data";
import { GoalCardSkeleton } from "@/components/skeletons";
import { ErrorState } from "@/components/error-state";
import { Tip } from "@/components/ui/tip";
import { showSuccess, showError } from "@/lib/toast";
import { apiFetch } from "@/lib/api-client";
import type { Goal, Task, GoalType, GoalStatus, Initiative } from "@/lib/types";

function ProgressBar({ value }: { value: number }) {
	return (
		<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
			<div
				className="h-full rounded-full bg-primary transition-all"
				style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
			/>
		</div>
	);
}

function InitiativeCard({
	initiative,
	tasks,
}: {
	initiative: Initiative;
	tasks: Task[];
}) {
	const linkedTasks = tasks.filter((t) => t.initiativeId === initiative.id);
	const completedCount = linkedTasks.filter((t) => t.kanban === "done").length;
	const progress =
		linkedTasks.length > 0 ? (completedCount / linkedTasks.length) * 100 : 0;

	const statusColors: Record<string, string> = {
		active: "text-status-in-progress",
		paused: "text-muted-foreground",
		completed: "text-status-done",
		archived: "text-muted-foreground",
	};

	return (
		<div className="ml-4 rounded-lg border bg-card/50 p-3 space-y-2">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					{initiative.color && (
						<span
							className="h-2 w-2 rounded-full shrink-0"
							style={{ backgroundColor: initiative.color }}
						/>
					)}
					<h4 className="font-medium text-sm">{initiative.title}</h4>
				</div>
				<Badge
					variant="outline"
					className={`text-xs capitalize ${statusColors[initiative.status] ?? ""}`}
				>
					{initiative.status}
				</Badge>
			</div>
			{linkedTasks.length > 0 && (
				<>
					<div className="flex items-center gap-3">
						<ProgressBar value={progress} />
						<span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
							{completedCount}/{linkedTasks.length}
						</span>
					</div>
					<div className="space-y-0.5 pt-1">
						{linkedTasks.map((task) => (
							<div key={task.id} className="flex items-center gap-2 text-xs">
								<span
									className={
										task.kanban === "done"
											? "text-status-done"
											: "text-muted-foreground"
									}
								>
									{task.kanban === "done" ? "✓" : "○"}
								</span>
								<span
									className={
										task.kanban === "done"
											? "line-through text-muted-foreground"
											: ""
									}
								>
									{task.title}
								</span>
								{task.kanban === "in-progress" && (
									<Badge
										variant="secondary"
										className="ml-auto text-xs h-4 px-1"
									>
										active
									</Badge>
								)}
							</div>
						))}
					</div>
				</>
			)}
		</div>
	);
}

function ObjectiveDetailPanel({
	goal,
	initiatives,
	tasks,
	onClose,
}: {
	goal: Goal;
	initiatives: Initiative[];
	tasks: Task[];
	onClose: () => void;
}) {
	const panelRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [onClose]);

	useEffect(() => {
		panelRef.current?.focus();
	}, []);

	const goalTasks = tasks.filter(
		(t) => t.initiativeId && initiatives.some((i) => i.id === t.initiativeId),
	);
	const completedTasks = goalTasks.filter((t) => t.kanban === "done").length;
	const overallProgress =
		goalTasks.length > 0 ? (completedTasks / goalTasks.length) * 100 : 0;

	const statusColors: Record<string, string> = {
		"not-started": "text-muted-foreground",
		"in-progress": "text-status-in-progress",
		completed: "text-status-done",
	};

	return (
		<>
			<div
				className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm cursor-pointer"
				onClick={onClose}
			/>
			<aside
				ref={panelRef}
				tabIndex={-1}
				className="fixed right-0 top-0 z-50 flex h-full w-full max-w-full md:max-w-lg flex-col border-l bg-card shadow-2xl animate-in slide-in-from-right duration-200 outline-none"
			>
				<div className="flex items-center justify-between border-b px-4 py-3">
					<div className="flex items-center gap-2 min-w-0">
						<Target className="h-4 w-4 text-muted-foreground shrink-0" />
						<h2 className="font-semibold truncate">{goal.title}</h2>
						<Badge
							variant="outline"
							className={`text-xs capitalize shrink-0 ${statusColors[goal.status] ?? ""}`}
						>
							{goal.status.replace("-", " ")}
						</Badge>
					</div>
					<button
						onClick={onClose}
						className="ml-2 rounded p-1 hover:bg-accent"
						aria-label="Close"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto p-4 space-y-4">
					{goal.timeframe && (
						<p className="text-sm text-muted-foreground">
							Timeframe: {goal.timeframe}
						</p>
					)}

					{goalTasks.length > 0 && (
						<div className="space-y-1.5">
							<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
								Overall Progress
							</p>
							<div className="flex items-center gap-3">
								<ProgressBar value={overallProgress} />
								<span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
									{completedTasks}/{goalTasks.length} tasks
								</span>
							</div>
						</div>
					)}

					<div className="space-y-2">
						<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
							Initiatives ({initiatives.length})
						</p>
						{initiatives.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No initiatives yet.
							</p>
						) : (
							initiatives.map((initiative) => {
								const initTasks = tasks.filter(
									(t) => t.initiativeId === initiative.id,
								);
								const initDone = initTasks.filter(
									(t) => t.kanban === "done",
								).length;
								const initProgress =
									initTasks.length > 0
										? (initDone / initTasks.length) * 100
										: 0;
								return (
									<div
										key={initiative.id}
										className="rounded-lg border bg-card/50 p-3 space-y-2"
									>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												{initiative.color && (
													<span
														className="h-2 w-2 rounded-full shrink-0"
														style={{ backgroundColor: initiative.color }}
													/>
												)}
												<h4 className="font-medium text-sm">
													{initiative.title}
												</h4>
											</div>
											<Badge variant="outline" className="text-xs capitalize">
												{initiative.status}
											</Badge>
										</div>
										{initTasks.length > 0 && (
											<>
												<div className="flex items-center gap-3">
													<ProgressBar value={initProgress} />
													<span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
														{initDone}/{initTasks.length}
													</span>
												</div>
												<div className="space-y-0.5 pt-1">
													{initTasks.map((task) => (
														<div
															key={task.id}
															className="flex items-center gap-2 text-xs"
														>
															<span
																className={
																	task.kanban === "done"
																		? "text-status-done"
																		: "text-muted-foreground"
																}
															>
																{task.kanban === "done" ? "✓" : "○"}
															</span>
															<span
																className={
																	task.kanban === "done"
																		? "line-through text-muted-foreground"
																		: ""
																}
															>
																{task.title}
															</span>
															{task.kanban === "in-progress" && (
																<Badge
																	variant="secondary"
																	className="ml-auto text-xs h-4 px-1"
																>
																	active
																</Badge>
															)}
														</div>
													))}
												</div>
											</>
										)}
									</div>
								);
							})
						)}
					</div>
				</div>
			</aside>
		</>
	);
}

export default function GoalsPage() {
	const {
		goals,
		loading: loadingGoals,
		create: createGoal,
		update: updateGoal,
		remove: deleteGoal,
		error: goalsError,
		refetch: refetchGoals,
	} = useGoals();
	const { tasks, loading: loadingTasks } = useTasks();
	const {
		initiatives,
		loading: loadingInitiatives,
		refetch: refetchInitiatives,
	} = useInitiatives();

	const loading = loadingGoals || loadingTasks || loadingInitiatives;
	const [showCreateGoal, setShowCreateGoal] = useState(false);
	const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
	const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
	const [addingInitiativeForGoalId, setAddingInitiativeForGoalId] = useState<
		string | null
	>(null);
	const [newInitTitle, setNewInitTitle] = useState("");
	const [newInitDesc, setNewInitDesc] = useState("");
	const [newInitSaving, setNewInitSaving] = useState(false);
	const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);

	const longTermGoals = goals.filter((g) => g.type === "long-term");
	const activeInitiatives = initiatives.filter((i) => !i.deletedAt);

	const handleCreateGoal = async (data: {
		title: string;
		type: GoalType;
		timeframe: string;
		projectId: string | null;
		parentGoalId: string | null;
	}) => {
		await createGoal({
			title: data.title,
			type: data.type,
			timeframe: data.timeframe,
			parentGoalId: data.parentGoalId,
			projectId: data.projectId,
			status: "not-started",
			milestones: [],
			tasks: [],
		});
	};

	const handleEditGoal = async (data: {
		title: string;
		type: GoalType;
		timeframe: string;
		status: GoalStatus;
		projectId: string | null;
		parentGoalId: string | null;
	}) => {
		if (!editingGoal) return;
		await updateGoal(editingGoal.id, data);
		setEditingGoal(null);
	};

	const handleDeleteGoal = async () => {
		if (!deletingGoalId) return;
		await deleteGoal(deletingGoalId);
		setDeletingGoalId(null);
	};

	if (loading) {
		return (
			<div className="space-y-6">
				<BreadcrumbNav items={[{ label: "Objectives" }]} />
				<div className="grid gap-3 sm:grid-cols-2">
					<GoalCardSkeleton />
					<GoalCardSkeleton />
					<GoalCardSkeleton />
				</div>
			</div>
		);
	}

	if (goalsError) {
		return (
			<div className="space-y-6">
				<BreadcrumbNav items={[{ label: "Objectives" }]} />
				<ErrorState message={goalsError} onRetry={refetchGoals} />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<BreadcrumbNav items={[{ label: "Objectives" }]} />
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-xl font-bold">Objectives</h1>
					<p className="text-sm text-muted-foreground">
						Long-term objectives broken down into initiatives
					</p>
				</div>
				<Tip content="Create a new objective">
					<Button
						size="sm"
						onClick={() => setShowCreateGoal(true)}
						className="gap-1.5"
					>
						<Plus className="h-3.5 w-3.5" /> New Objective
					</Button>
				</Tip>
			</div>

			{longTermGoals.length === 0 ? (
				<EmptyState
					icon={Target}
					title="No objectives yet"
					description="Set long-term objectives and break them into initiatives to track your progress."
					actionLabel="Create an objective"
					onAction={() => setShowCreateGoal(true)}
				/>
			) : (
				longTermGoals.map((goal) => {
					const goalInitiatives = activeInitiatives.filter(
						(i) => i.parentGoalId === goal.id,
					);
					const goalTasks = tasks.filter(
						(t) =>
							t.initiativeId &&
							goalInitiatives.some((i) => i.id === t.initiativeId),
					);
					const completedTasks = goalTasks.filter(
						(t) => t.kanban === "done",
					).length;
					const overallProgress =
						goalTasks.length > 0
							? (completedTasks / goalTasks.length) * 100
							: 0;

					return (
						<ContextMenu key={goal.id}>
							<ContextMenuTrigger asChild>
								<Card
									className="cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
									onClick={() => setSelectedGoal(goal)}
								>
									<CardHeader className="pb-3">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<CardTitle className="text-base">
													{goal.title}
												</CardTitle>
												<Tip content="Edit objective">
													<Button
														variant="ghost"
														size="icon"
														className="h-6 w-6 text-muted-foreground hover:text-foreground"
														onClick={(e) => {
															e.stopPropagation();
															setEditingGoal(goal);
														}}
														aria-label="Edit objective"
													>
														<Pencil className="h-3 w-3" />
													</Button>
												</Tip>
												<Tip content="Delete objective">
													<Button
														variant="ghost"
														size="icon"
														className="h-6 w-6 text-muted-foreground hover:text-destructive"
														onClick={(e) => {
															e.stopPropagation();
															setDeletingGoalId(goal.id);
														}}
														aria-label="Delete objective"
													>
														<Trash2 className="h-3 w-3" />
													</Button>
												</Tip>
											</div>
											<div className="flex items-center gap-2">
												<Tip content="Add initiative to this objective">
													<Button
														variant="outline"
														size="sm"
														className="h-6 gap-1 text-xs px-2"
														onClick={(e) => {
															e.stopPropagation();
															setNewInitTitle("");
															setNewInitDesc("");
															setAddingInitiativeForGoalId(goal.id);
														}}
													>
														<Rocket className="h-3 w-3" />
														Add Initiative
													</Button>
												</Tip>
												<Badge
													variant="outline"
													className={`text-xs capitalize ${goal.status === "completed" ? "text-status-done" : goal.status === "in-progress" ? "text-status-in-progress" : "text-muted-foreground"}`}
												>
													{goal.status.replace("-", " ")}
												</Badge>
											</div>
										</div>
										{goal.timeframe && (
											<p className="text-xs text-muted-foreground mt-1">
												Timeframe: {goal.timeframe}
											</p>
										)}
										{goalTasks.length > 0 && (
											<div className="flex items-center gap-3 pt-2">
												<ProgressBar value={overallProgress} />
												<span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
													{Math.round(overallProgress)}%
												</span>
											</div>
										)}
									</CardHeader>
									{goalInitiatives.length > 0 && (
										<CardContent>
											<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">
												Initiatives ({goalInitiatives.length})
											</p>
											<div className="space-y-2">
												{goalInitiatives.map((initiative) => (
													<InitiativeCard
														key={initiative.id}
														initiative={initiative}
														tasks={tasks}
													/>
												))}
											</div>
										</CardContent>
									)}
								</Card>
							</ContextMenuTrigger>
							<GoalContextMenuContent
								goal={goal}
								onEdit={() => setEditingGoal(goal)}
								onMarkComplete={
									goal.status !== "completed"
										? () => updateGoal(goal.id, { status: "completed" })
										: undefined
								}
								onDelete={() => setDeletingGoalId(goal.id)}
							/>
						</ContextMenu>
					);
				})
			)}

			<Dialog
				open={!!addingInitiativeForGoalId}
				onOpenChange={(open) => {
					if (!open) setAddingInitiativeForGoalId(null);
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Add Initiative</DialogTitle>
					</DialogHeader>
					<form
						className="space-y-4"
						onSubmit={async (e) => {
							e.preventDefault();
							if (!newInitTitle.trim() || !addingInitiativeForGoalId) return;
							setNewInitSaving(true);
							try {
								const res = await apiFetch("/api/initiatives", {
									method: "POST",
									headers: { "Content-Type": "application/json" },
									body: JSON.stringify({
										title: newInitTitle.trim(),
										description: newInitDesc.trim(),
										parentGoalId: addingInitiativeForGoalId,
										status: "active",
									}),
								});
								if (!res.ok) {
									const err = await res.json().catch(() => ({}));
									throw new Error(
										(err as { error?: string }).error ??
											"Failed to create initiative",
									);
								}
								showSuccess("Initiative created");
								setAddingInitiativeForGoalId(null);
								await refetchInitiatives();
							} catch (err) {
								showError(
									err instanceof Error
										? err.message
										: "Failed to create initiative",
								);
							} finally {
								setNewInitSaving(false);
							}
						}}
					>
						<div className="space-y-1.5">
							<Label htmlFor="new-init-title">
								Title <span className="text-destructive">*</span>
							</Label>
							<Input
								id="new-init-title"
								value={newInitTitle}
								onChange={(e) => setNewInitTitle(e.target.value)}
								required
								autoFocus
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="new-init-desc">Description</Label>
							<Textarea
								id="new-init-desc"
								value={newInitDesc}
								onChange={(e) => setNewInitDesc(e.target.value)}
								rows={2}
							/>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setAddingInitiativeForGoalId(null)}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={newInitSaving || !newInitTitle.trim()}
							>
								{newInitSaving ? "Creating..." : "Create Initiative"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<CreateGoalDialog
				open={showCreateGoal}
				onOpenChange={setShowCreateGoal}
				projects={[]}
				goals={goals}
				onSubmit={handleCreateGoal}
			/>

			{editingGoal && (
				<EditGoalDialog
					open={!!editingGoal}
					onOpenChange={(open) => {
						if (!open) setEditingGoal(null);
					}}
					goal={editingGoal}
					projects={[]}
					goals={goals}
					onSubmit={handleEditGoal}
				/>
			)}

			<ConfirmDialog
				open={!!deletingGoalId}
				onOpenChange={(open) => {
					if (!open) setDeletingGoalId(null);
				}}
				title="Delete objective"
				description="This will permanently delete this objective and its milestones. Linked tasks will not be deleted. This action cannot be undone."
				confirmLabel="Delete"
				onConfirm={handleDeleteGoal}
			/>

			{selectedGoal && (
				<ObjectiveDetailPanel
					goal={selectedGoal}
					initiatives={activeInitiatives.filter(
						(i) => i.parentGoalId === selectedGoal.id,
					)}
					tasks={tasks}
					onClose={() => setSelectedGoal(null)}
				/>
			)}
		</div>
	);
}
