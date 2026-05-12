import path from "node:path";
import { NextResponse } from "next/server";
import { readJSON, writeJSON } from "@/lib/json-io";
import { DATA_DIR } from "@/lib/paths";
import { applyWorkspaceContext } from "@/lib/workspace-context";

interface TaskEntry {
	id: string;
	kanban: string;
	updatedAt?: string;
	[key: string]: unknown;
}

interface RunEntry {
	id: string;
	taskId: string;
	status: string;
	pid: number;
	completedAt?: string | null;
	error?: string | null;
}

/**
 * Kill a process tree.
 */
async function killProcess(pid: number): Promise<boolean> {
	if (pid <= 0) return false;
	try {
		const treeKill = (await import("tree-kill")).default;
		return new Promise((resolve) => {
			treeKill(pid, "SIGTERM", (err?: Error) => {
				resolve(!err);
			});
		});
	} catch {
		try {
			process.kill(pid, "SIGTERM");
			return true;
		} catch {
			return false;
		}
	}
}

// ─── POST: Stop a running task ──────────────────────────────────────────────

export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	return applyWorkspaceContext(async (_workspaceId) => {
		const { id: taskId } = await params;
		const now = new Date().toISOString();

		// 1. Find running entry for this task
		const runsPath = path.join(DATA_DIR, "active-runs.json");
		const runsData = readJSON<{ runs: RunEntry[] }>(runsPath) ?? { runs: [] };
		const runEntry = runsData.runs.find(
			(r) => r.taskId === taskId && r.status === "running",
		);

		if (!runEntry) {
			return NextResponse.json(
				{ error: "Task is not currently running" },
				{ status: 404 },
			);
		}

		// 2. Kill the process
		const killed = await killProcess(runEntry.pid);

		// 3. Update run entry
		runEntry.status = "stopped";
		runEntry.completedAt = now;
		runEntry.error = "Stopped by user";
		writeJSON(runsPath, runsData);

		// 4. Reset task to not-started
		const tasksPath = path.join(DATA_DIR, "tasks.json");
		const tasksData = readJSON<{ tasks: TaskEntry[] }>(tasksPath);
		if (tasksData) {
			const task = tasksData.tasks.find((t) => t.id === taskId);
			if (task && task.kanban === "in-progress") {
				task.kanban = "not-started";
				task.updatedAt = now;
				writeJSON(tasksPath, tasksData);
			}
		}

		// 4.5 Cancel linked conversation if any
		try {
			const tasksData2 = readJSON<{
				tasks: Array<{ id: string; conversationId?: string | null }>;
			}>(tasksPath);
			const task = tasksData2?.tasks.find((t) => t.id === taskId);
			const conversationId = task?.conversationId;
			if (conversationId) {
				const { getConversation, updateConversationRun, updateConversation } =
					await import("@/lib/conversations");
				const { publishAndEmit } = await import("@/lib/conversation-event-bus");
				const conv = await getConversation(conversationId);
				if (
					conv &&
					!["completed", "failed", "cancelled"].includes(conv.status)
				) {
					const previousRunId = conv.currentRunId;
					if (previousRunId) {
						await updateConversationRun(previousRunId, {
							status: "stopped",
							completedAt: now,
						});
					}
					await updateConversation(conversationId, {
						status: "cancelled",
						cancelledAt: now,
						currentRunId: null,
					});
					await publishAndEmit({
						type: "conversation.cancelled",
						conversationId,
						payload: {
							runId: previousRunId,
							reason: "Stopped by user",
						},
					});
				}
			}
		} catch (err) {
			console.warn(
				`[stop] Failed to cancel conversation for task ${taskId}:`,
				err,
			);
			// Non-fatal — task PID is already killed
		}

		return NextResponse.json({
			taskId,
			killed,
			status: "stopped",
		});
	});
}
