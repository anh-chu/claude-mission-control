"use client";

import { Lightbulb, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { InitiativeContextMenuContent } from "@/components/context-menus/initiative-context-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useInitiatives, useProjects } from "@/hooks/use-data";

import type { Initiative, InitiativeStatus } from "@/lib/types";

interface InitiativeStats {
	activeInitiatives: number;
	totalTasks: number;
	linkedProjects: number;
}

const STATUS_GROUPS: { status: InitiativeStatus; label: string }[] = [
	{ status: "active", label: "Active" },
	{ status: "paused", label: "Paused" },
	{ status: "completed", label: "Completed" },
	{ status: "archived", label: "Archived" },
];

const COLOR_SWATCHES = [
	"#6366f1",
	"#8b5cf6",
	"#ec4899",
	"#ef4444",
	"#f97316",
	"#eab308",
	"#22c55e",
	"#14b8a6",
	"#3b82f6",
	"#06b6d4",
	"#64748b",
	"#78716c",
];

function statusBadge(status: InitiativeStatus) {
	switch (status) {
		case "active":
			return (
				<Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">
					Active
				</Badge>
			);
		case "paused":
			return (
				<Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30 text-[10px]">
					Paused
				</Badge>
			);
		case "completed":
			return (
				<Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
					Completed
				</Badge>
			);
		case "archived":
			return (
				<Badge className="bg-zinc-700/40 text-zinc-500 border-zinc-700/30 text-[10px]">
					Archived
				</Badge>
			);
	}
}

interface CreateInitiativeDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (data: Partial<Initiative>) => Promise<unknown>;
	projectOptions: { id: string; name: string }[];
}

