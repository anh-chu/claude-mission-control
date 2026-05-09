"use client";

import { Edit3, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
	BreadcrumbNav,
	type BreadcrumbPeer,
} from "@/components/breadcrumb-nav";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useInitiatives, useProjects, useTasks } from "@/hooks/use-data";
import { COLOR_SWATCHES } from "@/lib/constants";
import { showError, showSuccess } from "@/lib/toast";
import type { Initiative, InitiativeStatus } from "@/lib/types";

function CreateInitiativeDialog({
	open,
	onOpenChange,
	onSubmit,
	projectOptions,
	editInitiative,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (data: Partial<Initiative>) => Promise<unknown>;
	projectOptions: { id: string; name: string }[];
	editInitiative?: Initiative | null;
}) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [color, setColor] = useState<string>(COLOR_SWATCHES[0]);
	const [projectId, setProjectId] = useState<string>("none");
	const [saving, setSaving] = useState(false);

	const isEdit = !!editInitiative;

	useEffect(() => {
		if (open) {
			if (editInitiative) {
				setTitle(editInitiative.title);
				setDescription(editInitiative.description ?? "");
				setColor(editInitiative.color ?? COLOR_SWATCHES[0]);
				setProjectId(editInitiative.projectId ?? "none");
			} else {
				setTitle("");
				setDescription("");
				setColor(COLOR_SWATCHES[0]);
				setProjectId("none");
			}
		}
	}, [open, editInitiative]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!title.trim()) return;
		setSaving(true);
		try {
			await onSubmit({
				...(editInitiative ? { id: editInitiative.id } : {}),
				title: title.trim(),
				description: description.trim(),
				color,
				projectId: projectId === "none" ? null : projectId,
				status: editInitiative?.status ?? ("active" as InitiativeStatus),
				taskIds: editInitiative?.taskIds ?? [],
				tags: editInitiative?.tags ?? [],
				teamMembers: editInitiative?.teamMembers ?? [],
			});
			setTitle("");
			setDescription("");
			setColor(COLOR_SWATCHES[0]);
			setProjectId("none");
			onOpenChange(false);
		} catch {
			showError("Failed to save initiative");
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						{isEdit ? "Edit Initiative" : "New Initiative"}
					</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="init-title">
							Title <span className="text-destructive">*</span>
						</Label>
						<Input
							id="init-title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="e.g. Q2 Social Media Campaign"
							required
						/>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="init-desc">Description</Label>
						<Textarea
							id="init-desc"
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
							<Label htmlFor="init-project">Project</Label>
							<Select value={projectId} onValueChange={setProjectId}>
								<SelectTrigger id="init-project">
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
							{saving
								? "Saving..."
								: isEdit
									? "Save Changes"
									: "Create Initiative"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

const workPeers: BreadcrumbPeer[] = [
	{ label: "Tasks", href: "/work" },
	{ label: "Projects", href: "/work/projects" },
	{ label: "Initiatives", href: "/work/initiatives" },
	{ label: "Map", href: "/work/map" },
];

export default function WorkInitiativesPage() {
	const { initiatives, create, update, remove, loading } = useInitiatives();
	const { projects } = useProjects();
	const { tasks } = useTasks();

	const [filterProjectId, setFilterProjectId] = useState<string>("all");
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [editTarget, setEditTarget] = useState<Initiative | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

	const projectOptions = useMemo(
		() =>
			projects
				.filter((p) => !p.deletedAt && p.status !== "archived")
				.map((p) => ({ id: p.id, name: p.name })),
		[projects],
	);

	const filteredInitiatives = useMemo(() => {
		let list = initiatives.filter((i) => !i.deletedAt);
		if (filterProjectId !== "all") {
			list = list.filter((i) => i.projectId === filterProjectId);
		}
		return list;
	}, [initiatives, filterProjectId]);

	function getProjectName(projectId: string | null): string | null {
		if (!projectId) return null;
		const project = projects.find((p) => p.id === projectId);
		return project?.name ?? null;
	}

	function getTaskCount(initiativeId: string) {
		return tasks.filter((t) => t.initiativeId === initiativeId).length;
	}

	async function handleCreate(data: Partial<Initiative>) {
		await create(data);
	}

	async function handleEdit(data: Partial<Initiative>) {
		if (!editTarget || !data.id) return;
		await update(data.id, {
			title: data.title,
			description: data.description,
			color: data.color,
			projectId: data.projectId,
		});
		setEditTarget(null);
	}

	async function handleDelete(initiativeId: string) {
		await remove(initiativeId);
		setDeleteTarget(null);
	}

	return (
		<div className="space-y-4">
			<BreadcrumbNav
				items={[{ label: "Work", href: "/work" }, { label: "Initiatives" }]}
				peers={workPeers}
			/>

			<div className="flex items-center justify-between flex-wrap gap-2">
				<h1 className="text-xl font-normal">Initiatives</h1>
				<div className="flex items-center gap-2">
					<Select value={filterProjectId} onValueChange={setFilterProjectId}>
						<SelectTrigger className="h-8 w-[160px] text-xs">
							<SelectValue placeholder="All projects" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All projects</SelectItem>
							{projectOptions.map((p) => (
								<SelectItem key={p.id} value={p.id}>
									{p.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						size="sm"
						onClick={() => setShowCreateDialog(true)}
						className="gap-1.5 h-8"
					>
						<Plus className="h-3.5 w-3.5" /> New Initiative
					</Button>
				</div>
			</div>

			{loading ? (
				<div className="space-y-2">
					{[1, 2, 3].map((i) => (
						<Card key={i}>
							<CardContent className="py-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<Skeleton className="h-3 w-3 rounded-full" />
										<div>
											<Skeleton className="h-4 w-40" />
											<Skeleton className="h-3 w-24 mt-1" />
										</div>
									</div>
									<div className="flex items-center gap-2">
										<Skeleton className="h-5 w-16" />
										<Skeleton className="h-5 w-12" />
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			) : filteredInitiatives.length === 0 ? (
				<Card>
					<CardContent className="py-12 text-center">
						<p className="text-sm text-muted-foreground">
							{filterProjectId !== "all"
								? "No initiatives found for the selected project."
								: "No initiatives yet. Create your first initiative to group related tasks."}
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-2">
					{filteredInitiatives.map((initiative) => {
						const parentProjectName = getProjectName(initiative.projectId);
						const taskCount = getTaskCount(initiative.id);

						return (
							<Card
								key={initiative.id}
								className="group hover:shadow-e-3 transition-shadow"
							>
								<CardContent className="py-3 px-4">
									<div className="flex items-center justify-between gap-4">
										<div className="flex items-center gap-3 min-w-0 flex-1">
											<div
												className="h-3 w-3 rounded-full shrink-0"
												style={{
													backgroundColor:
														initiative.color || COLOR_SWATCHES[0],
												}}
											/>
											<div className="min-w-0">
												<Link
													href={`/initiatives/${initiative.id}`}
													className="text-sm font-normal hover:underline truncate block"
												>
													{initiative.title}
												</Link>
												{parentProjectName && (
													<p className="text-xs text-muted-foreground truncate">
														{parentProjectName}
													</p>
												)}
											</div>
										</div>
										<div className="flex items-center gap-2 shrink-0">
											<Badge variant="outline" className="text-xs capitalize">
												{initiative.status}
											</Badge>
											<span className="text-xs text-muted-foreground tabular-nums">
												{taskCount} task
												{taskCount !== 1 ? "s" : ""}
											</span>
											<div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7 text-muted-foreground hover:text-foreground"
													onClick={() => setEditTarget(initiative)}
													title="Edit initiative"
												>
													<Edit3 className="h-3.5 w-3.5" />
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className="h-7 w-7 text-muted-foreground hover:text-destructive"
													onClick={() => setDeleteTarget(initiative.id)}
													title="Delete initiative"
												>
													<Trash2 className="h-3.5 w-3.5" />
												</Button>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}

			<CreateInitiativeDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
				onSubmit={handleCreate}
				projectOptions={projectOptions}
			/>

			<CreateInitiativeDialog
				open={editTarget !== null}
				onOpenChange={(open) => {
					if (!open) setEditTarget(null);
				}}
				onSubmit={handleEdit}
				projectOptions={projectOptions}
				editInitiative={editTarget}
			/>

			<ConfirmDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
				title="Delete Initiative"
				description="Are you sure you want to delete this initiative? This action can be undone within 5 seconds."
				confirmLabel="Delete"
				onConfirm={() => {
					if (deleteTarget) handleDelete(deleteTarget);
				}}
			/>
		</div>
	);
}
