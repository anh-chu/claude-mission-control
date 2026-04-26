"use client";

import {
	AlertCircle,
	Check,
	ChevronDown,
	ChevronRight,
	File,
	FileText,
	Folder,
	FolderOpen,
	FolderPlus,
	Image as ImageIcon,
	Loader2,
	Pencil,
	Play,
	RefreshCw,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { prepareConsoleLines, StreamEntry } from "@/components/agent-console";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { StreamLine } from "@/hooks/use-agent-stream";
import { useAgents } from "@/hooks/use-data";
import { cn } from "@/lib/utils";

interface TreeNode {
	name: string;
	path: string;
	type: "dir" | "file";
	size?: number;
	modifiedAt: string;
	children?: TreeNode[];
	expanded?: boolean;
	loading?: boolean;
}

interface WikiRunRecord {
	id: string;
	workspaceId: string;
	status: "running" | "completed" | "failed";
	promptFile: string | null;
	hasOverride: boolean;
	agentId?: string;
	model?: string;
	startedAt: string;
	completedAt: string | null;
	exitCode: number | null;
	error: string | null;
	pid: number;
}

const DOC_MAINTAINER_AGENT_ID = "doc-maintainer";

const TEXT_EXTS = new Set([
	"txt",
	"md",
	"markdown",
	"json",
	"yaml",
	"yml",
	"toml",
	"csv",
	"xml",
	"html",
	"sh",
]);
const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg"]);

function ext(name: string) {
	return name.split(".").pop()?.toLowerCase() ?? "";
}
function isText(name: string) {
	return TEXT_EXTS.has(ext(name));
}
function isImage(name: string) {
	return IMAGE_EXTS.has(ext(name));
}

async function fetchDir(dir: string): Promise<TreeNode[]> {
	const res = await fetch(`/api/wiki?dir=${encodeURIComponent(dir)}`);
	if (!res.ok) return [];
	const data: {
		entries: Array<{
			name: string;
			type: "dir" | "file";
			size?: number;
			modifiedAt: string;
		}>;
	} = await res.json();
	return data.entries.map((e) => ({
		name: e.name,
		path: dir ? `${dir}/${e.name}` : e.name,
		type: e.type,
		size: e.size,
		modifiedAt: e.modifiedAt,
		expanded: false,
	}));
}

export default function DocumentsPage() {
	const [roots, setRoots] = useState<TreeNode[]>([]);
	const [rootLoaded, setRootLoaded] = useState(false);
	const [rootLoading, setRootLoading] = useState(false);

	const [uploading, setUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const uploadDirRef = useRef<string>("");

	const [newFolderParent, setNewFolderParent] = useState<string | null>(null);
	const [newFolderName, setNewFolderName] = useState("");
	const [folderError, setFolderError] = useState<string | null>(null);

	const [deletingPath, setDeletingPath] = useState<string | null>(null);
	const [deletingIsDir, setDeletingIsDir] = useState(false);

	const [openFile, setOpenFile] = useState<{
		path: string;
		name: string;
	} | null>(null);
	const [fileContent, setFileContent] = useState<string | null>(null);
	const [fileLoading, setFileLoading] = useState(false);
	const [editing, setEditing] = useState(false);
	const [editContent, setEditContent] = useState("");
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	const [wikiPrompt, setWikiPrompt] = useState("");
	const [promptLoading, setPromptLoading] = useState(false);
	const [promptSaving, setPromptSaving] = useState(false);
	const [promptError, setPromptError] = useState<string | null>(null);
	const [promptIsDefault, setPromptIsDefault] = useState(false);
	const [promptOverride, setPromptOverride] = useState("");
	const [wikiRuns, setWikiRuns] = useState<WikiRunRecord[]>([]);
	const [runsLoading, setRunsLoading] = useState(false);
	const [runError, setRunError] = useState<string | null>(null);
	const [running, setRunning] = useState(false);
	const [runMessage, setRunMessage] = useState<string | null>(null);
	const [initingWiki, setInitingWiki] = useState(false);

	const [activeRunId, setActiveRunId] = useState<string | null>(null);
	const [streamRunId, setStreamRunId] = useState<string | null>(null);
	const [streamEvents, setStreamEvents] = useState<StreamLine[]>([]);
	const [selectedAgentId, setSelectedAgentId] = useState(
		DOC_MAINTAINER_AGENT_ID,
	);
	const { agents } = useAgents();
	const runAgents = agents.filter((a) => a.status === "active");
	const hasDocMaintainer = runAgents.some(
		(a) => a.id === DOC_MAINTAINER_AGENT_ID,
	);
	const [selectedModel, setSelectedModel] = useState("sonnet");
	const [streamCursor, setStreamCursor] = useState(0);
	const displayStreamEvents = useMemo(
		() => prepareConsoleLines(streamEvents),
		[streamEvents],
	);

	// Drag state
	const dragNodeRef = useRef<TreeNode | null>(null);
	const [dragOverPath, setDragOverPath] = useState<string | null>(null);

	// --- Tree helpers ---
	function updateNodes(
		nodes: TreeNode[],
		targetPath: string,
		updater: (n: TreeNode) => TreeNode,
	): TreeNode[] {
		return nodes.map((n) => {
			if (n.path === targetPath) return updater(n);
			if (n.children)
				return { ...n, children: updateNodes(n.children, targetPath, updater) };
			return n;
		});
	}

	function removeNode(nodes: TreeNode[], targetPath: string): TreeNode[] {
		return nodes
			.filter((n) => n.path !== targetPath)
			.map((n) =>
				n.children ? { ...n, children: removeNode(n.children, targetPath) } : n,
			);
	}

	useEffect(() => {
		if (rootLoaded || rootLoading) return;

		let cancelled = false;

		(async () => {
			setRootLoading(true);
			const nodes = await fetchDir("");
			if (cancelled) return;
			setRoots(nodes);
			setRootLoaded(true);
			setRootLoading(false);
		})().catch(() => {
			if (!cancelled) setRootLoading(false);
		});

		return () => {
			cancelled = true;
		};
	}, [rootLoaded, rootLoading]);

	async function reloadDir(dir: string) {
		const fresh = await fetchDir(dir);
		if (dir === "") {
			setRoots(fresh);
		} else {
			setRoots((prev) =>
				updateNodes(prev, dir, (n) => ({
					...n,
					children: fresh,
					expanded: true,
				})),
			);
		}
	}

	async function toggleFolder(node: TreeNode) {
		if (node.type !== "dir") return;
		if (!node.expanded) {
			if (node.children === undefined) {
				setRoots((prev) =>
					updateNodes(prev, node.path, (n) => ({ ...n, loading: true })),
				);
				const children = await fetchDir(node.path);
				setRoots((prev) =>
					updateNodes(prev, node.path, (n) => ({
						...n,
						loading: false,
						children,
						expanded: true,
					})),
				);
			} else {
				setRoots((prev) =>
					updateNodes(prev, node.path, (n) => ({ ...n, expanded: true })),
				);
			}
		} else {
			setRoots((prev) =>
				updateNodes(prev, node.path, (n) => ({ ...n, expanded: false })),
			);
		}
	}

	async function openViewer(node: TreeNode) {
		setOpenFile({ path: node.path, name: node.name });
		setEditing(false);
		setSaveError(null);
		setFileContent(null);
		if (!isText(node.name)) return;
		setFileLoading(true);
		try {
			const res = await fetch(
				`/api/wiki/content?path=${encodeURIComponent(node.path)}`,
			);
			if (res.ok) {
				const d: { content: string } = await res.json();
				setFileContent(d.content);
			}
		} catch {
			/* ignore */
		}
		setFileLoading(false);
	}

	async function handleSave() {
		if (!openFile) return;
		setSaving(true);
		setSaveError(null);
		const res = await fetch("/api/wiki/content", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path: openFile.path, content: editContent }),
		});
		if (res.ok) {
			setFileContent(editContent);
			setEditing(false);
		} else {
			const e: { error?: string } = await res.json();
			setSaveError(e.error ?? "Save failed");
		}
		setSaving(false);
	}

	const loadPrompt = useCallback(async () => {
		setPromptLoading(true);
		setPromptError(null);
		try {
			const res = await fetch("/api/wiki/prompt");
			if (!res.ok) {
				const e: { error?: string } = await res.json();
				throw new Error(e.error ?? "Failed to load prompt");
			}
			const data: { content: string; isDefault: boolean } = await res.json();
			setWikiPrompt(data.content);
			setPromptIsDefault(data.isDefault);
		} catch (err) {
			setPromptError(
				err instanceof Error ? err.message : "Failed to load prompt",
			);
		} finally {
			setPromptLoading(false);
		}
	}, []);

	const savePrompt = useCallback(async () => {
		const content = wikiPrompt.trim();
		if (!content) {
			setPromptError("Prompt cannot be empty");
			return false;
		}

		setPromptSaving(true);
		setPromptError(null);
		try {
			const res = await fetch("/api/wiki/prompt", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content }),
			});
			if (!res.ok) {
				const e: { error?: string } = await res.json();
				throw new Error(e.error ?? "Failed to save prompt");
			}
			setWikiPrompt(content);
			setPromptIsDefault(false);
			return true;
		} catch (err) {
			setPromptError(
				err instanceof Error ? err.message : "Failed to save prompt",
			);
			return false;
		} finally {
			setPromptSaving(false);
		}
	}, [wikiPrompt]);

	const loadRuns = useCallback(async () => {
		setRunsLoading(true);
		try {
			const res = await fetch("/api/wiki/runs");
			if (!res.ok) return;
			const data: { runs: WikiRunRecord[] } = await res.json();
			setWikiRuns(data.runs);
		} catch {
			// ignore
		} finally {
			setRunsLoading(false);
		}
	}, []);

	const handleGenerate = useCallback(async () => {
		setRunning(true);
		setRunError(null);
		setRunMessage(null);
		try {
			const saved = await savePrompt();
			if (!saved) return;

			const res = await fetch("/api/wiki/generate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					agentId: selectedAgentId,
					model: selectedModel,
					...(promptOverride.trim()
						? { promptOverride: promptOverride.trim() }
						: {}),
				}),
			});
			if (!res.ok) {
				const e: { error?: string } = await res.json();
				throw new Error(e.error ?? "Failed to start wiki generation");
			}
			const data: {
				runId: string;
				pid: number;
				workspaceId: string;
				startedAt: string;
			} = await res.json();
			setActiveRunId(data.runId);
			setStreamRunId(data.runId);
			setStreamEvents([]);
			setStreamCursor(0);
			setRunMessage(`Run ${data.runId} started. PID ${data.pid}.`);
			await loadRuns();
		} catch (err) {
			setRunError(
				err instanceof Error ? err.message : "Failed to start wiki generation",
			);
		} finally {
			// keep "running" true until polling sees final run state
		}
	}, [loadRuns, promptOverride, savePrompt, selectedAgentId, selectedModel]);

	useEffect(() => {
		void loadPrompt();
		void loadRuns();
	}, [loadPrompt, loadRuns]);

	useEffect(() => {
		if (runAgents.length === 0) return;
		if (!runAgents.some((a) => a.id === selectedAgentId)) {
			setSelectedAgentId(DOC_MAINTAINER_AGENT_ID);
		}
	}, [hasDocMaintainer, runAgents, selectedAgentId]);

	useEffect(() => {
		if (!activeRunId) return;
		const id = setInterval(async () => {
			try {
				const res = await fetch("/api/wiki/runs");
				if (!res.ok) return;
				const data: { runs: WikiRunRecord[] } = await res.json();
				setWikiRuns(data.runs);

				const run = data.runs.find((r) => r.id === activeRunId);
				if (!run) return;
				if (run.status === "running") {
					setRunning(true);
					return;
				}
				setRunning(false);
				setActiveRunId(null);
				if (run.status === "completed") {
					setRunMessage(`Run ${run.id} completed.`);
					setRunError(null);
				} else {
					setRunError(run.error ?? `Run ${run.id} failed.`);
				}
			} catch {
				// ignore polling errors
			}
		}, 2000);
		return () => clearInterval(id);
	}, [activeRunId]);

	useEffect(() => {
		if (!streamRunId) return;
		const id = setInterval(async () => {
			try {
				const res = await fetch(
					`/api/wiki/run-stream?runId=${encodeURIComponent(streamRunId)}&since=${streamCursor}`,
				);
				if (!res.ok) return;
				const data: { events: StreamLine[]; next: number } = await res.json();
				if (data.events.length > 0) {
					setStreamEvents((prev) => [...prev, ...data.events]);
				}
				if (typeof data.next === "number") {
					setStreamCursor(data.next);
				}
			} catch {
				// ignore stream polling errors
			}
		}, 600);
		return () => clearInterval(id);
	}, [streamRunId, streamCursor]);

	const handleInitWiki = useCallback(async () => {
		setInitingWiki(true);
		setRunError(null);
		setRunMessage(null);
		try {
			const res = await fetch("/api/wiki/init", { method: "POST" });
			if (!res.ok) {
				const e: { error?: string } = await res.json();
				throw new Error(e.error ?? "Failed to initialize wiki");
			}

			const data: {
				pluginStatus?: "installed" | "already-installed";
				pluginUpdated?: boolean;
				bootstrapStatus?: "bootstrapped" | "already-initialized";
				pluginVersion?: string | null;
			} = await res.json();
			const pluginPart =
				data.pluginStatus === "installed"
					? "plugin installed"
					: data.pluginUpdated
						? "plugin updated"
						: "plugin ready";
			const bootstrapPart =
				data.bootstrapStatus === "bootstrapped"
					? "wiki bootstrapped from plugin"
					: "wiki already initialized";
			const versionPart = data.pluginVersion ? `v${data.pluginVersion}` : "";
			setRunMessage(
				["Wiki synced", pluginPart, bootstrapPart, versionPart]
					.filter(Boolean)
					.join(" · "),
			);
			await loadPrompt();
			await loadRuns();
			await reloadDir("");
		} catch (err) {
			setRunError(
				err instanceof Error ? err.message : "Failed to initialize wiki",
			);
		} finally {
			setInitingWiki(false);
		}
	}, [loadPrompt, loadRuns]);

	const doUpload = useCallback(
		async (files: FileList | File[], dir: string) => {
			const list = Array.from(files);
			if (!list.length) return;
			setUploading(true);
			setUploadError(null);
			try {
				for (const file of list) {
					const fd = new FormData();
					fd.append("file", file);
					fd.append("dir", dir);
					const res = await fetch("/api/wiki/upload", {
						method: "POST",
						body: fd,
					});
					if (!res.ok) {
						const e: { error?: string } = await res.json();
						setUploadError(e.error ?? "Upload failed");
						break;
					}
				}
				await reloadDir(dir);
			} catch {
				setUploadError("Upload failed.");
			} finally {
				setUploading(false);
				if (fileInputRef.current) fileInputRef.current.value = "";
			}
			// eslint-disable-next-line react-hooks/exhaustive-deps
		},
		[],
	);

	function triggerUpload(dir: string) {
		uploadDirRef.current = dir;
		fileInputRef.current?.click();
	}

	async function handleCreateFolder() {
		const name = newFolderName.trim();
		if (!name || newFolderParent === null) return;
		setFolderError(null);
		const rel = newFolderParent ? `${newFolderParent}/${name}` : name;
		const res = await fetch("/api/wiki/folder", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path: rel }),
		});
		if (res.ok) {
			setNewFolderParent(null);
			setNewFolderName("");
			await reloadDir(newFolderParent);
			if (newFolderParent !== "") {
				setRoots((prev) =>
					updateNodes(prev, newFolderParent, (n) => ({ ...n, expanded: true })),
				);
			}
		} else {
			const e: { error?: string } = await res.json();
			setFolderError(e.error ?? "Failed");
		}
	}

	async function handleDelete() {
		if (!deletingPath) return;
		await fetch("/api/wiki", {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path: deletingPath }),
		});
		if (
			openFile?.path === deletingPath ||
			openFile?.path.startsWith(deletingPath + "/")
		) {
			setOpenFile(null);
			setFileContent(null);
		}
		setRoots((prev) => removeNode(prev, deletingPath));
		setDeletingPath(null);
	}

	// --- Drag to reorganize ---
	function handleDragStart(e: React.DragEvent, node: TreeNode) {
		dragNodeRef.current = node;
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", node.path);
	}

	function handleDragOver(
		e: React.DragEvent,
		targetPath: string,
		targetType: "dir" | "root",
	) {
		e.preventDefault();
		e.stopPropagation();
		const dragging = dragNodeRef.current;
		if (!dragging) return;
		// Can't drop onto itself or a descendant
		if (
			dragging.path === targetPath ||
			targetPath.startsWith(dragging.path + "/")
		)
			return;
		e.dataTransfer.dropEffect = "move";
		setDragOverPath(targetType === "root" ? "" : targetPath);
	}

	async function handleDropOnFolder(e: React.DragEvent, targetDirPath: string) {
		e.preventDefault();
		e.stopPropagation();
		setDragOverPath(null);
		const node = dragNodeRef.current;
		dragNodeRef.current = null;
		if (!node) return;
		if (
			node.path === targetDirPath ||
			targetDirPath.startsWith(node.path + "/")
		)
			return;

		const newPath = targetDirPath ? `${targetDirPath}/${node.name}` : node.name;
		if (newPath === node.path) return;

		const res = await fetch("/api/wiki/move", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ from: node.path, to: newPath }),
		});
		if (res.ok) {
			// Reload both source parent and target dir
			const sourceParent = node.path.includes("/")
				? node.path.split("/").slice(0, -1).join("/")
				: "";
			await reloadDir(sourceParent);
			if (targetDirPath !== sourceParent) await reloadDir(targetDirPath);
			if (openFile?.path === node.path)
				setOpenFile({ path: newPath, name: node.name });
		}
	}

	// --- Render tree ---
	function renderNodes(nodes: TreeNode[], depth = 0): React.ReactNode {
		return nodes.map((node) => (
			<div key={node.path}>
				<div
					draggable
					onDragStart={(e) => handleDragStart(e, node)}
					onDragOver={(e) =>
						node.type === "dir"
							? handleDragOver(e, node.path, "dir")
							: e.preventDefault()
					}
					onDragLeave={() => setDragOverPath(null)}
					onDrop={(e) =>
						node.type === "dir"
							? handleDropOnFolder(e, node.path)
							: e.preventDefault()
					}
					className={cn(
						"flex items-center gap-1.5 rounded-sm px-2 py-1 text-sm cursor-pointer group transition-colors select-none",
						openFile?.path === node.path
							? "bg-accent text-accent-foreground"
							: "hover:bg-accent/50",
						dragOverPath === node.path && "ring-2 ring-primary bg-primary-soft",
					)}
					style={{ paddingLeft: `${depth * 14 + 8}px` }}
					onClick={() => {
						if (node.type === "dir") toggleFolder(node);
						else openViewer(node);
					}}
				>
					{node.type === "dir" ? (
						node.loading ? (
							<Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
						) : node.expanded ? (
							<ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
						) : (
							<ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
						)
					) : (
						<span className="w-3.5 shrink-0" />
					)}

					{node.type === "dir" ? (
						node.expanded ? (
							<FolderOpen className="h-4 w-4 shrink-0 text-warning" />
						) : (
							<Folder className="h-4 w-4 shrink-0 text-warning" />
						)
					) : isImage(node.name) ? (
						<ImageIcon className="h-4 w-4 shrink-0 text-sunshine-700" />
					) : isText(node.name) ? (
						<FileText className="h-4 w-4 shrink-0 text-accent" />
					) : (
						<File className="h-4 w-4 shrink-0 text-muted-foreground" />
					)}

					<span className="flex-1 truncate">{node.name}</span>

					<div
						className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
						onClick={(e) => e.stopPropagation()}
					>
						{node.type === "dir" && (
							<>
								<Button
									size="sm"
									variant="ghost"
									className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
									title="Upload here"
									onClick={() => triggerUpload(node.path)}
								>
									<Upload className="h-3 w-3" />
								</Button>
								<Button
									size="sm"
									variant="ghost"
									className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
									title="New subfolder"
									onClick={() => {
										setNewFolderParent(node.path);
										setNewFolderName("");
										setFolderError(null);
									}}
								>
									<FolderPlus className="h-3 w-3" />
								</Button>
							</>
						)}
						<Button
							size="sm"
							variant="ghost"
							className="h-6 w-6 p-0 text-destructive hover:text-destructive"
							title="Delete"
							onClick={() => {
								setDeletingPath(node.path);
								setDeletingIsDir(node.type === "dir");
							}}
						>
							<Trash2 className="h-3 w-3" />
						</Button>
					</div>
				</div>

				{newFolderParent === node.path && node.type === "dir" && (
					<div
						className="flex items-center gap-1.5 px-2 py-1"
						style={{ paddingLeft: `${(depth + 1) * 14 + 8}px` }}
					>
						<span className="w-3.5 shrink-0" />
						<Folder className="h-4 w-4 shrink-0 text-warning" />
						<input
							autoFocus
							className="flex-1 bg-transparent text-sm outline-none border-b border-border min-w-0"
							placeholder="Folder name"
							value={newFolderName}
							onChange={(e) => setNewFolderName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleCreateFolder();
								if (e.key === "Escape") {
									setNewFolderParent(null);
									setNewFolderName("");
								}
							}}
						/>
						{folderError && (
							<span className="text-xs text-destructive">{folderError}</span>
						)}
						<Button
							size="sm"
							variant="ghost"
							className="h-6 w-6 p-0"
							onClick={handleCreateFolder}
						>
							<Check className="h-3 w-3" />
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="h-6 w-6 p-0"
							onClick={() => {
								setNewFolderParent(null);
								setNewFolderName("");
							}}
						>
							<X className="h-3 w-3" />
						</Button>
					</div>
				)}

				{node.type === "dir" &&
					node.expanded &&
					node.children &&
					node.children.length > 0 &&
					renderNodes(node.children, depth + 1)}
				{node.type === "dir" &&
					node.expanded &&
					node.children?.length === 0 && (
						<div
							className="text-xs text-muted-foreground/50 py-0.5"
							style={{
								paddingLeft: `${(depth + 1) * 14 + 8 + 14 + 6 + 16 + 6}px`,
							}}
						>
							Empty
						</div>
					)}
			</div>
		));
	}

	return (
		<div className="flex h-[calc(100vh-8rem)] gap-4 min-h-0">
			{/* Tree panel */}
			<Card className="flex flex-col w-72 shrink-0 overflow-hidden">
				<div className="flex items-center justify-between px-3 py-2 border-b bg-muted shrink-0">
					<BreadcrumbNav items={[{ label: "Documents" }]} />
					<div className="flex gap-1">
						<Button
							size="sm"
							variant="ghost"
							className="h-7 w-7 p-0"
							title="New root folder"
							onClick={() => {
								setNewFolderParent("");
								setNewFolderName("");
								setFolderError(null);
							}}
						>
							<FolderPlus className="h-3.5 w-3.5" />
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="h-7 w-7 p-0"
							title="Upload to root"
							onClick={() => triggerUpload("")}
							disabled={uploading}
						>
							{uploading ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Upload className="h-3.5 w-3.5" />
							)}
						</Button>
					</div>
				</div>

				{uploadError && (
					<div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-destructive bg-destructive-soft shrink-0">
						<AlertCircle className="h-3.5 w-3.5 shrink-0" />
						{uploadError}
					</div>
				)}

				{newFolderParent === "" && (
					<div className="flex items-center gap-1.5 px-2 py-1 border-b shrink-0">
						<Folder className="h-4 w-4 shrink-0 text-warning" />
						<input
							autoFocus
							className="flex-1 bg-transparent text-sm outline-none border-b border-border min-w-0"
							placeholder="Folder name"
							value={newFolderName}
							onChange={(e) => setNewFolderName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleCreateFolder();
								if (e.key === "Escape") {
									setNewFolderParent(null);
									setNewFolderName("");
								}
							}}
						/>
						{folderError && (
							<span className="text-xs text-destructive">{folderError}</span>
						)}
						<Button
							size="sm"
							variant="ghost"
							className="h-6 w-6 p-0"
							onClick={handleCreateFolder}
						>
							<Check className="h-3 w-3" />
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="h-6 w-6 p-0"
							onClick={() => {
								setNewFolderParent(null);
								setNewFolderName("");
							}}
						>
							<X className="h-3 w-3" />
						</Button>
					</div>
				)}

				<div
					className={cn(
						"flex-1 overflow-auto py-1",
						dragOverPath === "" &&
							"ring-2 ring-inset ring-primary bg-primary-soft",
					)}
					onDragOver={(e) => handleDragOver(e, "", "root")}
					onDragLeave={(e) => {
						if (!e.currentTarget.contains(e.relatedTarget as Node))
							setDragOverPath(null);
					}}
					onDrop={(e) => handleDropOnFolder(e, "")}
				>
					{rootLoading ? (
						<div className="flex justify-center py-6">
							<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
						</div>
					) : roots.length === 0 ? (
						<p className="px-4 py-6 text-xs text-muted-foreground text-center">
							No files yet. Upload or create a folder.
						</p>
					) : (
						renderNodes(roots)
					)}
				</div>
			</Card>

			{/* Wiki generation */}
			<Card className="flex flex-col w-96 shrink-0 overflow-hidden">
				<div className="flex items-center justify-between px-3 py-2 border-b bg-muted shrink-0">
					<div>
						<p className="text-sm font-normal">Generate Wiki</p>
						<p className="text-xs text-muted-foreground">
							{promptIsDefault
								? "Default prompt loaded"
								: "Workspace prompt loaded"}
						</p>
					</div>
					<div className="flex gap-1">
						<Button
							size="sm"
							variant="outline"
							onClick={handleInitWiki}
							disabled={initingWiki || running || promptLoading}
						>
							{initingWiki ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : null}
							Init/Sync
						</Button>

						<Button
							size="sm"
							variant="ghost"
							className="h-7 w-7 p-0"
							title="Reload prompt and runs"
							onClick={() => {
								void loadPrompt();
								void loadRuns();
							}}
							disabled={promptLoading || runsLoading}
						>
							<RefreshCw className="h-3.5 w-3.5" />
						</Button>
						<Button
							size="sm"
							className="gap-1"
							onClick={handleGenerate}
							disabled={running || promptLoading || promptSaving}
						>
							{running ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								<Play className="h-3 w-3" />
							)}
							Run
						</Button>
					</div>
				</div>

				<div className="flex-1 overflow-auto p-3 min-h-0 space-y-4">
					<p className="text-[11px] text-muted-foreground">
						Init/Sync keeps llm-wiki-pm plugin current and lets plugin own wiki
						scaffold. Run processes docs and updates pages.
					</p>
					{promptError && (
						<div className="rounded-sm border border-destructive/30 bg-destructive-soft px-3 py-2 text-xs text-destructive">
							{promptError}
						</div>
					)}
					{runError && (
						<div className="rounded-sm border border-destructive/30 bg-destructive-soft px-3 py-2 text-xs text-destructive">
							{runError}
						</div>
					)}
					{runMessage && (
						<div className="rounded-sm border border-primary/30 bg-primary-soft px-3 py-2 text-xs text-primary">
							{runMessage}
						</div>
					)}

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<p className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
								Prompt
							</p>
							<span className="text-[11px] text-muted-foreground">
								{promptLoading
									? "Loading"
									: promptIsDefault
										? "Default"
										: "Saved"}
							</span>
						</div>
						<Textarea
							className="min-h-[190px] font-mono text-xs resize-y w-full"
							value={wikiPrompt}
							onChange={(e) => setWikiPrompt(e.target.value)}
							placeholder="Prompt Claude should use for wiki generation"
						/>
						<div className="flex justify-end gap-2">
							<Button
								size="sm"
								variant="ghost"
								onClick={() => void loadPrompt()}
								disabled={promptLoading}
							>
								Reload
							</Button>
							<Button
								size="sm"
								onClick={() => void savePrompt()}
								disabled={promptSaving || promptLoading}
							>
								{promptSaving ? (
									<Loader2 className="h-3 w-3 animate-spin" />
								) : null}
								Save prompt
							</Button>
						</div>
					</div>

					<div className="space-y-2">
						<p className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
							Additional instructions
						</p>
						<Textarea
							className="min-h-[120px] font-mono text-xs resize-y w-full"
							value={promptOverride}
							onChange={(e) => setPromptOverride(e.target.value)}
							placeholder="Optional override for this run"
						/>
						<p className="text-[11px] text-muted-foreground">
							Sent only for next run.
						</p>
					</div>

					<div className="space-y-2">
						<p className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
							Agent
						</p>
						<select
							className="w-full h-8 rounded-sm border bg-background px-2 text-xs"
							value={selectedAgentId}
							onChange={(e) => setSelectedAgentId(e.target.value)}
						>
							{!hasDocMaintainer ? (
								<option value={DOC_MAINTAINER_AGENT_ID}>Doc Maintainer</option>
							) : null}
							{runAgents.map((agent) => (
								<option key={agent.id} value={agent.id}>
									{agent.name}
								</option>
							))}
						</select>
						<p className="text-[11px] text-muted-foreground">
							Default Doc Maintainer follows plugin skill only.
						</p>
					</div>

					<div className="space-y-2">
						<p className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
							Model
						</p>
						<select
							className="w-full h-8 rounded-sm border bg-background px-2 text-xs"
							value={selectedModel}
							onChange={(e) => setSelectedModel(e.target.value)}
						>
							<option value="haiku">haiku</option>
							<option value="sonnet">sonnet</option>
							<option value="opus">opus</option>
						</select>
						<p className="text-[11px] text-muted-foreground">
							Model override for this run.
						</p>
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<p className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
								Recent runs
							</p>
							<span className="text-[11px] text-muted-foreground">
								{runsLoading ? "Loading" : `${wikiRuns.length} total`}
							</span>
						</div>
						<div className="space-y-2">
							{wikiRuns.length === 0 ? (
								<p className="text-xs text-muted-foreground">No runs yet.</p>
							) : (
								wikiRuns.slice(0, 5).map((run) => (
									<div
										key={run.id}
										className="rounded-sm border bg-background px-3 py-2 text-xs space-y-1"
									>
										<div className="flex items-center justify-between gap-2">
											<span className="font-normal truncate" title={run.id}>
												{run.id}
											</span>
											<span className="uppercase text-[10px] text-muted-foreground">
												{run.status}
											</span>
										</div>
										<p className="text-[11px] text-muted-foreground">
											{new Date(run.startedAt).toLocaleString()}
										</p>
										<p
											className="text-[11px] text-muted-foreground truncate"
											title={run.error ?? ""}
										>
											{run.agentId ?? DOC_MAINTAINER_AGENT_ID} ·{" "}
											{run.model ?? "default"} ·{" "}
											{run.hasOverride ? "Override: yes" : "Override: no"} ·
											Exit: {run.exitCode ?? "-"}
										</p>
									</div>
								))
							)}
						</div>
					</div>
				</div>
			</Card>

			{/* File viewer / editor */}
			{streamRunId ? (
				<Card className="flex-1 flex flex-col overflow-hidden min-w-0">
					<div className="flex items-center justify-between px-4 py-2 border-b bg-muted shrink-0">
						<div className="min-w-0">
							<p className="text-sm font-normal">Claude Run Stream</p>
							<p
								className="text-xs text-muted-foreground truncate"
								title={streamRunId}
							>
								{streamRunId}
							</p>
						</div>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setStreamRunId(null)}
						>
							Close
						</Button>
					</div>
					<div className="flex-1 overflow-auto p-4 min-h-0">
						{displayStreamEvents.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								Waiting for Claude output...
							</p>
						) : (
							<div className="space-y-1">
								{displayStreamEvents.map((line, i) => (
									<StreamEntry key={i} line={line} />
								))}
							</div>
						)}
					</div>
				</Card>
			) : openFile ? (
				<Card className="flex-1 flex flex-col overflow-hidden min-w-0">
					<div className="flex items-center justify-between px-4 py-2 border-b bg-muted shrink-0">
						<div className="flex items-center gap-2 min-w-0">
							{isImage(openFile.name) ? (
								<ImageIcon className="h-4 w-4 shrink-0 text-sunshine-700" />
							) : isText(openFile.name) ? (
								<FileText className="h-4 w-4 shrink-0 text-accent" />
							) : (
								<File className="h-4 w-4 shrink-0 text-muted-foreground" />
							)}
							<span
								className="text-sm font-normal truncate"
								title={openFile.path}
							>
								{openFile.path}
							</span>
						</div>
						<div className="flex items-center gap-1 shrink-0">
							{isText(openFile.name) && !editing && fileContent !== null && (
								<Button
									size="sm"
									variant="ghost"
									className="h-7 w-7 p-0"
									onClick={() => {
										setEditing(true);
										setEditContent(fileContent);
										setSaveError(null);
									}}
								>
									<Pencil className="h-3.5 w-3.5" />
								</Button>
							)}
							<Button
								size="sm"
								variant="ghost"
								className="h-7 w-7 p-0"
								onClick={() => {
									setOpenFile(null);
									setFileContent(null);
									setEditing(false);
								}}
							>
								<X className="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>

					<div className="flex-1 overflow-auto p-4 min-h-0">
						{fileLoading ? (
							<div className="flex justify-center py-8">
								<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
							</div>
						) : isImage(openFile.name) ? (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={`/api/wiki/file?path=${encodeURIComponent(openFile.path)}`}
								alt={openFile.name}
								className="max-w-full max-h-full object-contain rounded-sm"
							/>
						) : editing ? (
							<Textarea
								className="min-h-[400px] font-mono text-xs resize-none w-full"
								value={editContent}
								onChange={(e) => setEditContent(e.target.value)}
								autoFocus
							/>
						) : fileContent !== null ? (
							["md", "markdown"].includes(ext(openFile.name)) ? (
								<ReactMarkdown
									remarkPlugins={[remarkGfm]}
									components={{
										h1: ({ children }) => (
											<h1 className="text-2xl font-normal mt-6 mb-3 pb-1 border-b">
												{children}
											</h1>
										),
										h2: ({ children }) => (
											<h2 className="text-xl font-normal mt-5 mb-2 pb-1 border-b">
												{children}
											</h2>
										),
										h3: ({ children }) => (
											<h3 className="text-lg font-normal mt-4 mb-2">
												{children}
											</h3>
										),
										h4: ({ children }) => (
											<h4 className="text-base font-normal mt-3 mb-1">
												{children}
											</h4>
										),
										p: ({ children }) => (
											<p className="text-sm leading-relaxed mb-3">{children}</p>
										),
										ul: ({ children }) => (
											<ul className="list-disc pl-5 mb-3 space-y-1 text-sm">
												{children}
											</ul>
										),
										ol: ({ children }) => (
											<ol className="list-decimal pl-5 mb-3 space-y-1 text-sm">
												{children}
											</ol>
										),
										li: ({ children }) => (
											<li className="leading-relaxed">{children}</li>
										),
										blockquote: ({ children }) => (
											<blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic text-muted-foreground my-3 text-sm">
												{children}
											</blockquote>
										),
										code: ({ className, children, ...props }) => {
											const isBlock = className?.includes("language-");
											return isBlock ? (
												<code
													className={`block bg-muted rounded-sm px-3 py-2 text-xs font-mono overflow-x-auto my-3 ${className ?? ""}`}
													{...props}
												>
													{children}
												</code>
											) : (
												<code
													className="bg-muted rounded-sm px-1 py-0.5 text-xs font-mono"
													{...props}
												>
													{children}
												</code>
											);
										},
										pre: ({ children }) => (
											<pre className="my-3 overflow-x-auto">{children}</pre>
										),
										a: ({ href, children }) => (
											<a
												href={href}
												className="text-primary underline hover:no-underline"
												target="_blank"
												rel="noreferrer"
											>
												{children}
											</a>
										),
										strong: ({ children }) => (
											<strong className="font-normal">{children}</strong>
										),
										em: ({ children }) => (
											<em className="italic">{children}</em>
										),
										hr: () => <hr className="my-4 border-border" />,
										table: ({ children }) => (
											<div className="overflow-x-auto my-3">
												<table className="w-full text-sm border-collapse">
													{children}
												</table>
											</div>
										),
										th: ({ children }) => (
											<th className="border border-border px-3 py-1.5 bg-muted font-normal text-left">
												{children}
											</th>
										),
										td: ({ children }) => (
											<td className="border border-border px-3 py-1.5">
												{children}
											</td>
										),
									}}
								>
									{fileContent}
								</ReactMarkdown>
							) : (
								<pre className="text-xs font-mono whitespace-pre-wrap break-words leading-relaxed">
									{fileContent}
								</pre>
							)
						) : isText(openFile.name) ? (
							<p className="text-sm text-muted-foreground">
								Could not load file.
							</p>
						) : (
							<p className="text-sm text-muted-foreground">
								Preview not available for this file type.
							</p>
						)}
					</div>

					{editing && (
						<div className="border-t px-4 py-2 flex items-center justify-end gap-2 bg-muted shrink-0">
							{saveError && (
								<span className="text-xs text-destructive mr-auto">
									{saveError}
								</span>
							)}
							<Button
								size="sm"
								variant="ghost"
								onClick={() => {
									setEditing(false);
									setSaveError(null);
								}}
							>
								Cancel
							</Button>
							<Button
								size="sm"
								className="gap-1"
								onClick={handleSave}
								disabled={saving}
							>
								{saving && <Loader2 className="h-3 w-3 animate-spin" />}Save
							</Button>
						</div>
					)}
				</Card>
			) : (
				<Card className="flex-1 flex items-center justify-center text-muted-foreground text-sm border-dashed">
					Select a file to view
				</Card>
			)}

			<input
				ref={fileInputRef}
				type="file"
				multiple
				className="hidden"
				accept=".pdf,.txt,.md,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.svg"
				onChange={(e) => {
					if (e.target.files) doUpload(e.target.files, uploadDirRef.current);
				}}
			/>

			<ConfirmDialog
				open={!!deletingPath}
				onOpenChange={(open) => {
					if (!open) setDeletingPath(null);
				}}
				title={deletingIsDir ? "Delete folder?" : "Delete file?"}
				description={
					deletingIsDir
						? `"${deletingPath?.split("/").pop()}" and all its contents will be permanently deleted.`
						: `"${deletingPath?.split("/").pop()}" will be permanently removed.`
				}
				onConfirm={handleDelete}
			/>
		</div>
	);
}
