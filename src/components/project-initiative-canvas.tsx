"use client";

import {
	applyNodeChanges,
	Background,
	Controls,
	type Edge,
	Handle,
	MarkerType,
	type Node,
	type NodeChange,
	type NodeTypes,
	Position,
	ReactFlow,
	ReactFlowProvider,
	useReactFlow,
	useStore,
} from "@xyflow/react";
import { useRouter } from "next/navigation";
import {
	type FormEvent,
	type MouseEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import "@xyflow/react/dist/style.css";
import {
	CheckSquare,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	FolderKanban,
	Layers,
	Plus,
	Users,
} from "lucide-react";
import { InitiativeContextMenuContent } from "@/components/context-menus/initiative-context-menu";
import { ProjectContextMenuContent } from "@/components/context-menus/project-context-menu";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { ErrorState } from "@/components/error-state";
import { RunButton } from "@/components/run-button";
import type { TaskFormData } from "@/components/task-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useInitiatives, useProjects, useTasks } from "@/hooks/use-data";
import type { Initiative, Project, ProjectStatus, Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useActiveRunsContext } from "@/providers/active-runs-provider";

// ─── Node Data ────────────────────────────────────────────────────────────────

type CanvasTask = Task;

type ChildCounts = { initiatives: number; tasks: number };

type ProjectNodeData = {
	project: Project;
	tasks: Task[];
	isRunning: boolean;
	isProjectRunActive: boolean;
	onCreate: (project: Project) => void;
	onRun: (projectId: string) => void;
	onStop: (projectId: string) => void;
	onArchive: (projectId: string) => void;
	onDelete: (projectId: string) => void;
};

type InitiativeNodeData = {
	initiative: Initiative;
	tasks: Task[];
	projectName: string | null;
	onCreateTask: (initiative: Initiative) => void;
	onTogglePause: (initiative: Initiative) => void;
	onArchive: (initiativeId: string) => void;
	onDelete: (initiativeId: string) => void;
};

type TaskNodeData = {
	task: Task;
	projectColor: string | null;
};

// ─── Grid Layout ──────────────────────────────────────────────────────────────

function gridPosition(
	index: number,
	cols = 3,
	xGap = 280,
	yGap = 160,
): { x: number; y: number } {
	return {
		x: (index % cols) * xGap,
		y: Math.floor(index / cols) * yGap,
	};
}

const statusColors: Record<string, string> = {
	active: "border-success/20 bg-muted text-success dark:text-success",
	paused: "border-primary/20 bg-muted text-foreground dark:text-foreground",
	completed: "border-primary/20 bg-muted text-foreground dark:text-foreground",
	archived: "border-muted/20 bg-muted text-muted-foreground",
};

const edgeColor = "var(--muted-foreground)";
const edgeOpacity = 0.45;
const gridSize = 24;
const backgroundDotColor =
	"color-mix(in srgb, var(--muted-foreground) 20%, transparent)";

const handleClass =
	"!h-[1px] !w-[1px] !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0";

const SIDES = [
	{ position: Position.Top, id: "top" },
	{ position: Position.Right, id: "right" },
	{ position: Position.Bottom, id: "bottom" },
	{ position: Position.Left, id: "left" },
] as const;

function RoutingHandles({
	excludeSourceBottom,
}: {
	excludeSourceBottom?: boolean;
}) {
	return (
		<>
			{SIDES.map((side) => (
				<Handle
					key={`target-${side.id}`}
					type="target"
					position={side.position}
					id={`target-${side.id}`}
					className={handleClass}
				/>
			))}
			{SIDES.filter(
				(side) => !(excludeSourceBottom && side.id === "bottom"),
			).map((side) => (
				<Handle
					key={`source-${side.id}`}
					type="source"
					position={side.position}
					id={`source-${side.id}`}
					className={handleClass}
				/>
			))}
		</>
	);
}

type Side = "top" | "right" | "bottom" | "left";

function bestSides(
	sourcePos: { x: number; y: number },
	targetPos: { x: number; y: number },
	sourceWidth: number,
	targetWidth: number,
): { source: Side; target: Side } {
	const dx = targetPos.x + targetWidth / 2 - (sourcePos.x + sourceWidth / 2);
	const dy = targetPos.y - sourcePos.y;

	if (Math.abs(dx) > Math.abs(dy)) {
		return dx > 0
			? { source: "right", target: "left" }
			: { source: "left", target: "right" };
	}
	return dy > 0
		? { source: "bottom", target: "top" }
		: { source: "top", target: "bottom" };
}

const NODE_WIDTHS = { project: 280, initiative: 280, task: 280 } as const;

const colorSwatches = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
	"var(--quadrant-do)",
	"var(--quadrant-schedule)",
	"var(--primary)",
];

// ─── Collapse Bubble Node ────────────────────────────────────────────────────

const typeBubbleConfig = {
	initiatives: { icon: Layers, color: "bg-primary" },
	tasks: { icon: CheckSquare, color: "bg-primary" },
} as const;

type CollapseBubbleNodeData = {
	counts: ChildCounts;
	onExpand: () => void;
};

function CollapseBubbleNode({ data }: { data: CollapseBubbleNodeData }) {
	const entries = (["initiatives", "tasks"] as const).filter(
		(k) => data.counts[k] > 0,
	);
	if (entries.length === 0) return null;
	return (
		<div
			className="flex cursor-pointer items-center -space-x-1.5"
			onClick={(e) => {
				e.stopPropagation();
				data.onExpand();
			}}
			title="Click to expand"
		>
			{SIDES.map((side) => (
				<Handle
					key={`target-${side.id}`}
					type="target"
					position={side.position}
					id={`target-${side.id}`}
					className="!h-0 !w-0 !border-0 !bg-transparent"
				/>
			))}
			{entries.map((key) => {
				const cfg = typeBubbleConfig[key];
				const Icon = cfg.icon;
				return (
					<div
						key={key}
						className={cn(
							"flex items-center gap-1 rounded-full border-2 border-card px-2 py-1 text-primary-foreground shadow-md",
							cfg.color,
						)}
					>
						<Icon className="h-3.5 w-3.5" />
						<span className="text-xs font-bold leading-none">
							{data.counts[key]}
						</span>
					</div>
				);
			})}
		</div>
	);
}

const BUBBLE_NODE_WIDTH = 80;

// ─── Create Handle (plus button on hover) ─────────────────────────────────────

function CreateHandle({
	isHovered,
	onCreate,
	title,
}: {
	isHovered: boolean;
	onCreate: () => void;
	title: string;
}) {
	return (
		<Handle
			type="source"
			position={Position.Bottom}
			id="source-bottom"
			title={title}
			className={cn(
				"!flex !items-center !justify-center !cursor-pointer !rounded-full !border !border-background !p-0 transition-all duration-200",
				isHovered
					? "!h-6 !w-6 !bg-foreground"
					: "!h-3 !w-3 !bg-muted-foreground",
			)}
			onClick={(event) => {
				event.stopPropagation();
				onCreate();
			}}
		>
			{isHovered && (
				<Plus className="pointer-events-none h-3.5 w-3.5 text-background" />
			)}
		</Handle>
	);
}

