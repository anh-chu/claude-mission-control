import { readFile } from "node:fs/promises";
import path from "node:path";
import { scrubCredentials } from "../../scripts/daemon/security";
import { DATA_DIR } from "./paths";

const MAX_LINES = 200;
const ALLOWED_FILES = new Set([
	path.resolve(DATA_DIR, "daemon.log"),
	path.resolve(DATA_DIR, "logs", "app.jsonl"),
	path.resolve(DATA_DIR, "logs", "daemon.jsonl"),
	path.resolve(DATA_DIR, "logs", "tasks.jsonl"),
]);

function clampLines(lines: number): number {
	if (!Number.isFinite(lines)) return 50;
	return Math.min(Math.max(Math.trunc(lines), 1), MAX_LINES);
}

function normalizeLineEndings(content: string): string[] {
	const normalized = content.replace(/\r\n/g, "\n");
	const parts = normalized.split("\n");
	if (parts.at(-1) === "") {
		parts.pop();
	}
	return parts;
}

export function isAllowedLogPath(filePath: string): boolean {
	const resolvedPath = path.resolve(filePath);
	const resolvedDataDir = path.resolve(DATA_DIR);
	const withinDataDir =
		resolvedPath === resolvedDataDir ||
		resolvedPath.startsWith(`${resolvedDataDir}${path.sep}`);

	return withinDataDir && ALLOWED_FILES.has(resolvedPath);
}

export function scrubLogLines(lines: string[]): string[] {
	return lines.map((line) => scrubCredentials(line));
}

export async function tailFile(
	filePath: string,
	lines: number,
	search?: string,
): Promise<string[]> {
	const boundedLines = clampLines(lines);
	const raw = await readFile(filePath, "utf-8");
	const normalizedSearch = search?.trim().toLowerCase();
	const fileLines = normalizeLineEndings(raw);
	const filteredLines = normalizedSearch
		? fileLines.filter((line) => line.toLowerCase().includes(normalizedSearch))
		: fileLines;
	const tailedLines = filteredLines.slice(-boundedLines);

	return scrubLogLines(tailedLines);
}
