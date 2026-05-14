"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivePanel } from "@/components/activity-rail";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const TerminalDrawer = dynamic(
	() => import("@/components/terminal-drawer").then((m) => m.TerminalDrawer),
	{ ssr: false },
);

const PANEL_WIDTH_KEY = "mandio.right-panel.width";
const DEFAULT_WIDTH = 480;
const MIN_WIDTH = 280;
const MAX_WIDTH = 720;

interface RightPanelProps {
	activePanel: ActivePanel;
	isMobile: boolean;
	onClose: () => void;
}

function PanelContent({
	activePanel,
	onClose,
}: {
	activePanel: ActivePanel;
	onClose?: () => void;
}) {
	return (
		<>
			{activePanel === "chat" && <ChatSidebar onClose={onClose} />}
			{activePanel === "terminal" && (
				<TerminalDrawer enabled onClose={onClose} />
			)}
		</>
	);
}

export function RightPanel({
	activePanel,
	isMobile,
	onClose,
}: RightPanelProps) {
	const [width, setWidth] = useState(DEFAULT_WIDTH);
	const dragging = useRef(false);
	const startX = useRef(0);
	const startWidth = useRef(DEFAULT_WIDTH);
	const currentWidth = useRef(DEFAULT_WIDTH);

	// Restore persisted width
	useEffect(() => {
		try {
			const stored = localStorage.getItem(PANEL_WIDTH_KEY);
			if (stored) {
				const n = Number(stored);
				if (n >= MIN_WIDTH && n <= MAX_WIDTH) {
					setWidth(n);
					currentWidth.current = n;
				}
			}
		} catch {
			// localStorage unavailable
		}
	}, []);

	const onMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			dragging.current = true;
			startX.current = e.clientX;
			startWidth.current = width;
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";
		},
		[width],
	);

	useEffect(() => {
		const onMouseMove = (e: MouseEvent) => {
			if (!dragging.current) return;
			// Panel is on the right; dragging left (smaller clientX) = wider panel
			const delta = startX.current - e.clientX;
			const next = Math.min(
				MAX_WIDTH,
				Math.max(MIN_WIDTH, startWidth.current + delta),
			);
			currentWidth.current = next;
			setWidth(next);
		};

		const onMouseUp = () => {
			if (!dragging.current) return;
			dragging.current = false;
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
			try {
				localStorage.setItem(PANEL_WIDTH_KEY, String(currentWidth.current));
			} catch {
				// localStorage unavailable
			}
		};

		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
		return () => {
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
		};
	}, []);

	if (isMobile) {
		return (
			<Sheet open={!!activePanel} onOpenChange={(open) => !open && onClose()}>
				<SheetContent
					side="right"
					className="w-full sm:w-full p-0 flex flex-col"
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					<SheetTitle className="sr-only">
						{activePanel === "chat" ? "Chat" : "Terminal"}
					</SheetTitle>
					<PanelContent activePanel={activePanel} onClose={onClose} />
				</SheetContent>
			</Sheet>
		);
	}

	if (!activePanel) return null;

	return (
		<div
			className="shrink-0 border-l flex flex-col overflow-hidden bg-card text-foreground relative"
			style={{ width }}
		>
			{/* Resize handle */}
			<div
				onMouseDown={onMouseDown}
				className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-10"
				aria-hidden
			/>

			<PanelContent activePanel={activePanel} onClose={onClose} />
		</div>
	);
}
