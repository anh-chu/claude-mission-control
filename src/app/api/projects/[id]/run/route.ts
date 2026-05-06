import { spawn } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";
import { readJSON, writeJSON } from "@/lib/json-io";
import { DATA_DIR } from "@/lib/paths";
import { isProcessAlive } from "@/lib/process-utils";
import { resolveScriptEntrypoint } from "@/lib/script-entrypoints";

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface TaskEntry {
	id: string;
	title: string;
	assignedTo: string | null;
	kanban: string;
	projectId: string | null;
	blockedBy?: string[];
	deletedAt?: string | null;
}

interface RunEntry {
	id: string;
	taskId: string;
	pid: number;
	status: string;
}

interface MissionEntry {
	id: string;
	projectId: string;
	status: string;
	startedAt: string;
	stoppedAt: string | null;
	completedAt: string | null;
	lastTaskCompletedAt: string | null;
	totalTasks: number;
	completedTasks: number;
	failedTasks: number;
	skippedTasks: number;
	taskHistory: unknown[];
	loopDetection: {
		taskAttempts: Record<string, number>;
		taskErrors: Record<string, string[]>;
	};
}

interface DecisionEntry {
	taskId: string | null;
	status: string;
}

// ─── POST: Run all eligible tasks in a project (creates a mission) ──────────

export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id: projectId } = await params;

	// 1. Check for existing running mission
	const missionsPath = path.join(DATA_DIR, "missions.json");
	const missionsData = readJSON<{ missions: MissionEntry[] }>(missionsPath) ?? {
		missions: [],
	};
	const activeMission = missionsData.missions.find(
		(m) => m.projectId === projectId && m.status === "running",
	);
	if (activeMission) {
		return NextResponse.json(
			{
				error: "Mission already running for this project",
				missionId: activeMission.id,
			},
			{ status: 409 },
		);
	}

	// 2. Load tasks
	const tasksData = readJSON<{ tasks: TaskEntry[] }>(
		path.join(DATA_DIR, "tasks.json"),
	);
	if (!tasksData) {
		return NextResponse.json(
			{ error: "Could not read tasks" },
			{ status: 500 },
		);
	}

	// 3. Find eligible project tasks (not done, has agent assigned, not deleted)
	const eligible = tasksData.tasks.filter(
		(t) =>
			t.projectId === projectId &&
			t.kanban !== "done" &&
			t.assignedTo &&
			t.assignedTo !== "me" &&
			!t.deletedAt,
	);

	if (eligible.length === 0) {
		return NextResponse.json(
			{ error: "No eligible tasks to run in this project" },
			{ status: 400 },
		);
	}

	// 4. Pre-validate tasks (check blocked + pending decisions) — fixes toast count bug
	const allTasks = tasksData.tasks;
	const decisionsData = readJSON<{ decisions: DecisionEntry[] }>(
		path.join(DATA_DIR, "decisions.json"),
	);
	const pendingDecisionTaskIds = new Set(
		(decisionsData?.decisions ?? [])
			.filter((d) => d.status === "pending" && d.taskId)
			.map((d) => d.taskId as string),
	);

	const dispatchable = eligible.filter((t) => {
		// Check blocked
		if (t.blockedBy && t.blockedBy.length > 0) {
			const allDone = t.blockedBy.every((depId) => {
				const dep = allTasks.find((d) => d.id === depId);
				return dep?.kanban === "done";
			});
			if (!allDone) return false;
		}
		// Check pending decisions
		if (pendingDecisionTaskIds.has(t.id)) return false;
		return true;
	});

	// 5. Check which tasks are already running (with PID liveness check)
	const runsData = readJSON<{ runs: RunEntry[] }>(
		path.join(DATA_DIR, "active-runs.json"),
	);
	const liveRunningTaskIds = new Set<string>();
	let liveRunningCount = 0;

	for (const run of runsData?.runs ?? []) {
		if (run.status === "running") {
			if (isProcessAlive(run.pid, true)) {
				liveRunningTaskIds.add(run.taskId);
				liveRunningCount++;
			}
		}
	}

	const toRun = dispatchable.filter((t) => !liveRunningTaskIds.has(t.id));
	const skipped = dispatchable.filter((t) => liveRunningTaskIds.has(t.id));

	// 6. Load daemon config for concurrency + agentTeams
	const configData = readJSON<{
		concurrency: { maxParallelAgents: number };
		execution: { agentTeams?: boolean };
	}>(path.join(DATA_DIR, "daemon-config.json"));

	const maxParallel = configData?.concurrency?.maxParallelAgents ?? 3;
	const agentTeams = configData?.execution?.agentTeams ?? false;

	// 7. Respect concurrency limit
	const slotsAvailable = Math.max(0, maxParallel - liveRunningCount);
	const tasksToLaunch = toRun.slice(0, slotsAvailable);
	const queued = toRun.slice(slotsAvailable);

	// 8. Create mission
	const missionId = `mission_${Date.now()}`;
	const mission: MissionEntry = {
		id: missionId,
		projectId,
		status: "running",
		startedAt: new Date().toISOString(),
		stoppedAt: null,
		completedAt: null,
		lastTaskCompletedAt: null,
		totalTasks: eligible.length,
		completedTasks: 0,
		failedTasks: 0,
		skippedTasks: eligible.length - dispatchable.length,
		taskHistory: [],
		loopDetection: { taskAttempts: {}, taskErrors: {} },
	};
	missionsData.missions.push(mission);
	writeJSON(missionsPath, missionsData);

	// 9. Spawn run-task for each task (with --mission flag)
	const cwd = process.cwd();
	const runTaskEntry = resolveScriptEntrypoint("run-task");
	const launched: string[] = [];

	for (const task of tasksToLaunch) {
		const args = [
			...runTaskEntry.args,
			task.id,
			"--source",
			"project-run",
			"--mission",
			missionId,
		];
		if (agentTeams) {
			args.push("--agent-teams");
		}

		try {
			const child = spawn(runTaskEntry.runner, args, {
				cwd,
				detached: true,
				stdio: "ignore",
				shell: false,
			});
			child.unref();
			launched.push(task.id);
		} catch {
			// Skip this task on spawn failure — others may still succeed
		}
	}

	return NextResponse.json({
		missionId,
		projectId,
		launched,
		skipped: skipped.map((t) => t.id),
		queued: queued.map((t) => t.id),
		total: eligible.length,
		dispatchable: dispatchable.length,
	});
}
