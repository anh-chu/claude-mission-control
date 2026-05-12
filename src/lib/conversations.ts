/**
 * Conversation persistence layer.
 *
 * Implements the schema locked in docs/conversation-event-schema.md.
 *
 * Storage layout per workspace:
 *   conversations.json                              -- meta + runs index
 *   conversations/<conversationId>/turns.jsonl      -- append-only turn log
 *   conversations/<conversationId>/events.jsonl     -- append-only event log
 *   conversations/<conversationId>/seq.txt          -- durable seq counter
 *
 * Concurrency: per-conversation Mutex for JSONL/seq writes.
 * Workspace-level mutex for `conversations.json` (the metadata index).
 */

import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Mutex } from "async-mutex";
import { getWorkspaceDir } from "./paths";
import type {
	Conversation,
	ConversationEvent,
	ConversationRun,
	ConversationsFile,
	ConversationTurn,
} from "./types";
import { generateId } from "./utils";
import { getWorkspaceId, setFallbackWorkspaceId } from "./workspace-store";

// ─── mtime-based cache for conversations.json ────────────────────────────────
//
// Within a single request the file won't change between reads unless *we* write
// it.  After a write the cache is invalidated so the next read goes to disk.
// Cross-process writes (e.g. the daemon) will have a different mtime, so the
// cache correctly misses.

interface ConversationsCache {
	data: ConversationsFile;
	mtimeMs: number;
}

/** Keyed by absolute file path to avoid cross-workspace cache collisions. */
const _conversationsCache = new Map<string, ConversationsCache>();

// ─── Workspace-scoped file path helpers ──────────────────────────────────────

function workspaceDir(): string {
	return getWorkspaceDir(getWorkspaceId());
}

function conversationsIndexPath(): string {
	return path.join(workspaceDir(), "conversations.json");
}

function conversationsRoot(): string {
	return path.join(workspaceDir(), "conversations");
}

function conversationDir(conversationId: string): string {
	return path.join(conversationsRoot(), conversationId);
}

/**
 * Set the active workspace for conversation data access.
 *
 * @deprecated For test use only. Production route handlers must use
 * applyWorkspaceContext() which sets workspace via AsyncLocalStorage.
 */
export function setConversationsWorkspace(id: string): void {
	setFallbackWorkspaceId(id);
}

export function turnsFilePath(conversationId: string): string {
	return path.join(conversationDir(conversationId), "turns.jsonl");
}

export function eventsFilePath(conversationId: string): string {
	return path.join(conversationDir(conversationId), "events.jsonl");
}

export function seqFilePath(conversationId: string): string {
	return path.join(conversationDir(conversationId), "seq.txt");
}

// ─── Mutexes ─────────────────────────────────────────────────────────────────

/** Workspace-level lock for conversations.json (meta + runs index). */
const conversationsIndexMutex = new Mutex();

/** Per-conversation locks for JSONL files and seq counter. */
const conversationLocks = new Map<string, Mutex>();

function getConversationLock(conversationId: string): Mutex {
	let lock = conversationLocks.get(conversationId);
	if (!lock) {
		lock = new Mutex();
		conversationLocks.set(conversationId, lock);
	}
	return lock;
}

// ─── Directory bootstrapping ─────────────────────────────────────────────────

export async function ensureConversationDir(
	conversationId: string,
): Promise<void> {
	await mkdir(conversationDir(conversationId), { recursive: true });
}

// ─── Index (conversations.json) read/write ───────────────────────────────────

export async function getConversationsFile(): Promise<ConversationsFile> {
	// mtime-based cache: avoid re-reading the file on every call within a request.
	// Keyed by absolute path so different workspaces never share a cache entry.
	const filePath = conversationsIndexPath();
	const stat = await import("node:fs/promises").then((fs) =>
		fs.stat(filePath).catch(() => null),
	);
	const mtimeMs = stat?.mtimeMs ?? 0;

	const cached = _conversationsCache.get(filePath);
	if (cached && cached.mtimeMs === mtimeMs) {
		return cached.data;
	}

	try {
		const raw = await readFile(filePath, "utf-8");
		const parsed = JSON.parse(raw) as Partial<ConversationsFile>;
		const data = {
			conversations: parsed.conversations ?? [],
			runs: parsed.runs ?? {},
		};
		_conversationsCache.set(filePath, { data, mtimeMs });
		return data;
	} catch {
		return { conversations: [], runs: {} };
	}
}

