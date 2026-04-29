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
} from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import "@xyflow/react/dist/style.css";
import { FolderKanban, Layers } from "lucide-react";
import { ErrorState } from "@/components/error-state";
import { useInitiatives, useProjects } from "@/hooks/use-data";
import type { Initiative, Project } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Node Data ────────────────────────────────────────────────────────────────

type ProjectNodeData = {
	project: Project;
};

type InitiativeNodeData = {
	initiative: Initiative;
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
	active:
		"border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
	paused:
		"border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
	completed:
		"border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

const edgeColor = "var(--muted-foreground)";
const edgeOpacity = 0.45;
const gridSize = 24;
const backgroundDotColor =
	"color-mix(in srgb, var(--muted-foreground) 20%, transparent)";

// ─── Project Node ─────────────────────────────────────────────────────────────

function ProjectNode({ data }: { data: ProjectNodeData }) {
	const { project } = data;
	return (
		<div className="relative w-[280px] rounded-xl border border-border/50 bg-card p-5 shadow-md transition-all hover:shadow-lg">
			<Handle
				type="source"
				position={Position.Bottom}
				className="!h-2 !w-2 !border !border-background !bg-muted-foreground"
			/>
			<div className="flex items-center gap-2">
				<span
					className="h-3 w-3 shrink-0 rounded-full"
					style={{ background: project.color }}
				/>
				<FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
				<span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
					Project
				</span>
			</div>
			<p className="mt-2 line-clamp-2 text-base font-semibold leading-snug text-foreground">
				{project.name}
			</p>
			{project.description && (
				<p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
					{project.description}
				</p>
			)}
			<span
				className={cn(
					"mt-2 inline-block text-[10px] px-1.5 py-0.5 rounded-sm border font-medium",
					statusColors[project.status] ?? statusColors.active,
				)}
			>
				{project.status}
			</span>
		</div>
	);
}

// ─── Initiative Node ──────────────────────────────────────────────────────────

function InitiativeNode({ data }: { data: InitiativeNodeData }) {
	const { initiative } = data;
	return (
		<div className="relative w-[280px] rounded-xl border border-border/50 bg-card p-5 shadow-md transition-all hover:shadow-lg">
			<Handle
				type="target"
				position={Position.Top}
				className="!h-2 !w-2 !border !border-background !bg-muted-foreground"
			/>
			<div className="flex items-center gap-2">
				<span
					className="h-3 w-3 shrink-0 rounded-full"
					style={{ background: initiative.color }}
				/>
				<Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
				<span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
					Initiative
				</span>
			</div>
			<p className="mt-2 line-clamp-2 text-base font-semibold leading-snug text-foreground">
				{initiative.title}
			</p>
			{initiative.description && (
				<p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
					{initiative.description}
				</p>
			)}
			<span
				className={cn(
					"mt-2 inline-block text-[10px] px-1.5 py-0.5 rounded-sm border font-medium",
					statusColors[initiative.status] ?? statusColors.active,
				)}
			>
				{initiative.status}
			</span>
		</div>
	);
}

// ─── Node Types ───────────────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
	project: ProjectNode as NodeTypes[string],
	initiative: InitiativeNode as NodeTypes[string],
};

// ─── Canvas ───────────────────────────────────────────────────────────────────

export function ProjectInitiativeCanvas() {
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
	} = useInitiatives();

	const loading = projectsLoading || initiativesLoading;
	const error = projectsError || initiativesError;

	const activeProjects = useMemo(
		() => projects.filter((p) => !p.deletedAt && p.status !== "archived"),
		[projects],
	);

	const activeInitiatives = useMemo(
		() => initiatives.filter((i) => !i.deletedAt && i.status !== "archived"),
		[initiatives],
	);

	const initialNodes: Node[] = useMemo(() => {
		const projectNodes: Node[] = activeProjects.map((project, idx) => {
			const id = `project:${project.id}`;
			return {
				id,
				type: "project",
				position: project.mapPosition ?? gridPosition(idx, 3, 340, 320),
				data: { project } satisfies ProjectNodeData,
			};
		});

		// Place initiatives below projects in a separate row band
		const projectCount = activeProjects.length;
		const projectRows = Math.max(1, Math.ceil(projectCount / 3));
		const initiativeStartY = projectRows * 320 + 80;

		const initiativeNodes: Node[] = activeInitiatives.map((initiative, idx) => {
			const id = `initiative:${initiative.id}`;
			const fallbackPosition = {
				x: gridPosition(idx, 3, 340, 320).x,
				y: initiativeStartY + gridPosition(idx, 3, 340, 320).y,
			};
			return {
				id,
				type: "initiative",
				position: initiative.mapPosition ?? fallbackPosition,
				data: { initiative } satisfies InitiativeNodeData,
			};
		});

		return [...projectNodes, ...initiativeNodes];
	}, [activeProjects, activeInitiatives]);

	const [nodes, setNodes] = useState<Node[]>(initialNodes);

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
		setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
	}

	function handleNodeDragStop(
		_: React.MouseEvent,
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
		}
	}

	const edges: Edge[] = useMemo(() => {
		const activeProjectIds = new Set(
			activeProjects.map((project) => project.id),
		);
		return activeInitiatives
			.filter(
				(initiative) =>
					initiative.projectId !== null &&
					activeProjectIds.has(initiative.projectId),
			)
			.map((initiative) => ({
				id: `edge:project:${initiative.projectId}:initiative:${initiative.id}`,
				source: `project:${initiative.projectId}`,
				target: `initiative:${initiative.id}`,
				type: "smoothstep",
				markerEnd: {
					type: MarkerType.ArrowClosed,
					color: edgeColor,
					width: 14,
					height: 14,
				},
				animated: false,
				style: {
					strokeWidth: 2,
					stroke: edgeColor,
					strokeOpacity: edgeOpacity,
				},
			}));
	}, [activeProjects, activeInitiatives]);

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
					}}
				/>
			</div>
		);
	}

	if (activeProjects.length === 0 && activeInitiatives.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
				<div className="mb-3 rounded-full bg-muted/50 p-4">
					<FolderKanban className="h-8 w-8 text-muted-foreground" />
				</div>
				<p className="text-base font-medium text-foreground">
					No projects or initiatives yet.
				</p>
				<p className="text-sm text-muted-foreground">
					Create projects and initiatives to see the map.
				</p>
			</div>
		);
	}

	return (
		<ReactFlow
			nodes={nodes}
			edges={edges}
			nodeTypes={nodeTypes}
			fitView
			nodesDraggable
			nodesConnectable={false}
			elementsSelectable
			onNodesChange={handleNodesChange}
			onNodeDragStop={handleNodeDragStop}
			panOnDrag
			zoomOnScroll
			snapToGrid
			snapGrid={[gridSize, gridSize]}
			proOptions={{ hideAttribution: true }}
		>
			<Background gap={gridSize} size={1} color={backgroundDotColor} />
			<Controls showInteractive={false} />
		</ReactFlow>
	);
}
