import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { mutateActivityLog } from "@/lib/data";
import { DATA_DIR } from "@/lib/paths";

export async function POST() {
	const results = {
		daemonStopped: false,
		activityLogged: false,
	};

	// 1. Stop the daemon
	try {
		const pidPath = path.join(DATA_DIR, "daemon.pid");
		if (fs.existsSync(pidPath)) {
			const raw = fs.readFileSync(pidPath, "utf-8").trim();
			const pid = parseInt(raw, 10);
			if (!Number.isNaN(pid)) {
				try {
					process.kill(pid, 0); // Check if process exists
					process.kill(pid, "SIGTERM");
					results.daemonStopped = true;
				} catch {
					// Process not running — skip gracefully
				}
			}
		}
	} catch {
		// No PID file or read error — skip gracefully
	}

	// 2. Log the event
	const details = `Daemon ${results.daemonStopped ? "stopped" : "was not running"}`;

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
