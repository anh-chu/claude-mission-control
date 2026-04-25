/**
 * respond-runs.ts — CRUD utilities for tracking inbox auto-respond chains.
 *
 * Data file: $CMC_DATA_DIR/workspaces/<id>/respond-runs.json
 * Schema: { runs: RespondRunEntry[] }
 *
 * Each "run" tracks a chain of Claude Code sessions responding to a single inbox message.
 * Continuations increment `continuationIndex` on the same run entry.
 */

import path from "path";
import { getWorkspaceDir } from "../../src/lib/paths";
import { logger } from "./logger";
import { pruneOldEntries, readJsonFile, writeJsonFile } from "./runs-registry";
import type { ClaudeUsage, RespondRunEntry, RespondRunsFile } from "./types";

const RESPOND_RUNS_FILE = path.join(
	getWorkspaceDir("default"),
	"respond-runs.json",
);

// ─── Read / Write ────────────────────────────────────────────────────────────

export function readRespondRuns(): RespondRunsFile {
	return readJsonFile(RESPOND_RUNS_FILE, { runs: [] });
}

export function writeRespondRuns(data: RespondRunsFile): void {
	writeJsonFile(RESPOND_RUNS_FILE, data);
}

// ─── Queries ────────────────────────────────────────────────────────────────

/** Check if a run has been stopped by the user */
export function isRunStopped(runId: string): boolean {
	const data = readRespondRuns();
	const run = data.runs.find((r) => r.id === runId);
	return run?.stopped === true;
}

/** Find a running respond-run for a given message */
export function findRunningByMessage(
	messageId: string,
): RespondRunEntry | null {
	const data = readRespondRuns();
	return (
		data.runs.find(
			(r) => r.messageId === messageId && r.status === "running",
		) ?? null
	);
}

/** Get all currently running respond-runs */
export function getRunningRuns(): RespondRunEntry[] {
	const data = readRespondRuns();
	return data.runs.filter((r) => r.status === "running");
}

// ─── Mutations ──────────────────────────────────────────────────────────────

/** Create a new respond-run entry */
export function createRespondRun(entry: RespondRunEntry): void {
	const data = readRespondRuns();
	data.runs.push(entry);
	writeRespondRuns(pruneOldRuns(data));
}

/** Update an existing respond-run by ID */
export function updateRespondRun(
	runId: string,
	updates: Partial<
		Pick<
			RespondRunEntry,
			| "pid"
			| "status"
			| "continuationIndex"
			| "completedAt"
			| "costUsd"
			| "numTurns"
			| "usage"
			| "error"
			| "stopped"
		>
	>,
): void {
	const data = readRespondRuns();
	const run = data.runs.find((r) => r.id === runId);
	if (!run) {
		logger.warn("respond-runs", `Run not found: ${runId}`);
		return;
	}

	if (updates.pid !== undefined) run.pid = updates.pid;
	if (updates.status !== undefined) run.status = updates.status;
	if (updates.continuationIndex !== undefined)
		run.continuationIndex = updates.continuationIndex;
	if (updates.completedAt !== undefined) run.completedAt = updates.completedAt;
	if (updates.costUsd !== undefined) run.costUsd = updates.costUsd;
	if (updates.numTurns !== undefined) run.numTurns = updates.numTurns;
	if (updates.usage !== undefined) run.usage = updates.usage;
	if (updates.error !== undefined) run.error = updates.error;
	if (updates.stopped !== undefined) run.stopped = updates.stopped;

	writeRespondRuns(data);
}

/** Accumulate cost/usage from a continuation session */
export function accumulateRunCost(
	runId: string,
	sessionCost: number | null,
	sessionTurns: number | null,
	sessionUsage: ClaudeUsage | null,
): void {
	const data = readRespondRuns();
	const run = data.runs.find((r) => r.id === runId);
	if (!run) return;

	if (sessionCost != null) {
		run.costUsd = (run.costUsd ?? 0) + sessionCost;
	}
	if (sessionTurns != null) {
		run.numTurns = (run.numTurns ?? 0) + sessionTurns;
	}
	if (sessionUsage) {
		if (!run.usage) {
			run.usage = {
				inputTokens: 0,
				outputTokens: 0,
				cacheReadInputTokens: 0,
				cacheCreationInputTokens: 0,
			};
		}
		run.usage.inputTokens += sessionUsage.inputTokens || 0;
		run.usage.outputTokens += sessionUsage.outputTokens || 0;
		run.usage.cacheReadInputTokens += sessionUsage.cacheReadInputTokens || 0;
		run.usage.cacheCreationInputTokens +=
			sessionUsage.cacheCreationInputTokens || 0;
	}

	writeRespondRuns(data);
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

/** Remove completed/failed/stopped entries older than 1 hour */
export function pruneOldRuns(data: RespondRunsFile): RespondRunsFile {
	data.runs = pruneOldEntries<RespondRunEntry>(data.runs);
	return data;
}
