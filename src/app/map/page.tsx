"use client";

import { Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { ProjectDialog } from "@/components/project-dialog";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useAgents, useInitiatives, useProjects } from "@/hooks/use-data";
import { COLOR_SWATCHES } from "@/lib/constants";
import type { Initiative, ProjectStatus } from "@/lib/types";

const ProjectInitiativeCanvas = dynamic(
	() =>
		import("@/components/project-initiative-canvas").then(
			(mod) => mod.ProjectInitiativeCanvas,
		),
	{ ssr: false },
);

function CreateInitiativeDialog({
	open,
	onOpenChange,
	onSubmit,
	projectOptions,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (data: Partial<Initiative>) => Promise<unknown>;
	projectOptions: { id: string; name: string }[];
}) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [color, setColor] = useState<string>(COLOR_SWATCHES[0]);
	const [projectId, setProjectId] = useState<string>("none");
	const [saving, setSaving] = useState(false);

	// Reset form when dialog opens
	useEffect(() => {
		if (open) {
			setTitle("");
			setDescription("");
			setColor(COLOR_SWATCHES[0]);
			setProjectId("none");
		}
	}, [open]);

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
							{saving ? "Creating..." : "Create Initiative"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export default function MapPage() {
	const { agents } = useAgents();
	const { projects, create: createProject } = useProjects();
	const { create: createInitiative } = useInitiatives();

	const [projectDialogOpen, setProjectDialogOpen] = useState(false);
	const [initiativeDialogOpen, setInitiativeDialogOpen] = useState(false);
	const [canvasVersion, setCanvasVersion] = useState(0);

	const projectOptions = projects
		.filter((project) => !project.deletedAt && project.status !== "archived")
		.map((project) => ({ id: project.id, name: project.name }));

	function refreshCanvas() {
		setCanvasVersion((version) => version + 1);
	}

	function handleCreateProject(data: {
		name: string;
		description: string;
		status: ProjectStatus;
		color: string;
		teamMembers: string[];
		tags: string[];
	}) {
		void createProject({
			name: data.name,
			description: data.description,
			status: data.status,
			color: data.color,
			teamMembers: data.teamMembers,
			tags: data.tags,
		}).then(refreshCanvas);
	}

	async function handleCreateInitiative(data: Partial<Initiative>) {
		await createInitiative(data);
		refreshCanvas();
	}

	return (
		<div className="flex flex-col gap-4">
			<BreadcrumbNav items={[{ label: "Map" }]} />
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-xl font-normal">Map</h1>
					<p className="text-sm text-muted-foreground">
						Visualize projects, initiatives, and tasks
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setInitiativeDialogOpen(true)}
					>
						<Plus className="h-3.5 w-3.5 mr-1.5" />
						New Initiative
					</Button>
					<Button size="sm" onClick={() => setProjectDialogOpen(true)}>
						<Plus className="h-3.5 w-3.5 mr-1.5" />
						New Project
					</Button>
				</div>
			</div>
			<div
				className="overflow-hidden rounded-xl border border-border/50 bg-muted/20 shadow-inner"
				style={{ height: "calc(100vh - 10rem)" }}
			>
				<ProjectInitiativeCanvas key={canvasVersion} />
			</div>

			<ProjectDialog
				open={projectDialogOpen}
				onOpenChange={setProjectDialogOpen}
				agents={agents}
				onSubmit={handleCreateProject}
			/>

			<CreateInitiativeDialog
				open={initiativeDialogOpen}
				onOpenChange={setInitiativeDialogOpen}
				onSubmit={handleCreateInitiative}
				projectOptions={projectOptions}
			/>
		</div>
	);
}
