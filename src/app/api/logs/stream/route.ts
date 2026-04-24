import { readFileSync } from "fs";
import { watchFile, unwatchFile } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { isAllowedLogPath, scrubLogLines } from "@/lib/log-reader";
import { DATA_DIR } from "@/lib/paths";

const FILE_MAP: Record<string, string> = {
	daemon: path.join(DATA_DIR, "daemon.log"),
	app: path.join(DATA_DIR, "logs", "app.jsonl"),
};

export async function GET(request: NextRequest) {
	const fileKey = request.nextUrl.searchParams.get("file") ?? "daemon";
	const logPath = FILE_MAP[fileKey];

	if (!logPath || !isAllowedLogPath(logPath)) {
		return new Response("Forbidden", { status: 403 });
	}

	// Track position by character length (not byte size) to avoid
	// Unicode offset mismatch when slicing the decoded string.
	let lastCharLen = 0;
	try {
		lastCharLen = readFileSync(logPath, "utf-8").length;
	} catch {
		// File doesn't exist yet -- start from 0
	}

	const encoder = new TextEncoder();
	let closed = false;
	const stream = new ReadableStream({
		start(controller) {
			const cleanup = () => {
				unwatchFile(logPath, listener);
				if (!closed) {
					closed = true;
					try {
						controller.close();
					} catch {
						/* already closed */
					}
				}
			};
			request.signal.addEventListener("abort", cleanup);

			const listener = () => {
				let content: string;
				try {
					content = readFileSync(logPath, "utf-8");
				} catch {
					return; // File read error -- skip this cycle
				}

				if (content.length <= lastCharLen) {
					// File was truncated or rotated -- reset
					lastCharLen = 0;
				}
				if (content.length === lastCharLen) return;

				const newText = content.slice(lastCharLen);
				lastCharLen = content.length;
				const newLines = newText.split("\n").filter(Boolean);

				const scrubbed = scrubLogLines(newLines);
				for (const line of scrubbed) {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(line)}\n\n`),
					);
				}
			};

			watchFile(logPath, { interval: 500 }, listener);
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
}
