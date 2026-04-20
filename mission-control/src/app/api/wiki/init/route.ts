import { NextResponse } from "next/server";
import { initWikiDir } from "@/lib/data";
import { getWikiDir } from "@/lib/paths";
import { ensureWikiPluginInstalled } from "@/lib/wiki-plugin";
import { applyWorkspaceContext } from "@/lib/workspace-context";

export async function POST() {
	try {
		const workspaceId = await applyWorkspaceContext();
		await initWikiDir(workspaceId);

		const wikiDir = getWikiDir(workspaceId);
		const pluginStatus = ensureWikiPluginInstalled(wikiDir);

		return NextResponse.json({ ok: true, workspaceId, pluginStatus });
	} catch (err) {
		return NextResponse.json(
			{
				error: err instanceof Error ? err.message : "Failed to initialize wiki",
			},
			{ status: 500 },
		);
	}
}
