"use client";

import { ArrowLeft, Plus, Save, Tag, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAgents, useSkills } from "@/hooks/use-data";
import type { SkillDefinition } from "@/lib/types";

interface SkillFormProps {
	mode: "create" | "edit";
	initialData?: SkillDefinition;
	onDelete?: () => void;
}

export function SkillForm({ mode, initialData, onDelete }: SkillFormProps) {
	const router = useRouter();
	const { create: createSkill, update: updateSkill } = useSkills();
	const { agents } = useAgents();

	const [name, setName] = useState(initialData?.name ?? "");
	const [description, setDescription] = useState(
		initialData?.description ?? "",
	);
	const [content, setContent] = useState(initialData?.content ?? "");
	const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
	const [tagInput, setTagInput] = useState("");
	const [agentIds, setAgentIds] = useState<string[]>(
		initialData?.agentIds ?? [],
	);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// dirty tracking only meaningful in edit mode
	const [dirty, setDirty] = useState(false);

	// Sync form state when initialData loads (edit mode: skill may load async)
	useEffect(() => {
		if (mode === "edit" && initialData) {
			setName(initialData.name);
			setDescription(initialData.description);
			setContent(initialData.content);
			setTags(initialData.tags);
			setAgentIds(initialData.agentIds);
		}
	}, [mode, initialData]);

	const markDirty = () => {
		if (mode === "edit") setDirty(true);
	};

	const handleSubmit = async () => {
		setError(null);

		if (mode === "create") {
			if (!name.trim()) {
				setError("Name is required");
				return;
			}
			setSaving(true);
			try {
				await createSkill({
					id: `skill_${Date.now()}`,
					name,
					description,
					content,
					agentIds,
					tags,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				});
				router.push("/skills");
			} catch {
				setError("Failed to create skill.");
			} finally {
				setSaving(false);
			}
		} else {
			if (!initialData) return;
			setSaving(true);
			try {
				await updateSkill(initialData.id, {
					name,
					description,
					content,
					tags,
					agentIds,
				});
				setDirty(false);
			} finally {
				setSaving(false);
			}
		}
	};

	const addTag = () => {
		const trimmed = tagInput.trim();
		if (trimmed && !tags.includes(trimmed)) {
			setTags((prev) => [...prev, trimmed]);
			setTagInput("");
			markDirty();
		}
	};

	const removeTag = (tag: string) => {
		setTags((prev) => prev.filter((t) => t !== tag));
		markDirty();
	};

	const toggleAgent = (agentId: string) => {
		setAgentIds((prev) =>
			prev.includes(agentId)
				? prev.filter((id) => id !== agentId)
				: [...prev, agentId],
		);
		markDirty();
	};

	const isCreate = mode === "create";
	const pageTitle = isCreate ? "Create New Skill" : "Edit Skill";
	const submitLabel = isCreate ? "Create Skill" : "Save Changes";
	const savingLabel = isCreate ? "Creating..." : "Saving...";
	const breadcrumbLabel = isCreate
		? "New Skill"
		: (initialData?.name ?? "Edit Skill");
	const textareaRows = isCreate ? 12 : 16;

	return (
		<div className="space-y-6 max-w-3xl">
			<BreadcrumbNav
				items={[
					{ label: "Skills Library", href: "/skills" },
					{ label: breadcrumbLabel },
				]}
			/>

			<div className="flex items-center gap-3">
				<Button
					variant="ghost"
					size="icon"
					onClick={() => (isCreate ? router.back() : router.push("/skills"))}
				>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<h1 className="text-xl font-bold flex-1">{pageTitle}</h1>
				{!isCreate && onDelete && (
					<Button
						variant="destructive"
						size="sm"
						onClick={onDelete}
						className="text-xs"
					>
						Delete
					</Button>
				)}
			</div>

			{error && (
				<div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
					{error}
				</div>
			)}

			<div className="space-y-5">
				{/* Name */}
				<div className="space-y-2">
					<Label htmlFor="skill-name">Name{isCreate && " *"}</Label>
					<Input
						id="skill-name"
						placeholder={isCreate ? "e.g. Web Research" : undefined}
						value={name}
						onChange={(e) => {
							setName(e.target.value);
							markDirty();
						}}
					/>
				</div>

				{/* Description */}
				<div className="space-y-2">
					<Label htmlFor="skill-desc">Description</Label>
					<Input
						id="skill-desc"
						placeholder={
							isCreate ? "Brief description of what this skill does" : undefined
						}
						value={description}
						onChange={(e) => {
							setDescription(e.target.value);
							markDirty();
						}}
					/>
				</div>

				{/* Content */}
				<div className="space-y-2">
					<Label htmlFor="skill-content">Content (Markdown)</Label>
					<Textarea
						id="skill-content"
						placeholder={
							isCreate
								? "Full skill content in Markdown. This gets injected into agent system prompts when the skill is assigned."
								: undefined
						}
						value={content}
						onChange={(e) => {
							setContent(e.target.value);
							markDirty();
						}}
						rows={textareaRows}
						className="font-mono text-sm"
					/>
					<p className="text-xs text-muted-foreground">
						{content.length.toLocaleString()} characters
					</p>
				</div>

				{/* Tags */}
				<div className="space-y-2">
					<Label>Tags</Label>
					<div className="flex gap-2">
						<Input
							placeholder="Add tag..."
							value={tagInput}
							onChange={(e) => setTagInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									addTag();
								}
							}}
							className="h-8 text-sm"
						/>
						<Button type="button" variant="outline" size="sm" onClick={addTag}>
							<Plus className="h-3.5 w-3.5" />
						</Button>
					</div>
					{tags.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							{tags.map((tag) => (
								<Badge key={tag} variant="secondary" className="gap-1 pr-1">
									<Tag className="h-3 w-3" />
									{tag}
									<button
										type="button"
										onClick={() => removeTag(tag)}
										className="rounded-full hover:bg-muted-foreground/20 p-0.5"
									>
										<X className="h-3 w-3" />
									</button>
								</Badge>
							))}
						</div>
					)}
				</div>

				{/* Agents */}
				<div className="space-y-2">
					<Label>{isCreate ? "Assign to Agents" : "Assigned Agents"}</Label>
					{!isCreate && (
						<p className="text-xs text-muted-foreground">
							Select which agents have access to this skill.
						</p>
					)}
					<div className="grid gap-2 sm:grid-cols-2">
						{agents
							.filter((a) => a.status === "active")
							.map((agent) => {
								const isAssigned = agentIds.includes(agent.id);
								return (
									<button
										type="button"
										key={agent.id}
										onClick={() => toggleAgent(agent.id)}
										className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors ${
											isAssigned
												? "border-primary bg-primary/5"
												: "hover:bg-muted"
										}`}
									>
										<div
											className={`h-4 w-4 rounded border flex items-center justify-center ${
												isAssigned
													? "bg-primary border-primary text-primary-foreground"
													: ""
											}`}
										>
											{isAssigned && <span className="text-xs">&#10003;</span>}
										</div>
										<div>
											<p className="text-sm font-medium">{agent.name}</p>
											<p className="text-xs text-muted-foreground">
												{agent.description}
											</p>
										</div>
									</button>
								);
							})}
					</div>
				</div>

				{/* Actions */}
				<div className="flex gap-3 pt-2">
					<Button
						onClick={handleSubmit}
						disabled={saving || (mode === "edit" && !dirty)}
						className="gap-1.5"
					>
						<Save className="h-3.5 w-3.5" />
						{saving ? savingLabel : submitLabel}
					</Button>
					<Button
						variant="ghost"
						onClick={() => (isCreate ? router.back() : router.push("/skills"))}
					>
						Cancel
					</Button>
					{mode === "edit" && dirty && (
						<p className="text-xs text-amber-500 self-center">
							Unsaved changes
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
