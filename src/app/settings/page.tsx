"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/hooks/use-workspace";
import { useDaemon } from "@/hooks/use-daemon";
import { showSuccess, showError } from "@/lib/toast";
import {
	Save,
	Trash2,
	FolderOpen,
	Download,
	Upload,
	Plus,
	Loader2,
	FileJson,
	Square,
	Rocket,
	X,
} from "lucide-react";

const COLORS = [
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
];

interface CheckpointMeta {
	id: string;
	name: string;
	description: string;
	createdAt: string;
	version: number;
	stats: {
		tasks: number;
		projects: number;
		goals: number;
		brainDump: number;
		inbox: number;
		decisions: number;
		agents: number;
		skills: number;
	};
}

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

export default function SettingsPage() {
	const router = useRouter();
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
	const [color, setColor] = useState("#6366f1");
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);

	const [pollingEnabled, setPollingEnabled] = useState(true);
	const [maxParallelAgents, setMaxParallelAgents] = useState(3);
	const [daemonSaving, setDaemonSaving] = useState(false);
	const [daemonSaved, setDaemonSaved] = useState(false);

	const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(
		[],
	);
	const [envSaving, setEnvSaving] = useState(false);
	const [envSaved, setEnvSaved] = useState(false);
	const [revealedEnvIdx, setRevealedEnvIdx] = useState<Set<number>>(new Set());

	const [checkpoints, setCheckpoints] = useState<CheckpointMeta[]>([]);
	const [cpLoading, setCpLoading] = useState(true);
	const [cpBusy, setCpBusy] = useState(false);
	const [showSave, setShowSave] = useState(false);
	const [showLoad, setShowLoad] = useState<CheckpointMeta | null>(null);
	const [showDelete, setShowDelete] = useState<CheckpointMeta | null>(null);
	const [saveName, setSaveName] = useState("");
	const [saveDesc, setSaveDesc] = useState("");
	const importRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (currentWorkspace) {
			setName(currentWorkspace.name);
			setColor(currentWorkspace.color);
			const vars = currentWorkspace.settings?.envVars ?? {};
			setEnvVars(Object.entries(vars).map(([key, value]) => ({ key, value })));
		}
	}, [currentWorkspace]);

	useEffect(() => {
		setPollingEnabled(config.polling.enabled);
		setMaxParallelAgents(config.concurrency.maxParallelAgents);
	}, [config]);

	const fetchCheckpoints = useCallback(async () => {
		try {
			const res = await fetch("/api/checkpoints");
			if (res.ok) {
				const data = await res.json();
				setCheckpoints(data);
			}
		} catch {
			showError("Failed to fetch checkpoints");
		} finally {
			setCpLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchCheckpoints();
	}, [fetchCheckpoints]);

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

	async function handleCpSave() {
		if (!saveName.trim()) return;
		setCpBusy(true);
		try {
			const res = await fetch("/api/checkpoints", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: saveName.trim(),
					description: saveDesc.trim(),
				}),
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || "Save failed");
			}
			showSuccess(`Checkpoint "${saveName.trim()}" saved`);
			setShowSave(false);
			setSaveName("");
			setSaveDesc("");
			fetchCheckpoints();
		} catch (err) {
			showError(String(err));
		} finally {
			setCpBusy(false);
		}
	}

	async function handleCpLoad() {
		if (!showLoad) return;
		setCpBusy(true);
		try {
			const res = await fetch("/api/checkpoints/load", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: showLoad.id }),
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || "Load failed");
			}
			showSuccess(`Loaded "${showLoad.name}"`);
			setShowLoad(null);
			router.push("/");
		} catch (err) {
			showError(String(err));
		} finally {
			setCpBusy(false);
		}
	}

	async function handleCpDelete() {
		if (!showDelete) return;
		setCpBusy(true);
		try {
			const res = await fetch(`/api/checkpoints?id=${showDelete.id}`, {
				method: "DELETE",
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || "Delete failed");
			}
			showSuccess(`Deleted "${showDelete.name}"`);
			setShowDelete(null);
			fetchCheckpoints();
		} catch (err) {
			showError(String(err));
		} finally {
			setCpBusy(false);
		}
	}

	function handleExport(cp: CheckpointMeta) {
		const safeName = cp.name
			.replace(/[^a-zA-Z0-9-_ ]/g, "")
			.replace(/\s+/g, "-")
			.toLowerCase();
		const filename = `${safeName || cp.id}.json`;
		const link = document.createElement("a");
		link.href = `/api/checkpoints/export?id=${cp.id}`;
		link.download = filename;
		link.click();
	}

	async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setCpBusy(true);
		try {
			const text = await file.text();
			const json = JSON.parse(text);
			const res = await fetch("/api/checkpoints/import", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(json),
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || "Import failed");
			}
			const result = await res.json();
			showSuccess(`Imported "${result.name}"`);
			fetchCheckpoints();
		} catch (err) {
			showError(`Import failed: ${err}`);
		} finally {
			setCpBusy(false);
			if (importRef.current) importRef.current.value = "";
		}
	}

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
								<div key={i} className="flex items-center gap-2">
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
											setEnvVars(envVars.filter((_, j) => j !== i))
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
								onClick={() => setEnvVars([...envVars, { key: "", value: "" }])}
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
								<Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
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
								<p className="text-sm font-medium">Polling</p>
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

				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle>Backup &amp; Restore</CardTitle>
								<CardDescription>
									Save and restore workspace snapshots.
								</CardDescription>
							</div>
							<div className="flex items-center gap-2">
								<Button
									size="sm"
									variant="outline"
									className="gap-1.5 h-7 text-xs"
									onClick={() => importRef.current?.click()}
									disabled={cpBusy}
								>
									<Upload className="h-3 w-3" /> Import
								</Button>
								<input
									ref={importRef}
									type="file"
									accept=".json"
									className="hidden"
									onChange={handleImport}
								/>
								<Button
									size="sm"
									className="gap-1.5 h-7 text-xs"
									onClick={() => {
										setSaveName("");
										setSaveDesc("");
										setShowSave(true);
									}}
									disabled={cpBusy}
								>
									<Save className="h-3 w-3" /> Create Backup
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent>
						{cpLoading ? (
							<div className="flex items-center justify-center py-6">
								<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
							</div>
						) : checkpoints.length === 0 ? (
							<p className="text-sm text-muted-foreground py-2">
								No checkpoints yet. Create a backup to snapshot your current
								workspace.
							</p>
						) : (
							<div className="space-y-2">
								{checkpoints.map((cp) => (
									<div
										key={cp.id}
										className="flex items-center gap-3 rounded-lg border bg-card/50 px-3 py-2"
									>
										<FileJson className="h-4 w-4 text-primary shrink-0" />
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium truncate">{cp.name}</p>
											<p className="text-xs text-muted-foreground">
												{formatDate(cp.createdAt)}
												{cp.stats.tasks > 0 && ` · ${cp.stats.tasks} tasks`}
												{cp.stats.projects > 0 &&
													` · ${cp.stats.projects} projects`}
											</p>
										</div>
										<div className="flex items-center gap-1 shrink-0">
											<Button
												size="sm"
												variant="outline"
												className="h-6 text-xs px-2 gap-1"
												onClick={() => setShowLoad(cp)}
												disabled={cpBusy}
											>
												<FolderOpen className="h-3 w-3" /> Restore
											</Button>
											<Button
												size="sm"
												variant="ghost"
												className="h-6 w-6 p-0"
												onClick={() => handleExport(cp)}
												disabled={cpBusy}
												title="Export"
											>
												<Download className="h-3 w-3" />
											</Button>
											<Button
												size="sm"
												variant="ghost"
												className="h-6 w-6 p-0 text-destructive hover:text-destructive"
												onClick={() => setShowDelete(cp)}
												disabled={cpBusy}
												title="Delete"
											>
												<Trash2 className="h-3 w-3" />
											</Button>
										</div>
									</div>
								))}
							</div>
						)}
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
								<p className="text-sm font-medium">Delete workspace</p>
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

			<Dialog open={showSave} onOpenChange={setShowSave}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create Backup</DialogTitle>
						<DialogDescription>
							Save a copy of your current workspace that you can restore later.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<div>
							<label className="text-sm font-medium" htmlFor="cp-name">
								Name
							</label>
							<Input
								id="cp-name"
								placeholder="e.g. Before big refactor"
								value={saveName}
								onChange={(e) => setSaveName(e.target.value)}
								maxLength={200}
								autoFocus
							/>
						</div>
						<div>
							<label className="text-sm font-medium" htmlFor="cp-desc">
								Description (optional)
							</label>
							<Textarea
								id="cp-desc"
								placeholder="What state is this workspace in?"
								value={saveDesc}
								onChange={(e) => setSaveDesc(e.target.value)}
								maxLength={1000}
								rows={2}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowSave(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleCpSave}
							disabled={!saveName.trim() || cpBusy}
						>
							{cpBusy ? (
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
							) : (
								<Save className="h-4 w-4 mr-2" />
							)}
							Save Checkpoint
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={!!showLoad}
				onOpenChange={(open) => !open && setShowLoad(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Restore Checkpoint</DialogTitle>
						<DialogDescription>
							This will replace all current data with &ldquo;{showLoad?.name}
							&rdquo;. Make sure to create a backup first if you want to keep
							your current state.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowLoad(null)}>
							Cancel
						</Button>
						<Button onClick={handleCpLoad} disabled={cpBusy}>
							{cpBusy ? (
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
							) : (
								<FolderOpen className="h-4 w-4 mr-2" />
							)}
							Restore
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={!!showDelete}
				onOpenChange={(open) => !open && setShowDelete(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Checkpoint</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete &ldquo;{showDelete?.name}&rdquo;?
							This cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowDelete(null)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleCpDelete}
							disabled={cpBusy}
						>
							{cpBusy ? (
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
							) : (
								<Trash2 className="h-4 w-4 mr-2" />
							)}
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