export function invalidateConversationsCache(): void {
	_conversationsCache.delete(conversationsIndexPath());
}

async function writeConversationsFile(data: ConversationsFile): Promise<void> {
	await mkdir(workspaceDir(), { recursive: true });
	await writeFile(
		conversationsIndexPath(),
		JSON.stringify(data, null, 2),
		"utf-8",
	);
	// Invalidate cache so the next read goes to disk and picks up the new mtime
	invalidateConversationsCache();
}

/**
 * Locked read-modify-write on conversations.json.
 * Callback mutates `data` in place; file is written after callback resolves.
 * If callback throws, file is NOT written (implicit rollback).
 */
export async function mutateConversationsFile<T>(
	fn: (data: ConversationsFile) => Promise<T> | T,
): Promise<T> {
	return conversationsIndexMutex.runExclusive(async () => {
		const data = await getConversationsFile();
		const result = await fn(data);
		await writeConversationsFile(data);
		return result;
	});
}

// ─── Conversation CRUD ───────────────────────────────────────────────────────

export interface CreateConversationInput {
	title: string;
	agentId: string | null;
	model: string | null;
	mode: "foreground" | "background";
	executionSource: Conversation["executionSource"];
	taskId?: string | null;
	parentConversationId?: string | null;
	status?: Conversation["status"];
}

export async function createConversation(
	input: CreateConversationInput,
): Promise<Conversation> {
	const now = new Date().toISOString();
	const conversation: Conversation = {
		id: generateId("conv"),
		title: input.title,
		agentId: input.agentId,
		model: input.model,
		status: input.status ?? "idle",
		mode: input.mode,
		executionSource: input.executionSource,

		taskId: input.taskId ?? null,
		parentConversationId: input.parentConversationId ?? null,

		currentRunId: null,
		runCount: 0,

		tokens: { input: 0, output: 0, total: 0 },
		turnCount: 0,

		error: null,
		errorKind: null,
		pausedReason: null,
		pausedDecisionId: null,
		summary: null,

		artifactRefs: [],
		mentionedPaths: [],
		attachmentPaths: [],

		recentRequestIds: [],

		createdAt: now,
		startedAt: null,
		updatedAt: now,
		completedAt: null,
		cancelledAt: null,
		archivedAt: null,
		deletedAt: null,
		pausedAt: null,

		version: 1,
	};

	await ensureConversationDir(conversation.id);
	await mutateConversationsFile(async (data) => {
		data.conversations.push(conversation);
	});
	return conversation;
}

export async function getConversation(
	conversationId: string,
): Promise<Conversation | null> {
	const data = await getConversationsFile();
	return data.conversations.find((c) => c.id === conversationId) ?? null;
}

export async function updateConversation(
	conversationId: string,
	patch: Partial<Conversation>,
): Promise<Conversation | null> {
	return mutateConversationsFile(async (data) => {
		const idx = data.conversations.findIndex((c) => c.id === conversationId);
		if (idx === -1) return null;
		const now = new Date().toISOString();
		data.conversations[idx] = {
			...data.conversations[idx],
			...patch,
			updatedAt: now,
		};
		return data.conversations[idx];
	});
}

/** Soft delete (sets deletedAt). Files are preserved for referential integrity. */
export async function softDeleteConversation(
	conversationId: string,
): Promise<boolean> {
	const result = await updateConversation(conversationId, {
		deletedAt: new Date().toISOString(),
	});
	return result !== null;
}

