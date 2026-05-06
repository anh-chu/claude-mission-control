"use client";

import {
	Archive,
	ArrowRight,
	Lightbulb,
	Loader2,
	Pencil,
	Trash2,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { ErrorState } from "@/components/error-state";
import { GridSkeleton, RowSkeleton } from "@/components/skeletons";
import type { TaskFormData } from "@/components/task-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tip";
import { useBrainDump, useTasks } from "@/hooks/use-data";
import { useProcessingEntries } from "@/hooks/use-processing-entries";
import type { BrainDumpEntry } from "@/lib/types";

export function DashboardInbox() {
	const {
		entries,
		update: updateEntry,
		remove: deleteEntry,
		loading,
		error: dumpError,
		refetch,
	} = useBrainDump();
	const { create: createTask } = useTasks();
	const [convertingEntry, setConvertingEntry] = useState<BrainDumpEntry | null>(
		null,
	);
	const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
	const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
	const [editContent, setEditContent] = useState("");
	const processing = useProcessingEntries(entries);

	function startEditing(entry: BrainDumpEntry) {
		setEditingEntryId(entry.id);
		setEditContent(entry.content);
	}

	function cancelEditing() {
		setEditingEntryId(null);
		setEditContent("");
	}

	async function handleSaveEdit() {
		if (!editingEntryId || !editContent.trim()) return;
		await updateEntry(editingEntryId, { content: editContent.trim() });
		setEditingEntryId(null);
		setEditContent("");
	}

	async function handleAutoProcessEntry(entryId: string) {
		try {
			const res = await fetch("/api/brain-dump/automate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ entryIds: [entryId] }),
			});
			if (res.ok) {
				processing.markProcessing(entryId);
			}
		} catch {
			// Network error — don't mark as processing
		}
	}

	async function handleAutoProcessAll() {
		try {
			const res = await fetch("/api/brain-dump/automate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ all: true }),
			});
			if (res.ok) {
				const data: { entryIds: string[] } = await res.json();
				processing.markAllProcessing(data.entryIds);
			}
		} catch {
			// Network error
		}
	}

	// Poll for brain dump updates while entries are being auto-processed
	useEffect(() => {
		if (!processing.hasProcessing) return;
		const interval = setInterval(() => {
			if (document.visibilityState === "visible") refetch();
		}, 5_000);
		return () => clearInterval(interval);
	}, [processing.hasProcessing, refetch]);

	async function handleConvertToTask(data: TaskFormData) {
		if (!convertingEntry) return;
		await createTask({
			id: `task_${Date.now()}`,
			...data,
			tags: data.tags
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean),
			acceptanceCriteria: data.acceptanceCriteria,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			completedAt: null,
		});
		await updateEntry(convertingEntry.id, {
			processed: true,
			convertedTo: "task",
		});
		setConvertingEntry(null);
	}

	const unprocessed = entries.filter((e) => !e.processed);
	const processed = entries.filter((e) => e.processed);

	if (loading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-normal flex items-center gap-2">
						<Lightbulb className="h-5 w-5 text-primary" />
						Inbox
					</h2>
				</div>
				<GridSkeleton
					className="space-y-2"
					count={3}
					renderItem={() => (
						<RowSkeleton
							className="rounded-sm border bg-card p-3 items-start justify-between"
							lines={[
								{ key: "title", className: "h-4 w-4/5" },
								{ key: "meta", className: "h-3 w-24" },
							]}
							linesClassName="flex-1 space-y-2"
							trailing={[
								{ key: "primary-action", className: "h-7 w-14 rounded-sm" },
								{ key: "secondary-action", className: "h-7 w-7 rounded-sm" },
								{ key: "tertiary-action", className: "h-7 w-7 rounded-sm" },
							]}
						/>
					)}
				/>
			</div>
		);
	}

	if (dumpError) {
		return <ErrorState message={dumpError} onRetry={refetch} />;
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-normal flex items-center gap-2">
					<Lightbulb className="h-5 w-5 text-primary" />
					Inbox
					{unprocessed.length > 0 && (
						<span className="text-sm text-muted-foreground">
							({unprocessed.length} to process)
						</span>
					)}
				</h2>
				{unprocessed.length > 0 && (
					<Tip content="Automatically process all entries">
						<Button
							size="sm"
							variant="outline"
							className="gap-1.5"
							onClick={handleAutoProcessAll}
							disabled={processing.hasProcessing}
						>
							{processing.hasProcessing ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Zap className="h-3.5 w-3.5" />
							)}
							{processing.hasProcessing
								? `Processing ${processing.processingCount}...`
								: "Auto-Process All"}
						</Button>
					</Tip>
				)}
			</div>

			{/* To Process */}
			<section>
				<h3 className="text-sm font-normal mb-2 text-muted-foreground">
					To Process ({unprocessed.length})
				</h3>
				{unprocessed.length === 0 ? (
					<Card className="border-dashed">
						<CardContent className="py-8 text-center text-sm text-muted-foreground">
							All caught up! Use the capture bar at the top to add new ideas.
						</CardContent>
					</Card>
				) : (
					<div className="space-y-2">
						{unprocessed.map((entry) => (
							<Card
								key={entry.id}
								className={`bg-card ${processing.isProcessing(entry.id) ? "animate-pulse border-primary/30 bg-primary-soft" : ""}`}
							>
								<CardContent className="p-3 flex items-start justify-between gap-3">
									{editingEntryId === entry.id ? (
										<div className="flex-1 min-w-0 space-y-2">
											<textarea
												value={editContent}
												onChange={(e) => setEditContent(e.target.value)}
												className="min-h-[60px] text-sm resize-none w-full rounded-md border border-input bg-background px-3 py-2"
												autoFocus
												onKeyDown={(e) => {
													if (e.key === "Enter" && !e.shiftKey) {
														e.preventDefault();
														handleSaveEdit();
													}
													if (e.key === "Escape") cancelEditing();
												}}
											/>
											<div className="flex gap-1">
												<Button
													size="sm"
													onClick={handleSaveEdit}
													disabled={!editContent.trim()}
												>
													Save
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={cancelEditing}
												>
													Cancel
												</Button>
											</div>
										</div>
									) : (
										<>
											<div className="flex-1 min-w-0">
												<p className="text-sm">{entry.content}</p>
												<div className="mt-1.5 flex items-center gap-2">
													<span className="text-xs text-muted-foreground">
														{new Date(entry.capturedAt).toLocaleDateString()}
													</span>
													{entry.tags.map((tag) => (
														<Badge
															key={tag}
															variant="outline"
															className="text-xs h-4 px-1"
														>
															{tag}
														</Badge>
													))}
												</div>
											</div>
											<div className="flex gap-1 shrink-0">
												<Tip content="Auto-process this entry">
													<Button
														size="sm"
														variant="ghost"
														onClick={() => handleAutoProcessEntry(entry.id)}
														disabled={processing.isProcessing(entry.id)}
														className="h-7 w-7 p-0 text-primary hover:text-primary"
														aria-label="Auto-process"
													>
														{processing.isProcessing(entry.id) ? (
															<Loader2 className="h-3 w-3 animate-spin" />
														) : (
															<Zap className="h-3 w-3" />
														)}
													</Button>
												</Tip>
												<Tip content="Edit entry">
													<Button
														size="sm"
														variant="ghost"
														onClick={() => startEditing(entry)}
														className="h-7 w-7 p-0"
														aria-label="Edit"
													>
														<Pencil className="h-3 w-3" />
													</Button>
												</Tip>
												<Tip content="Convert to a new task">
													<Button
														size="sm"
														variant="outline"
														onClick={() => setConvertingEntry(entry)}
														className="gap-1 px-2"
													>
														<ArrowRight className="h-3 w-3" /> Task
													</Button>
												</Tip>
												<Tip content="Archive entry">
													<Button
														size="sm"
														variant="ghost"
														onClick={() =>
															updateEntry(entry.id, { processed: true })
														}
														className="h-7 w-7 p-0"
														aria-label="Archive"
													>
														<Archive className="h-3 w-3" />
													</Button>
												</Tip>
												<Tip content="Delete entry">
													<Button
														size="sm"
														variant="ghost"
														className="h-7 w-7 p-0 text-destructive hover:text-destructive"
														onClick={() => setDeletingEntryId(entry.id)}
														aria-label="Delete"
													>
														<Trash2 className="h-3 w-3" />
													</Button>
												</Tip>
											</div>
										</>
									)}
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</section>

			{/* Archived */}
			{processed.length > 0 && (
				<section>
					<h3 className="text-sm font-normal mb-2 text-muted-foreground/60">
						Archived ({processed.length})
					</h3>
					<div className="space-y-1.5">
						{processed.map((entry) => (
							<Card key={entry.id} className="bg-card opacity-60">
								<CardContent className="p-2.5 flex items-center justify-between">
									<div>
										<p className="text-xs line-through">{entry.content}</p>
										{entry.convertedTo && (
											<span className="text-xs text-muted-foreground">
												&rarr; {entry.convertedTo}
											</span>
										)}
									</div>
									<Button
										size="sm"
										variant="ghost"
										className="h-6 w-6 p-0 text-destructive"
										onClick={() => setDeletingEntryId(entry.id)}
										aria-label="Delete"
									>
										<Trash2 className="h-3 w-3" />
									</Button>
								</CardContent>
							</Card>
						))}
					</div>
				</section>
			)}

			{/* Convert to Task dialog */}
			<CreateTaskDialog
				open={!!convertingEntry}
				onOpenChange={(open) => {
					if (!open) setConvertingEntry(null);
				}}
				onSubmit={handleConvertToTask}
				defaultValues={
					convertingEntry
						? {
								title: convertingEntry.content,
								tags: convertingEntry.tags.join(", "),
							}
						: undefined
				}
			/>

			{/* Delete confirmation dialog */}
			<ConfirmDialog
				open={!!deletingEntryId}
				onOpenChange={(open) => {
					if (!open) setDeletingEntryId(null);
				}}
				title="Delete entry?"
				description="This will permanently remove this quick capture entry. This action cannot be undone."
				onConfirm={() => {
					if (deletingEntryId) deleteEntry(deletingEntryId);
				}}
			/>
		</div>
	);
}
