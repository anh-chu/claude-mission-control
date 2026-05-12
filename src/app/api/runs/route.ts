import { type NextRequest, NextResponse } from "next/server";
import { getActiveRuns, mutateActiveRuns } from "@/lib/data";
import { isProcessAlive } from "@/lib/process-utils";
import { applyWorkspaceContext } from "@/lib/workspace-context";

// ─── GET: Read active runs with PID liveness check ──────────────────────────

export async function GET(request: NextRequest) {
	return applyWorkspaceContext(async (_workspaceId) => {
		let data = await getActiveRuns();

		// PID liveness check: find dead "running" processes
		const hasDeadProcesses = data.runs.some(
			(run) =>
				run.status === "running" && run.pid > 0 && !isProcessAlive(run.pid),
		);

		// Only acquire the write mutex if we actually need to update
		if (hasDeadProcesses) {
			const updated = await mutateActiveRuns(async (mutableData) => {
				for (const run of mutableData.runs) {
					if (
						run.status === "running" &&
						run.pid > 0 &&
						!isProcessAlive(run.pid)
					) {
						run.status = "failed";
						run.error = "Process terminated unexpectedly";
						run.completedAt = new Date().toISOString();
					}
				}
				return mutableData;
			});
			data = updated;
		}

		// ── URL query param filtering ──────────────────────────────────────────
		const { searchParams } = new URL(request.url);
		const filterTaskId = searchParams.get("taskId");
		const filterAgentId = searchParams.get("agentId");
		const filterStatus = searchParams.get("status");

		let filtered = data.runs;

		if (filterTaskId) {
			filtered = filtered.filter((run) => run.taskId === filterTaskId);
		}
		if (filterAgentId) {
			filtered = filtered.filter((run) => run.agentId === filterAgentId);
		}
		if (filterStatus) {
			const statuses = filterStatus.split(",");
			filtered = filtered.filter((run) => statuses.includes(run.status));
		}

		return NextResponse.json({ runs: filtered });
	});
}
