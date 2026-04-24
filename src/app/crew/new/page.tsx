"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
	ArrowLeft,
	Save,
	Plus,
	X,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { useAgents } from "@/hooks/use-data";
import { cn } from "@/lib/utils";

const ICON_OPTIONS = [
	{ name: "User", icon: User },
	{ name: "Search", icon: Search },
	{ name: "Code", icon: Code },
	{ name: "Megaphone", icon: Megaphone },
	{ name: "BarChart3", icon: BarChart3 },
	{ name: "Bot", icon: Bot },
	{ name: "Zap", icon: Zap },
	{ name: "Shield", icon: Shield },
	{ name: "Wrench", icon: Wrench },
	{ name: "BookOpen", icon: BookOpen },
	{ name: "Globe", icon: Globe },
	{ name: "Brain", icon: Brain },
	{ name: "Palette", icon: Palette },
	{ name: "HeartPulse", icon: HeartPulse },
];

export default function NewAgentPage() {
	const router = useRouter();
	const { create: createAgent } = useAgents();

	const [form, setForm] = useState({
		id: "",
		name: "",
		icon: "Bot",
		description: "",
		instructions: "",
		status: "active" as "active" | "inactive",
		backend: "claude" as "claude" | "codex",
		skipPermissions: "inherit" as "inherit" | "on" | "off",
		yolo: "inherit" as "inherit" | "on" | "off",
	});
	const [capabilities, setCapabilities] = useState<string[]>([]);
	const [capInput, setCapInput] = useState("");
	const [allowedTools, setAllowedTools] = useState<string[]>([]);
	const [toolInput, setToolInput] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Auto-generate ID from name
	const handleNameChange = (name: string) => {
		const id = name
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, "")
			.replace(/\s+/g, "-")
			.replace(/-+/g, "-")
			.slice(0, 50);
		setForm((prev) => ({ ...prev, name, id }));
	};

	const addCapability = () => {
		const trimmed = capInput.trim();
		if (trimmed && !capabilities.includes(trimmed)) {
			setCapabilities((prev) => [...prev, trimmed]);
			setCapInput("");
		}
	};

	const removeCapability = (cap: string) => {
		setCapabilities((prev) => prev.filter((c) => c !== cap));
	};

	const addTool = () => {
		const trimmed = toolInput.trim();
		if (trimmed && !allowedTools.includes(trimmed)) {
			setAllowedTools((prev) => [...prev, trimmed]);
			setToolInput("");
		}
	};

	const removeTool = (tool: string) => {
		setAllowedTools((prev) => prev.filter((t) => t !== tool));
	};

	const handleSubmit = async () => {
		setError(null);

		if (!form.name.trim()) {
			setError("Name is required");
			return;
		}
		if (!form.id.trim()) {
			setError("ID is required");
			return;
		}

		setSaving(true);
		try {
			await createAgent({
				id: form.id,
				name: form.name,
				icon: form.icon,
				description: form.description,
				instructions: form.instructions,
				capabilities,
				skillIds: [],
				status: form.status,
				backend: form.backend,
				allowedTools,
				skipPermissions: form.skipPermissions,
				yolo: form.yolo,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			});
			router.push("/crew");
		} catch {
			setError("Failed to create agent. The ID may already be in use.");
		} finally {
			setSaving(false);
		}
	};

	const SelectedIcon =
		ICON_OPTIONS.find((o) => o.name === form.icon)?.icon ?? Bot;

	return (
		<div className="space-y-6 max-w-2xl">
			<BreadcrumbNav
				items={[{ label: "Agents", href: "/crew" }, { label: "New Agent" }]}
			/>

			<div className="flex items-center gap-3">
				<Button variant="ghost" size="icon" onClick={() => router.back()}>
					<ArrowLeft className="h-4 w-4" />
				</Button>
				<h1 className="text-xl font-bold">Create New Agent</h1>
			</div>

			{error && (
				<div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
					{error}
				</div>
			)}

			<div className="space-y-5">
				{/* Name */}
				<div className="space-y-2">
					<Label htmlFor="name">Name *</Label>
					<Input
						id="name"
						placeholder="e.g. Legal Advisor"
						value={form.name}
						onChange={(e) => handleNameChange(e.target.value)}
					/>
				</div>

				{/* ID (auto-generated) */}
				<div className="space-y-2">
					<Label htmlFor="agent-id">ID (URL-safe slug)</Label>
					<Input
						id="agent-id"
						placeholder="e.g. legal-advisor"
						value={form.id}
						onChange={(e) =>
							setForm((prev) => ({
								...prev,
								id: e.target.value
									.toLowerCase()
									.replace(/[^a-z0-9-]/g, "")
									.slice(0, 50),
							}))
						}
						className="font-mono text-sm"
					/>
					<p className="text-xs text-muted-foreground">
						Used as the agent identifier in task assignments and commands.
					</p>
				</div>

				{/* Icon Picker */}
				<div className="space-y-2">
					<Label>Icon</Label>
					<div className="flex flex-wrap gap-1.5">
						{ICON_OPTIONS.map(({ name, icon: Ic }) => (
							<button
								key={name}
								type="button"
								onClick={() => setForm((prev) => ({ ...prev, icon: name }))}
								className={cn(
									"h-9 w-9 rounded-lg border flex items-center justify-center transition-colors",
									form.icon === name
										? "bg-primary text-primary-foreground border-primary"
										: "bg-muted hover:bg-accent",
								)}
							>
								<Ic className="h-4 w-4" />
							</button>
						))}
					</div>
				</div>

				{/* Description */}
				<div className="space-y-2">
					<Label htmlFor="description">Description</Label>
					<Input
						id="description"
						placeholder="Short description of what this agent does"
						value={form.description}
						onChange={(e) =>
							setForm((prev) => ({ ...prev, description: e.target.value }))
						}
					/>
				</div>

				{/* Backend CLI */}
				<div className="space-y-2">
					<Label>Backend CLI</Label>
					<div className="flex gap-2">
						<Button
							type="button"
							variant={form.backend === "claude" ? "default" : "outline"}
							size="sm"
							onClick={() =>
								setForm((prev) => ({ ...prev, backend: "claude" as const }))
							}
						>
							Claude Code
						</Button>
						<Button
							type="button"
							variant={form.backend === "codex" ? "default" : "outline"}
							size="sm"
							onClick={() =>
								setForm((prev) => ({ ...prev, backend: "codex" as const }))
							}
						>
							Codex CLI
						</Button>
					</div>
					<p className="text-xs text-muted-foreground">
						{form.backend === "codex"
							? "Uses OpenAI Codex CLI for task execution"
							: "Uses Claude Code CLI for task execution (default)"}
					</p>
				</div>

				{form.backend === "claude" ? (
					<div className="space-y-2">
						<Label>Skip Permissions</Label>
						<div className="flex gap-1">
							{(["inherit", "on", "off"] as const).map((v) => (
								<Button
									key={v}
									type="button"
									variant={form.skipPermissions === v ? "default" : "outline"}
									size="sm"
									className="capitalize"
									onClick={() =>
										setForm((prev) => ({ ...prev, skipPermissions: v }))
									}
								>
									{v}
								</Button>
							))}
						</div>
						<p className="text-xs text-muted-foreground">
							{form.skipPermissions === "on"
								? "Agent runs with --dangerously-skip-permissions (bypasses all prompts)"
								: form.skipPermissions === "off"
									? "Agent always requires permission prompts regardless of global setting"
									: "Inherits global skipPermissions setting from Autopilot config"}
						</p>
					</div>
				) : (
					<div className="space-y-2">
						<Label>Full-Auto Mode (--yolo)</Label>
						<div className="flex gap-1">
							{(["inherit", "on", "off"] as const).map((v) => (
								<Button
									key={v}
									type="button"
									variant={form.yolo === v ? "default" : "outline"}
									size="sm"
									className="capitalize"
									onClick={() => setForm((prev) => ({ ...prev, yolo: v }))}
								>
									{v}
								</Button>
							))}
						</div>
						<p className="text-xs text-muted-foreground">
							{form.yolo === "on"
								? "Agent runs with --full-auto --yolo (maximum autonomy)"
								: form.yolo === "off"
									? "Agent runs without --full-auto (manual approval required)"
									: "Default: runs with --full-auto"}
						</p>
					</div>
				)}

				{/* Instructions (system prompt) */}
				<div className="space-y-2">
					<Label htmlFor="instructions">Instructions (System Prompt)</Label>
					<Textarea
						id="instructions"
						placeholder="Full instructions for this agent. This becomes the system prompt when the agent is activated in Claude Code."
						value={form.instructions}
						onChange={(e) =>
							setForm((prev) => ({ ...prev, instructions: e.target.value }))
						}
						rows={10}
						className="font-mono text-sm"
					/>
					<p className="text-xs text-muted-foreground">
						{form.instructions.length.toLocaleString()} characters
					</p>
				</div>

				{/* Capabilities (tag input) */}
				<div className="space-y-2">
					<Label>Capabilities</Label>
					<div className="flex gap-2">
						<Input
							placeholder="e.g. contract-review"
							value={capInput}
							onChange={(e) => setCapInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									addCapability();
								}
							}}
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={addCapability}
						>
							<Plus className="h-3.5 w-3.5" />
						</Button>
					</div>
					{capabilities.length > 0 && (
						<div className="flex flex-wrap gap-1.5 mt-2">
							{capabilities.map((cap) => (
								<Badge key={cap} variant="secondary" className="gap-1 pr-1">
									{cap}
									<button
										type="button"
										onClick={() => removeCapability(cap)}
										className="rounded-full hover:bg-muted-foreground/20 p-0.5"
									>
										<X className="h-3 w-3" />
									</button>
								</Badge>
							))}
						</div>
					)}
				</div>

				{/* Allowed Tools (tag input) */}
				<div className="space-y-2">
					<Label>Allowed Tools</Label>
					<div className="flex gap-2">
						<Input
							placeholder="e.g. mcp__gmail__*"
							value={toolInput}
							onChange={(e) => setToolInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									addTool();
								}
							}}
						/>
						<Button type="button" variant="outline" size="sm" onClick={addTool}>
							<Plus className="h-3.5 w-3.5" />
						</Button>
					</div>
					{allowedTools.length > 0 && (
						<div className="flex flex-wrap gap-1.5 mt-2">
							{allowedTools.map((tool) => (
								<Badge key={tool} variant="secondary" className="gap-1 pr-1">
									{tool}
									<button
										type="button"
										onClick={() => removeTool(tool)}
										className="rounded-full hover:bg-muted-foreground/20 p-0.5"
									>
										<X className="h-3 w-3" />
									</button>
								</Badge>
							))}
						</div>
					)}
					<p className="text-xs text-muted-foreground">
						e.g. mcp__gmail__*, Read, Write. Pre-approves tools to prevent
						permission prompts.
					</p>
				</div>

				{/* Status */}
				<div className="flex items-center justify-between rounded-lg border p-4">
					<div>
						<Label>Status</Label>
						<p className="text-xs text-muted-foreground mt-0.5">
							Inactive agents won&apos;t receive task assignments
						</p>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-xs text-muted-foreground">
							{form.status === "active" ? "Active" : "Inactive"}
						</span>
						<Switch
							checked={form.status === "active"}
							onCheckedChange={(checked) =>
								setForm((prev) => ({
									...prev,
									status: checked ? "active" : "inactive",
								}))
							}
						/>
					</div>
				</div>

				{/* Preview */}
				<div className="rounded-lg border bg-muted/50 p-4">
					<p className="text-xs font-semibold text-muted-foreground mb-2">
						Preview
					</p>
					<div className="flex items-center gap-3">
						<div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
							<SelectedIcon className="h-5 w-5 text-primary" />
						</div>
						<div>
							<p className="font-semibold text-sm">
								{form.name || "Agent Name"}
							</p>
							<p className="text-xs text-muted-foreground">
								{form.description || "No description"}
							</p>
						</div>
					</div>
				</div>

				{/* Actions */}
				<div className="flex gap-3 pt-2">
					<Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
						<Save className="h-3.5 w-3.5" />
						{saving ? "Creating..." : "Create Agent"}
					</Button>
					<Button variant="ghost" onClick={() => router.back()}>
						Cancel
					</Button>
				</div>
			</div>
		</div>
	);
}