// ─── Project Node ─────────────────────────────────────────────────────────────

function ProjectNode({ data }: { data: ProjectNodeData }) {
	const { project, tasks, isRunning, isProjectRunActive } = data;
	const [isHovered, setIsHovered] = useState(false);

	// Task counts
	const notStarted = useMemo(
		() => tasks.filter((t) => t.kanban === "not-started").length,
		[tasks],
	);
	const inProgress = useMemo(
		() => tasks.filter((t) => t.kanban === "in-progress").length,
		[tasks],
	);
	const done = useMemo(
		() => tasks.filter((t) => t.kanban === "done").length,
		[tasks],
	);
	const total = tasks.length;
	const progress = total > 0 ? Math.round((done / total) * 100) : 0;

	// Tags: show up to 3, then "+N"
	const visibleTags = project.tags.slice(0, 3);
	const extraTags = project.tags.length - visibleTags.length;

	const hasEligibleTasks = tasks.some(
		(t) => t.kanban !== "done" && t.assignedTo && t.assignedTo !== "me",
	);

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div
					className={cn(
						"relative w-[280px] rounded-xl border bg-card p-4 shadow-e-2 transition-all hover:shadow-e-3 cursor-pointer",
						isRunning && "ring-2 ring-accent/50 border-accent/30",
					)}
					onMouseEnter={() => setIsHovered(true)}
					onMouseLeave={() => setIsHovered(false)}
				>
					<RoutingHandles excludeSourceBottom />
					<CreateHandle
						isHovered={isHovered}
						onCreate={() => data.onCreate(project)}
						title="Create from project"
					/>

					{/* Header row */}
					<div className="flex items-center justify-between gap-1">
						<div className="flex min-w-0 items-center gap-1.5">
							<span
								className="h-2.5 w-2.5 shrink-0 rounded-full"
								style={{ background: project.color }}
							/>
							<FolderKanban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
							<span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
								Project
							</span>
						</div>
						<div className="flex items-center gap-0.5 shrink-0">
							{hasEligibleTasks && (
								<RunButton
									isRunning={isRunning}
									isProjectRunActive={isProjectRunActive}
									onClick={() => data.onRun(project.id)}
									onStop={() => data.onStop(project.id)}
									size="sm"
									title={
										isProjectRunActive
											? "Project running — click to stop"
											: "Run all project tasks"
									}
								/>
							)}
						</div>
					</div>

					{/* Title */}
					<p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
						{project.name}
					</p>

					{/* Description */}
					{project.description && (
						<p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
							{project.description}
						</p>
					)}

					{/* Status badge */}
					<span
						className={cn(
							"mt-1.5 inline-block text-[9px] px-1.5 py-0.5 rounded-sm border font-medium capitalize",
							statusColors[project.status] ?? statusColors.active,
						)}
					>
						{project.status}
					</span>

					{/* Progress bar */}
					{total > 0 && (
						<div className="mt-2 space-y-0.5">
							<div className="flex justify-between text-[9px] text-muted-foreground">
								<span>Progress</span>
								<span>{progress}%</span>
							</div>
							<div className="h-1 w-full rounded-full bg-muted overflow-hidden">
								<div
									className="h-full rounded-full bg-primary transition-all"
									style={{ width: `${progress}%` }}
								/>
							</div>
						</div>
					)}

					{/* Task counts */}
					{total > 0 && (
						<div className="mt-1.5 flex gap-2 text-[9px]">
							<span className="text-muted-foreground">
								<span className="font-medium text-foreground">
									{notStarted}
								</span>{" "}
								todo
							</span>
							<span className="text-muted-foreground">
								<span className="font-medium text-status-in-progress">
									{inProgress}
								</span>{" "}
								active
							</span>
							<span className="text-muted-foreground">
								<span className="font-medium text-status-done">{done}</span>{" "}
								done
							</span>
						</div>
					)}

					{/* Footer: tags + team */}
					<div className="mt-2 flex items-center justify-between gap-1">
						<div className="flex min-w-0 flex-wrap gap-1">
							{visibleTags.map((tag) => (
								<Badge
									key={tag}
									variant="secondary"
									className="text-[9px] px-1 py-0 h-4 leading-none"
								>
									{tag}
								</Badge>
							))}
							{extraTags > 0 && (
								<Badge
									variant="outline"
									className="text-[9px] px-1 py-0 h-4 leading-none"
								>
									+{extraTags}
								</Badge>
							)}
						</div>
						{project.teamMembers.length > 0 && (
							<div className="flex shrink-0 items-center gap-0.5 text-[9px] text-muted-foreground">
								<Users className="h-3 w-3" />
								<span>{project.teamMembers.length}</span>
							</div>
						)}
					</div>
				</div>
			</ContextMenuTrigger>
			<ProjectContextMenuContent
				project={project}
				href={`/projects/${project.id}`}
				onRun={hasEligibleTasks ? data.onRun : undefined}
				onArchive={data.onArchive}
				onDelete={data.onDelete}
			/>
		</ContextMenu>
	);
}

// ─── Initiative Node ──────────────────────────────────────────────────────────

function InitiativeNode({ data }: { data: InitiativeNodeData }) {
	const { initiative, tasks, projectName } = data;
	const [isHovered, setIsHovered] = useState(false);

	const taskCount = tasks.length;
	const doneCount = tasks.filter((t) => t.kanban === "done").length;

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div
					className="relative w-[280px] rounded-xl border bg-card p-4 shadow-e-2 transition-all hover:shadow-e-3 cursor-pointer"
					onMouseEnter={() => setIsHovered(true)}
					onMouseLeave={() => setIsHovered(false)}
				>
					<RoutingHandles excludeSourceBottom />
					<CreateHandle
						isHovered={isHovered}
						onCreate={() => data.onCreateTask(initiative)}
						title="Create task from initiative"
					/>

					{/* Header row */}
					<div className="flex items-center gap-1.5">
						<span
							className="h-2.5 w-2.5 shrink-0 rounded-full"
							style={{ background: initiative.color }}
						/>
						<Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
						<span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
							Initiative
						</span>
					</div>

					{/* Title */}
					<p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
						{initiative.title}
					</p>

					{/* Description */}
					{initiative.description && (
						<p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
							{initiative.description}
						</p>
					)}

					{/* Status badge */}
					<span
						className={cn(
							"mt-1.5 inline-block text-[9px] px-1.5 py-0.5 rounded-sm border font-medium capitalize",
							statusColors[initiative.status] ?? statusColors.active,
						)}
					>
						{initiative.status}
					</span>

					{/* Meta row: task count + project name */}
					<div className="mt-2 flex items-center justify-between gap-1 text-[9px] text-muted-foreground">
						{taskCount > 0 ? (
							<span>
								<span className="font-medium text-foreground">{doneCount}</span>
								<span>/{taskCount} tasks done</span>
							</span>
						) : (
							<span>No tasks</span>
						)}
						{projectName && (
							<span
								className="truncate max-w-[120px] text-right"
								title={projectName}
							>
								{projectName}
							</span>
						)}
					</div>
				</div>
			</ContextMenuTrigger>
			<InitiativeContextMenuContent
				initiative={initiative}
				onTogglePause={data.onTogglePause}
				onArchive={data.onArchive}
				onDelete={data.onDelete}
			/>
		</ContextMenu>
	);
}