export async function listConversations(filter?: {
	taskId?: string | null;
	status?: Conversation["status"];
	mode?: Conversation["mode"];
	agentId?: string;
	source?: Conversation["executionSource"];
	includeDeleted?: boolean;
	includeArchived?: boolean;
}): Promise<Conversation[]> {
	const data = await getConversationsFile();
	let list = data.conversations;
	if (!filter?.includeDeleted) {
		list = list.filter((c) => !c.deletedAt);
	}
	if (!filter?.includeArchived) {
		list = list.filter((c) => !c.archivedAt);
	}
	if (filter?.taskId !== undefined) {
		list = list.filter((c) => c.taskId === filter.taskId);
	}
	if (filter?.status) {
		list = list.filter((c) => c.status === filter.status);
	}
	if (filter?.mode) {
		list = list.filter((c) => c.mode === filter.mode);
	}
	if (filter?.agentId) {
		list = list.filter((c) => c.agentId === filter.agentId);
	}
	if (filter?.source) {
		list = list.filter((c) => c.executionSource === filter.source);
	}
	return list;
}

// ─── Run CRUD ─────────────────────────────────────────────────────────────────

export interface CreateRunInput {
	conversationId: string;
	source: ConversationRun["source"];
	projectId?: string | null;
	missionId?: string | null;
	continuationIndex?: number;
	sessionHandle?: string | null;
	model?: string | null;
	requestId?: string | null;
	noPrune?: boolean;
}

export async function createConversationRun(
	input: CreateRunInput,
): Promise<ConversationRun> {
	const now = new Date().toISOString();
	const run: ConversationRun = {
		id: generateId("run"),
		conversationId: input.conversationId,
		status: "starting",

		pid: null,
		sessionHandle: input.sessionHandle ?? null,
		continuationIndex: input.continuationIndex ?? 0,

		source: input.source,
		projectId: input.projectId ?? null,
		missionId: input.missionId ?? null,

		tokens: { input: 0, output: 0, total: 0 },
		numTurns: 0,

		requestId: input.requestId ?? null,

		startedAt: now,
		completedAt: null,

		exitCode: null,
		error: null,
		errorKind: null,

		model: input.model ?? null,
		noPrune: input.noPrune,
	};

	await mutateConversationsFile(async (data) => {
		data.runs[run.id] = run;
		const conv = data.conversations.find((c) => c.id === input.conversationId);
		if (conv) {
			conv.currentRunId = run.id;
			conv.runCount += 1;
			conv.updatedAt = now;
		}
	});

	return run;
}

export async function getConversationRun(
	runId: string,
): Promise<ConversationRun | null> {
	const data = await getConversationsFile();
	return data.runs[runId] ?? null;
}

export async function updateConversationRun(
	runId: string,
	patch: Partial<ConversationRun>,
): Promise<ConversationRun | null> {
	return mutateConversationsFile(async (data) => {
		const existing = data.runs[runId];
		if (!existing) return null;
		data.runs[runId] = { ...existing, ...patch };
		return data.runs[runId];
	});
}

export async function listRunsForConversation(
	conversationId: string,
): Promise<ConversationRun[]> {
	const data = await getConversationsFile();
	return Object.values(data.runs)
		.filter((r) => r.conversationId === conversationId)
		.sort((a, b) => a.continuationIndex - b.continuationIndex);
}

// ─── Sequence counter (durable, monotonic) ──────────────────────────────────

/**
 * Read-increment-write the seq counter for a conversation.
 * Caller MUST hold the conversation's lock — internal use only.
 */
async function _nextSeqLocked(conversationId: string): Promise<number> {
	const seqPath = seqFilePath(conversationId);
	let current = 0;
	try {
		const raw = await readFile(seqPath, "utf-8");
		current = parseInt(raw.trim(), 10);
		if (!Number.isFinite(current) || current < 0) current = 0;
	} catch {
		current = 0;
	}
	const next = current + 1;
	await writeFile(seqPath, String(next), "utf-8");
	return next;
}

export async function getCurrentSeq(conversationId: string): Promise<number> {
	try {
		const raw = await readFile(seqFilePath(conversationId), "utf-8");
		const n = parseInt(raw.trim(), 10);
		return Number.isFinite(n) ? n : 0;
	} catch {
		return 0;
	}
}

// ─── Turn append / read ──────────────────────────────────────────────────────

