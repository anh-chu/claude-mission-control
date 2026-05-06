"use client";

import { Pause, Play, Radio } from "lucide-react";
import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { DaemonRunViewer } from "@/components/chat/DaemonRunViewer";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api-client";

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

type TabValue = "all" | "daemon" | "app" | "runs";

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
			return "bg-sunshine-700 text-white";
		case "completed":
			return "bg-success text-white";
		case "failed":
			return "bg-destructive text-white";
		case "timeout":
			return "bg-warning text-black";
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
					<p className="text-sm text-destructive">{error}</p>
				) : allLines.length === 0 ? (
					<p className="text-sm text-muted-foreground">{emptyMessage}</p>
				) : (
					<pre
						ref={preRef}
						className="max-h-[420px] overflow-auto rounded-sm border bg-muted p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words"
					>
						{allLines.join("\n")}
					</pre>
				)}
			</CardContent>
		</Card>
	);
}

export default function LogsPage() {
	const { runs } = useActiveRuns();
	const [daemonLog, setDaemonLog] = useState<LogState>(INITIAL_LOG_STATE);
	const [appLog, setAppLog] = useState<LogState>(INITIAL_LOG_STATE);
	const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
	const [tab, setTab] = useState<TabValue>("all");
	const [search, setSearch] = useState("");
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

	return (
		<div className="space-y-6">
			<BreadcrumbNav items={[{ label: "Ops / Debug" }]} />

			<div className="flex items-center justify-between gap-4">
				<div>
					<h1 className="text-xl font-normal">Ops / Debug</h1>
					<p className="text-sm text-muted-foreground">
						System output, active runs, and per-run consoles.
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
							title="System Log Tail"
							description={
								live
									? "Streaming live. New lines appear in real-time."
									: "Last 50 lines. Refreshes every 5 seconds."
							}
							emptyMessage="No system log lines available yet."
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
											className="flex flex-col gap-3 rounded-sm border p-4 md:flex-row md:items-start md:justify-between"
										>
											<div className="space-y-1">
												<div className="flex flex-wrap items-center gap-2">
													<p className="font-normal text-sm">{run.agentId}</p>
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
											className="rounded-sm border border-destructive/20 bg-destructive-soft p-4"
										>
											<div className="mb-2 flex flex-wrap items-center gap-2">
												<p className="font-normal text-sm">{run.agentId}</p>
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
											<pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-destructive dark:text-destructive-foreground">
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
						<DaemonRunViewer runId={selectedRunId} />
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
