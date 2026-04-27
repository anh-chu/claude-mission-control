/**
 * active-runs.ts — Shared I/O helpers for active-runs.json.
 * Extracted from run-task.ts and run-task-comment.ts (byte-for-byte identical).
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";

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
		| "comment"
		| "wiki";
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
	// Wiki fields
	sessionId?: string | null;
	firstMessage?: string | null;
	model?: string | null;
	noPrune?: boolean;
}

export function readActiveRuns(filePath: string): { runs: ActiveRunEntry[] } {
	if (!existsSync(filePath)) return { runs: [] };
	const raw = readFileSync(filePath, "utf-8");
	// Throw on parse failure — corrupt file should not silently discard all runs
	return JSON.parse(raw) as { runs: ActiveRunEntry[] };
}

export function writeActiveRuns(
	filePath: string,
	data: { runs: ActiveRunEntry[] },
): void {
	const tmpPath = `${filePath}.${process.pid}.tmp`;
	writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
	renameSync(tmpPath, filePath);
}
