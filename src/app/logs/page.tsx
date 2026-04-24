"use client";

import {
	Activity,
	BarChart3,
	Bot,
	Code,
	Megaphone,
	Pause,
	Play,
	Radio,
	Search,
	User,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { AgentConsole } from "@/components/agent-console";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { GridSkeleton, RowSkeleton } from "@/components/skeletons";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActivityLog } from "@/hooks/use-data";
import { apiFetch } from "@/lib/api-client";
import type { ActivityEvent, EventType } from "@/lib/types";
import { AGENT_ROLES } from "@/lib/types";
import { useActiveRunsContext as useActiveRuns } from "@/providers/active-runs-provider";

interface LogResponse {
	lines?: string[];
	error?: string | null;
}

interface LogState {
	lines: string[];
	error: string | null;
	isLoading: boolean;
}

type TabValue = "all" | "daemon" | "app" | "runs" | "activity";

const agentIcons: Record<string, typeof User> = {
	me: User,
	researcher: Search,
	developer: Code,
	marketer: Megaphone,
	"business-analyst": BarChart3,
	system: Bot,
};

const eventTypeLabels: Record<EventType, string> = {
	task_created: "Task Created",
	task_updated: "Task Updated",
	task_completed: "Task Completed",
	task_delegated: "Task Delegated",
	task_failed: "Task Failed",
	message_sent: "Message Sent",
	decision_requested: "Decision Requested",
	decision_answered: "Decision Answered",
	brain_dump_triaged: "Quick Capture Processed",
	milestone_completed: "Milestone Completed",
	agent_checkin: "Agent Check-in",
};

const eventTypeColors: Record<EventType, string> = {
	task_created: "bg-blue-500/20 text-blue-400",
	task_updated: "bg-purple-500/20 text-purple-400",
	task_completed: "bg-green-500/20 text-green-400",
	task_delegated: "bg-orange-500/20 text-orange-400",
	task_failed: "bg-red-500/20 text-red-400",
	message_sent: "bg-cyan-500/20 text-cyan-400",
	decision_requested: "bg-yellow-500/20 text-yellow-400",
	decision_answered: "bg-emerald-500/20 text-emerald-400",
	brain_dump_triaged: "bg-pink-500/20 text-pink-400",
	milestone_completed: "bg-green-500/20 text-green-400",
	agent_checkin: "bg-indigo-500/20 text-indigo-400",
};

function groupByDate(events: ActivityEvent[]): Map<string, ActivityEvent[]> {
	const groups = new Map<string, ActivityEvent[]>();
	const today = new Date().toDateString();
	const yesterday = new Date(Date.now() - 86400000).toDateString();

	for (const event of events) {
		const dateStr = new Date(event.timestamp).toDateString();
		let label: string;
		if (dateStr === today) label = "Today";
		else if (dateStr === yesterday) label = "Yesterday";
		else
			label = new Date(event.timestamp).toLocaleDateString("en-US", {
				weekday: "short",
				month: "short",
				day: "numeric",
			});

		if (!groups.has(label)) groups.set(label, []);
		groups.get(label)?.push(event);
	}
	return groups;
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

function getStatusBadgeClass(status: string): string {
	switch (status) {
		case "running":
			return "bg-green-600 text-white";
		case "completed":
			return "bg-blue-600 text-white";
		case "failed":
			return "bg-red-600 text-white";
		case "timeout":
			return "bg-amber-500 text-black";
		default:
			return "";
	}
}

function getErrorExcerpt(error: string | null | undefined): string {
	if (!error) return "No error details recorded.";
	return error.length > 500 ? `${error.slice(0, 500)}...` : error;
}

function filterLines(lines: string[], search: string): string[] {
	if (!search) return lines;
	const q = search.toLowerCase();
	return lines.filter((line) => line.toLowerCase().includes(q));
}

const INITIAL_LOG_STATE: LogState = { lines: [], error: null, isLoading: true };

function LogTailCard({
	title,
	description,
	emptyMessage,
	lines,
	isLoading,
	error,
	liveLines,
	preRef,
}: {
	title: string;
	description: string;
	emptyMessage: string;
	lines: string[];
	isLoading: boolean;
	error: string | null;
	liveLines: string[];
	preRef?: React.RefObject<HTMLPreElement | null>;
}) {
	const allLines = liveLines.length > 0 ? [...lines, ...liveLines] : lines;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<p className="text-sm text-muted-foreground">Loading log...</p>
				) : error ? (
					<p className="text-sm text-red-500">{error}</p>
				) : allLines.length === 0 ? (
					<p className="text-sm text-muted-foreground">{emptyMessage}</p>
				) : (
					<pre
						ref={preRef}
						className="max-h-[420px] overflow-auto rounded-lg border bg-muted/30 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words"
					>
						{allLines.join("\n")}
					</pre>
				)}
			</CardContent>
		</Card>
	);
}

