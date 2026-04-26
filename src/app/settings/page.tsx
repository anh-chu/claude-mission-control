"use client";

import { Plus, Rocket, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDaemon } from "@/hooks/use-daemon";
import { useWorkspace } from "@/hooks/use-workspace";

const COLORS = [
	"#fa520f",
	"#fb6424",
	"#ff8105",
	"#ffa110",
	"#ffb83e",
	"#ffd06a",
	"#ffd900",
	"#1f1f1f",
];

export default function SettingsPage() {
	const { currentWorkspace, loading } = useWorkspace();
	const {
		config,
		isRunning,
		isLoading: daemonLoading,
		start,
		stop,
		updateConfig,
	} = useDaemon();

	const [name, setName] = useState("");
	const [color, setColor] = useState("#fa520f");
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	const [pollingEnabled, setPollingEnabled] = useState(true);
	const [maxParallelAgents, setMaxParallelAgents] = useState(3);
	const [daemonSaving, setDaemonSaving] = useState(false);
	const [daemonSaved, setDaemonSaved] = useState(false);

	const [envVars, setEnvVars] = useState<
		Array<{ id: string; key: string; value: string }>
	>([]);
	const [envSaving, setEnvSaving] = useState(false);
	const [envSaved, setEnvSaved] = useState(false);
	const [revealedEnvIdx, setRevealedEnvIdx] = useState<Set<number>>(new Set());

	useEffect(() => {
		if (currentWorkspace) {
			setName(currentWorkspace.name);
			setColor(currentWorkspace.color);
			const vars = currentWorkspace.settings?.envVars ?? {};
			setEnvVars(
				Object.entries(vars).map(([key, value]) => ({ id: key, key, value })),
			);
		}
	}, [currentWorkspace]);

	useEffect(() => {
		setPollingEnabled(config.polling.enabled);
		setMaxParallelAgents(config.concurrency.maxParallelAgents);
	}, [config]);

	const handleSave = async () => {
		if (!currentWorkspace) return;
		setSaving(true);
		try {
			await fetch("/api/workspaces", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: currentWorkspace.id,
					name,
					color,
				}),
			});
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async () => {
		if (!currentWorkspace) return;
		await fetch(`/api/workspaces?id=${currentWorkspace.id}&confirm=true`, {
			method: "DELETE",
		});
		window.location.href = "/";
	};

	const handleEnvSave = async () => {
		if (!currentWorkspace) return;
		setEnvSaving(true);
		try {
			const envVarsObj: Record<string, string> = {};
			for (const { key, value } of envVars) {
				if (key.trim()) envVarsObj[key.trim()] = value;
			}
			await fetch("/api/workspaces", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: currentWorkspace.id,
					settings: { envVars: envVarsObj },
				}),
			});
			setEnvSaved(true);
			setTimeout(() => setEnvSaved(false), 2000);
		} finally {
			setEnvSaving(false);
		}
	};

	const handleDaemonSave = async () => {
		setDaemonSaving(true);
		try {
			await updateConfig({
				polling: { enabled: pollingEnabled },
				concurrency: { maxParallelAgents },
			});
			setDaemonSaved(true);
			setTimeout(() => setDaemonSaved(false), 2000);
		} finally {
			setDaemonSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="flex flex-col min-h-screen">
				<BreadcrumbNav items={[{ label: "Settings" }]} />
				<div className="flex-1 p-6 text-sm text-muted-foreground">
					Loading...
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col min-h-screen">
			<BreadcrumbNav items={[{ label: "Settings" }]} />

			<div className="flex-1 p-6 space-y-6 max-w-2xl">
				<Card>
					<CardHeader>
						<CardTitle>Workspace Settings</CardTitle>
						<CardDescription>
							Configure your workspace name, appearance, and defaults.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-5">
						<div className="space-y-1.5">
							<Label htmlFor="ws-name">Workspace name</Label>
							<Input
								id="ws-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="My Workspace"
								className="max-w-sm"
							/>
						</div>

						<div className="space-y-1.5">
							<Label>Workspace color</Label>
							<div className="flex flex-wrap gap-2">
								{COLORS.map((c) => (
									<button
										key={c}
										type="button"
										onClick={() => setColor(c)}
										className={`h-7 w-7 rounded-full border-2 transition-all ${
											color === c
												? "border-foreground scale-110"
												: "border-transparent hover:scale-105"
										}`}
										style={{ backgroundColor: c }}
										aria-label={c}
									/>
								))}
							</div>
						</div>

						<Button onClick={handleSave} disabled={saving}>
							{saved ? "Saved" : saving ? "Saving..." : "Save changes"}
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Environment Variables</CardTitle>
						<CardDescription>
							Key-value pairs injected into every agent subprocess in this
							workspace.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							{envVars.map((entry, i) => (
								<div key={entry.id} className="flex items-center gap-2">
									<Input
										placeholder="KEY"
										value={entry.key}
										onChange={(e) => {
											const next = [...envVars];
											next[i] = { ...next[i], key: e.target.value };
											setEnvVars(next);
										}}
										className="font-mono text-xs w-40 shrink-0"
									/>
									<span className="text-muted-foreground text-xs">=</span>
									<Input
										placeholder="value"
										type={revealedEnvIdx.has(i) ? "text" : "password"}
										value={entry.value}
										onChange={(e) => {
											const next = [...envVars];
											next[i] = { ...next[i], value: e.target.value };
											setEnvVars(next);
										}}
										onMouseEnter={() =>
											setRevealedEnvIdx((prev) => new Set(prev).add(i))
										}
										onMouseLeave={() =>
											setRevealedEnvIdx((prev) => {
												const s = new Set(prev);
												s.delete(i);
												return s;
											})
										}
										className="font-mono text-xs flex-1"
									/>
									<Button
										size="sm"
										variant="ghost"
										className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
										onClick={() =>
											setEnvVars(envVars.filter((e) => e.id !== entry.id))
										}
									>
										<X className="h-3.5 w-3.5" />
									</Button>
								</div>
							))}
							{envVars.length === 0 && (
								<p className="text-xs text-muted-foreground">
									No environment variables set.
								</p>
							)}
						</div>
						<div className="flex items-center gap-3">
							<Button
								size="sm"
								variant="outline"
								className="gap-1.5 h-7 text-xs"
								onClick={() =>
									setEnvVars([
										...envVars,
										{ id: `env-new-${Date.now()}`, key: "", value: "" },
									])
								}
							>
								<Plus className="h-3 w-3" /> Add variable
							</Button>
							<Button
								size="sm"
								onClick={() => void handleEnvSave()}
								disabled={envSaving}
							>
								{envSaved ? "Saved" : envSaving ? "Saving..." : "Save"}
							</Button>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Autopilot</CardTitle>
						<CardDescription>
							Background task execution, polling intervals, and concurrency
							limits.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-5">
						<div className="flex items-center gap-3">
							{daemonLoading ? (
								<Badge variant="secondary">Checking...</Badge>
							) : isRunning ? (
								<Badge className="bg-sunshine-700/15 text-sunshine-700 border-sunshine-700/30">
									Running
								</Badge>
							) : (
								<Badge variant="secondary">Stopped</Badge>
							)}
							{isRunning ? (
								<Button
									size="sm"
									variant="outline"
									className="h-7 gap-1.5"
									onClick={() => void stop()}
								>
									<Square className="h-3 w-3" /> Stop
								</Button>
							) : (
								<Button
									size="sm"
									className="h-7 gap-1.5"
									onClick={() => void start()}
								>
									<Rocket className="h-3 w-3" /> Start
								</Button>
							)}
						</div>

						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-normal">Polling</p>
								<p className="text-xs text-muted-foreground">
									Automatically pick up new tasks
								</p>
							</div>
							<Switch
								checked={pollingEnabled}
								onCheckedChange={setPollingEnabled}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="max-agents">Max parallel agents</Label>
							<Input
								id="max-agents"
								type="number"
								min={1}
								max={10}
								value={maxParallelAgents}
								onChange={(e) =>
									setMaxParallelAgents(
										Math.max(1, Math.min(10, Number(e.target.value))),
									)
								}
								className="max-w-[120px]"
							/>
						</div>

						<div className="flex items-center gap-3">
							<Button
								onClick={() => void handleDaemonSave()}
								disabled={daemonSaving}
							>
								{daemonSaved ? "Saved" : daemonSaving ? "Saving..." : "Save"}
							</Button>
						</div>
					</CardContent>
				</Card>

				<Card className="border-destructive/40">
					<CardHeader>
						<CardTitle className="text-destructive">Danger Zone</CardTitle>
						<CardDescription>
							Irreversible actions. Proceed with caution.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-normal">Delete workspace</p>
								<p className="text-xs text-muted-foreground mt-0.5">
									{currentWorkspace?.isDefault
										? "The default workspace cannot be deleted."
										: "Permanently removes this workspace and all its data."}
								</p>
							</div>
							<Button
								variant="destructive"
								disabled={currentWorkspace?.isDefault}
								onClick={() => setShowDeleteDialog(true)}
							>
								Delete
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>

			<ConfirmDialog
				open={showDeleteDialog}
				onOpenChange={setShowDeleteDialog}
				title="Delete workspace?"
				description={`This will permanently delete "${currentWorkspace?.name ?? "this workspace"}" and all associated data. This cannot be undone.`}
				confirmLabel="Delete workspace"
				onConfirm={handleDelete}
			/>
		</div>
	);
}
