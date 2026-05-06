import { NextResponse } from "next/server";
import {
	getActiveRuns,
	mutateActiveRuns,
	mutateActivityLog,
	mutateDaemonConfig,
} from "@/lib/data";

export async function POST() {
	const results = {
		pollingDisabled: false,
		tasksStopped: 0,
		activityLogged: false,
	};

	// 1. Disable polling so no new tasks are dispatched
	try {
		await mutateDaemonConfig(async (cfg) => ({
			...cfg,
			polling: { ...(cfg.polling as Record<string, unknown>), enabled: false },
		}));
		results.pollingDisabled = true;
	} catch {
		// Non-fatal — log and continue
	}

	// 2. Mark all running runs as stopped, then signal their PIDs.
	// We write first so the UI/API never shows stale "running" state.
	try {
		await mutateActiveRuns(async (data) => {
			const now = new Date().toISOString();
			for (const run of data.runs) {
				if (run.status === "running" && run.pid > 0) {
					try {
						process.kill(run.pid, "SIGTERM");
						results.tasksStopped++;
					} catch {
						// Process already gone — skip
					}
					run.status = "stopped";
					run.completedAt = now;
					run.error = "Emergency stop";
				}
			}
		});
	} catch {
		// active-runs update failed — skip gracefully
	}

	// 3. Log the event
	const details = `Polling disabled. ${results.tasksStopped} task process(es) signaled.`;

	try {
		await mutateActivityLog(async (data) => {
			data.events.push({
				id: `evt_${Date.now()}`,
				type: "agent_checkin",
				actor: "system",
				taskId: null,
				summary: "Emergency stop activated — all autonomous activity frozen",
				details,
				timestamp: new Date().toISOString(),
			});
		});
		results.activityLogged = true;
	} catch {
		// Activity log write failed — skip gracefully
	}

	return NextResponse.json({ ok: true, results });
}
