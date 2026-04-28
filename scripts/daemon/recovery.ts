import path from "node:path";
import { getWorkspaceDir } from "../../src/lib/paths";
import { logger } from "./logger";
import { atomicWriteJson, readJsonFile } from "./runs-registry";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SessionRecord {
	taskId: string;
	agentId: string;
	sessionId: string;
	startedAt: string;
}

export interface RecoveryResult {
	/** Task IDs that were reset to not-started (no session ID to resume) */
	tasksReset: string[];
	/** Tasks that have a persisted Claude session ID — candidates for --resume */
	sessionsToResume: SessionRecord[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isProcessRunning(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

// ─── Session Record Persistence ──────────────────────────────────────────────

/**
 * Persist a Claude session ID so it can be used to --resume on crash recovery.
 * Called by the dispatcher as soon as the session_id is emitted in stream-json.
 */
export function persistSessionRecord(
	taskId: string,
	agentId: string,
	sessionId: string,
): void {
	try {
		const sessionRecoveryFile = path.join(
			getWorkspaceDir("default"),
			"daemon-session-recovery.json",
		);
		const data = readJsonFile<{ sessions: SessionRecord[] }>(
			sessionRecoveryFile,
			{ sessions: [] },
		);
		data.sessions = data.sessions.filter((s) => s.taskId !== taskId);
		data.sessions.push({
			taskId,
			agentId,
			sessionId,
			startedAt: new Date().toISOString(),
		});
		atomicWriteJson(sessionRecoveryFile, data);
		logger.debug(
			"recovery",
			`Persisted session ID for task ${taskId}: ${sessionId}`,
		);
	} catch (err) {
		logger.warn(
			"recovery",
			`Failed to persist session record for ${taskId}: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

/**
 * Remove the session record for a task on successful completion or permanent failure.
 * Prevents stale records from triggering spurious resumes.
 */
export function clearSessionRecord(taskId: string): void {
	try {
		const sessionRecoveryFile = path.join(
			getWorkspaceDir("default"),
			"daemon-session-recovery.json",
		);
		const data = readJsonFile<{ sessions: SessionRecord[] }>(
			sessionRecoveryFile,
			{ sessions: [] },
		);
		data.sessions = data.sessions.filter((s) => s.taskId !== taskId);
		atomicWriteJson(sessionRecoveryFile, data);
	} catch {
		// Best effort
	}
}

// ─── Crash Recovery Sweep ────────────────────────────────────────────────────

/**
 * Run at daemon startup to detect and recover from a previous crash.
 *
 * Two sweeps:
 *   1. Status sweep — reads daemon-status.json activeSessions, finds dead PIDs
 *   2. Tasks sweep  — scans tasks.json for all in-progress tasks (belt-and-suspenders)
 *
 * For each orphaned in-progress task:
 *   - If a persisted session ID exists → add to sessionsToResume (caller attempts --resume)
 *   - Otherwise → reset kanban to "not-started" so the dispatcher picks it up fresh
 */
export function runCrashRecovery(
	workspaceId: string = "default",
): RecoveryResult {
	const result: RecoveryResult = { tasksReset: [], sessionsToResume: [] };

	try {
		const workspaceDir = getWorkspaceDir(workspaceId);
		const statusFile = path.join(workspaceDir, "daemon-status.json");
		const tasksFile = path.join(workspaceDir, "tasks.json");
		const sessionRecoveryFile = path.join(
			workspaceDir,
			"daemon-session-recovery.json",
		);

		// Load persisted session IDs (for resume attempts)
		const sessionRecords =
			readJsonFile<{ sessions: SessionRecord[] }>(sessionRecoveryFile, {
				sessions: [],
			})?.sessions ?? [];

		// ── Sweep 1: identify dead PIDs from last status ──────────────────────
		const status = readJsonFile<{
			activeSessions: Array<{ taskId: string | null; pid: number }>;
		}>(statusFile, { activeSessions: [] });

		const knownDeadTaskIds = new Set<string>();
		const taskPidMap = new Map<string, number>();
		if (status?.activeSessions) {
			for (const session of status.activeSessions) {
				if (!session.taskId) continue;
				taskPidMap.set(session.taskId, session.pid);
				const alive = session.pid > 0 && isProcessRunning(session.pid);
				if (!alive) knownDeadTaskIds.add(session.taskId);
			}
		}

		// ── Sweep 2: all in-progress tasks ───────────────────────────────────
		const tasksData = readJsonFile<{ tasks: Array<Record<string, unknown>> }>(
			tasksFile,
			{ tasks: [] },
		);
		if (!tasksData?.tasks) return result;

		const inProgress = tasksData.tasks.filter(
			(t) =>
				t.kanban === "in-progress" &&
				typeof t.id === "string" &&
				typeof t.assignedTo === "string" &&
				t.assignedTo !== "me" &&
				!t.deletedAt,
		);

		if (inProgress.length === 0) {
			// Clean up any stale session records if no in-progress tasks exist
			if (sessionRecords.length > 0) {
				atomicWriteJson(sessionRecoveryFile, { sessions: [] });
			}
			return result;
		}

		logger.info(
			"recovery",
			`Found ${inProgress.length} in-progress task(s) at startup — running crash recovery`,
		);

		let anyChanged = false;

		for (const task of inProgress) {
			const taskId = task.id as string;
			const _agentId = task.assignedTo as string;
			const record = sessionRecords.find((s) => s.taskId === taskId);

			if (record) {
				// Has a persisted Claude session ID → try --resume
				result.sessionsToResume.push(record);
				logger.info("recovery", "Recovering session", {
					taskId,
					sessionId: record.sessionId,
					pid: taskPidMap.get(taskId) ?? null,
					previouslyRunning: !knownDeadTaskIds.has(taskId),
				});
			} else {
				// No session ID → reset so dispatcher picks it up fresh
				task.kanban = "not-started";
				task.updatedAt = new Date().toISOString();
				result.tasksReset.push(taskId);
				anyChanged = true;
				logger.info(
					"recovery",
					`Task ${taskId} reset to not-started (orphaned, no session record)`,
				);
			}
		}

		if (anyChanged) {
			atomicWriteJson(tasksFile, tasksData);
		}

		if (result.tasksReset.length > 0) {
			logger.info(
				"recovery",
				`Reset ${result.tasksReset.length} orphaned task(s) → not-started`,
			);
		}
		if (result.sessionsToResume.length > 0) {
			logger.info(
				"recovery",
				`${result.sessionsToResume.length} task(s) queued for session resume`,
			);
		}

		return result;
	} catch (err) {
		logger.error(
			"recovery",
			`Crash recovery failed: ${err instanceof Error ? err.message : String(err)}`,
		);
		return result;
	}
}
