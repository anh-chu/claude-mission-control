import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guards";
import { getWorkspaceDir } from "@/lib/paths";
import { getPluginStatus } from "@/lib/wiki-plugin";
import { applyWorkspaceContext } from "@/lib/workspace-context";

export async function GET() {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;

	return applyWorkspaceContext(async (workspaceId) => {
		try {
			const workspaceDir = getWorkspaceDir(workspaceId);
			const status = getPluginStatus(workspaceDir);
			return NextResponse.json(status);
		} catch {
			return NextResponse.json({ installed: false, version: null });
		}
	});
}
