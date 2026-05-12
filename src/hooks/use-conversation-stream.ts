import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type {
	Conversation,
	ConversationEvent,
	ConversationRun,
	ConversationTurn,
	MessagePart,
	ToolCallRecord,
} from "@/lib/types";

// ─── Reducer State ─────────────────────────────────────────────────────────────────────────────

export interface ConversationReducerState {
	conversation: Conversation | null;
	turns: ConversationTurn[];
	runs: ConversationRun[];
	error: string | null;
	/** Buffer for tool.started events whose parent turn hasn't arrived yet */
	pendingToolCalls: Record<string, ToolCallRecord[]>;
}

export const initialReducerState: ConversationReducerState = {
	conversation: null,
	turns: [],
	runs: [],
	error: null,
	pendingToolCalls: {},
};

// ─── Public Interface ─────────────────────────────────────────────────────────────────────────

export interface ConversationStreamState {
	conversation: Conversation | null;
	turns: ConversationTurn[];
	runs: ConversationRun[];
	error: string | null;
	connected: boolean;
}

// ─── Reducer Actions ───────────────────────────────────────────────────────────────────────────

type InternalAction =
	| {
			type: "__set_state";
			payload: {
				conversation: Conversation | null;
				turns: ConversationTurn[];
				runs: ConversationRun[];
			};
	  }
	| { type: "__set_error"; payload: string | null }
	| { type: "__optimistic_turn"; payload: { content: string; ts: string } };

type ReducerAction = ConversationEvent | InternalAction;

// ─── Pure Reducer ──────────────────────────────────────────────────────────────────────────────

