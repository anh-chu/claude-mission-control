"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AutopilotPage } from "@/components/autopilot-page";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { HomeLogs } from "@/components/home-logs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function OpsPage() {
	const searchParams = useSearchParams();
	const tab = searchParams.get("tab") ?? "logs";

	return (
		<div className="flex flex-col gap-6">
			<BreadcrumbNav items={[{ label: "Ops" }]} />

			<div className="flex items-center gap-0.5 -mt-2">
				<Link
					href="/ops?tab=logs"
					className={cn(
						"px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
						tab === "logs"
							? "bg-accent text-accent-foreground"
							: "text-muted-foreground hover:bg-accent/50",
					)}
				>
					Logs
				</Link>
				<Link
					href="/ops?tab=autopilot"
					className={cn(
						"px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
						tab === "autopilot"
							? "bg-accent text-accent-foreground"
							: "text-muted-foreground hover:bg-accent/50",
					)}
				>
					Autopilot
				</Link>
				<Link
					href="/ops?tab=runs"
					className={cn(
						"px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
						tab === "runs"
							? "bg-accent text-accent-foreground"
							: "text-muted-foreground hover:bg-accent/50",
					)}
				>
					Runs
				</Link>
			</div>

			{tab === "logs" && <HomeLogs />}
			{tab === "autopilot" && <AutopilotPage />}
			{tab === "runs" && (
				<Card>
					<CardHeader>
						<CardTitle>Runs</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							Coming soon — active and historical runs across all workspaces.
						</p>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
