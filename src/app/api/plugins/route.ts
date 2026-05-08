import { NextResponse } from "next/server";
import { getWorkspaceDir } from "@/lib/paths";
import { listInstalledPlugins } from "@/lib/plugin-reader";
import { applyWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export async function GET() {
	return applyWorkspaceContext(async (workspaceId) => {
		const plugins = await listInstalledPlugins(getWorkspaceDir(workspaceId));
		return NextResponse.json({ plugins });
	});
}
