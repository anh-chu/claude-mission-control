"use client";

import { X } from "lucide-react";
import { useTerminalWS } from "@/hooks/use-terminal-ws";
import "@xterm/xterm/css/xterm.css";

interface TerminalDrawerProps {
	enabled: boolean;
	onClose?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
	idle: "idle",
	connecting: "connecting…",
	open: "connected",
	closed: "disconnected",
	error: "error",
};

export function TerminalDrawer({ enabled, onClose }: TerminalDrawerProps) {
	const { containerRef, status, errorMessage, reconnect } =
		useTerminalWS(enabled);

	return (
		<div className="flex h-full flex-col bg-[#0c0a09]">
			{/* Title bar */}
			<div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-1.5">
				<span className="text-[11px] font-medium text-white/40 select-none">
					Terminal &mdash; {STATUS_LABELS[status] ?? status}
				</span>

				<div className="flex items-center gap-1.5">
					{(status === "closed" || status === "error") && (
						<button
							type="button"
							onClick={reconnect}
							className="rounded-sm bg-white/10 px-2 py-0.5 text-[11px] text-white/70 hover:bg-white/20 transition-colors"
						>
							Reconnect
						</button>
					)}
					{onClose && (
						<button
							type="button"
							onClick={onClose}
							className="rounded-sm p-0.5 text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
							aria-label="Close terminal panel"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					)}
				</div>
			</div>

			{/* xterm.js container */}
			<div
				ref={containerRef}
				className="min-h-0 flex-1 overflow-hidden px-1 py-0.5"
			/>

			{/* Error bar */}
			{errorMessage && (
				<div className="shrink-0 border-t border-red-900/40 bg-red-950/40 px-3 py-1 text-[11px] text-red-400">
					{errorMessage}
				</div>
			)}
		</div>
	);
}