export default function LogsPage() {
	const searchParams = useSearchParams();
	const { runs } = useActiveRuns();
	const [daemonLog, setDaemonLog] = useState<LogState>(INITIAL_LOG_STATE);
	const [appLog, setAppLog] = useState<LogState>(INITIAL_LOG_STATE);
	const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
	const [tab, setTab] = useState<TabValue>(
		searchParams.get("tab") === "activity" ? "activity" : "all",
	);
	const [search, setSearch] = useState("");
	const [filterActor, setFilterActor] = useState<string>("all");
	const [filterType, setFilterType] = useState<string>("all");
	const {
		events: activityEvents,
		loading: activityLoading,
		error: activityError,
		refetch: activityRefetch,
	} = useActivityLog();
	const [live, setLive] = useState(false);
	const [paused, setPaused] = useState(false);
	const [liveLines, setLiveLines] = useState<string[]>([]);
	const eventSourceRef = useRef<EventSource | null>(null);
	const pausedRef = useRef(false);
	const daemonPreRef = useRef<HTMLPreElement | null>(null);

	// Keep pausedRef in sync with paused state
	useEffect(() => {
		pausedRef.current = paused;
	}, [paused]);

	// Polling fetch for log tails
	useEffect(() => {
		let isMounted = true;

		async function fetchLog(
			url: string,
			setLog: Dispatch<SetStateAction<LogState>>,
			label: string,
		) {
			try {
				const response = await apiFetch(url);
				if (!response.ok) {
					if (!isMounted) return;
					setLog((current) => ({
						...current,
						error: `Failed to load ${label}.`,
						isLoading: false,
					}));
					return;
				}
				const data = (await response.json()) as LogResponse;
				if (!isMounted) return;
				setLog({
					lines: Array.isArray(data.lines) ? data.lines : [],
					error: data.error ?? null,
					isLoading: false,
				});
			} catch {
				if (!isMounted) return;
				setLog((current) => ({
					...current,
					error: `Failed to load ${label}.`,
					isLoading: false,
				}));
			}
		}

		async function fetchLogs() {
			await Promise.all([
				fetchLog("/api/logs/daemon?lines=50", setDaemonLog, "daemon log"),
				fetchLog("/api/logs/app?lines=50", setAppLog, "app log"),
			]);
		}

		void fetchLogs();
		const interval = setInterval(() => {
			void fetchLogs();
		}, 5000);
		return () => {
			isMounted = false;
			clearInterval(interval);
		};
	}, []);

	// SSE live streaming
	useEffect(() => {
		if (!live) {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}
			setLiveLines([]);
			return;
		}

		const es = new EventSource("/api/logs/stream?file=daemon");
		eventSourceRef.current = es;

		es.onmessage = (event) => {
			if (pausedRef.current) return;
			try {
				const line = JSON.parse(event.data) as string;
				setLiveLines((prev) => [...prev.slice(-200), line]);
				// Auto-scroll
				requestAnimationFrame(() => {
					if (daemonPreRef.current) {
						daemonPreRef.current.scrollTop = daemonPreRef.current.scrollHeight;
					}
				});
			} catch {
				// Ignore malformed events
			}
		};

		es.onerror = () => {
			es.close();
			eventSourceRef.current = null;
			setLive(false);
		};

		return () => {
			es.close();
			eventSourceRef.current = null;
		};
	}, [live]);

	const toggleLive = useCallback(() => {
		setLive((prev) => !prev);
		setPaused(false);
	}, []);

	const searchQuery = search.trim();

	const filteredDaemonLines = filterLines(daemonLog.lines, searchQuery);
	const filteredAppLines = filterLines(appLog.lines, searchQuery);
	const filteredLiveLines = filterLines(liveLines, searchQuery);

	const filteredRuns = searchQuery
		? runs.filter((run) => {
				const q = searchQuery.toLowerCase();
				return (
					run.agentId.toLowerCase().includes(q) ||
					run.taskId.toLowerCase().includes(q) ||
					run.id.toLowerCase().includes(q) ||
					(run.source?.toLowerCase().includes(q) ?? false)
				);
			})
		: runs;

	const failedRuns = filteredRuns.filter(
		(run) => (run.status === "failed" || run.status === "timeout") && run.error,
	);

	const showDaemon = tab === "all" || tab === "daemon";
	const showApp = tab === "all" || tab === "app";
	const showRuns = tab === "all" || tab === "runs";
	const showActivity = tab === "activity";

	return (
		<div className="space-y-6">
			<BreadcrumbNav items={[{ label: "Logs" }]} />

			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold tracking-tight">Runtime Logs</h1>
					<p className="text-sm text-muted-foreground">
						Live daemon output, active runs, and quick access to per-run
						consoles.
					</p>
				</div>
				<div className="flex items-center gap-2">
					{live && (
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setPaused((p) => !p)}
						>
							{paused ? (
								<Play className="h-3.5 w-3.5" />
							) : (
								<Pause className="h-3.5 w-3.5" />
							)}
						</Button>
					)}
					<Button
						size="sm"
						variant={live ? "default" : "outline"}
						onClick={toggleLive}
						className="gap-1.5"
					>
						<Radio className={`h-3.5 w-3.5 ${live ? "animate-pulse" : ""}`} />
						{live ? "Live" : "Live"}
					</Button>
					<Badge variant="outline" className="text-xs">
						{runs.length} run{runs.length === 1 ? "" : "s"}
					</Badge>
				</div>
			</div>

			<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
				<Tabs
					value={tab}
					onValueChange={(v) => setTab(v as TabValue)}
					className="w-full sm:w-auto"
				>
					<TabsList>
						<TabsTrigger value="all">All</TabsTrigger>
						<TabsTrigger value="daemon">Daemon</TabsTrigger>
						<TabsTrigger value="app">App</TabsTrigger>
						<TabsTrigger value="runs">Runs</TabsTrigger>
						<TabsTrigger value="activity">Activity</TabsTrigger>
					</TabsList>
				</Tabs>
				<Input
					placeholder="Search logs and runs..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="sm:max-w-xs"
				/>
			</div>

			{(showDaemon || showApp) && (
				<div
					className={`grid gap-6 ${showDaemon && showApp ? "xl:grid-cols-2" : ""}`}
				>
					{showDaemon && (
						<LogTailCard
							title="Daemon Log Tail"
							description={
								live
									? "Streaming live. New lines appear in real-time."
									: "Last 50 lines. Refreshes every 5 seconds."
							}
							emptyMessage="No daemon log lines available yet."
							lines={filteredDaemonLines}
							isLoading={daemonLog.isLoading}
							error={daemonLog.error}
							liveLines={live ? filteredLiveLines : []}
							preRef={daemonPreRef}
						/>
					)}
					{showApp && (
						<LogTailCard
							title="App Log Tail"
							description="Last 50 lines from the app log. Refreshes every 5 seconds."
							emptyMessage="No app log lines available yet."
							lines={filteredAppLines}
							isLoading={appLog.isLoading}
							error={appLog.error}
							liveLines={[]}
						/>
					)}
				</div>
			)}

			{showRuns && (
				<div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
					<Card>
						<CardHeader>
							<CardTitle>Active and Recent Runs</CardTitle>
							<CardDescription>
								Current background work from the active runs registry.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{filteredRuns.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No active or recent runs found.
								</p>
							) : (
								<div className="space-y-3">
									{filteredRuns.map((run) => (
										<div
											key={run.id}
											className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-start md:justify-between"
										>
											<div className="space-y-1">
												<div className="flex flex-wrap items-center gap-2">
													<p className="font-medium text-sm">{run.agentId}</p>
													<Badge
														variant="secondary"
														className={getStatusBadgeClass(run.status)}
													>
														{run.status}
													</Badge>
													{run.taskId ? (
														<Badge variant="outline" className="text-xs">
															Task {run.taskId}
														</Badge>
													) : null}
													{run.source ? (
														<Badge
															variant="outline"
															className="text-xs capitalize"
														>
															{run.source.replace(/-/g, " ")}
														</Badge>
													) : null}
												</div>
												<p className="text-xs text-muted-foreground break-all">
													Run ID: {run.id}
												</p>
												<p className="text-xs text-muted-foreground">
													Started {formatRelativeTime(run.startedAt)}
													{run.pid > 0 ? ` · PID ${run.pid}` : ""}
												</p>
											</div>
											<div className="flex items-center gap-2">
												<Button
													size="sm"
													variant="outline"
													onClick={() => setSelectedRunId(run.id)}
												>
													Open Console
												</Button>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Recent Failures</CardTitle>
							<CardDescription>
								Bounded error excerpts for failed or timed out runs.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{failedRuns.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No failed runs recorded.
								</p>
							) : (
								<div className="space-y-3">
									{failedRuns.map((run) => (
										<div
											key={run.id}
											className="rounded-lg border border-red-500/20 bg-red-500/5 p-4"
										>
											<div className="mb-2 flex flex-wrap items-center gap-2">
												<p className="font-medium text-sm">{run.agentId}</p>
												<Badge variant="destructive" className="capitalize">
													{run.status}
												</Badge>
												{run.source ? (
													<Badge
														variant="outline"
														className="text-xs capitalize"
													>
														{run.source.replace(/-/g, " ")}
													</Badge>
												) : null}
											</div>
											<p className="mb-2 text-xs text-muted-foreground">
												{run.taskId ? `Task ${run.taskId}` : "Unlinked run"} ·
												Started {formatRelativeTime(run.startedAt)}
											</p>
											<pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-red-950 dark:text-red-100">
												{getErrorExcerpt(run.error)}
											</pre>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			)}

			{showActivity && (
				<div className="space-y-6">
					{activityLoading ? (
						<GridSkeleton
							className="space-y-2"
							count={5}
							renderItem={() => (
								<RowSkeleton
									className="items-start py-2"
									leading={[
										{ key: "label", className: "h-5 w-16 rounded-full" },
									]}
									lines={[
										{ key: "title", className: "h-4 w-3/4" },
										{ key: "subtitle", className: "h-3 w-1/3" },
									]}
									linesClassName="flex-1 space-y-1"
									trailing={[{ key: "time", className: "h-3 w-16" }]}
								/>
							)}
						/>
					) : activityError ? (
						<ErrorState message={activityError} onRetry={activityRefetch} />
					) : (
						(() => {
							let filtered = [...activityEvents].sort(
								(a, b) =>
									new Date(b.timestamp).getTime() -
									new Date(a.timestamp).getTime(),
							);
							if (filterActor !== "all") {
								filtered = filtered.filter((e) => e.actor === filterActor);
							}
							if (filterType !== "all") {
								filtered = filtered.filter((e) => e.type === filterType);
							}
							if (searchQuery) {
								filtered = filtered.filter((e) =>
									e.summary.toLowerCase().includes(searchQuery.toLowerCase()),
								);
							}
							const grouped = groupByDate(filtered);
							return (
								<>
									<div className="flex items-center gap-3">
										<Select value={filterActor} onValueChange={setFilterActor}>
											<SelectTrigger className="w-40 h-8 text-xs">
												<SelectValue placeholder="All actors" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">All actors</SelectItem>
												{AGENT_ROLES.map((r) => (
													<SelectItem key={r.id} value={r.id}>
														{r.label}
													</SelectItem>
												))}
												<SelectItem value="system">System</SelectItem>
											</SelectContent>
										</Select>
										<Select value={filterType} onValueChange={setFilterType}>
											<SelectTrigger className="w-44 h-8 text-xs">
												<SelectValue placeholder="All types" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">All types</SelectItem>
												{(Object.keys(eventTypeLabels) as EventType[]).map(
													(type) => (
														<SelectItem key={type} value={type}>
															{eventTypeLabels[type]}
														</SelectItem>
													),
												)}
											</SelectContent>
										</Select>
									</div>
									{Array.from(grouped.entries()).map(
										([dateLabel, dateEvents]) => (
											<section key={dateLabel} className="space-y-2">
												<h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
													{dateLabel}
												</h2>
												<div className="space-y-1.5">
													{dateEvents.map((evt) => {
														const ActorIcon = agentIcons[evt.actor] ?? User;
														const actorLabel =
															evt.actor === "system"
																? "System"
																: (AGENT_ROLES.find((r) => r.id === evt.actor)
																		?.label ?? evt.actor);
														return (
															<Card key={evt.id} className="bg-card/50">
																<CardContent className="p-3 flex items-start gap-3">
																	<div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
																		<ActorIcon className="h-3.5 w-3.5 text-muted-foreground" />
																	</div>
																	<div className="flex-1 min-w-0">
																		<div className="flex items-center gap-2">
																			<Badge
																				className={`text-xs px-1.5 ${eventTypeColors[evt.type]}`}
																			>
																				{eventTypeLabels[evt.type]}
																			</Badge>
																			<span className="text-xs text-muted-foreground">
																				{actorLabel}
																			</span>
																			<span className="text-xs text-muted-foreground ml-auto shrink-0">
																				{new Date(
																					evt.timestamp,
																				).toLocaleTimeString([], {
																					hour: "2-digit",
																					minute: "2-digit",
																				})}
																			</span>
																		</div>
																		<p className="text-sm mt-1">
																			{evt.summary}
																		</p>
																		{evt.details && (
																			<p className="text-xs text-muted-foreground mt-0.5">
																				{evt.details}
																			</p>
																		)}
																	</div>
																</CardContent>
															</Card>
														);
													})}
												</div>
											</section>
										),
									)}
									{filtered.length === 0 && (
										<EmptyState
											icon={Activity}
											title="No activity yet"
											description="Actions taken by you and your AI agents will be logged here."
										/>
									)}
								</>
							);
						})()
					)}
				</div>
			)}

			{selectedRunId ? (
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between gap-3">
							<div>
								<CardTitle>Run Console</CardTitle>
								<CardDescription>
									Live stream for run {selectedRunId}
								</CardDescription>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setSelectedRunId(null)}
							>
								Close
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						<AgentConsole runId={selectedRunId} />
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
