/**
 * Cross-process conversation event bus.
 *
 * Provides:
 * 1. In-process EventEmitter (globalThis singleton) for same‑process producers.
 * 2. File‑watching layer (fs.watch on the parent directory) so the Next.js
 *    SSE route is notified when the daemon writes events to events.jsonl.
 * 3. Convenience publisher (publishAndEmit) that writes to the file AND emits
 *    locally in one call.
 *
 * Schema: docs/conversation-event-schema.md (locked v1.0)
 * Persistence layer: src/lib/conversations.ts
 */

import { EventEmitter } from "node:events";
import { existsSync, type FSWatcher, statSync, watch } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eventsFilePath, publishConversationEvent } from "./conversations";
import type { ConversationEvent } from "./types";

// ─── Singleton EventEmitter on globalThis ─────────────────────────────────

const GLOBAL_KEY = "__ccmcConversationEventBus__";

function getEmitter(): EventEmitter {
	const g = globalThis as Record<string, unknown>;
	if (!g[GLOBAL_KEY]) {
		const ee = new EventEmitter();
		ee.setMaxListeners(200);
		g[GLOBAL_KEY] = ee;
	}
	return g[GLOBAL_KEY] as EventEmitter;
}

// ─── Local emit / subscribe (in-process only) ─────────────────────────────

/**
 * Emit a conversation event on the in-process EventEmitter.
 * Fires on both the global "event" channel and the per-conversation
 * `conversation:<id>` channel.
 */
export function emitLocal(event: ConversationEvent): void {
	const ee = getEmitter();
	ee.emit("event", event);
	ee.emit(`conversation:${event.conversationId}`, event);
}

/**
 * Subscribe to in-process events for a specific conversation.
 * Returns an unsubscribe function.
 */
export function subscribeLocal(
	conversationId: string,
	listener: (event: ConversationEvent) => void,
): () => void {
	const ee = getEmitter();
	const channel = `conversation:${conversationId}`;
	ee.on(channel, listener);
	return () => {
		ee.off(channel, listener);
	};
}

// ─── File-watching layer (cross-process) ──────────────────────────────────

interface WatcherEntry {
	watcher: FSWatcher;
	refCount: number;
	offset: number;
}

const watchers = new Map<string, WatcherEntry>();

/** Guard to prevent concurrent reads on the same conversation file. */
const reading = new Set<string>();

/**
 * Read new events written to the conversation's events.jsonl
 * since the last tracked offset, then emit them locally.
 */
async function consumeNewEvents(conversationId: string): Promise<void> {
	if (reading.has(conversationId)) return;
	reading.add(conversationId);
	try {
		const entry = watchers.get(conversationId);
		if (!entry) return;

		const filePath = eventsFilePath(conversationId);
		let content: string;
		try {
			content = await readFile(filePath, "utf-8");
		} catch {
			// File does not exist (yet) or was removed
			entry.offset = 0;
			return;
		}

		const size = content.length;

		if (size < entry.offset) {
			// File was truncated or rotated — reset and re-read everything
			entry.offset = 0;
		}
		if (size <= entry.offset) return;

		const newChunk = content.slice(entry.offset);
		entry.offset = size;

		for (const line of newChunk.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			try {
				const event = JSON.parse(trimmed) as ConversationEvent;
				emitLocal(event);
			} catch {
				// skip corrupt line
			}
		}
	} finally {
		reading.delete(conversationId);
	}
}

/**
 * Start watching a conversation's events.jsonl for changes.
 *
 * Watches the parent directory (not the file itself) so it works even before
 * the file exists.  When the file is created or appended to, inotify fires
 * a `rename` or `change` event and we read the new bytes.
 */
function startFileWatcher(conversationId: string): void {
	const filePath = eventsFilePath(conversationId);
	const dirPath = path.dirname(filePath);
	const fileName = path.basename(filePath);

	// Seed offset from any existing file content so we don't re-read old events
	let offset = 0;
	try {
		if (existsSync(filePath)) {
			offset = statSync(filePath).size;
		}
	} catch {
		// offset stays 0
	}

	const watcher = watch(dirPath, (_eventType, _filename) => {
		// Normalise filename (can be string | Buffer | null on some platforms)
		const name =
			_filename === null
				? fileName
				: Buffer.isBuffer(_filename)
					? _filename.toString()
					: _filename;
		if (name === fileName) {
			// Fire-and-forget — errors are caught inside consumeNewEvents
			consumeNewEvents(conversationId);
		}
	});

	watchers.set(conversationId, { watcher, refCount: 1, offset });
}

function stopFileWatcher(conversationId: string): void {
	const entry = watchers.get(conversationId);
	if (entry) {
		try {
			entry.watcher.close();
		} catch {
			// ignore close errors
		}
		watchers.delete(conversationId);
	}
}

// ─── Public cross-process subscribe ───────────────────────────────────────

/**
 * Subscribe to conversation events from both in-process producers AND
 * cross-process file writes.
 *
 * - Adds the listener to the local EventEmitter.
 * - Starts a file watcher for this conversation if it is the first subscriber.
 * - Stops the watcher when the last subscriber unsubscribes.
 *
 * @returns An unsubscribe function.  Call it when the subscriber no longer
 *          needs events (e.g. SSE connection closed).
 */
export function subscribe(
	conversationId: string,
	listener: (event: ConversationEvent) => void,
): () => void {
	const unsubLocal = subscribeLocal(conversationId, listener);

	const existing = watchers.get(conversationId);
	if (existing) {
		existing.refCount++;
	} else {
		startFileWatcher(conversationId);
	}

	return () => {
		unsubLocal();
		const entry = watchers.get(conversationId);
		if (entry) {
			entry.refCount--;
			if (entry.refCount <= 0) {
				stopFileWatcher(conversationId);
			}
		}
	};
}

// ─── Convenience publisher ────────────────────────────────────────────────

/**
 * Publish a conversation event (writes to events.jsonl via
 * `publishConversationEvent`) AND emits on the in-process bus so
 * same-process subscribers do not wait for the file-watcher round-trip.
 *
 * Returns the fully-formed event with `seq` and `ts` assigned.
 */
export async function publishAndEmit(
	event: Omit<ConversationEvent, "ts" | "seq">,
): Promise<ConversationEvent> {
	const full = await publishConversationEvent(event);
	emitLocal(full);
	return full;
}

// ─── Testing helpers ──────────────────────────────────────────────────────

/** @internal exposed for testing — number of active file watchers */
export function _watcherCount(): number {
	return watchers.size;
}

/** @internal exposed for testing — remove all file watchers */
export function _clearWatchers(): void {
	for (const [id] of [...watchers.keys()]) {
		stopFileWatcher(id);
	}
}
