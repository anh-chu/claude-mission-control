/**
 * spawn-utils.ts — Shared output-parsing helpers for agent spawn results.
 * Includes special handling for error_max_turns and error_timeout subtypes.
 */

/**
 * Extract a human-readable summary from Claude Code's stdout.
 * Parses JSONL output looking for the final result line, then falls back
 * to raw text (filtering out JSON stream lines).
 */
export function extractSummary(stdout: string): string {
	const lines = stdout.trim().split("\n").filter(Boolean);

	// Scan JSONL lines in reverse for the result entry
	for (let i = lines.length - 1; i >= 0; i--) {
		try {
			const parsed = JSON.parse(lines[i]) as Record<string, unknown>;
			if (parsed.type === "result") {
				if (typeof parsed.result === "string" && parsed.result.trim()) {
					return parsed.result.slice(0, 2000);
				}
				if (parsed.subtype === "error_max_turns") {
					return "I ran out of processing turns before I could finish. You can retry with a more focused request, or break the task into smaller steps.";
				}
				if (parsed.subtype === "error_timeout") {
					return "I timed out before completing the task. Consider breaking it into smaller, more targeted requests.";
				}
				if (parsed.is_error) {
					return "I encountered an error while processing your message. Please try again or rephrase your request.";
				}
				return "(Completed but produced no summary)";
			}
		} catch {
			// not JSON, skip
		}
	}

	// Fallback: non-JSON lines only (filter out raw stream events)
	const textLines = lines.filter((l) => {
		try {
			JSON.parse(l);
			return false;
		} catch {
			return true;
		}
	});
	const tail = textLines.slice(-10).join("\n");
	if (!tail) return "(no output)";
	if (tail.length > 500) return `${tail.slice(0, 497)}...`;
	return tail;
}
