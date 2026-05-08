import { NextResponse } from "next/server";
import { getActiveRuns, mutateActiveRuns } from "@/lib/data";
import { isProcessAlive } from "@/lib/process-utils";
import { applyWorkspaceContext } from "@/lib/workspace-context";

// ─── GET: Read a single active run by id ────────────────────────────────────

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	return applyWorkspaceContext(async () => {
		const { id } = await params;
		const data = await getActiveRuns();
		let run = data.runs.find((r) => r.id === id);

		if (!run) {
			return NextResponse.json({ error: "Run not found" }, { status: 404 });
		}

		// Liveness check: mark dead "running" processes as failed
		if (run.status === "running" && run.pid > 0 && !isProcessAlive(run.pid)) {
			const updated = await mutateActiveRuns(async (mutableData) => {
				const stored = mutableData.runs.find((r) => r.id === id);
				if (
					stored &&
					stored.status === "running" &&
					stored.pid > 0 &&
					!isProcessAlive(stored.pid)
				) {
					stored.status = "failed";
					stored.error = "Process terminated unexpectedly";
					stored.completedAt = new Date().toISOString();
				}
				return mutableData;
			});
			run = updated.runs.find((r) => r.id === id) ?? run;
		}

		return NextResponse.json(run);
	});
}