export interface AppendTurnInput {
	role: ConversationTurn["role"];
	content: string;
	parts?: ConversationTurn["parts"];
	tokens?: ConversationTurn["tokens"];
	pending?: boolean;
	runId?: string;
	exitCode?: number | null;
	error?: string;
	toolCalls?: ConversationTurn["toolCalls"];
	mentionedPaths?: string[];
	attachmentPaths?: string[];
	artifactRefs?: string[];
}

/**
 * Append a new turn to the conversation's turn log.
 * Increments turnCount on the conversation metadata.
 */
export async function appendConversationTurn(
	conversationId: string,
	input: AppendTurnInput,
): Promise<ConversationTurn> {
	const lock = getConversationLock(conversationId);
	return lock.runExclusive(async () => {
		await ensureConversationDir(conversationId);

		// Determine next turn number from conversation metadata
		const data = await getConversationsFile();
		const conv = data.conversations.find((c) => c.id === conversationId);
		if (!conv) {
			throw new Error(`Conversation not found: ${conversationId}`);
		}
		const turn: ConversationTurn = {
			id: generateId("turn"),
			turn: conv.turnCount + 1,
			role: input.role,
			ts: new Date().toISOString(),
			content: input.content,
			parts: input.parts,
			pending: input.pending,
			tokens: input.tokens,
			runId: input.runId,
			exitCode: input.exitCode,
			error: input.error,
			toolCalls: input.toolCalls,
			mentionedPaths: input.mentionedPaths,
			attachmentPaths: input.attachmentPaths,
			artifactRefs: input.artifactRefs,
		};

		await appendFile(
			turnsFilePath(conversationId),
			`${JSON.stringify(turn)}\n`,
			"utf-8",
		);

		// Bump turnCount + updatedAt on conversation
		await mutateConversationsFile(async (d) => {
			const c = d.conversations.find((x) => x.id === conversationId);
			if (c) {
				c.turnCount += 1;
				c.updatedAt = turn.ts;
			}
		});

		return turn;
	});
}

/** Read all turns for a conversation. Returns empty array if log doesn't exist. */
export async function readConversationTurns(
	conversationId: string,
): Promise<ConversationTurn[]> {
	const file = turnsFilePath(conversationId);
	if (!existsSync(file)) return [];
	const raw = await readFile(file, "utf-8");
	const turns: ConversationTurn[] = [];
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			turns.push(JSON.parse(trimmed) as ConversationTurn);
		} catch {
			// skip corrupt line
		}
	}
	return turns;
}

// ─── Event append / read ─────────────────────────────────────────────────────

/**
 * Publish a conversation event. Writes to events.jsonl with a fresh seq number.
 * Returns the fully-formed event including assigned seq + ts.
 *
 * Caller passes the event without ts/seq — both are filled here.
 */
export async function publishConversationEvent(
	event: Omit<ConversationEvent, "ts" | "seq">,
): Promise<ConversationEvent> {
	const lock = getConversationLock(event.conversationId);
	return lock.runExclusive(async () => {
		await ensureConversationDir(event.conversationId);
		const seq = await _nextSeqLocked(event.conversationId);
		const full = {
			...event,
			ts: new Date().toISOString(),
			seq,
		} as ConversationEvent;
		await appendFile(
			eventsFilePath(event.conversationId),
			`${JSON.stringify(full)}\n`,
			"utf-8",
		);
		return full;
	});
}

/**
 * Read events for a conversation, optionally starting after a given seq.
 * Used for SSE replay via Last-Event-ID.
 */
export async function readConversationEvents(
	conversationId: string,
	options?: { afterSeq?: number; limit?: number },
): Promise<ConversationEvent[]> {
	const file = eventsFilePath(conversationId);
	if (!existsSync(file)) return [];
	const raw = await readFile(file, "utf-8");
	const events: ConversationEvent[] = [];
	const afterSeq = options?.afterSeq ?? 0;
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		try {
			const evt = JSON.parse(trimmed) as ConversationEvent;
			if (evt.seq > afterSeq) {
				events.push(evt);
				if (options?.limit && events.length >= options.limit) break;
			}
		} catch {
			// skip corrupt line
		}
	}
	return events;
}

