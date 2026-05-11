"use client";

import {
	Clock,
	Pencil,
	Play,
	Plus,
	RefreshCw,
	Rocket,
	Save,
	Square,
	Timer,
	Trash2,
	X,
	Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ConversationView } from "@/components/conversation/ConversationView";
import { ErrorState } from "@/components/error-state";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/tip";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDaemon } from "@/hooks/use-daemon";
import { useAgents } from "@/hooks/use-data";
import { apiFetch } from "@/lib/api-client";
import { useActiveRunsContext as useActiveRuns } from "@/providers/active-runs-provider";

function formatDuration(minutes: number): string {
	if (minutes < 1) return "< 1m";
	if (minutes < 60) return `${Math.round(minutes)}m`;
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatRelativeTime(isoString: string): string {
	const diff = Date.now() - new Date(isoString).getTime();
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

const AVAILABLE_COMMANDS = [
	"standup",
	"daily-plan",
	"weekly-review",
	"brainstorm",
	"research",
	"plan-feature",
	"ship-feature",
	"pick-up-work",
	"report",
	"orchestrate",
];

type RepeatInterval = "once" | "daily" | "weekly" | "monthly" | "custom";

const REPEAT_OPTIONS: { label: string; value: RepeatInterval }[] = [
	{ label: "Once", value: "once" },
	{ label: "Daily", value: "daily" },
	{ label: "Weekly", value: "weekly" },
	{ label: "Monthly", value: "monthly" },
	{ label: "Custom (cron)", value: "custom" },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Detect the repeat interval from a cron expression */
function detectRepeat(cron: string): RepeatInterval {
	const parts = cron.trim().split(/\s+/);
	if (parts.length !== 5) return "custom";
	const [, , dd, mon, dow] = parts;
	if (dd === "*" && mon === "*" && dow === "*") return "daily";
	if (dd === "*" && mon === "*" && dow !== "*") return "weekly";
	if (dd !== "*" && mon === "*" && dow === "*") {
		// Could be "once" (specific month+day) or monthly
		if (mon !== "*") return "once";
		return "monthly";
	}
	if (dd !== "*" && mon !== "*" && dow === "*") return "once";
	return "custom";
}

/** Generate a cron expression from a datetime-local string + repeat interval */
function deriveCron(startAt: string, repeat: RepeatInterval): string {
	if (!startAt || repeat === "custom") return "";
	const dt = new Date(startAt);
	if (Number.isNaN(dt.getTime())) return "";
	const mm = dt.getMinutes();
	const hh = dt.getHours();
	const dd = dt.getDate();
	const mon = dt.getMonth() + 1;
	const dow = dt.getDay();
	switch (repeat) {
		case "once":
			return `${mm} ${hh} ${dd} ${mon} *`;
		case "daily":
			return `${mm} ${hh} * * *`;
		case "weekly":
			return `${mm} ${hh} * * ${dow}`;
		case "monthly":
			return `${mm} ${hh} ${dd} * *`;
		default:
			return "";
	}
}

/** Format a local datetime string for a datetime-local input (YYYY-MM-DDTHH:mm) */
function toDatetimeLocal(isoOrNull: string | null | undefined): string {
	if (!isoOrNull) {
		const now = new Date();
		now.setSeconds(0, 0);
		return now.toISOString().slice(0, 16);
	}
	try {
		const dt = new Date(isoOrNull);
		// Shift to local time
		const offset = dt.getTimezoneOffset();
		const local = new Date(dt.getTime() - offset * 60000);
		return local.toISOString().slice(0, 16);
	} catch {
		return new Date().toISOString().slice(0, 16);
	}
}

/** Human-readable description of a schedule entry */
function scheduleToHuman(schedule: {
	cron: string;
	startAt?: string | null;
}): string {
	const { cron, startAt } = schedule;
	const parts = cron.trim().split(/\s+/);
	if (parts.length !== 5) return cron;

	const [mmStr, hhStr, dd, , dow] = parts;
	const mm = parseInt(mmStr, 10);
	const hh = parseInt(hhStr, 10);
	const timeStr = `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
	const repeat = detectRepeat(cron);

	let text = "";
	switch (repeat) {
		case "once":
			text = `Once at ${timeStr}`;
			break;
		case "daily":
			text = `Daily at ${timeStr}`;
			break;
		case "weekly": {
			const dayIdx = parseInt(dow, 10);
			const dayName = Number.isNaN(dayIdx) ? dow : (DAY_NAMES[dayIdx] ?? dow);
			text = `Weekly on ${dayName} at ${timeStr}`;
			break;
		}
		case "monthly":
			text = `Monthly on the ${dd}${ordinalSuffix(parseInt(dd, 10))} at ${timeStr}`;
			break;
		default:
			return cron;
	}

	if (startAt) {
		const startDate = new Date(startAt);
		if (!Number.isNaN(startDate.getTime()) && startDate > new Date()) {
			text += ` · starts ${startDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
		}
	}

	return text;
}

function ordinalSuffix(n: number): string {
	if (n >= 11 && n <= 13) return "th";
	switch (n % 10) {
		case 1:
			return "st";
		case 2:
			return "nd";
		case 3:
			return "rd";
		default:
			return "th";
	}
}

export function AutopilotPage() {
	const { status, config, isRunning, isLoading, error, updateConfig } =
		useDaemon();
	const { runs } = useActiveRuns();
	const { agents } = useAgents();
	const [expandedSessionId, setExpandedSessionId] = useState<string | null>(
		null,
	);

	// Map task IDs to active run IDs for the live console
	const taskToRunId = useMemo(() => {
		const map = new Map<string, string>();
		for (const run of runs) {
			if (run.status === "running" && run.taskId && run.streamFile) {
				map.set(run.taskId, run.id);
			}
		}
		return map;
	}, [runs]);

	// Conversation lookup for expanded session
	const [linkedConversationId, setLinkedConversationId] = useState<
		string | null
	>(null);
	const [lookupLoading, setLookupLoading] = useState(false);

	const expandedSession = expandedSessionId
		? (status.activeSessions.find((s) => s.id === expandedSessionId) ?? null)
		: null;

	useEffect(() => {
		setLinkedConversationId(null);
		if (!expandedSession?.taskId) return;

		let cancelled = false;
		setLookupLoading(true);

		fetch(`/api/conversations?taskId=${expandedSession.taskId}`)
			.then((res) => {
				if (!res.ok) return null;
				return res.json();
			})
			.then(
				(
					data: {
						conversations?: Array<{ id: string; updatedAt: string }>;
					} | null,
				) => {
					if (cancelled) return;
					const convs: Array<{ id: string; updatedAt: string }> =
						data?.conversations ?? [];
					convs.sort(
						(a, b) =>
							new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
					);
					if (convs.length > 0) {
						setLinkedConversationId(convs[0].id);
					}
				},
			)
			.catch(() => {
				// ignore
			})
			.finally(() => {
				if (!cancelled) setLookupLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [expandedSession?.taskId]);

	// Config editing state
	const [editingConfig, setEditingConfig] = useState(false);
	const [maxParallelAgents, setMaxParallelAgents] = useState(1);
	const [maxTurns, setMaxTurns] = useState(10);
	const [timeoutMinutes, setTimeoutMinutes] = useState(30);
	const [retries, setRetries] = useState(1);

	function startEditing() {
		setMaxParallelAgents(config.concurrency.maxParallelAgents);
		setMaxTurns(config.execution.maxTurns);
		setTimeoutMinutes(config.execution.timeoutMinutes);
		setRetries(config.execution.retries);
		setEditingConfig(true);
	}

	async function saveConfig() {
		await updateConfig({
			concurrency: { maxParallelAgents },
			execution: {
				maxTurns,
				timeoutMinutes,
				retries,
				retryDelayMinutes: config.execution.retryDelayMinutes,
				skipPermissions: config.execution.skipPermissions,
				allowedTools: config.execution.allowedTools,
				agentTeams: config.execution.agentTeams,
				claudeBinaryPath: config.execution.claudeBinaryPath,
				maxTaskContinuations: config.execution.maxTaskContinuations,
			},
			polling: { enabled: config.polling.enabled },
		});
		setEditingConfig(false);
	}

	async function toggleSchedule(name: string) {
		const entry = config.schedule[name];
		if (!entry) return;
		await updateConfig({
			schedule: {
				...config.schedule,
				[name]: { ...entry, enabled: !entry.enabled },
			},
		});
	}

	// Schedule editing state
	const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
	const [editCron, setEditCron] = useState("");
	const [editCommand, setEditCommand] = useState("");
	const [editStartAt, setEditStartAt] = useState("");
	const [editRepeat, setEditRepeat] = useState<RepeatInterval>("daily");
	const [editAgentId, setEditAgentId] = useState("");

	// Ad-hoc run state
	const [runningCommands, setRunningCommands] = useState<Set<string>>(
		new Set(),
	);

	function startEditingSchedule(name: string) {
		const entry = config.schedule[name];
		if (!entry) return;
		const repeat = detectRepeat(entry.cron);
		setEditRepeat(repeat);
		setEditCron(entry.cron);
		setEditCommand(entry.command);
		setEditStartAt(toDatetimeLocal(entry.startAt));
		setEditAgentId(entry.agentId ?? agents[0]?.id ?? "");
		setEditingSchedule(name);
	}

	function cancelEditingSchedule() {
		setEditingSchedule(null);
		setEditCron("");
		setEditCommand("");
		setEditStartAt("");
		setEditRepeat("daily");
		setEditAgentId("");
	}

	async function saveScheduleEntry(name: string) {
		const finalCron =
			editRepeat === "custom" ? editCron : deriveCron(editStartAt, editRepeat);
		const startAtISO = editStartAt ? new Date(editStartAt).toISOString() : null;
		await updateConfig({
			schedule: {
				...config.schedule,
				[name]: {
					...config.schedule[name],
					cron: finalCron || editCron,
					command: editCommand,
					startAt: startAtISO,
					agentId: editAgentId || undefined,
				},
			},
		});
		setEditingSchedule(null);
	}

	async function addScheduleEntry() {
		const newName = `schedule_${Date.now()}`;
		await updateConfig({
			schedule: {
				...config.schedule,
				[newName]: {
					enabled: true,
					cron: "0 9 * * *",
					command: "daily-plan",
					startAt: null,
					agentId: agents[0]?.id,
				},
			},
		});
	}

	async function removeScheduleEntry(name: string) {
		const updated = { ...config.schedule };
		delete updated[name];
		await updateConfig({ schedule: updated });
	}

	async function runCommandNow(command: string) {
		setRunningCommands((prev) => new Set(prev).add(command));
		try {
			await apiFetch("/api/daemon", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "run-command", command }),
			});
		} catch {
			// ignore — fire and forget
		} finally {
			setRunningCommands((prev) => {
				const next = new Set(prev);
				next.delete(command);
				return next;
			});
		}
	}

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-28" />
					))}
				</div>
				<Skeleton className="h-64" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="space-y-6">
				<ErrorState message={error} onRetry={() => window.location.reload()} />
			</div>
		);
	}

	const completionRate =
		status.stats.tasksDispatched > 0
			? Math.round(
					(status.stats.tasksCompleted / status.stats.tasksDispatched) * 100,
				)
			: 0;

	// Preview the derived cron expression while editing
	const previewCron =
		editRepeat === "custom" ? editCron : deriveCron(editStartAt, editRepeat);

	return (
		<div className="space-y-6">
			{/* Status Bar */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Rocket className="h-5 w-5" />
					<h1 className="text-xl font-normal">Automation</h1>
					<Badge
						variant={isRunning ? "default" : "secondary"}
						className={isRunning ? "bg-primary" : ""}
					>
						{isRunning ? "Running" : "Stopped"}
					</Badge>
				</div>
				<div className="flex gap-2">
					<Button
						variant={isRunning ? "destructive" : "default"}
						size="sm"
						onClick={() =>
							void updateConfig({
								polling: { enabled: !config.polling.enabled },
							})
						}
					>
						{isRunning ? (
							<>
								<Square className="h-4 w-4 mr-2" />
								Disable Automation
							</>
						) : (
							<>
								<Rocket className="h-4 w-4 mr-2" />
								Enable Automation
							</>
						)}
					</Button>
				</div>
			</div>

			<p className="text-sm text-muted-foreground -mt-2">
				Automation runs within the app, polling for pending tasks and
				dispatching them to AI agents. It manages concurrency limits, retries
				failed tasks, and runs scheduled commands (standups, daily plans, weekly
				reviews) on cron schedules. Enable it and your task queue runs
				hands-free.
			</p>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-5 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Uptime</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-normal">
							{isRunning
								? formatDuration(status.stats.uptimeMinutes)
								: "\u2014"}
						</div>
						{status.startedAt && isRunning && (
							<p className="text-xs text-muted-foreground mt-1">
								Since {new Date(status.startedAt).toLocaleString()}
							</p>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Tasks Completed</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span className="text-2xl font-normal">
								{status.stats.tasksCompleted}
							</span>
							<span className="text-sm text-muted-foreground">
								/ {status.stats.tasksDispatched} dispatched
							</span>
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							{completionRate}% success rate
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Active Sessions</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span className="text-2xl font-normal">
								{status.activeSessions.length}
							</span>
							<span className="text-sm text-muted-foreground">
								/ {config.concurrency.maxParallelAgents} max
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Failures</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-normal">
							{status.stats.tasksFailed}
						</div>
						{status.lastPollAt && (
							<p className="text-xs text-muted-foreground mt-1">
								Last poll: {formatRelativeTime(status.lastPollAt)}
							</p>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Total Spend</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="text-2xl font-normal">
							${status.stats.totalCostUsd?.toFixed(2) ?? "0.00"}
						</div>
						{status.stats.tasksCompleted > 0 && (
							<p className="text-xs text-muted-foreground mt-1">
								~$
								{(
									status.stats.totalCostUsd / status.stats.tasksCompleted
								).toFixed(2)}{" "}
								per task
							</p>
						)}
						{(status.stats.totalInputTokens > 0 ||
							status.stats.totalOutputTokens > 0) && (
							<p className="text-xs text-muted-foreground mt-0.5">
								{(
									(status.stats.totalInputTokens +
										status.stats.totalOutputTokens) /
									1000
								).toFixed(0)}
								k tokens
							</p>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Active Sessions */}
			{status.activeSessions.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Zap className="h-5 w-5 text-primary" />
							Active Sessions
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{status.activeSessions.map((session) => {
								const runId = session.taskId
									? taskToRunId.get(session.taskId)
									: null;
								const isExpanded = expandedSessionId === session.id;

								return (
									<div
										key={session.id}
										className="rounded-sm border overflow-hidden"
									>
										<div
											className="flex items-center justify-between p-3 cursor-pointer hover:bg-accent-soft transition-colors"
											onClick={() =>
												setExpandedSessionId(isExpanded ? null : session.id)
											}
										>
											<div className="flex items-center gap-3">
												<div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
												<div>
													<p className="font-normal">
														{session.command === "task"
															? `Task: ${session.taskId}`
															: `/${session.command}`}
													</p>
													<p className="text-sm text-muted-foreground">
														Agent: {session.agentId} &middot; PID: {session.pid}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-3">
												{runId && (
													<Badge
														variant="outline"
														className="text-[10px] bg-accent-soft text-accent border-accent/40"
													>
														Live
													</Badge>
												)}
												<div className="flex items-center gap-2 text-sm text-muted-foreground">
													<Clock className="h-4 w-4" />
													{formatRelativeTime(session.startedAt)}
												</div>
											</div>
										</div>
										{isExpanded && lookupLoading && (
											<div className="border-t px-3 py-4 text-center text-xs text-muted-foreground">
												Linking conversation...
											</div>
										)}
										{isExpanded && !lookupLoading && linkedConversationId && (
											<div className="border-t px-3 pb-3 pt-2 max-h-[500px] overflow-y-auto">
												<ConversationView
													conversationId={linkedConversationId}
													embed
												/>
											</div>
										)}
										{isExpanded &&
											!lookupLoading &&
											!linkedConversationId &&
											runId && (
												<div className="border-t px-3 pb-3 pt-2">
													<p className="text-center text-xs text-muted-foreground py-4">
														No conversation linked to this run (legacy run
														before unification)
													</p>
												</div>
											)}
										{isExpanded &&
											!lookupLoading &&
											!linkedConversationId &&
											!runId && (
												<div className="border-t px-3 py-4 text-center text-xs text-muted-foreground">
													No live stream available for this session
												</div>
											)}
									</div>
								);
							})}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Schedule */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Timer className="h-5 w-5" />
								Schedule
							</CardTitle>
							<CardDescription className="mt-1.5">
								Watches for task changes
								{!config.polling.enabled && " (disabled)"}
							</CardDescription>
						</div>
						<Tip content="Add a new scheduled skill">
							<Button
								variant="outline"
								size="sm"
								onClick={addScheduleEntry}
								className="gap-1.5"
							>
								<Plus className="h-3.5 w-3.5" />
								Add
							</Button>
						</Tip>
					</div>
				</CardHeader>
				<CardContent>
					{Object.keys(config.schedule).length === 0 ? (
						<p className="text-sm text-muted-foreground text-center py-6">
							No scheduled skills yet. Click &ldquo;Add&rdquo; to create one.
						</p>
					) : (
						<div className="space-y-2">
							{Object.entries(config.schedule).map(([name, schedule]) => (
								<div key={name} className="rounded-sm border p-3">
									{editingSchedule === name ? (
										/* Edit mode — calendar-like form */
										<div className="space-y-3">
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
												<div className="space-y-1.5">
													<p className="text-xs text-muted-foreground">
														Skill Command
													</p>
													<Select
														value={editCommand}
														onValueChange={setEditCommand}
													>
														<SelectTrigger className="h-8">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															{AVAILABLE_COMMANDS.map((cmd) => (
																<SelectItem key={cmd} value={cmd}>
																	/{cmd}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
												<div className="space-y-1.5">
													<p className="text-xs text-muted-foreground">
														Repeat
													</p>
													<Select
														value={editRepeat}
														onValueChange={(v) =>
															setEditRepeat(v as RepeatInterval)
														}
													>
														<SelectTrigger className="h-8">
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															{REPEAT_OPTIONS.map((opt) => (
																<SelectItem key={opt.value} value={opt.value}>
																	{opt.label}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
											</div>

											<div className="space-y-1.5">
												<p className="text-xs text-muted-foreground">
													Assigned Agent
												</p>
												<Select
													value={editAgentId}
													onValueChange={setEditAgentId}
												>
													<SelectTrigger className="h-8">
														<SelectValue placeholder="Select agent" />
													</SelectTrigger>
													<SelectContent>
														{agents.map((agent) => (
															<SelectItem key={agent.id} value={agent.id}>
																{agent.name}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>

											{editRepeat !== "custom" ? (
												<div className="space-y-1.5">
													<p className="text-xs text-muted-foreground">
														{editRepeat === "once"
															? "Run at"
															: "Start date & time"}
													</p>
													<Input
														type="datetime-local"
														className="h-8 text-sm"
														value={editStartAt}
														onChange={(e) => setEditStartAt(e.target.value)}
													/>
													{previewCron && (
														<p className="text-xs text-muted-foreground">
															Cron:{" "}
															<code className="font-mono">{previewCron}</code>
															{" · "}
															{scheduleToHuman({
																cron: previewCron,
																startAt: null,
															})}
														</p>
													)}
												</div>
											) : (
												<div className="space-y-1.5">
													<p className="text-xs text-muted-foreground">
														Cron expression
													</p>
													<Input
														className="h-8 font-mono text-sm"
														placeholder="0 9 * * *"
														value={editCron}
														onChange={(e) => setEditCron(e.target.value)}
													/>
												</div>
											)}

											<div className="flex justify-end gap-2">
												<Tip content="Discard changes">
													<Button
														variant="ghost"
														size="sm"
														onClick={cancelEditingSchedule}
													>
														<X className="h-3.5 w-3.5 mr-1" />
														Cancel
													</Button>
												</Tip>
												<Tip content="Save schedule changes">
													<Button
														size="sm"
														onClick={() => saveScheduleEntry(name)}
													>
														<Save className="h-3.5 w-3.5 mr-1" />
														Save
													</Button>
												</Tip>
											</div>
										</div>
									) : (
										/* View mode */
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<button
													type="button"
													onClick={() => toggleSchedule(name)}
													className="cursor-pointer"
													title={
														schedule.enabled
															? "Click to disable"
															: "Click to enable"
													}
												>
													<Badge
														variant={schedule.enabled ? "default" : "outline"}
														className="text-xs hover:opacity-80 transition-opacity"
													>
														{schedule.enabled ? "ON" : "OFF"}
													</Badge>
												</button>
												<div>
													<p className="font-normal">/{schedule.command}</p>
													<p className="text-xs text-muted-foreground">
														{scheduleToHuman({
															cron: schedule.cron,
															startAt: schedule.startAt,
														})}
														{schedule.agentId && (
															<>
																{" · "}
																<span className="text-xs">
																	Agent:{" "}
																	{agents.find((a) => a.id === schedule.agentId)
																		?.name ?? schedule.agentId}
																</span>
															</>
														)}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-1">
												{status.nextScheduledRuns[schedule.command] && (
													<span className="text-xs text-muted-foreground hidden sm:inline mr-1">
														Next:{" "}
														{new Date(
															status.nextScheduledRuns[schedule.command],
														).toLocaleString()}
													</span>
												)}
												<Tip content="Run now">
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7 text-muted-foreground hover:text-foreground"
														onClick={() => void runCommandNow(schedule.command)}
														disabled={runningCommands.has(schedule.command)}
													>
														<Play
															className={`h-3.5 w-3.5 ${runningCommands.has(schedule.command) ? "animate-pulse" : ""}`}
														/>
													</Button>
												</Tip>
												<Tip content="Edit schedule entry">
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7 text-muted-foreground"
														onClick={() => startEditingSchedule(name)}
													>
														<Pencil className="h-3.5 w-3.5" />
													</Button>
												</Tip>
												<Tip content="Remove schedule entry">
													<Button
														variant="ghost"
														size="icon"
														className="h-7 w-7 text-muted-foreground hover:text-destructive"
														onClick={() => removeScheduleEntry(name)}
													>
														<Trash2 className="h-3.5 w-3.5" />
													</Button>
												</Tip>
											</div>
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Editable Config */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<RefreshCw className="h-5 w-5" />
							Configuration
						</CardTitle>
						{!editingConfig && (
							<Tip content="Edit configuration">
								<Button
									variant="ghost"
									size="sm"
									onClick={startEditing}
									className="gap-1.5 text-muted-foreground"
								>
									<Pencil className="h-3.5 w-3.5" />
									Edit
								</Button>
							</Tip>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{editingConfig ? (
						<div className="space-y-4">
							<div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
								<div className="space-y-1.5">
									<p className="text-muted-foreground text-xs">
										Max Parallel Agents
									</p>
									<Input
										type="number"
										min={1}
										max={10}
										value={maxParallelAgents}
										onChange={(e) =>
											setMaxParallelAgents(
												Math.max(1, Math.min(10, Number(e.target.value) || 1)),
											)
										}
										className="h-8"
									/>
								</div>
								<div className="space-y-1.5">
									<p className="text-muted-foreground text-xs">
										Max Turns per Task
									</p>
									<Input
										type="number"
										min={1}
										max={100}
										value={maxTurns}
										onChange={(e) =>
											setMaxTurns(
												Math.max(1, Math.min(100, Number(e.target.value) || 1)),
											)
										}
										className="h-8"
									/>
								</div>
								<div className="space-y-1.5">
									<p className="text-muted-foreground text-xs">
										Timeout (minutes)
									</p>
									<Input
										type="number"
										min={1}
										max={120}
										value={timeoutMinutes}
										onChange={(e) =>
											setTimeoutMinutes(
												Math.max(1, Math.min(120, Number(e.target.value) || 1)),
											)
										}
										className="h-8"
									/>
								</div>
								<div className="space-y-1.5">
									<p className="text-muted-foreground text-xs">Retries</p>
									<Input
										type="number"
										min={0}
										max={5}
										value={retries}
										onChange={(e) =>
											setRetries(
												Math.max(0, Math.min(5, Number(e.target.value) || 0)),
											)
										}
										className="h-8"
									/>
								</div>
							</div>
							<div className="flex items-center justify-end gap-2 pt-2">
								<Tip content="Discard changes">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setEditingConfig(false)}
									>
										<X className="h-3.5 w-3.5 mr-1" />
										Cancel
									</Button>
								</Tip>
								<Tip content="Save configuration changes">
									<Button size="sm" onClick={saveConfig}>
										<Save className="h-3.5 w-3.5 mr-1" />
										Save
									</Button>
								</Tip>
							</div>
						</div>
					) : (
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
							<div>
								<p className="text-muted-foreground">Max Parallel Agents</p>
								<p className="font-normal">
									{config.concurrency.maxParallelAgents}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Max Turns per Task</p>
								<p className="font-normal">{config.execution.maxTurns}</p>
							</div>
							<div>
								<p className="text-muted-foreground">Timeout</p>
								<p className="font-normal">
									{config.execution.timeoutMinutes} min
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Retries</p>
								<p className="font-normal">{config.execution.retries}</p>
							</div>
						</div>
					)}
					{config.execution.allowedTools.length > 0 && (
						<div className="mt-4 flex items-center gap-2 rounded-sm border border-primary/30 bg-muted p-3 text-sm">
							<Zap className="h-4 w-4 text-primary shrink-0" />
							<span>
								<strong>Allowed tools:</strong>{" "}
								{config.execution.allowedTools.map((tool) => (
									<Badge key={tool} variant="outline" className="text-xs mr-1">
										{tool}
									</Badge>
								))}
							</span>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="text-xs text-muted-foreground underline decoration-dotted cursor-help ml-auto shrink-0">
										What is this?
									</span>
								</TooltipTrigger>
								<TooltipContent side="top" className="max-w-[280px]">
									<p className="text-xs">
										These tools are pre-approved for agents via{" "}
										<code className="text-[10px]">--allowedTools</code>. Edit{" "}
										<code className="text-[10px]">
											~/.mandio/daemon-config.json
										</code>{" "}
										to change.
									</p>
								</TooltipContent>
							</Tooltip>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
