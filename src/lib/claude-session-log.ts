/**
 * Read Claude Code on-disk session logs and convert them to UIMessage[].
 *
 * Log location: ~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl
 * Encoding: each "/" in the cwd is replaced with "-".
 *
 * Only text and reasoning (thinking) parts are replayed.
 * Tool-use parts are skipped in v1 because the assistant-ui ToolUIPart
 * shape requires toolCallId linkage that is non-trivial to reconstruct
 * from static JSONL entries.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { UIMessage } from "ai";

// ---- Path helpers ----------------------------------------------------------

/**
 * Encode a cwd into Claude Code's project-directory naming scheme.
 * Both `/` and `.` are replaced with `-`, so `/home/sil/.mandio/workspaces/default`
 * becomes `-home-sil--mandio-workspaces-default` (note the double dash).
 */
function encodeCwd(cwd: string): string {
	return cwd.replaceAll(/[/.]/g, "-");
}

export function getSessionLogPath(cwd: string, sessionId: string): string {
	return path.join(
		os.homedir(),
		".claude",
		"projects",
		encodeCwd(cwd),
		`${sessionId}.jsonl`,
	);
}

// ---- Raw JSONL entry types -------------------------------------------------

interface RawContentText {
	type: "text";
	text: string;
}

interface RawContentThinking {
	type: "thinking";
	thinking: string;
}

interface RawContentToolUse {
	type: "tool_use";
	id: string;
	name: string;
	input: unknown;
}

interface RawContentToolResult {
	type: "tool_result";
	tool_use_id: string;
	content: unknown;
}

type RawContent =
	| RawContentText
	| RawContentThinking
	| RawContentToolUse
	| RawContentToolResult;

interface RawMessage {
	role: "user" | "assistant";
	content: RawContent[];
}

interface RawEntry {
	type: "user" | "assistant";
	uuid: string;
	message: RawMessage;
}

// ---- UIMessage part types (subset we produce) ------------------------------

type TextPart = { type: "text"; text: string };
type ReasoningPart = { type: "reasoning"; text: string };
type UsablePart = TextPart | ReasoningPart;

// ---- Conversion ------------------------------------------------------------

function convertContent(content: RawContent[]): UsablePart[] {
	const parts: UsablePart[] = [];
	for (const c of content) {
		if (c.type === "text" && c.text.trim()) {
			parts.push({ type: "text", text: c.text });
		} else if (c.type === "thinking" && c.thinking.trim()) {
			parts.push({ type: "reasoning", text: c.thinking });
		}
		// tool_use and tool_result are skipped in v1
	}
	return parts;
}

function isInitProbe(content: RawContent[]): boolean {
	return content.some((c) => c.type === "text" && c.text === "__init_probe__");
}

function isToolResultOnly(content: RawContent[]): boolean {
	return content.length > 0 && content.every((c) => c.type === "tool_result");
}

// ---- Public API ------------------------------------------------------------

/**
 * Read a Claude Code session log and return UIMessage[] for rendering.
 * Returns [] if the file does not exist or cannot be parsed.
 */
export function readSessionMessages(
	cwd: string,
	sessionId: string,
): UIMessage[] {
	const logPath = getSessionLogPath(cwd, sessionId);

	let raw: string;
	try {
		raw = fs.readFileSync(logPath, "utf8");
	} catch {
		return [];
	}

	const lines = raw.split("\n").filter((l) => l.trim());
	const messages: UIMessage[] = [];

	for (const line of lines) {
		let entry: RawEntry;
		try {
			const parsed = JSON.parse(line) as Record<string, unknown>;
			if (parsed.type !== "user" && parsed.type !== "assistant") continue;
			const msg = parsed.message as RawMessage | undefined;
			if (!msg?.role || !Array.isArray(msg.content)) continue;
			entry = {
				type: parsed.type as "user" | "assistant",
				uuid:
					typeof parsed.uuid === "string" ? parsed.uuid : crypto.randomUUID(),
				message: msg,
			};
		} catch {
			continue;
		}

		const { type, uuid, message } = entry;
		const { role, content } = message;

		// Skip tool-result-only user messages and the init probe
		if (isInitProbe(content)) continue;
		if (type === "user" && isToolResultOnly(content)) continue;

		const parts = convertContent(content);
		if (parts.length === 0) continue;

		messages.push({
			id: uuid,
			role,
			parts,
		} satisfies UIMessage);
	}

	return messages;
}