function CreateInitiativeDialog({
	open,
	onOpenChange,
	onSubmit,
	projectOptions,
}: CreateInitiativeDialogProps) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [color, setColor] = useState(COLOR_SWATCHES[0]);
	const [projectId, setProjectId] = useState<string>("none");
	const [saving, setSaving] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!title.trim()) return;
		setSaving(true);
		try {
			await onSubmit({
				title: title.trim(),
				description: description.trim(),
				color,
				projectId: projectId === "none" ? null : projectId,
				status: "active",
				taskIds: [],
				tags: [],
				teamMembers: [],
			});
			setTitle("");
			setDescription("");
			setColor(COLOR_SWATCHES[0]);
			setProjectId("none");
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
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="title">
							Title <span className="text-destructive">*</span>
						</Label>
						<Input
							id="title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="e.g. Q2 Social Media Campaign"
							required
						/>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="What is this initiative about?"
							rows={3}
						/>
					</div>

					<div className="space-y-1.5">
						<Label>Color</Label>
						<div className="flex flex-wrap gap-2">
							{COLOR_SWATCHES.map((c) => (
								<button
									key={c}
									type="button"
									className="h-6 w-6 rounded-full border-2 transition-all"
									style={{
										backgroundColor: c,
										borderColor: color === c ? "white" : "transparent",
										outline: color === c ? `2px solid ${c}` : "none",
										outlineOffset: "2px",
									}}
									onClick={() => setColor(c)}
								/>
							))}
						</div>
					</div>

					{projectOptions.length > 0 && (
						<div className="space-y-1.5">
							<Label htmlFor="project">Project</Label>
							<Select value={projectId} onValueChange={setProjectId}>
								<SelectTrigger id="project">
									<SelectValue placeholder="None" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">None</SelectItem>
									{projectOptions.map((p) => (
										<SelectItem key={p.id} value={p.id}>
											{p.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

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

function InitiativeCard({
	initiative,
	projectTitle,
	onTogglePause,
	onArchive,
	onDelete,
}: {
	initiative: Initiative;
	projectTitle?: string;
	onTogglePause?: (initiative: Initiative) => void;
	onArchive?: (initiativeId: string) => void;
	onDelete?: (initiativeId: string) => void;
}) {
	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<Card
					className="hover:border-primary/30 transition-all cursor-pointer"
					onClick={() => router.push(`/initiatives/${initiative.id}`)}
				>
					<CardContent className="p-4 space-y-2">
						<div className="flex items-start justify-between gap-3">
							<div className="flex items-center gap-2 min-w-0 flex-1">
								<span
									className="h-3 w-3 rounded-full shrink-0"
									style={{ backgroundColor: initiative.color }}
								/>
								<h3 className="font-medium truncate">{initiative.title}</h3>
							</div>
							<div className="flex items-center gap-1.5 shrink-0">
								{statusBadge(initiative.status)}
							</div>
						</div>

						{initiative.description && (
							<p className="text-sm text-muted-foreground line-clamp-2 ml-5">
								{initiative.description}
							</p>
						)}

						<div className="flex items-center gap-4 text-xs text-muted-foreground ml-5">
							<span>{initiative.taskIds.length} tasks</span>
							{projectTitle && (
								<span className="truncate">Project: {projectTitle}</span>
							)}
						</div>
					</CardContent>
				</Card>
			</ContextMenuTrigger>
			<InitiativeContextMenuContent
				initiative={initiative}
				onTogglePause={onTogglePause}
				onArchive={onArchive}
				onDelete={onDelete}
			/>
		</ContextMenu>
	);
}

export default function InitiativesPage() {
	const { initiatives, loading, create, update, remove } = useInitiatives();
	const { projects } = useProjects();
	const router = useRouter();
	const [createOpen, setCreateOpen] = useState(false);

	async function handleTogglePause(initiative: Initiative) {
		const newStatus = initiative.status === "paused" ? "active" : "paused";
		await update(initiative.id, { status: newStatus });
	}

	async function handleArchive(initiativeId: string) {
		await update(initiativeId, { status: "archived" });
	}

	async function handleDeleteInitiative(initiativeId: string) {
		await remove(initiativeId);
	}

	const visible = initiatives.filter((i) => !i.deletedAt);

	const stats: InitiativeStats = {
		activeInitiatives: visible.filter((i) => i.status === "active").length,
		totalTasks: visible.reduce(
			(sum, initiative) => sum + initiative.taskIds.length,
			0,
		),
		linkedProjects: new Set(
			visible.map((initiative) => initiative.projectId).filter(Boolean),
		).size,
	};

	const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));

	const projectMap = new Map(projects.map((p) => [p.id, p.name]));

	const statCards = [
		{ label: "Active Initiatives", value: stats.activeInitiatives },
		{ label: "Total Tasks", value: stats.totalTasks },
		{ label: "Linked Projects", value: stats.linkedProjects },
	];

	return (
		<div className="space-y-6">
			<BreadcrumbNav items={[{ label: "Initiatives" }]} />

			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-xl font-bold">Initiatives</h1>
					<p className="text-sm text-muted-foreground">
						Group tasks into focused campaigns
					</p>
				</div>
				<Button
					size="sm"
					onClick={() => setCreateOpen(true)}
					className="gap-1.5"
				>
					<Plus className="h-3.5 w-3.5" /> New Initiative
				</Button>
			</div>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{statCards.map(({ label, value }) => (
					<Card key={label}>
						<CardContent className="p-4">
							<p className="text-2xl font-bold">{value}</p>
							<p className="text-xs text-muted-foreground mt-0.5">{label}</p>
						</CardContent>
					</Card>
				))}
			</div>

			{loading ? (
				<div className="space-y-3">
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-24 w-full rounded-lg" />
					))}
				</div>
			) : visible.length === 0 ? (
				<div className="space-y-4">
					<Card>
						<CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
							<Lightbulb className="h-12 w-12 text-muted-foreground/30" />
							<div className="space-y-1.5 max-w-sm">
								<h3 className="font-medium text-lg">No initiatives yet</h3>
								<p className="text-sm text-muted-foreground">
									Use initiatives to group related tasks into a focused campaign
									with one ownership point.
								</p>
							</div>
							<div className="flex gap-2">
								<Button variant="outline" onClick={() => setCreateOpen(true)}>
									<Plus className="h-4 w-4" /> Create Initiative
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			) : (
				<div className="space-y-8">
					{STATUS_GROUPS.map(({ status, label }) => {
						const group = visible.filter((i) => i.status === status);
						if (group.length === 0) return null;
						return (
							<section key={status}>
								<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
									{label} ({group.length})
								</h2>
								<div className="space-y-3">
									{group.map((initiative) => (
										<InitiativeCard
											key={initiative.id}
											initiative={initiative}
											projectTitle={
												initiative.projectId
													? projectMap.get(initiative.projectId)
													: undefined
											}
											onTogglePause={handleTogglePause}
											onArchive={handleArchive}
											onDelete={handleDeleteInitiative}
										/>
									))}
								</div>
							</section>
						);
					})}
				</div>
			)}

			<CreateInitiativeDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				onSubmit={create}
				projectOptions={projectOptions}
			/>
		</div>
	);
}