export function conversationReducer(
	state: ConversationReducerState,
	action: ReducerAction,
): ConversationReducerState {
	// Internal actions (not from SSE)
	if (action.type === "__set_state") {
		return {
			conversation: action.payload.conversation,
			turns: action.payload.turns,
			runs: action.payload.runs,
			error: null,
			pendingToolCalls: {},
		};
	}

	if (action.type === "__optimistic_turn") {
		const { content, ts } = action.payload;
		const tempId = `opt-${Date.now()}`;
		const nextTurn =
			state.turns.length > 0
				? Math.max(...state.turns.map((t) => t.turn)) + 1
				: 1;

		const newTurn: ConversationTurn = {
			id: tempId,
			turn: nextTurn,
			role: "user",
			ts,
			content,
			parts: [{ type: "text", content }],
			pending: true,
		};

		return { ...state, turns: [...state.turns, newTurn] };
	}

	if (action.type === "__set_error") {
		return { ...state, error: action.payload };
	}

	// ── ConversationEvent dispatching ──
	const event: ConversationEvent = action;

	switch (event.type) {
		// ─── Turn Events ──────────────────────────────────────────────────────────────────────────
		case "turn.started": {
			const { turnId, turn, role, runId } = event.payload;

			// Remove any optimistic user turn so the real one takes its place.
			// Optimistic turns use placeholder IDs like "opt-<timestamp>".
			const filteredTurns = state.turns.filter((t) => !t.id.startsWith("opt-"));
			if (filteredTurns.some((t) => t.id === turnId)) return state;

			const newTurn: ConversationTurn = {
				id: turnId,
				turn,
				role,
				ts: event.ts,
				content: "",
				parts: [],
				pending: true,
				runId,
			};

			// Attach any buffered tool calls
			let pendingToolCalls = state.pendingToolCalls;
			const buffered = pendingToolCalls[turnId];
			if (buffered && buffered.length > 0) {
				newTurn.toolCalls = [...buffered];
				newTurn.parts = buffered.map(
					(tc) =>
						({
							type: "tool_use",
							content: JSON.stringify(tc.args),
							toolName: tc.tool,
							toolCallId: tc.id,
							status: "running",
						}) as MessagePart,
				);
				const { [turnId]: _, ...rest } = pendingToolCalls;
				pendingToolCalls = rest;
			}

			return {
				...state,
				turns: [...filteredTurns, newTurn],
				pendingToolCalls,
			};
		}

		case "turn.delta": {
			const { turnId, delta, partType } = event.payload;
			const turnIdx = state.turns.findIndex((t) => t.id === turnId);
			if (turnIdx === -1) return state;

			const turn = state.turns[turnIdx];
			const targetPartType = partType ?? "text";
			const parts = [...(turn.parts || [])];
			let partIdx = parts.findIndex((p) => p.type === targetPartType);

			if (partIdx === -1) {
				partIdx = parts.length;
				parts.push({ type: targetPartType, content: "" });
			}

			parts[partIdx] = {
				...parts[partIdx],
				content: parts[partIdx].content + delta,
			};

			// content = concatenation of text parts only
			const content = parts
				.filter((p) => p.type === "text")
				.map((p) => p.content)
				.join("");

			const newTurns = [...state.turns];
			newTurns[turnIdx] = { ...turn, parts, content };

			return { ...state, turns: newTurns };
		}

		case "turn.completed": {
			const { turnId, tokens, content, parts, toolCalls } = event.payload;
			const turnIdx = state.turns.findIndex((t) => t.id === turnId);
			if (turnIdx === -1) return state;

			const existing = state.turns[turnIdx];
			const update: Partial<ConversationTurn> = {
				pending: false,
				tokens,
			};
			if (content !== undefined) update.content = content;
			if (parts !== undefined) update.parts = parts;
			if (toolCalls !== undefined) update.toolCalls = toolCalls;

			const newTurns = [...state.turns];
			newTurns[turnIdx] = { ...existing, ...update };

			return { ...state, turns: newTurns };
		}

		// ─── Tool Call Events ──────────────────────────────────────────────────────────────────────
		case "tool.started": {
			const tcPayload = event.payload;
			const toolCall: ToolCallRecord = {
				id: tcPayload.toolCallId,
				tool: tcPayload.tool,
				args: tcPayload.args,
				status: "running",
			};
			const part: MessagePart = {
				type: "tool_use",
				content: JSON.stringify(tcPayload.args),
				toolName: tcPayload.tool,
				toolCallId: tcPayload.toolCallId,
				status: "running",
			};

			const turnIdx = state.turns.findIndex((t) => t.id === tcPayload.turnId);
			if (turnIdx === -1) {
				// Buffer for when the turn arrives
				const existing = state.pendingToolCalls[tcPayload.turnId] || [];
				return {
					...state,
					pendingToolCalls: {
						...state.pendingToolCalls,
						[tcPayload.turnId]: [...existing, toolCall],
					},
				};
			}

			const turn = state.turns[turnIdx];
			const newTurns = [...state.turns];
			newTurns[turnIdx] = {
				...turn,
				toolCalls: [...(turn.toolCalls || []), toolCall],
				parts: [...(turn.parts || []), part],
			};

			return { ...state, turns: newTurns };
		}

		case "tool.completed": {
			const tcPayload = event.payload;
			const turnIdx = state.turns.findIndex((t) => t.id === tcPayload.turnId);
			if (turnIdx === -1) return state;

			const turn = state.turns[turnIdx];

			// Update tool call record
			const toolCalls = (turn.toolCalls || []).map((tc) =>
				tc.id === tcPayload.toolCallId
					? {
							...tc,
							status: tcPayload.status,
							result: tcPayload.result,
							durationMs: tcPayload.durationMs,
						}
					: tc,
			);

			// Update tool_use part status
			const parts = [...(turn.parts || [])];
			for (let i = 0; i < parts.length; i++) {
				if (
					parts[i].type === "tool_use" &&
					parts[i].toolCallId === tcPayload.toolCallId
				) {
					parts[i] = { ...parts[i], status: tcPayload.status };
				}
			}

			// Add tool_result part if result is present
			if (tcPayload.result !== undefined) {
				parts.push({
					type: "tool_result",
					content: tcPayload.result,
					toolCallId: tcPayload.toolCallId,
					status: tcPayload.status,
				});
			}

			const newTurns = [...state.turns];
			newTurns[turnIdx] = { ...turn, toolCalls, parts };

			return { ...state, turns: newTurns };
		}

		// ─── Conversation Lifecycle Events ─────────────────────────────────────────────────────────
		case "conversation.started": {
			const { runId, source } = event.payload;
			const now = event.ts;

			const newRun: ConversationRun = {
				id: runId,
				conversationId: state.conversation?.id || event.conversationId,
				status: "starting",
				pid: null,
				sessionHandle: null,
				continuationIndex: state.runs.length,
				source,
				projectId: null,
				missionId: null,
				tokens: { input: 0, output: 0, total: 0 },
				numTurns: 0,
				requestId: null,
				startedAt: now,
				completedAt: null,
				exitCode: null,
				error: null,
				errorKind: null,
				model: null,
			};

			return {
				...state,
				conversation: state.conversation
					? {
							...state.conversation,
							status: "starting" as const,
							error: null,
							errorKind: null,
							currentRunId: runId,
						}
					: null,
				runs: [...state.runs, newRun],
				error: null,
			};
		}

		case "conversation.updated": {
			if (!state.conversation) return state;
			return {
				...state,
				conversation: {
					...state.conversation,
					...event.payload.fields,
				},
			};
		}

		case "conversation.completed": {
			const { runId, exitCode, tokens } = event.payload;
			const runs = state.runs.map((r) =>
				r.id === runId
					? {
							...r,
							status: "completed" as const,
							exitCode,
							tokens,
							completedAt: event.ts,
						}
					: r,
			);

			return {
				...state,
				conversation: state.conversation
					? {
							...state.conversation,
							status: "completed" as const,
							tokens,
							completedAt: event.ts,
						}
					: null,
				runs,
			};
		}

		case "conversation.paused": {
			const { reason, decisionId } = event.payload;
			if (!state.conversation) return state;
			return {
				...state,
				conversation: {
					...state.conversation,
					status: "awaiting-decision" as const,
					pausedReason: reason,
					pausedDecisionId: decisionId,
					pausedAt: event.ts,
				},
			};
		}

		case "conversation.resumed": {
			if (!state.conversation) return state;
			return {
				...state,
				conversation: {
					...state.conversation,
					status: "running" as const,
					pausedReason: null,
					pausedDecisionId: null,
					pausedAt: null,
					runCount: (state.conversation.runCount || 0) + 1,
					currentRunId: event.payload.runId,
				},
			};
		}

		case "conversation.error": {
			const { error, errorKind } = event.payload;
			if (!state.conversation) return state;
			return {
				...state,
				conversation: {
					...state.conversation,
					status: "failed" as const,
					error,
					errorKind,
				},
				error,
			};
		}

		case "conversation.cancelled": {
			if (!state.conversation) return state;
			return {
				...state,
				conversation: {
					...state.conversation,
					status: "cancelled" as const,
					cancelledAt: event.ts,
				},
			};
		}

		// ─── Decision Events (no state change) ─────────────────────────────────────────────────────
		case "decision.created":
		case "decision.answered":
			return state;

		default:
			return state;
	}
}

