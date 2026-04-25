/**
 * active-runs.ts — Shared I/O helpers for active-runs.json.
 * Extracted from run-task.ts and run-task-comment.ts (byte-for-byte identical).
 */

import { existsSync, readFileSync, writeFileSync } from "fs";

export interface ActiveRunEntry {
	id: string;
	taskId: string;
	agentId: string;
	source?:
		| "manual"
		| "project-run"
		| "mission-chain"
		| "scheduled"
		| "webhook"
		| "inbox-respond"
		| "comment";
	projectId: string | null;
	missionId: string | null;
	pid: number;
	status: "running" | "completed" | "failed" | "timeout" | "stopped";
	startedAt: string;
	completedAt: string | null;
	exitCode: number | null;
	error: string | null;
	costUsd: number | null;
	numTurns: number | null;
	continuationIndex: number;
	streamFile?: string | null;
}

export function readActiveRuns(filePath: string): { runs: ActiveRunEntry[] } {
	try {
		if (!existsSync(filePath)) return { runs: [] };
		const raw = readFileSync(filePath, "utf-8");
		return JSON.parse(raw) as { runs: ActiveRunEntry[] };
	} catch {
		return { runs: [] };
	}
}

export function writeActiveRuns(
	filePath: string,
	data: { runs: ActiveRunEntry[] },
): void {
	writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