// ─── Idempotency helpers ─────────────────────────────────────────────────────

/**
 * Check whether a requestId has already been processed for this conversation.
 * Used by `/continue` to detect duplicate POSTs.
 */
export async function hasRecentRequestId(
	conversationId: string,
	requestId: string,
): Promise<boolean> {
	const conv = await getConversation(conversationId);
	return conv?.recentRequestIds.includes(requestId) ?? false;
}

/**
 * Push a requestId onto the conversation's recent list. Caps at 10 entries.
 */
export async function recordRequestId(
	conversationId: string,
	requestId: string,
): Promise<void> {
	await mutateConversationsFile(async (data) => {
		const conv = data.conversations.find((c) => c.id === conversationId);
		if (!conv) return;
		const list = conv.recentRequestIds;
		if (list.includes(requestId)) return;
		list.push(requestId);
		while (list.length > 10) list.shift();
	});
}

// ─── Stale-run reaper ────────────────────────────────────────────────────────

/**
 * Check if a process is still alive by sending signal 0.
 * Returns true if alive, false if dead or pid is null/<=0.
 */
export function isProcessAlive(pid: number | null): boolean {
	if (!pid || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * Scan all conversations with non-terminal status. For each one whose
 * currentRunId points to a run with a dead pid, mark the run as "failed"
 * and the conversation as "failed" with errorKind="unknown".
 *
 * Also publishes `conversation.error` events.
 *
 * Returns the number of stale conversations reaped.
 *
 * Safe to call repeatedly (idempotent).
 *
 * `gracePeriodMs`: don't reap conversations younger than this (default 10000ms)
 * to avoid racing with fresh starts where pid hasn't been attached yet.
 */
export async function reapStaleRuns(options?: {
	gracePeriodMs?: number;
}): Promise<number> {
	const gracePeriodMs = options?.gracePeriodMs ?? 10000;
	const now = Date.now();
	const data = await getConversationsFile();

	const reaped: Array<{
		conversationId: string;
		runId: string | null;
	}> = [];

	for (const conv of data.conversations) {
		if (conv.status !== "starting" && conv.status !== "running") continue;

		if (!conv.currentRunId) {
			// No active run — check if conversation is older than grace period
			const age = now - new Date(conv.createdAt).getTime();
			if (age > gracePeriodMs) {
				reaped.push({ conversationId: conv.id, runId: null });
			}
			continue;
		}

		const run = data.runs[conv.currentRunId];
		if (!run) {
			// Run reference is missing — treat as stale if old enough
			const age = now - new Date(conv.createdAt).getTime();
			if (age > gracePeriodMs) {
				reaped.push({ conversationId: conv.id, runId: null });
			}
			continue;
		}

		// Run exists — check process liveness
		if (run.pid === null) {
			// No pid attached yet — if run is older than grace period, it's stale
			const age = now - new Date(run.startedAt).getTime();
			if (age > gracePeriodMs) {
				reaped.push({ conversationId: conv.id, runId: run.id });
			}
		} else if (!isProcessAlive(run.pid)) {
			// Process is dead — definitely stale
			reaped.push({ conversationId: conv.id, runId: run.id });
		}
	}

	// Reap all stale conversations
	const nowISO = new Date().toISOString();
	for (const { conversationId, runId } of reaped) {
		const errorMsg = runId
			? "Process not running (crash recovery)"
			: "No active run";

		if (runId) {
			await updateConversationRun(runId, {
				status: "failed",
				error: errorMsg,
				errorKind: "unknown",
				completedAt: nowISO,
			});
		}
		await updateConversation(conversationId, {
			status: "failed",
			error: errorMsg,
			errorKind: "unknown",
			currentRunId: null,
		});

		// Dynamic import to avoid circular dependency
		// (conversation-event-bus imports from conversations.ts)
		const { publishAndEmit } = await import("./conversation-event-bus");
		await publishAndEmit({
			type: "conversation.error",
			conversationId,
			payload: {
				runId,
				error: errorMsg,
				errorKind: "unknown",
			},
		});
	}

	return reaped.length;
}