// ─── Task Node ───────────────────────────────────────────────────────────────

const kanbanStatusColors: Record<string, string> = {
	"not-started":
		"border-status-not-started/20 bg-status-not-started/10 text-status-not-started dark:text-status-not-started",
	"in-progress":
		"border-status-in-progress/20 bg-status-in-progress/10 text-status-in-progress dark:text-status-in-progress",
	done: "border-status-done/20 bg-status-done/10 text-status-done dark:text-status-done",
	"awaiting-decision":
		"border-warning/20 bg-warning/10 text-warning dark:text-warning",
	failed:
		"border-destructive/20 bg-destructive/10 text-destructive dark:text-destructive",
};

function TaskNode({ data }: { data: TaskNodeData }) {
	const { task, projectColor } = data;
	return (
		<div className="relative w-[280px] rounded-xl border bg-card p-5 shadow-e-2 transition-all hover:shadow-e-3 cursor-pointer">
			<RoutingHandles />
			<div className="flex items-center gap-2">
				<span
					className="h-3 w-3 shrink-0 rounded-full"
					style={{ background: projectColor ?? "var(--muted-foreground)" }}
				/>
				<CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
				<span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
					Task
				</span>
			</div>
			<p className="mt-2 line-clamp-2 text-base font-semibold leading-snug text-foreground">
				{task.title}
			</p>
			<span
				className={cn(
					"mt-2 inline-block text-[10px] px-1.5 py-0.5 rounded-sm border font-medium",
					kanbanStatusColors[task.kanban] ?? kanbanStatusColors["not-started"],
				)}
			>
				{task.kanban}
			</span>
		</div>
	);
}

// ─── Creation Dialogs ────────────────────────────────────────────────────────

