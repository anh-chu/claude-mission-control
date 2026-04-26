"use client";

import { AlertTriangle, Circle, OctagonX } from "lucide-react";
import { useEffect, useState } from "react";
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
import { apiFetch } from "@/lib/api-client";
import { showError, showSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface SidebarFooterProps {
	collapsed: boolean;
}

interface ServerStatus {
	mode: "pm2" | "terminal";
	uptimeSeconds: number;
	pid: number;
}

function formatUptime(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function SidebarFooter({ collapsed }: SidebarFooterProps) {
	const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
	const [killDialogOpen, setKillDialogOpen] = useState(false);
	const [killLoading, setKillLoading] = useState(false);

	// Fetch server mode once on mount (PM2 mode doesn't change at runtime)
	useEffect(() => {
		apiFetch("/api/server-status")
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data) setServerStatus(data as ServerStatus);
			})
			.catch(() => {});
	}, []);

	const isPm2 = serverStatus?.mode === "pm2";

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
							className="flex items-center justify-center h-8 w-8 rounded-sm hover:bg-accent transition-colors"
							aria-label="Server mode"
						>
							<Circle
								className={cn(
									"h-2.5 w-2.5 fill-current",
									isPm2
										? "text-accent animate-pulse"
										: "text-muted-foreground",
								)}
							/>
						</button>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipContent side={collapsed ? "right" : "top"}>
					{isPm2 ? "Always-on (PM2)" : "Terminal mode"}
				</TooltipContent>
			</Tooltip>
			<PopoverContent side="top" align="start" className="w-72">
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<h4 className="text-sm font-normal">Server Mode</h4>
						<Badge
							className={cn(
								isPm2
									? "bg-accent/15 text-accent border-accent/25"
									: "bg-muted/50 text-muted-foreground border-muted",
							)}
						>
							{isPm2 ? "Always-on (PM2)" : "Terminal"}
						</Badge>
					</div>

					{serverStatus && (
						<div className="text-xs text-muted-foreground space-y-1">
							<p>Uptime: {formatUptime(serverStatus.uptimeSeconds)}</p>
						</div>
					)}

					<p className="text-xs text-muted-foreground">
						{isPm2
							? "Running continuously with auto-restart. The server persists across terminal sessions and restarts on crashes."
							: "Running in a terminal session. The server stops when the terminal closes. Use PM2 for always-on operation."}
					</p>

					<Separator />

					<div className="space-y-2">
						<p className="text-xs font-normal">Server Management</p>
						<p className="text-xs text-muted-foreground">
							For continuous operation, run with PM2. The server auto-restarts
							on crashes.
						</p>
						<div className="space-y-1.5">
							<p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-normal">
								Always-on mode (PM2)
							</p>
							<code className="block text-xs bg-muted px-2 py-1 rounded-sm font-mono">
								pm2 start ecosystem.config.js
							</code>
							<p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-normal mt-2">
								Terminal mode
							</p>
							<code className="block text-xs bg-muted px-2 py-1 rounded-sm font-mono">
								pnpm dev
							</code>
							<p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-normal mt-2">
								Stop PM2 server
							</p>
							<code className="block text-xs bg-muted px-2 py-1 rounded-sm font-mono">
								pm2 stop mission-control
							</code>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);

	const killSwitchButton = (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
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
						Task Control v0.10
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
