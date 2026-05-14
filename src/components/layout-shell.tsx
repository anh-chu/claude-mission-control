"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ActivePanel } from "@/components/activity-rail";
import { ActivityRail } from "@/components/activity-rail";
import { CommandBar } from "@/components/command-bar";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { RightPanel } from "@/components/right-panel";
import { SearchDialog } from "@/components/search-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useConnection } from "@/hooks/use-connection";
import { useCommands } from "@/hooks/use-data";
import { useSidebar } from "@/hooks/use-sidebar";
import { useWorkspace } from "@/hooks/use-workspace";
import { apiFetch } from "@/lib/api-client";
import { showError, showSuccess } from "@/lib/toast";
import { ActiveRunsProvider } from "@/providers/active-runs-provider";

const ACTIVE_PANEL_KEY = "mandio.right-panel.active";

interface LayoutShellProps {
	children: React.ReactNode;
}

export function LayoutShell({ children }: LayoutShellProps) {
	const [activePanel, setActivePanel] = useState<ActivePanel>(null);
	const [isMobile, setIsMobile] = useState(false);
	const _pathname = usePathname();
	const router = useRouter();
	const { tasks } = useSidebar();
	const { online } = useConnection();
	const { currentId: workspaceId } = useWorkspace();
	const { commands } = useCommands(workspaceId);

	// Restore panel state from localStorage
	useEffect(() => {
		try {
			const stored = localStorage.getItem(ACTIVE_PANEL_KEY);
			if (stored === "chat" || stored === "terminal") {
				setActivePanel(stored);
			}
		} catch {
			// localStorage unavailable
		}
	}, []);

	// Persist panel state
	useEffect(() => {
		try {
			if (activePanel) {
				localStorage.setItem(ACTIVE_PANEL_KEY, activePanel);
			} else {
				localStorage.removeItem(ACTIVE_PANEL_KEY);
			}
		} catch {
			// localStorage unavailable
		}
	}, [activePanel]);

	// Detect mobile viewport
	useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768);
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	// Listen for terminal toggle custom event (dispatched by KeyboardShortcuts)
	useEffect(() => {
		const handler = () =>
			setActivePanel((v) => (v === "terminal" ? null : "terminal"));
		window.addEventListener("mandio:terminal-toggle", handler);
		return () => window.removeEventListener("mandio:terminal-toggle", handler);
	}, []);

	const handleRailSelect = useCallback((panel: "chat" | "terminal") => {
		setActivePanel((v) => (v === panel ? null : panel));
	}, []);

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
			<div className="h-screen bg-background flex flex-col overflow-hidden">
				<a href="#main-content" className="skip-to-content">
					Skip to content
				</a>
				<KeyboardShortcuts />
				<SearchDialog />
				<CommandBar
					onCapture={handleCapture}
					tasks={tasks}
					commands={commands}
					onTaskClick={() => {
						router.push("/work");
					}}
				/>

				{/* Content row: main + optional panel + rail */}
				<div className="flex flex-1 overflow-hidden">
					<main
						id="main-content"
						className="flex-1 min-w-0 overflow-y-auto p-4 md:p-6"
					>
						{!online && (
							<div className="mb-4 rounded-sm bg-destructive-soft border border-destructive/20 text-destructive text-xs text-center py-2 px-3 flex items-center justify-center gap-2">
								<span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
								Connection lost — changes may not save. Retrying
								automatically...
							</div>
						)}
						<ActiveRunsProvider>{children}</ActiveRunsProvider>
					</main>

					<RightPanel
						activePanel={activePanel}
						isMobile={isMobile}
						onClose={() => setActivePanel(null)}
					/>
					<ActivityRail active={activePanel} onSelect={handleRailSelect} />
				</div>
			</div>
		</TooltipProvider>
	);
}
