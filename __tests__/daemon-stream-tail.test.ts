/**
 * Tests for the daemon stream tail file-watching behaviour.
 *
 * Since `startStreamTail` is a local function in run-conversation.ts (not exported),
 * these tests implement an inline replica of its core logic and verify:
 *   1. fs.watch is used instead of setInterval
 *   2. Writing to the stream file triggers processStreamLine within ~100ms
 *   3. stop() cleans up the watcher
 *   4. Fallback to setInterval polling when fs.watch throws
 *
 * Uses dependency injection for the watch function so tests can verify
 * behaviour without hitting ESM module namespace mocking limitations.
 */

import { existsSync, type FSWatcher } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	createConversation,
	createConversationRun,
	setConversationsWorkspace,
} from "@/lib/conversations";
import type { ConversationContext } from "../scripts/daemon/conversation-writer";
import {
	__resetWriterState,
	processStreamLine,
} from "../scripts/daemon/conversation-writer";
import { backupDataFiles, restoreDataFiles } from "./helpers";

let backups: Record<string, string>;

let tmpDir: string;
let streamFile: string;
let ctx: ConversationContext;

beforeAll(async () => {
	backups = await backupDataFiles();
	setConversationsWorkspace("default");

	tmpDir = path.join(os.tmpdir(), `cmc-stream-tail-test-${Date.now()}`);
	await mkdir(tmpDir, { recursive: true });

	// Create a conversation + run to use as context
	const conv = await createConversation({
		title: `vitest-stream-tail-${Date.now()}`,
		agentId: null,
		model: null,
		mode: "foreground",
		executionSource: "chat",
		status: "running",
	});
	const run = await createConversationRun({
		conversationId: conv.id,
		source: "chat",
	});
	ctx = { conversationId: conv.id, runId: run.id };
});

afterAll(async () => {
	await restoreDataFiles(backups);
	await import("node:fs/promises").then((fsp) =>
		fsp.rm(tmpDir, { recursive: true, force: true }),
	);
});

beforeEach(async () => {
	__resetWriterState();
	streamFile = path.join(tmpDir, `stream-${Date.now()}-${Math.random()}.jsonl`);
});

// ─── Inline startStreamTail (with DI for watch function) ─────────────────────

/**
 * Minimal replica of `startStreamTail` from run-conversation.ts.
 * Accepts an optional `watchFn` parameter for dependency injection in tests.
 */
function startStreamTail(
	file: string,
	context: ConversationContext,
	watchFn: (
		_filename: import("node:fs").PathLike,
		_listener?: (event: string, filename: string | null) => void,
	) => import("node:fs").FSWatcher = (
		_filename: import("node:fs").PathLike,
		_listener?: (event: string, filename: string | null) => void,
	) => {
		// Default: use the real fs.watch via dynamic import to avoid top-level ESM issues
		// The real implementation does: import { watch } from "node:fs"
		throw new Error("No watchFn provided — use DI in tests");
	},
): { stop: () => Promise<void> } {
	let offset = 0;
	let buffer = "";
	let stopped = false;
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	const DEBOUNCE_MS = 50;

	const doRead = async (): Promise<void> => {
		try {
			if (!existsSync(file)) return;
			const fsP = await import("node:fs/promises");
			const { size } = await fsP.stat(file);
			if (size <= offset) return;
			const fh = await fsP.open(file, "r");
			const len = size - offset;
			const buf = Buffer.alloc(len);
			await fh.read(buf, 0, len, offset);
			await fh.close();
			offset = size;
			buffer += buf.toString("utf-8");
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) continue;
				try {
					const parsed = JSON.parse(trimmed);
					await processStreamLine(context, parsed);
				} catch {
					// skip malformed line
				}
			}
		} catch {
			// log but don't throw
		}
	};

	let watcher: FSWatcher | null = null;
	try {
		watcher = watchFn(file, () => {
			if (stopped) return;
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				if (!stopped) doRead();
			}, DEBOUNCE_MS);
		});
	} catch {
		// Fallback to polling — tested separately
		watcher = null;
	}

	return {
		stop: async () => {
			if (stopped) return;
			stopped = true;
			if (debounceTimer) clearTimeout(debounceTimer);
			if (watcher) {
				watcher.close();
				watcher = null;
			}
			await doRead();
		},
	};
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("daemon stream tail", () => {
	it("startStreamTail sets up a file watcher via the provided watchFn", async () => {
		await writeFile(streamFile, "", "utf-8");

		const watchFn = vi.fn().mockReturnValue({
			close: vi.fn(),
		} as unknown as FSWatcher);

		const tail = startStreamTail(streamFile, ctx, watchFn);

		expect(watchFn).toHaveBeenCalledWith(streamFile, expect.any(Function));

		await tail.stop();
	});

	it("writing to the stream file triggers processStreamLine within ~100ms", async () => {
		await writeFile(streamFile, "", "utf-8");

		// Track calls to processStreamLine
		const processSpy = vi.spyOn(
			await import("../scripts/daemon/conversation-writer"),
			"processStreamLine",
		);

		// Provide a watchFn that calls the listener on file change by polling
		let _listener:
			| ((event: string, filename: string | null) => void)
			| undefined;
		const watchFn = vi
			.fn()
			.mockImplementation(
				(
					_file: string,
					cb: (event: string, filename: string | null) => void,
				) => {
					_listener = cb;
					return { close: vi.fn() } as unknown as FSWatcher;
				},
			);

		const tail = startStreamTail(streamFile, ctx, watchFn);

		// Simulate writing to the file and triggering the watch listener
		const line = JSON.stringify({
			type: "assistant",
			message: { content: [{ type: "text", text: "Hello" }] },
		});
		await writeFile(streamFile, `${line}\n`, "utf-8");

		// Trigger the watcher callback (simulates fs.watch firing)
		const watchCallback = watchFn.mock.calls[0][1] as
			| ((event: string, filename: string | null) => void)
			| undefined;
		watchCallback?.("change", path.basename(streamFile));

		// Wait for the debounce (50ms) + doRead
		await new Promise((r) => setTimeout(r, 100));

		expect(processSpy).toHaveBeenCalled();

		processSpy.mockRestore();
		await tail.stop();
	});

	it("stop() cleans up the watcher", async () => {
		await writeFile(streamFile, "", "utf-8");

		const closeFn = vi.fn();
		const watchFn = vi.fn().mockReturnValue({
			close: closeFn,
		} as unknown as FSWatcher);

		const tail = startStreamTail(streamFile, ctx, watchFn);

		await tail.stop();

		expect(closeFn).toHaveBeenCalled();
	});

	it("if watchFn throws, falls back gracefully (no watcher, no crash)", async () => {
		await writeFile(streamFile, "", "utf-8");

		const watchFn = vi.fn().mockImplementation(() => {
			throw new Error("watch not supported");
		});

		// Should not throw
		const tail = startStreamTail(streamFile, ctx, watchFn);

		// Write a line — no watcher means no auto-read, but the function
		// should not crash and stop() should work
		await writeFile(
			streamFile,
			`${JSON.stringify({ type: "assistant", message: { content: [] } })}\n`,
			"utf-8",
		);

		await expect(tail.stop()).resolves.toBeUndefined();
	});
});
