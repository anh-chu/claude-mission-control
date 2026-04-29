import { NextResponse } from "next/server";
import { listInstalledPlugins } from "@/lib/plugin-reader";
import { applyWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export async function GET() {
	await applyWorkspaceContext();
	const plugins = await listInstalledPlugins();
	return NextResponse.json({ plugins });
}
