import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guards";
import { syncAllAgentCommands } from "@/lib/sync-commands";
import { applyWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

/**
 * POST /api/sync — Regenerates all `.claude/commands/` and `skills/` files
 * from the agent registry and skills library JSON data.
 */
export async function POST() {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;
	return applyWorkspaceContext(async (workspaceId) => {
		try {
			await syncAllAgentCommands(workspaceId);
			return NextResponse.json({
				ok: true,
				message: "All agent commands synced.",
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unknown error";
			return NextResponse.json(
				{ error: "Sync failed", details: message },
				{ status: 500 },
			);
		}
	});
}
