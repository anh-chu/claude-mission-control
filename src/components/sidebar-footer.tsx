"use client";

import { AlertTriangle, Circle, OctagonX } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDaemon } from "@/hooks/use-daemon";
import { apiFetch } from "@/lib/api-client";
import { showError, showSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface SidebarFooterProps {
	collapsed: boolean;
}

function formatUptime(minutes: number): string {
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function SidebarFooter({ collapsed }: SidebarFooterProps) {
	const [killDialogOpen, setKillDialogOpen] = useState(false);
	const [killLoading, setKillLoading] = useState(false);

	const { status: daemonStatus, start, stop } = useDaemon();

	async function handleEmergencyStop() {
		setKillLoading(true);
		try {
			const res = await apiFetch("/api/emergency-stop", {
				method: "POST",
			});
			if (!res.ok) throw new Error("Request failed");
			showSuccess(
				"Emergency stop completed — all autonomous operations halted",
			);
			setKillDialogOpen(false);
		} catch {
			showError("Emergency stop failed");
		} finally {
			setKillLoading(false);
		}
	}

	const statusDotButton = (
		<Popover>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="flex items-center justify-center h-8 w-8 rounded-sm hover:bg-muted transition-colors"
							aria-label="Daemon status"
						>
							<Circle
								className={cn(
									"h-2.5 w-2.5 fill-current",
									daemonStatus.status === "running"
										? "text-success animate-pulse"
										: daemonStatus.status === "starting"
											? "text-warning animate-pulse"
											: "text-muted-foreground",
								)}
							/>
						</button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent side={collapsed ? "right" : "top"}>
					{daemonStatus.status === "running"
						? "Daemon running"
						: daemonStatus.status === "starting"
							? "Daemon starting"
							: "Daemon stopped"}
				</TooltipContent>
			</Tooltip>
			<PopoverContent side="top" align="start" className="w-72">
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<h4 className="text-sm font-normal">Daemon Status</h4>
						<Badge
							className={cn(
								daemonStatus.status === "running"
									? "bg-success-soft text-success border-success/25"
									: daemonStatus.status === "starting"
										? "bg-warning-soft text-warning border-warning/25"
										: "bg-muted text-muted-foreground border-muted",
							)}
						>
							{daemonStatus.status === "running"
								? "Running"
								: daemonStatus.status === "starting"
									? "Starting"
									: "Stopped"}
						</Badge>
					</div>

					{daemonStatus.status === "running" && (
						<div className="text-xs text-muted-foreground space-y-1">
							<p>
								Active Sessions:{" "}
								<strong className="text-foreground">
									{daemonStatus.activeSessions.length}
								</strong>
							</p>
							<p>
								Tasks Completed:{" "}
								<strong className="text-foreground">
									{daemonStatus.stats.tasksCompleted}
								</strong>
							</p>
							<p>
								Uptime:{" "}
								<strong className="text-foreground">
									{formatUptime(daemonStatus.stats.uptimeMinutes)}
								</strong>
							</p>
						</div>
					)}

					<Separator />

					<Button
						className="w-full"
						variant={
							daemonStatus.status === "running" ? "destructive" : "default"
						}
						size="sm"
						onClick={() =>
							daemonStatus.status === "running" ? stop() : start()
						}
						disabled={daemonStatus.status === "starting"}
					>
						{daemonStatus.status === "running" ? "Stop Daemon" : "Start Daemon"}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);

	const killSwitchButton = (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					className="flex items-center justify-center h-8 w-8 rounded-sm text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors"
					onClick={() => setKillDialogOpen(true)}
					aria-label="Emergency Stop"
				>
					<OctagonX className="h-4 w-4" />
				</button>
			</TooltipTrigger>
			<TooltipContent side={collapsed ? "right" : "top"}>
				Emergency Stop
			</TooltipContent>
		</Tooltip>
	);

	return (
		<>
			{collapsed ? (
				<div className="border-t p-2 flex flex-col items-center gap-1">
					{statusDotButton}
					{killSwitchButton}
					<ThemeToggle />
				</div>
			) : (
				<div className="border-t p-3 flex items-center gap-2">
					<p className="text-xs text-sidebar-foreground/40 flex-1">
						Mandio v0.10
					</p>
					{statusDotButton}
					{killSwitchButton}
					<ThemeToggle />
				</div>
			)}

			<Dialog open={killDialogOpen} onOpenChange={setKillDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 text-destructive" />
							Emergency Stop
						</DialogTitle>
						<DialogDescription>
							This will immediately halt all autonomous operations:
						</DialogDescription>
					</DialogHeader>

					<ul className="list-disc pl-6 text-sm space-y-1">
						<li>Stop the Autopilot daemon</li>
						<li>Pause all active initiatives</li>

						<li>Log the emergency stop event</li>
					</ul>

					<p className="text-sm text-muted-foreground">
						The app will remain usable. You can review activity and selectively
						restart operations.
					</p>

					<DialogFooter>
						<Button
							variant="ghost"
							onClick={() => setKillDialogOpen(false)}
							disabled={killLoading}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleEmergencyStop}
							disabled={killLoading}
						>
							{killLoading ? "Stopping..." : "Emergency Stop"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