function ProjectCreateChoiceDialog({
	project,
	onOpenChange,
	onCreateInitiative,
	onCreateTask,
}: {
	project: Project | null;
	onOpenChange: (open: boolean) => void;
	onCreateInitiative: () => void;
	onCreateTask: () => void;
}) {
	return (
		<Dialog open={!!project} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Create from project</DialogTitle>
					<DialogDescription>
						{project ? `Add entity connected to ${project.name}.` : null}
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-2">
					<Button variant="outline" onClick={onCreateInitiative}>
						<Plus className="mr-2 h-4 w-4" /> New Initiative
					</Button>
					<Button onClick={onCreateTask}>
						<Plus className="mr-2 h-4 w-4" /> New Task
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function CreateInitiativeFromCanvasDialog({
	open,
	project,
	onOpenChange,
	onSubmit,
}: {
	open: boolean;
	project: Project | null;
	onOpenChange: (open: boolean) => void;
	onSubmit: (data: {
		title: string;
		description: string;
		color: string;
	}) => Promise<void>;
}) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [color, setColor] = useState(colorSwatches[0]);
	const [saving, setSaving] = useState(false);

	async function handleSubmit(event: FormEvent) {
		event.preventDefault();
		if (!title.trim()) return;
		setSaving(true);
		try {
			await onSubmit({
				title: title.trim(),
				description: description.trim(),
				color,
			});
			setTitle("");
			setDescription("");
			setColor(colorSwatches[0]);
			onOpenChange(false);
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>New Initiative</DialogTitle>
					<DialogDescription>
						{project ? `Linked to ${project.name}.` : null}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="canvas-initiative-title">Title</Label>
						<Input
							id="canvas-initiative-title"
							value={title}
							onChange={(event) => setTitle(event.target.value)}
							placeholder="Initiative title"
							required
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="canvas-initiative-description">Description</Label>
						<Textarea
							id="canvas-initiative-description"
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							placeholder="What is this initiative about?"
							rows={3}
						/>
					</div>
					<div className="space-y-1.5">
						<Label>Color</Label>
						<div className="flex flex-wrap gap-2">
							{colorSwatches.map((swatch) => (
								<button
									key={swatch}
									type="button"
									className="h-6 w-6 rounded-full border-2 transition-all"
									style={{
										backgroundColor: swatch,
										borderColor: color === swatch ? "white" : "transparent",
										outline: color === swatch ? `2px solid ${swatch}` : "none",
										outlineOffset: "2px",
									}}
									onClick={() => setColor(swatch)}
								/>
							))}
						</div>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={saving || !title.trim()}>
							{saving ? "Creating..." : "Create Initiative"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({
	open,
	title,
	description,
	confirmLabel,
	onConfirm,
	onCancel,
}: {
	open: boolean;
	title: string;
	description: string;
	confirmLabel?: string;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				if (!o) onCancel();
			}}
		>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button variant="destructive" onClick={onConfirm}>
						{confirmLabel ?? "Confirm"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ─── Off-Screen Indicators ───────────────────────────────────────────────────

type OffScreenDirection = "top" | "right" | "bottom" | "left";

function OffScreenIndicators() {
	const { getNodes, flowToScreenPosition } = useReactFlow();
	const _viewport = useStore((s) => ({
		x: s.transform[0],
		y: s.transform[1],
		zoom: s.transform[2],
	}));
	const containerRef = useRef<HTMLDivElement>(null);

	const offScreen = useMemo(() => {
		const container = containerRef.current?.parentElement;
		if (!container) return { top: 0, right: 0, bottom: 0, left: 0 };

		const rect = container.getBoundingClientRect();
		const pad = 40;
		const counts = { top: 0, right: 0, bottom: 0, left: 0 };

		for (const node of getNodes()) {
			const w =
				(NODE_WIDTHS as Record<string, number>)[node.type ?? "project"] ?? 280;
			const h = 120;
			const screenPos = flowToScreenPosition({
				x: node.position.x + w / 2,
				y: node.position.y + h / 2,
			});

			const relX = screenPos.x - rect.left;
			const relY = screenPos.y - rect.top;

			if (relY < -pad) counts.top++;
			else if (relY > rect.height + pad) counts.bottom++;
			if (relX < -pad) counts.left++;
			else if (relX > rect.width + pad) counts.right++;
		}

		return counts;
	}, [getNodes, flowToScreenPosition]);

	const indicators: {
		dir: OffScreenDirection;
		count: number;
		Icon: typeof ChevronUp;
		style: string;
	}[] = [
		{
			dir: "top",
			count: offScreen.top,
			Icon: ChevronUp,
			style: "top-3 left-1/2 -translate-x-1/2",
		},
		{
			dir: "bottom",
			count: offScreen.bottom,
			Icon: ChevronDown,
			style: "bottom-3 left-1/2 -translate-x-1/2",
		},
		{
			dir: "left",
			count: offScreen.left,
			Icon: ChevronLeft,
			style: "left-3 top-1/2 -translate-y-1/2",
		},
		{
			dir: "right",
			count: offScreen.right,
			Icon: ChevronRight,
			style: "right-3 top-1/2 -translate-y-1/2",
		},
	];

	return (
		<div
			ref={containerRef}
			className="pointer-events-none absolute inset-0 z-10"
		>
			{indicators.map(
				({ dir, count, Icon, style }) =>
					count > 0 && (
						<button
							key={dir}
							type="button"
							className={cn(
								"pointer-events-auto absolute flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 shadow-e-3 transition-opacity animate-pulse cursor-default",
								style,
							)}
						>
							<Icon className="h-5 w-5 text-foreground" />
							{count > 1 && (
								<span className="text-xs font-semibold text-foreground">
									{count}
								</span>
							)}
						</button>
					),
			)}
		</div>
	);
}

// ─── Node Types ───────────────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
	project: ProjectNode as NodeTypes[string],
	initiative: InitiativeNode as NodeTypes[string],
	task: TaskNode as NodeTypes[string],
	collapseBubble: CollapseBubbleNode as NodeTypes[string],
};

// ─── Status Filter Toolbar ───────────────────────────────────────────────────

type StatusFilterKey = ProjectStatus | "done-tasks";

const STATUS_FILTER_OPTIONS: { key: StatusFilterKey; label: string }[] = [
	{ key: "active", label: "Active" },
	{ key: "paused", label: "Paused" },
	{ key: "completed", label: "Completed" },
	{ key: "archived", label: "Archived" },
	{ key: "done-tasks", label: "Done tasks" },
];

function StatusFilterToolbar({
	statusFilter,
	onToggle,
}: {
	statusFilter: Set<StatusFilterKey>;
	onToggle: (key: StatusFilterKey) => void;
}) {
	return (
		<div className="absolute top-3 left-3 z-20 flex flex-wrap gap-1.5 rounded-lg border border-border bg-card px-2.5 py-2 shadow-e-3">
			{STATUS_FILTER_OPTIONS.map(({ key, label }) => {
				const active = statusFilter.has(key);
				return (
					<button
						key={key}
						type="button"
						onClick={() => onToggle(key)}
						className={cn(
							"rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors border",
							active
								? "bg-primary text-primary-foreground border-primary"
								: "bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
						)}
					>
						{label}
					</button>
				);
			})}
		</div>
	);
}

// ─── Stats Summary Bar ───────────────────────────────────────────────────────

function StatsSummaryBar({
	projectCount,
	initiativeCount,
	taskCount,
}: {
	projectCount: number;
	initiativeCount: number;
	taskCount: number;
}) {
	return (
		<div className="absolute bottom-12 left-1/2 z-20 -translate-x-1/2 flex items-center gap-3 rounded-full border border-border bg-card px-4 py-1.5 shadow-e-3 text-[10px] text-muted-foreground">
			<span>
				<span className="font-semibold text-foreground">{projectCount}</span>{" "}
				project{projectCount !== 1 ? "s" : ""}
			</span>
			<span className="h-3 w-px bg-border" />
			<span>
				<span className="font-semibold text-foreground">{initiativeCount}</span>{" "}
				initiative{initiativeCount !== 1 ? "s" : ""}
			</span>
			<span className="h-3 w-px bg-border" />
			<span>
				<span className="font-semibold text-foreground">{taskCount}</span> task
				{taskCount !== 1 ? "s" : ""}
			</span>
		</div>
	);
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

function ProjectInitiativeCanvasInner() {
	const router = useRouter();
	const {
		projects,
		loading: projectsLoading,
		error: projectsError,
		refetch: refetchProjects,
		update: updateProject,
	} = useProjects();
	const {
		initiatives,
		loading: initiativesLoading,
		error: initiativesError,
		refetch: refetchInitiatives,
		update: updateInitiative,
		create: createInitiative,
		remove: removeInitiative,
	} = useInitiatives();
	const {
		tasks,
		loading: tasksLoading,
		error: tasksError,
		refetch: refetchTasks,
		update: updateTask,
		create: createTask,
	} = useTasks();

	const { isProjectRunning, isProjectRunActive, runProject, stopProject } =
		useActiveRunsContext();

	const loading = projectsLoading || initiativesLoading || tasksLoading;
	const error = projectsError || initiativesError || tasksError;

	// ─── Status filter state ───────────────────────────────────────────────
	const [statusFilter, setStatusFilter] = useState<Set<StatusFilterKey>>(
		() => new Set(["active", "paused", "completed"]),
	);

	const toggleStatusFilter = useCallback((key: StatusFilterKey) => {
		setStatusFilter((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}, []);

	const showDoneTasks = statusFilter.has("done-tasks");

	// ─── Confirm dialog state ──────────────────────────────────────────────
	const [confirmDialog, setConfirmDialog] = useState<{
		open: boolean;
		title: string;
		description: string;
		onConfirm: () => void;
	} | null>(null);

	// ─── Filtered collections ──────────────────────────────────────────────
	const activeProjects = useMemo(
		() =>
			projects.filter(
				(p) => !p.deletedAt && statusFilter.has(p.status as StatusFilterKey),
			),
		[projects, statusFilter],
	);

	const activeInitiatives = useMemo(
		() =>
			initiatives.filter(
				(i) => !i.deletedAt && statusFilter.has(i.status as StatusFilterKey),
			),
		[initiatives, statusFilter],
	);

	const canvasTasks = useMemo(
		() =>
			tasks.filter(
				(t) =>
					!t.deletedAt &&
					!t.isScheduled &&
					(showDoneTasks || t.kanban !== "done"),
			),
		[tasks, showDoneTasks],
	);

	// Memoized per-project task map for performance
	const projectTaskMap = useMemo(() => {
		const map = new Map<string, Task[]>();
		for (const task of tasks.filter((t) => !t.deletedAt && !t.isScheduled)) {
			if (task.projectId) {
				const arr = map.get(task.projectId) ?? [];
				arr.push(task);
				map.set(task.projectId, arr);
			}
		}
		return map;
	}, [tasks]);

	// Per-initiative task map
	const initiativeTaskMap = useMemo(() => {
		const map = new Map<string, Task[]>();
		for (const initiative of initiatives) {
			const itasks = tasks.filter(
				(t) =>
					!t.deletedAt &&
					(t.initiativeId === initiative.id ||
						(initiative.taskIds ?? []).includes(t.id)),
			);
			map.set(initiative.id, itasks);
		}
		return map;
	}, [initiatives, tasks]);

	// Project name lookup
	const projectNameMap = useMemo(
		() => new Map(projects.map((p) => [p.id, p.name])),
		[projects],
	);

	// ─── Action handlers ───────────────────────────────────────────────────

	const handleArchiveProject = useCallback(
		(projectId: string) => {
			const project = projects.find((p) => p.id === projectId);
			if (!project) return;
			void updateProject(projectId, {
				status: project.status === "archived" ? "active" : "archived",
			});
		},
		[projects, updateProject],
	);

	const handleDeleteProject = useCallback(
		(projectId: string) => {
			const project = projects.find((p) => p.id === projectId);
			if (!project) return;
			setConfirmDialog({
				open: true,
				title: "Delete project",
				description: `Are you sure you want to delete "${project.name}"? This cannot be undone.`,
				onConfirm: () => {
					void updateProject(projectId, {
						deletedAt: new Date().toISOString(),
					});
					setConfirmDialog(null);
				},
			});
		},
		[projects, updateProject],
	);

	const handleTogglePauseInitiative = useCallback(
		(initiative: Initiative) => {
			void updateInitiative(initiative.id, {
				status: initiative.status === "paused" ? "active" : "paused",
			});
		},
		[updateInitiative],
	);

	const handleArchiveInitiative = useCallback(
		(initiativeId: string) => {
			void updateInitiative(initiativeId, { status: "archived" });
		},
		[updateInitiative],
	);

	const handleDeleteInitiative = useCallback(
		(initiativeId: string) => {
			const initiative = initiatives.find((i) => i.id === initiativeId);
			if (!initiative) return;
			setConfirmDialog({
				open: true,
				title: "Delete initiative",
				description: `Are you sure you want to delete "${initiative.title}"? This cannot be undone.`,
				onConfirm: () => {
					void removeInitiative(initiativeId);
					setConfirmDialog(null);
				},
			});
		},
		[initiatives, removeInitiative],
	);

	// ─── Canvas state ──────────────────────────────────────────────────────

	const [projectCreateSource, setProjectCreateSource] =
		useState<Project | null>(null);
	const [initiativeCreateProject, setInitiativeCreateProject] =
		useState<Project | null>(null);
	const [taskDefaults, setTaskDefaults] =
		useState<Partial<TaskFormData> | null>(null);
	const [taskMapPosition, setTaskMapPosition] = useState<{
		x: number;
		y: number;
	} | null>(null);
	const [collapsedSides, setCollapsedSides] = useState<Map<string, Set<Side>>>(
		() => new Map(),
	);

	const toggleCollapseSide = useCallback((nodeId: string, side: Side) => {
		setCollapsedSides((prev) => {
			const next = new Map(prev);
			const sides = new Set(prev.get(nodeId));
			if (sides.has(side)) sides.delete(side);
			else sides.add(side);
			if (sides.size === 0) next.delete(nodeId);
			else next.set(nodeId, sides);
			return next;
		});
	}, []);

	const getProjectPosition = useCallback(
		(project: Project) => {
			const index = Math.max(
				0,
				activeProjects.findIndex((item) => item.id === project.id),
			);
			return project.mapPosition ?? gridPosition(index, 3, 340, 320);
		},
		[activeProjects],
	);

	const getInitiativePosition = useCallback(
		(initiative: Initiative) => {
			const projectRows = Math.max(1, Math.ceil(activeProjects.length / 3));
			const initiativeStartY = projectRows * 320 + 80;
			const index = Math.max(
				0,
				activeInitiatives.findIndex((item) => item.id === initiative.id),
			);
			const fallback = {
				x: gridPosition(index, 3, 340, 320).x,
				y: initiativeStartY + gridPosition(index, 3, 340, 320).y,
			};
			return initiative.mapPosition ?? fallback;
		},
		[activeProjects.length, activeInitiatives],
	);

	const openProjectCreate = useCallback((project: Project) => {
		setProjectCreateSource(project);
	}, []);

	const openTaskFromProject = useCallback(
		(project: Project) => {
			const position = getProjectPosition(project);
			setProjectCreateSource(null);
			setTaskMapPosition({ x: position.x + 40, y: position.y + 260 });
			setTaskDefaults({
				projectId: project.id,
				initiativeId: null,
			});
		},
		[getProjectPosition],
	);

	const openTaskFromInitiative = useCallback(
		(initiative: Initiative) => {
			const position = getInitiativePosition(initiative);
			setTaskMapPosition({ x: position.x + 40, y: position.y + 260 });
			setTaskDefaults({
				projectId: initiative.projectId,
				initiativeId: initiative.id,
			});
		},
		[getInitiativePosition],
	);

	// Build child-count maps for collapse indicators
	const initiativeTaskIdSets = useMemo(() => {
		const result = new Map<string, Set<string>>();
		for (const init of activeInitiatives) {
			result.set(init.id, new Set(init.taskIds ?? []));
		}
		return result;
	}, [activeInitiatives]);

	const activeInitiativeIds = useMemo(
		() => new Set(activeInitiatives.map((i) => i.id)),
		[activeInitiatives],
	);

	const hasActiveInitiativeParent = useCallback(
		(task: CanvasTask) =>
			(task.initiativeId && activeInitiativeIds.has(task.initiativeId)) ||
			[...initiativeTaskIdSets.values()].some((ids) => ids.has(task.id)),
		[activeInitiativeIds, initiativeTaskIdSets],
	);

	const initialNodes: Node[] = useMemo(() => {
		const projectColorMap = new Map(activeProjects.map((p) => [p.id, p.color]));

		const projectNodes: Node[] = activeProjects.map((project, idx) => {
			const id = `project:${project.id}`;
			const projectTasks = projectTaskMap.get(project.id) ?? [];
			return {
				id,
				type: "project",
				position: project.mapPosition ?? gridPosition(idx, 3, 340, 320),
				data: {
					project,
					tasks: projectTasks,
					isRunning: isProjectRunning(project.id),
					isProjectRunActive: isProjectRunActive(project.id),
					onCreate: openProjectCreate,
					onRun: runProject,
					onStop: stopProject,
					onArchive: handleArchiveProject,
					onDelete: handleDeleteProject,
				} satisfies ProjectNodeData,
			};
		});

		const projectCount = activeProjects.length;
		const projectRows = Math.max(1, Math.ceil(projectCount / 3));
		const initiativeStartY = projectRows * 320 + 80;

		const initiativeNodes: Node[] = activeInitiatives.map((initiative, idx) => {
			const id = `initiative:${initiative.id}`;
			const fallbackPosition = {
				x: gridPosition(idx, 3, 340, 320).x,
				y: initiativeStartY + gridPosition(idx, 3, 340, 320).y,
			};
			const initTasks = initiativeTaskMap.get(initiative.id) ?? [];
			return {
				id,
				type: "initiative",
				position: initiative.mapPosition ?? fallbackPosition,
				data: {
					initiative,
					tasks: initTasks,
					projectName: initiative.projectId
						? (projectNameMap.get(initiative.projectId) ?? null)
						: null,
					onCreateTask: openTaskFromInitiative,
					onTogglePause: handleTogglePauseInitiative,
					onArchive: handleArchiveInitiative,
					onDelete: handleDeleteInitiative,
				} satisfies InitiativeNodeData,
			};
		});

		const initiativeCount = activeInitiatives.length;
		const initiativeRows = Math.max(1, Math.ceil(initiativeCount / 3));
		const taskStartY = initiativeStartY + initiativeRows * 320 + 80;

		const taskNodes: Node[] = canvasTasks.map((task, idx) => {
			const taskId = `task:${task.id}`;
			const fallbackPosition = {
				x: gridPosition(idx, 3, 340, 320).x,
				y: taskStartY + gridPosition(idx, 3, 340, 320).y,
			};
			return {
				id: taskId,
				type: "task",
				position: task.mapPosition ?? fallbackPosition,
				data: {
					task,
					projectColor: task.projectId
						? (projectColorMap.get(task.projectId) ?? null)
						: null,
				} satisfies TaskNodeData,
			};
		});

		return [...projectNodes, ...initiativeNodes, ...taskNodes];
	}, [
		activeProjects,
		activeInitiatives,
		canvasTasks,
		projectTaskMap,
		initiativeTaskMap,
		projectNameMap,
		openProjectCreate,
		openTaskFromInitiative,
		isProjectRunning,
		isProjectRunActive,
		runProject,
		stopProject,
		handleArchiveProject,
		handleDeleteProject,
		handleTogglePauseInitiative,
		handleArchiveInitiative,
		handleDeleteInitiative,
	]);

	const [nodes, setNodes] = useState<Node[]>(initialNodes);

	// Node opacity: archived/done at 0.6
	const archivedProjectIds = useMemo(
		() =>
			new Set(projects.filter((p) => p.status === "archived").map((p) => p.id)),
		[projects],
	);
	const archivedInitiativeIds = useMemo(
		() =>
			new Set(
				initiatives.filter((i) => i.status === "archived").map((i) => i.id),
			),
		[initiatives],
	);

	// Compute hidden nodes + bubble nodes based on current positions and collapsed sides
	const { hiddenNodeIds, bubbleNodes } = useMemo(() => {
		const livePositions = new Map(nodes.map((n) => [n.id, n.position]));
		const nodePositions = new Map(
			initialNodes.map((n) => [n.id, livePositions.get(n.id) ?? n.position]),
		);

		type ChildEntry = { childId: string; childType: keyof typeof NODE_WIDTHS };
		const parentChildren = new Map<string, Map<Side, ChildEntry[]>>();

		function addChild(
			parentId: string,
			parentType: keyof typeof NODE_WIDTHS,
			childId: string,
			childType: keyof typeof NODE_WIDTHS,
		) {
			const sPos = nodePositions.get(parentId);
			const tPos = nodePositions.get(childId);
			if (!sPos || !tPos) return;
			const sides = bestSides(
				sPos,
				tPos,
				NODE_WIDTHS[parentType],
				NODE_WIDTHS[childType],
			);

			let sideMap = parentChildren.get(parentId);
			if (!sideMap) {
				sideMap = new Map();
				parentChildren.set(parentId, sideMap);
			}
			let bucket = sideMap.get(sides.source);
			if (!bucket) {
				bucket = [];
				sideMap.set(sides.source, bucket);
			}
			bucket.push({ childId, childType });
		}

		for (const init of activeInitiatives) {
			if (init.projectId) {
				addChild(
					`project:${init.projectId}`,
					"project",
					`initiative:${init.id}`,
					"initiative",
				);
			}
		}
		for (const task of canvasTasks) {
			if (task.projectId && !hasActiveInitiativeParent(task)) {
				addChild(
					`project:${task.projectId}`,
					"project",
					`task:${task.id}`,
					"task",
				);
			}
		}
		for (const task of canvasTasks) {
			const initId = task.initiativeId ?? null;
			if (initId) {
				addChild(
					`initiative:${initId}`,
					"initiative",
					`task:${task.id}`,
					"task",
				);
			} else {
				for (const [iid, taskIdSet] of initiativeTaskIdSets) {
					if (taskIdSet.has(task.id)) {
						addChild(
							`initiative:${iid}`,
							"initiative",
							`task:${task.id}`,
							"task",
						);
						break;
					}
				}
			}
		}

		const hidden = new Set<string>();
		for (const [nodeId, sides] of collapsedSides) {
			const sideMap = parentChildren.get(nodeId);
			if (!sideMap) continue;
			for (const side of sides) {
				const children = sideMap.get(side);
				if (!children) continue;
				for (const { childId } of children) {
					hidden.add(childId);
					if (childId.startsWith("initiative:")) {
						const iid = childId.slice(11);
						for (const task of canvasTasks) {
							if (
								task.initiativeId === iid ||
								initiativeTaskIdSets.get(iid)?.has(task.id)
							) {
								hidden.add(`task:${task.id}`);
							}
						}
					}
				}
			}
		}

		const _bubbleNodes: Node[] = [];
		for (const [nodeId, sides] of collapsedSides) {
			const parentPos = nodePositions.get(nodeId);
			if (!parentPos) continue;
			const sideMap = parentChildren.get(nodeId);
			if (!sideMap) continue;
			const parentW = 280;
			const parentH = 120;

			for (const side of sides) {
				const children = sideMap.get(side);
				if (!children || children.length === 0) continue;

				const counts: ChildCounts = { initiatives: 0, tasks: 0 };
				for (const { childId } of children) {
					if (childId.startsWith("initiative:")) {
						counts.initiatives++;
						const iid = childId.slice(11);
						for (const task of canvasTasks) {
							if (
								task.initiativeId === iid ||
								initiativeTaskIdSets.get(iid)?.has(task.id)
							) {
								counts.tasks++;
							}
						}
					} else if (childId.startsWith("task:")) {
						counts.tasks++;
					}
				}

				const offset = 60;
				let pos: { x: number; y: number };
				let sourceHandle: string;
				let targetHandle: string;
				switch (side) {
					case "right":
						pos = {
							x: parentPos.x + parentW + offset,
							y: parentPos.y + parentH / 2 - 12,
						};
						sourceHandle = "source-right";
						targetHandle = "target-left";
						break;
					case "left":
						pos = {
							x: parentPos.x - offset - BUBBLE_NODE_WIDTH,
							y: parentPos.y + parentH / 2 - 12,
						};
						sourceHandle = "source-left";
						targetHandle = "target-right";
						break;
					case "bottom":
						pos = {
							x: parentPos.x + parentW / 2 - BUBBLE_NODE_WIDTH / 2,
							y: parentPos.y + parentH + offset,
						};
						sourceHandle = "source-bottom";
						targetHandle = "target-top";
						break;
					case "top":
						pos = {
							x: parentPos.x + parentW / 2 - BUBBLE_NODE_WIDTH / 2,
							y: parentPos.y - offset - 24,
						};
						sourceHandle = "source-top";
						targetHandle = "target-bottom";
						break;
				}

				_bubbleNodes.push({
					id: `bubble:${nodeId}:${side}`,
					type: "collapseBubble",
					position: pos,
					draggable: false,
					selectable: false,
					data: {
						counts,
						onExpand: () => toggleCollapseSide(nodeId, side),
						_sourceHandle: sourceHandle,
						_targetHandle: targetHandle,
						_parentId: nodeId,
					},
				});
			}
		}

		return { hiddenNodeIds: hidden, bubbleNodes: _bubbleNodes };
	}, [
		nodes,
		initialNodes,
		collapsedSides,
		activeInitiatives,
		canvasTasks,
		initiativeTaskIdSets,
		toggleCollapseSide,
		hasActiveInitiativeParent,
	]);

	useEffect(() => {
		setNodes((currentNodes) => {
			const currentPositions = new Map(
				currentNodes.map((node) => [node.id, node.position]),
			);
			return initialNodes.map((node) => ({
				...node,
				position: currentPositions.get(node.id) ?? node.position,
			}));
		});
	}, [initialNodes]);

	function handleNodesChange(changes: NodeChange<Node>[]) {
		setNodes((currentNodes) => {
			const currentIds = new Set(currentNodes.map((n) => n.id));
			const withBubbles = [
				...currentNodes,
				...bubbleNodes.filter((b) => !currentIds.has(b.id)),
			];
			return applyNodeChanges(changes, withBubbles);
		});
	}

	function handleNodeDragStop(
		_: MouseEvent,
		_draggedNode: Node,
		draggedNodes: Node[],
	) {
		setNodes((currentNodes) => {
			const draggedPositions = new Map(
				draggedNodes.map((node) => [node.id, node.position]),
			);
			return currentNodes.map((node) => ({
				...node,
				position: draggedPositions.get(node.id) ?? node.position,
			}));
		});

		for (const node of draggedNodes) {
			if (node.id.startsWith("project:")) {
				void updateProject(node.id.slice("project:".length), {
					mapPosition: node.position,
				});
			}
			if (node.id.startsWith("initiative:")) {
				void updateInitiative(node.id.slice("initiative:".length), {
					mapPosition: node.position,
				});
			}
			if (node.id.startsWith("task:")) {
				void updateTask(node.id.slice("task:".length), {
					mapPosition: node.position,
				});
			}
		}
	}

	const handleEdgeClick = useCallback(
		(_event: React.MouseEvent, edge: Edge) => {
			const sourceId = edge.source;
			if (
				!sourceId.startsWith("project:") &&
				!sourceId.startsWith("initiative:")
			)
				return;
			const side = (edge.sourceHandle?.replace("source-", "") ??
				"bottom") as Side;
			toggleCollapseSide(sourceId, side);
		},
		[toggleCollapseSide],
	);

	const handleNodeClick = useCallback(
		(event: React.MouseEvent, node: Node) => {
			// Collapse bubble — expand instead of navigating
			if (node.type === "collapseBubble") {
				(node.data as CollapseBubbleNodeData).onExpand();
				return;
			}

			// Guard: do not navigate if the click was inside a button, menuitem, or data-no-nav element
			const target = event.target as HTMLElement;
			if (target.closest("button, [role='menuitem'], [data-no-nav]")) {
				return;
			}

			// Navigate based on node type and id prefix
			if (node.id.startsWith("project:")) {
				router.push(`/projects/${node.id.slice("project:".length)}`);
			} else if (node.id.startsWith("initiative:")) {
				router.push(`/initiatives/${node.id.slice("initiative:".length)}`);
			} else if (node.id.startsWith("task:")) {
				router.push(`/tasks/${node.id.slice("task:".length)}`);
			}
		},
		[router],
	);

	async function handleCreateTask(data: TaskFormData) {
		await createTask({
			...data,
			tags: data.tags
				.split(",")
				.map((tag) => tag.trim())
				.filter(Boolean),
			acceptanceCriteria: data.acceptanceCriteria ?? "",
			mapPosition: taskMapPosition ?? undefined,
		});
		setTaskDefaults(null);
		setTaskMapPosition(null);
		void refetchTasks();
		void refetchInitiatives();
	}

	async function handleCreateInitiative(data: {
		title: string;
		description: string;
		color: string;
	}) {
		if (!initiativeCreateProject) return;
		const position = getProjectPosition(initiativeCreateProject);
		await createInitiative({
			title: data.title,
			description: data.description,
			color: data.color,
			projectId: initiativeCreateProject.id,
			status: "active",
			teamMembers: [],
			taskIds: [],
			tags: [],
			mapPosition: { x: position.x + 40, y: position.y + 300 },
		});
		setInitiativeCreateProject(null);
		void refetchInitiatives();
	}

	const edges: Edge[] = useMemo(() => {
		const activeProjectIds = new Set(
			activeProjects.map((project) => project.id),
		);
		const activeInitiativeIds = new Set(
			activeInitiatives.map((initiative) => initiative.id),
		);

		const nodePositions = new Map(
			nodes.map((node) => [node.id, node.position]),
		);

		function edgeHandles(
			sourceId: string,
			targetId: string,
			sourceType: keyof typeof NODE_WIDTHS,
			targetType: keyof typeof NODE_WIDTHS,
		) {
			const sPos = nodePositions.get(sourceId);
			const tPos = nodePositions.get(targetId);
			if (!sPos || !tPos) return {};
			const sides = bestSides(
				sPos,
				tPos,
				NODE_WIDTHS[sourceType],
				NODE_WIDTHS[targetType],
			);
			return {
				sourceHandle: `source-${sides.source}`,
				targetHandle: `target-${sides.target}`,
			};
		}

		const result: Edge[] = [];

		result.push(
			...activeInitiatives
				.filter(
					(initiative) =>
						initiative.projectId !== null &&
						activeProjectIds.has(initiative.projectId),
				)
				.map((initiative) => {
					const sourceId = `project:${initiative.projectId}`;
					const targetId = `initiative:${initiative.id}`;
					return {
						id: `edge:${sourceId}:${targetId}`,
						source: sourceId,
						target: targetId,
						...edgeHandles(sourceId, targetId, "project", "initiative"),
						type: "smoothstep",
						markerEnd: {
							type: MarkerType.ArrowClosed,
							color: edgeColor,
							width: 14,
							height: 14,
						},
						animated: false,
						interactionWidth: 20,
						style: {
							strokeWidth: 2,
							stroke: edgeColor,
							strokeOpacity: edgeOpacity,
							cursor: "pointer",
						},
					};
				}),
		);

		result.push(
			...canvasTasks
				.filter((task) => {
					if (!task.projectId || !activeProjectIds.has(task.projectId))
						return false;
					return !hasActiveInitiativeParent(task);
				})
				.map((task) => {
					const sourceId = `project:${task.projectId}`;
					const targetId = `task:${task.id}`;
					return {
						id: `edge:${sourceId}:${targetId}`,
						source: sourceId,
						target: targetId,
						...edgeHandles(sourceId, targetId, "project", "task"),
						type: "smoothstep",
						markerEnd: {
							type: MarkerType.ArrowClosed,
							color: edgeColor,
							width: 12,
							height: 12,
						},
						animated: false,
						interactionWidth: 20,
						style: {
							strokeWidth: 1.5,
							stroke: edgeColor,
							strokeOpacity: edgeOpacity * 0.8,
							cursor: "pointer",
						},
					};
				}),
		);

		result.push(
			...canvasTasks
				.filter((task) => {
					if (task.initiativeId && activeInitiativeIds.has(task.initiativeId)) {
						return true;
					}
					for (const taskIdSet of initiativeTaskIdSets.values()) {
						if (taskIdSet.has(task.id)) {
							return true;
						}
					}
					return false;
				})
				.map((task) => {
					let initiativeId: string | null = task.initiativeId ?? null;
					if (!initiativeId) {
						for (const [initId, taskIdSet] of initiativeTaskIdSets) {
							if (taskIdSet.has(task.id)) {
								initiativeId = initId;
								break;
							}
						}
					}
					if (!initiativeId) return null;
					const sourceId = `initiative:${initiativeId}`;
					const targetId = `task:${task.id}`;
					return {
						id: `edge:${sourceId}:${targetId}`,
						source: sourceId,
						target: targetId,
						...edgeHandles(sourceId, targetId, "initiative", "task"),
						type: "smoothstep",
						markerEnd: {
							type: MarkerType.ArrowClosed,
							color: edgeColor,
							width: 12,
							height: 12,
						},
						animated: false,
						interactionWidth: 20,
						style: {
							strokeWidth: 1.5,
							stroke: edgeColor,
							strokeOpacity: edgeOpacity * 0.8,
							cursor: "pointer",
						},
					} as Edge;
				})
				.filter((e): e is Edge => e !== null),
		);

		return result;
	}, [
		activeProjects,
		activeInitiatives,
		canvasTasks,
		nodes,
		initiativeTaskIdSets,
		hasActiveInitiativeParent,
	]);

	const visibleNodes = useMemo(() => {
		const base = nodes
			.filter((n) => n.type !== "collapseBubble" && !hiddenNodeIds.has(n.id))
			.map((n) => {
				// Dim archived nodes
				let opacity: number | undefined;
				if (n.id.startsWith("project:")) {
					const pid = n.id.slice("project:".length);
					if (archivedProjectIds.has(pid)) opacity = 0.6;
				} else if (n.id.startsWith("initiative:")) {
					const iid = n.id.slice("initiative:".length);
					if (archivedInitiativeIds.has(iid)) opacity = 0.6;
				} else if (n.id.startsWith("task:")) {
					const taskData = n.data as TaskNodeData;
					if (taskData.task.kanban === "done") opacity = 0.6;
				}
				return opacity !== undefined
					? { ...n, style: { ...n.style, opacity } }
					: n;
			});
		const currentBubbles = bubbleNodes
			.filter((b) => {
				const parentId = (b.data as { _parentId: string })._parentId;
				return !hiddenNodeIds.has(parentId);
			})
			.map((b) => {
				const existing = nodes.find((n) => n.id === b.id);
				return existing
					? { ...existing, ...b, measured: existing.measured }
					: b;
			});
		return [...base, ...currentBubbles];
	}, [
		nodes,
		hiddenNodeIds,
		bubbleNodes,
		archivedProjectIds,
		archivedInitiativeIds,
	]);

	const visibleEdges = useMemo(() => {
		const filtered = edges.filter(
			(e) => !hiddenNodeIds.has(e.source) && !hiddenNodeIds.has(e.target),
		);
		for (const bubble of bubbleNodes) {
			const bd = bubble.data as CollapseBubbleNodeData & {
				_sourceHandle: string;
				_targetHandle: string;
				_parentId: string;
			};
			if (hiddenNodeIds.has(bd._parentId)) continue;
			filtered.push({
				id: `edge:stub:${bubble.id}`,
				source: bd._parentId,
				target: bubble.id,
				sourceHandle: bd._sourceHandle,
				targetHandle: bd._targetHandle,
				type: "smoothstep",
				markerEnd: {
					type: MarkerType.ArrowClosed,
					color: edgeColor,
					width: 10,
					height: 10,
				},
				style: {
					strokeWidth: 2,
					stroke: edgeColor,
					strokeOpacity: edgeOpacity,
					strokeDasharray: "4 3",
				},
			});
		}
		return filtered;
	}, [edges, hiddenNodeIds, bubbleNodes]);

	// Stats for the summary bar
	const visibleProjectCount = useMemo(
		() => visibleNodes.filter((n) => n.type === "project").length,
		[visibleNodes],
	);
	const visibleInitiativeCount = useMemo(
		() => visibleNodes.filter((n) => n.type === "initiative").length,
		[visibleNodes],
	);
	const visibleTaskCount = useMemo(
		() => visibleNodes.filter((n) => n.type === "task").length,
		[visibleNodes],
	);

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				Loading canvas…
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex h-full items-center justify-center p-6">
				<ErrorState
					message={error}
					onRetry={() => {
						void refetchProjects();
						void refetchInitiatives();
						void refetchTasks();
					}}
				/>
			</div>
		);
	}

	if (
		activeProjects.length === 0 &&
		activeInitiatives.length === 0 &&
		canvasTasks.length === 0
	) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
				<div className="mb-3 rounded-full bg-muted p-4">
					<FolderKanban className="h-8 w-8 text-muted-foreground" />
				</div>
				<p className="text-base font-medium text-foreground">
					No projects, initiatives, or tasks yet.
				</p>
				<p className="text-sm text-muted-foreground">
					Create projects, initiatives, and tasks to see the map.
				</p>
			</div>
		);
	}

	return (
		<div className="relative h-full w-full">
			<StatusFilterToolbar
				statusFilter={statusFilter}
				onToggle={toggleStatusFilter}
			/>
			<StatsSummaryBar
				projectCount={visibleProjectCount}
				initiativeCount={visibleInitiativeCount}
				taskCount={visibleTaskCount}
			/>
			<ReactFlow
				nodes={visibleNodes}
				edges={visibleEdges}
				nodeTypes={nodeTypes}
				fitView
				nodesDraggable
				nodesConnectable={false}
				elementsSelectable
				onNodesChange={handleNodesChange}
				onNodeDragStop={handleNodeDragStop}
				onEdgeClick={handleEdgeClick}
				onNodeClick={handleNodeClick}
				panOnDrag
				zoomOnScroll
				snapToGrid
				snapGrid={[gridSize, gridSize]}
				proOptions={{ hideAttribution: true }}
			>
				<Background gap={gridSize} size={1} color={backgroundDotColor} />
				<Controls showInteractive={false} />
				<OffScreenIndicators />
			</ReactFlow>
			<ProjectCreateChoiceDialog
				project={projectCreateSource}
				onOpenChange={(open) => {
					if (!open) setProjectCreateSource(null);
				}}
				onCreateInitiative={() => {
					if (!projectCreateSource) return;
					setInitiativeCreateProject(projectCreateSource);
					setProjectCreateSource(null);
				}}
				onCreateTask={() => {
					if (!projectCreateSource) return;
					openTaskFromProject(projectCreateSource);
				}}
			/>
			<CreateInitiativeFromCanvasDialog
				open={!!initiativeCreateProject}
				project={initiativeCreateProject}
				onOpenChange={(open) => {
					if (!open) setInitiativeCreateProject(null);
				}}
				onSubmit={handleCreateInitiative}
			/>
			<CreateTaskDialog
				key={`${taskDefaults?.projectId ?? "none"}:${taskDefaults?.initiativeId ?? "none"}`}
				open={!!taskDefaults}
				onOpenChange={(open) => {
					if (!open) {
						setTaskDefaults(null);
						setTaskMapPosition(null);
					}
				}}
				defaultValues={taskDefaults ?? undefined}
				onSubmit={(data) => {
					void handleCreateTask(data);
				}}
			/>
			{confirmDialog && (
				<ConfirmDialog
					open={confirmDialog.open}
					title={confirmDialog.title}
					description={confirmDialog.description}
					confirmLabel="Delete"
					onConfirm={confirmDialog.onConfirm}
					onCancel={() => setConfirmDialog(null)}
				/>
			)}
		</div>
	);
}

export function ProjectInitiativeCanvas() {
	return (
		<ReactFlowProvider>
			<ProjectInitiativeCanvasInner />
		</ReactFlowProvider>
	);
}
