"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandBar } from "@/components/command-bar";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { SearchDialog } from "@/components/search-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useConnection } from "@/hooks/use-connection";
import { useSidebar } from "@/hooks/use-sidebar";
import { apiFetch } from "@/lib/api-client";
import { showError, showSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ActiveRunsProvider } from "@/providers/active-runs-provider";

interface LayoutShellProps {
	children: React.ReactNode;
}

export function LayoutShell({ children }: LayoutShellProps) {
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [isMobile, setIsMobile] = useState(false);
	const pathname = usePathname();
	const router = useRouter();
	const { tasks, unreadInbox, pendingDecisions } = useSidebar();
	const { online } = useConnection();

	// Detect mobile viewport and auto-close sidebar
	useEffect(() => {
		const checkMobile = () => {
			const mobile = window.innerWidth < 768;
			setIsMobile(mobile);
			if (mobile) setSidebarOpen(false);
		};
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	// Auto-close sidebar on mobile when navigating
	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname is intentional trigger for route changes
	useEffect(() => {
		if (isMobile) setSidebarOpen(false);
	}, [pathname, isMobile]);

	const handleCapture = useCallback(async (content: string) => {
		try {
			const res = await apiFetch("/api/brain-dump", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content,
					capturedAt: new Date().toISOString(),
					processed: false,
					convertedTo: null,
					tags: [],
				}),
			});
			if (!res.ok) throw new Error("Failed to capture");
			showSuccess("Entry created");
		} catch {
			showError("Failed to capture entry");
		}
	}, []);

	return (
		<TooltipProvider delayDuration={300}>
			<div className="min-h-screen bg-background">
				<a href="#main-content" className="skip-to-content">
					Skip to content
				</a>
				<KeyboardShortcuts />
				<SearchDialog />
				<CommandBar
					onCapture={handleCapture}
					sidebarOpen={sidebarOpen}
					onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
					isMobile={isMobile}
					tasks={tasks}
					onTaskClick={() => {
						// Navigate to Priority Matrix view which shows the task in context
						router.push("/priority-matrix");
					}}
				/>

				{/* Mobile sidebar backdrop */}
				{isMobile && sidebarOpen && (
					<button
						type="button"
						aria-label="Close sidebar"
						className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
						onClick={() => setSidebarOpen(false)}
					/>
				)}

				<AppSidebar
					collapsed={!sidebarOpen}
					unreadInbox={unreadInbox}
					pendingDecisions={pendingDecisions}
					isMobile={isMobile}
					onClose={() => setSidebarOpen(false)}
				/>
				<main
					id="main-content"
					className={cn(
						"min-h-[calc(100vh-3.5rem)] transition-all duration-200 p-4 md:p-6",
						isMobile ? "ml-0" : sidebarOpen ? "ml-56" : "ml-14",
					)}
				>
					{!online && (
						<div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs text-center py-2 px-3 flex items-center justify-center gap-2">
							<span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
							Connection lost — changes may not save. Retrying automatically...
						</div>
					)}
					<ActiveRunsProvider>{children}</ActiveRunsProvider>
				</main>
			</div>
		</TooltipProvider>
	);
}
