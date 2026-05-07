import path from "node:path";
import { NextResponse } from "next/server";
import { readJSON, writeJSON } from "@/lib/json-io";
import { DATA_DIR } from "@/lib/paths";

interface RunEntry {
	id: string;
	taskId: string;
	projectId: string | null;
	missionId: string | null;
	pid: number;
	status: string;
	completedAt: string | null;
	error: string | null;
}

interface MissionEntry {
	id: string;
	projectId: string;
	status: string;
	stoppedAt: string | null;
}

interface TaskEntry {
	id: string;
	kanban: string;
	updatedAt: string;
}

/**
 * Kill a process tree. Uses tree-kill if available, falls back to process.kill.
 */
async function killProcess(pid: number): Promise<boolean> {
	if (pid <= 0) return false;
	try {
		// Dynamic import of tree-kill (available in the project)
		const treeKill = (await import("tree-kill")).default;
		return new Promise((resolve) => {
			treeKill(pid, "SIGTERM", (err?: Error) => {
				resolve(!err);
			});
		});
	} catch {
		// Fallback to process.kill
		try {
			process.kill(pid, "SIGTERM");
			return true;
		} catch {
			return false;
		}
	}
}

// ─── POST: Stop a running mission for a project ─────────────────────────────

export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id: projectId } = await params;
	const now = new Date().toISOString();

	// 1. Find running mission for this project
	const missionsPath = path.join(DATA_DIR, "missions.json");
	const missionsData = readJSON<{ missions: MissionEntry[] }>(missionsPath);
	if (!missionsData) {
		return NextResponse.json({ error: "No missions data" }, { status: 404 });
	}

	const mission = missionsData.missions.find(
		(m) =>
			m.projectId === projectId &&
			(m.status === "running" || m.status === "stalled"),
	);
	if (!mission) {
		return NextResponse.json(
			{ error: "No running mission for this project" },
			{ status: 404 },
		);
	}

	// 2. Find all running tasks for this project/mission
	const runsPath = path.join(DATA_DIR, "active-runs.json");
	const runsData = readJSON<{ runs: RunEntry[] }>(runsPath) ?? { runs: [] };
	const runningRuns = runsData.runs.filter(
		(r) =>
			r.status === "running" &&
			(r.projectId === projectId || r.missionId === mission.id),
	);

	// 3. Kill each running process
	const killed: string[] = [];

	// Pre-load tasks.json to check conversationId for each task
	const tasksPath = path.join(DATA_DIR, "tasks.json");
	const tasksFile = readJSON<{
		tasks: Array<{
			id: string;
			conversationId?: string | null;
			kanban?: string;
		}>;
	}>(tasksPath);

	for (const run of runningRuns) {
		const success = await killProcess(run.pid);
		if (success) killed.push(run.taskId);

		// Update run entry
		run.status = "stopped";
		run.completedAt = now;
		run.error = "Stopped by user";

		// Cancel linked conversation if any (non-fatal)
		if (tasksFile) {
			const task = tasksFile.tasks.find((t) => t.id === run.taskId);
			const conversationId = task?.conversationId;
			if (conversationId) {
				try {
					const {
						setConversationsWorkspace,
						getConversation,
						updateConversationRun,
						updateConversation,
					} = await import("@/lib/conversations");
					const { publishAndEmit } = await import(
						"@/lib/conversation-event-bus"
					);
					setConversationsWorkspace("default"); // TODO: use real workspace
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
								reason: "Stopped by project stop",
							},
						});
					}
				} catch (err) {
					console.warn(
						`[stop] Failed to cancel conversation for task ${run.taskId}:`,
						err,
					);
					// Non-fatal — task PID is already killed
				}
			}
		}
	}

	// 4. Write updated active-runs.json
	writeJSON(runsPath, runsData);

	// 5. Update mission status
	mission.status = "stopped";
	mission.stoppedAt = now;
	writeJSON(missionsPath, missionsData);

	// 6. Revert in-progress tasks back to not-started (for clean restart)
	const tasksData = readJSON<{ tasks: TaskEntry[] }>(tasksPath);
	if (tasksData) {
		const stoppedTaskIds = new Set(runningRuns.map((r) => r.taskId));
		for (const task of tasksData.tasks) {
			if (stoppedTaskIds.has(task.id) && task.kanban === "in-progress") {
				task.kanban = "not-started";
				task.updatedAt = now;
			}
		}
		writeJSON(tasksPath, tasksData);
	}

	return NextResponse.json({
		missionId: mission.id,
		killed: killed.length,
		tasksStopped: runningRuns.length,
	});
}
