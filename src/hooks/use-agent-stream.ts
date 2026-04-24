"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface StreamLine {
	type: string;
	[key: string]: unknown;
}

interface UseAgentStreamReturn {
	lines: StreamLine[];
	isConnected: boolean;
	isDone: boolean;
}

/**
 * Hook that connects to the SSE endpoint for a running agent session
 * and accumulates parsed stream lines.
 */
export function useAgentStream(runId: string | null): UseAgentStreamReturn {
	const [lines, setLines] = useState<StreamLine[]>([]);
	const [isConnected, setIsConnected] = useState(false);
	const [isDone, setIsDone] = useState(false);
	const eventSourceRef = useRef<EventSource | null>(null);

	const cleanup = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
		setIsConnected(false);
	}, []);

	useEffect(() => {
		if (!runId) {
			cleanup();
			return;
		}

		// Reset state for new connection
		setLines([]);
		setIsDone(false);

		const es = new EventSource(
			`/api/runs/stream?runId=${encodeURIComponent(runId)}`,
		);
		eventSourceRef.current = es;

		es.onopen = () => {
			setIsConnected(true);
		};

		es.onmessage = (event) => {
			try {
				const parsed = JSON.parse(event.data) as StreamLine;
				setLines((prev) => [...prev, parsed]);
			} catch {
				// Non-JSON line — ignore
			}
		};

		es.addEventListener("done", () => {
			setIsDone(true);
			cleanup();
		});

		es.onerror = () => {
			// EventSource will auto-reconnect, but if the stream is done
			// we should just close
			setIsConnected(false);
		};

		return () => {
			cleanup();
		};
	}, [runId, cleanup]);

	return { lines, isConnected, isDone };
}
