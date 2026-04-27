import {
	closeSync,
	existsSync,
	openSync,
	readFileSync,
	readSync,
	statSync,
	watch,
} from "fs";
import type { NextRequest } from "next/server";
import path from "path";
import { getWorkspaceDataDir } from "@/lib/data";
import { applyWorkspaceContext } from "@/lib/workspace-context";

interface ActiveRunEntry {
	id: string;
	status: string;
	streamFile?: string | null;
}

function getRunEntry(
	runId: string,
	activeRunsFile: string,
): ActiveRunEntry | null {
	try {
		const raw = readFileSync(activeRunsFile, "utf-8");
		const data = JSON.parse(raw) as { runs: ActiveRunEntry[] };
		return data.runs.find((r) => r.id === runId) ?? null;
	} catch {
		return null;
	}
}

/**
 * GET /api/runs/stream?runId=<id>
 *
 * Server-Sent Events endpoint that tails the agent's .jsonl stream file.
 * Sends existing lines first, then watches for new lines until the run completes.
 */
export async function GET(request: NextRequest) {
	const workspaceId = await applyWorkspaceContext();
	const activeRunsFile = path.join(
		getWorkspaceDataDir(workspaceId),
		"active-runs.json",
	);

	const runId = request.nextUrl.searchParams.get("runId");

	if (!runId || !/^(run|wiki)_[A-Za-z0-9_-]+$/.test(runId)) {
		return new Response("Missing or invalid runId", { status: 400 });
	}

	const run = getRunEntry(runId, activeRunsFile);
	if (!run) {
		return new Response("Run not found", { status: 404 });
	}

	const streamFile = run.streamFile;
	if (!streamFile) {
		return new Response("No stream file for this run", { status: 404 });
	}

	// Security: ensure stream file is within data/agent-streams/
	const resolvedPath = path.resolve(streamFile);
	const streamsDir = path.resolve(
		getWorkspaceDataDir(workspaceId),
		"agent-streams",
	);
	if (
		!resolvedPath.startsWith(streamsDir + path.sep) &&
		resolvedPath !== streamsDir
	) {
		return new Response("Invalid stream file path", { status: 403 });
	}

	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		start(controller) {
			let bytesSent = 0;
			let closed = false;
			let watcher: ReturnType<typeof watch> | null = null;
			let pollTimer: ReturnType<typeof setInterval> | null = null;

			function cleanup() {
				if (closed) return;
				closed = true;
				if (watcher) {
					watcher.close();
					watcher = null;
				}
				if (pollTimer) {
					clearInterval(pollTimer);
					pollTimer = null;
				}
				try {
					controller.close();
				} catch {
					/* already closed */
				}
			}

			function sendLine(line: string) {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(`data: ${line}\n\n`));
				} catch {
					cleanup();
				}
			}

			function sendNewContent() {
				if (closed) return;
				if (!existsSync(resolvedPath)) return;

				try {
					const stat = statSync(resolvedPath);
					if (stat.size <= bytesSent) return;

					// Read new bytes from where we left off
					const fd = openSync(resolvedPath, "r");
					const buffer = Buffer.alloc(stat.size - bytesSent);
					readSync(fd, buffer, 0, buffer.length, bytesSent);
					closeSync(fd);

					bytesSent = stat.size;
					const text = buffer.toString("utf-8");
					const lines = text.split("\n");

					for (const line of lines) {
						if (line.trim()) {
							sendLine(line);
						}
					}
				} catch {
					// File may be in flux — retry on next poll
				}
			}

			function checkRunStatus() {
				if (closed) return;
				const currentRun = getRunEntry(runId!, activeRunsFile);
				if (!currentRun || currentRun.status !== "running") {
					// Send any remaining content
					sendNewContent();
					// Send done event
					try {
						controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
					} catch {
						/* already closed */
					}
					cleanup();
				}
			}

			// Send existing content immediately
			sendNewContent();

			// Watch for file changes via polling (more reliable than fs.watch across platforms)
			pollTimer = setInterval(() => {
				sendNewContent();
				checkRunStatus();
			}, 1000);

			// Also try fs.watch for faster response (best-effort)
			if (existsSync(resolvedPath)) {
				try {
					watcher = watch(resolvedPath, () => {
						sendNewContent();
					});
				} catch {
					// fs.watch not supported — polling is the fallback
				}
			}

			// Safety timeout: close after 30 minutes max
			setTimeout(
				() => {
					cleanup();
				},
				30 * 60 * 1000,
			);

			// Handle client disconnect
			request.signal.addEventListener("abort", cleanup);
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});
}
