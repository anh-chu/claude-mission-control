import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guards";
import { getWorkspaceDir } from "@/lib/paths";
import { listInstalledPlugins } from "@/lib/plugin-reader";
import { applyWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export async function GET() {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;
	return applyWorkspaceContext(async (workspaceId) => {
		const plugins = await listInstalledPlugins(getWorkspaceDir(workspaceId));
		return NextResponse.json({ plugins });
	});
}
