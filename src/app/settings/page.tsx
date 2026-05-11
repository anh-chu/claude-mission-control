"use client";

import { Globe, Monitor, Moon, Rocket, Square, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { HomeLogs } from "@/components/home-logs";

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

function ScopeBadge({
	scope,
	name,
	color,
}: {
	scope: "global" | "workspace";
	name?: string;
	color?: string;
}) {
	if (scope === "global") {
		return (
			<Badge variant="secondary" className="gap-1">
				<Globe className="h-3 w-3" />
				Global
			</Badge>
		);
	}
	return (
		<Badge variant="outline" className="gap-1.5">
			<div
				className="h-2 w-2 rounded-full"
				style={{ backgroundColor: color ?? "#888" }}
			/>
			Workspace{name ? `: ${name}` : ""}
		</Badge>
	);
}

export default function SettingsPage() {
	const { currentWorkspace, loading } = useWorkspace();
	const {
		config,
		isRunning,
		isLoading: daemonLoading,
		updateConfig,
	} = useDaemon();

	const [pollingEnabled, setPollingEnabled] = useState(true);
	const [maxParallelAgents, setMaxParallelAgents] = useState(3);
	const [daemonSaving, setDaemonSaving] = useState(false);
	const [daemonSaved, setDaemonSaved] = useState(false);

	const { theme, setTheme } = useTheme();

	useEffect(() => {
		setPollingEnabled(config.polling.enabled);
		setMaxParallelAgents(config.concurrency.maxParallelAgents);
	}, [config]);

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
				<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-2 mb-1">
					Global
				</h2>
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between gap-2">
							<CardTitle>Appearance</CardTitle>
							<ScopeBadge scope="global" />
						</div>
						<CardDescription>
							Choose your preferred color theme.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-5">
						<div className="flex gap-2">
							<Button
								size="sm"
								variant={theme === "light" ? "default" : "outline"}
								className="gap-1.5"
								onClick={() => setTheme("light")}
							>
								<Sun className="h-4 w-4" /> Light
							</Button>
							<Button
								size="sm"
								variant={theme === "dark" ? "default" : "outline"}
								className="gap-1.5"
								onClick={() => setTheme("dark")}
							>
								<Moon className="h-4 w-4" /> Dark
							</Button>
							<Button
								size="sm"
								variant={theme === "system" ? "default" : "outline"}
								className="gap-1.5"
								onClick={() => setTheme("system")}
							>
								<Monitor className="h-4 w-4" /> System
							</Button>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className="flex items-center justify-between gap-2">
							<CardTitle>Workspaces</CardTitle>
							<CardDescription>
								Manage workspace names, colors, environment variables, and
								members.
							</CardDescription>
						</div>
					</CardHeader>
					<CardContent>
						<Button asChild size="sm" variant="outline">
							<Link href="/settings/workspaces">Manage workspaces →</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className="flex items-center justify-between gap-2">
							<CardTitle>Autopilot</CardTitle>
							<ScopeBadge
								scope="workspace"
								name={currentWorkspace?.name}
								color={currentWorkspace?.color}
							/>
						</div>
						<CardDescription>
							Background task execution, polling intervals, and concurrency
							limits for this workspace.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-5">
						<div className="flex items-center gap-3">
							{daemonLoading ? (
								<Badge variant="secondary">Checking...</Badge>
							) : isRunning ? (
								<Badge className="bg-warning-soft text-warning border-warning/30">
									Running
								</Badge>
							) : (
								<Badge variant="secondary">Stopped</Badge>
							)}
							<Button
								size="sm"
								variant={isRunning ? "outline" : "default"}
								className="gap-1.5"
								onClick={() =>
									void updateConfig({
										polling: { enabled: !config.polling.enabled },
									})
								}
							>
								{isRunning ? (
									<>
										<Square className="h-3.5 w-3.5" /> Disable
									</>
								) : (
									<>
										<Rocket className="h-3.5 w-3.5" /> Enable
									</>
								)}
							</Button>
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
								size="sm"
								onClick={() => void handleDaemonSave()}
								disabled={daemonSaving}
							>
								{daemonSaved ? "Saved" : daemonSaving ? "Saving..." : "Save"}
							</Button>
						</div>
					</CardContent>
				</Card>

				<h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-6 mb-1">
					Diagnostics
				</h2>
				<Card>
					<CardHeader>
						<CardTitle>System Logs</CardTitle>
						<CardDescription>
							System output, active runs, and per-run consoles.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<HomeLogs />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