// ─── Hook ──────────────────────────────────────────────────────────────────────────────────────

const CONVERSATION_EVENT_TYPES = [
	"turn.started",
	"turn.delta",
	"turn.completed",
	"tool.started",
	"tool.completed",
	"conversation.started",
	"conversation.updated",
	"conversation.completed",
	"conversation.paused",
	"conversation.resumed",
	"conversation.error",
	"conversation.cancelled",
	"decision.created",
	"decision.answered",
] as const;

export function useConversationStream(
	conversationId: string | null,
): ConversationStreamState & {
	refresh: () => Promise<void>;
	addOptimisticTurn: (content: string) => void;
} {
	const [state, dispatch] = useReducer(
		conversationReducer,
		initialReducerState,
	);
	const [connected, setConnected] = useState(false);

	// Refs for SSE lifecycle
	const lastSeqRef = useRef(0);
	const seenSeqsRef = useRef(new Set<number>());
	const esRef = useRef<EventSource | null>(null);
	const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const retryDelayRef = useRef(1000);
	const conversationIdRef = useRef(conversationId);
	conversationIdRef.current = conversationId;

	// Dispatch decision events to window for DecisionPanel
	const dispatchDecisionEvent = useCallback((decisionId: string) => {
		if (typeof window !== "undefined") {
			window.dispatchEvent(
				new CustomEvent("cmc:decision-updated", {
					detail: { decisionId },
				}),
			);
		}
	}, []);

	// Refresh: full re-fetch from REST API
	const refresh = useCallback(async () => {
		const convId = conversationIdRef.current;
		if (!convId) return;
		try {
			const res = await fetch(
				`/api/conversations/${convId}?withTurns=1&withRuns=1`,
			);
			if (!res.ok) throw new Error("Failed to fetch conversation");
			const data = await res.json();
			dispatch({
				type: "__set_state",
				payload: {
					conversation: data.conversation,
					turns: data.turns || [],
					runs: data.runs || [],
				},
			});
		} catch (err: unknown) {
			dispatch({
				type: "__set_error",
				payload: err instanceof Error ? err.message : String(err),
			});
		}
	}, []);

	// Add an optimistic user turn that appears immediately without waiting for SSE
	const addOptimisticTurn = useCallback((content: string) => {
		dispatch({
			type: "__optimistic_turn",
			payload: { content, ts: new Date().toISOString() },
		});
	}, []);

	// Process SSE message (parsed JSON)
	const processEvent = useCallback(
		(raw: string) => {
			try {
				const event = JSON.parse(raw) as ConversationEvent;

				// Dedup by seq
				if (event.seq) {
					const seen = seenSeqsRef.current;
					if (seen.has(event.seq)) return;
					seen.add(event.seq);
					lastSeqRef.current = Math.max(lastSeqRef.current, event.seq);

					// Cap seenSeqs at 1000 entries
					if (seen.size > 1000) {
						const arr = Array.from(seen);
						seenSeqsRef.current = new Set(arr.slice(arr.length - 500));
					}
				}

				dispatch(event);

				// Side effect for decision events
				if (
					event.type === "decision.created" ||
					event.type === "decision.answered"
				) {
					dispatchDecisionEvent(event.payload.decisionId);
				}
			} catch (err) {
				console.error("Failed to parse conversation event", err);
			}
		},
		[dispatchDecisionEvent],
	);

	// Connect SSE
	const connectSSE = useCallback(() => {
		const convId = conversationIdRef.current;
		if (!convId || typeof window === "undefined") return;

		// Close any existing connection
		esRef.current?.close();

		const url =
			lastSeqRef.current > 0
				? `/api/conversations/${convId}/events?lastEventId=${lastSeqRef.current}`
				: `/api/conversations/${convId}/events`;

		const es = new EventSource(url);
		esRef.current = es;

		es.onopen = () => {
			setConnected(true);
			retryDelayRef.current = 1000; // Reset backoff
		};

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		es.onerror = (_event) => {
			setConnected(false);
			es.close();
			esRef.current = null;

			const delay = retryDelayRef.current;
			retryDelayRef.current = Math.min(delay * 2, 30000);
			retryTimerRef.current = setTimeout(connectSSE, delay);
		};

		// Register named event listeners for all conversation event types
		const handler = (e: MessageEvent) => processEvent(e.data);
		for (const type of CONVERSATION_EVENT_TYPES) {
			es.addEventListener(type, handler);
		}
	}, [processEvent]);

	// Main effect: reset, initial fetch, then SSE connection
	useEffect(() => {
		if (!conversationId) {
			dispatch({
				type: "__set_state",
				payload: { conversation: null, turns: [], runs: [] },
			});
			setConnected(false);
			esRef.current?.close();
			esRef.current = null;
			clearTimeout(retryTimerRef.current);
			lastSeqRef.current = 0;
			seenSeqsRef.current = new Set();
			retryDelayRef.current = 1000;
			return;
		}

		// Reset for new conversation
		dispatch({
			type: "__set_state",
			payload: { conversation: null, turns: [], runs: [] },
		});
		lastSeqRef.current = 0;
		seenSeqsRef.current = new Set();
		retryDelayRef.current = 1000;

		// Initial fetch, then SSE.
		// Guard against StrictMode double-mount: if the effect is cleaned up
		// between the refresh() await and connectSSE(), skip the connect.
		let aborted = false;
		const init = async () => {
			await refresh();
			if (!aborted) connectSSE();
		};
		init();

		return () => {
			aborted = true;
			esRef.current?.close();
			esRef.current = null;
			clearTimeout(retryTimerRef.current);
		};
	}, [conversationId, refresh, connectSSE]);

	return {
		conversation: state.conversation,
		turns: state.turns,
		runs: state.runs,
		error: state.error,
		connected,
		refresh,
		addOptimisticTurn,
	};
}
