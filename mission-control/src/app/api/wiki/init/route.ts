import { NextResponse } from "next/server";
import { initWikiDir } from "@/lib/data";
import { getWikiDir, getWorkspaceDir } from "@/lib/paths";
import {
	ensureWikiBootstrappedFromPlugin,
	ensureWikiPluginInstalledDetailed,
	reconcileWikiWithPlugin,
} from "@/lib/wiki-plugin";
import { applyWorkspaceContext } from "@/lib/workspace-context";

export async function POST() {
	try {
		const workspaceId = await applyWorkspaceContext();
		await initWikiDir(workspaceId);

		const wikiDir = getWikiDir(workspaceId);
		const workspaceDir = getWorkspaceDir(workspaceId);
		const plugin = ensureWikiPluginInstalledDetailed(workspaceDir, {
			update: true,
		});
		const bootstrap = ensureWikiBootstrappedFromPlugin(
			wikiDir,
			plugin.installPath,
			`Workspace ${workspaceId}`,
			{ workspaceDir },
		);
		reconcileWikiWithPlugin(wikiDir, plugin.installPath);

		return NextResponse.json({
			ok: true,
			workspaceId,
			pluginStatus: plugin.status,
			pluginVersion: plugin.version,
			pluginUpdated: plugin.updated,
			bootstrapStatus: bootstrap.status,
			hasLockFile: Boolean(bootstrap.lockFile),
			hasCoverageReport: Boolean(bootstrap.coverageReport),
			reconciled: true,
		});
	} catch (err) {
		return NextResponse.json(
			{
				error: err instanceof Error ? err.message : "Failed to initialize wiki",
			},
			{ status: 500 },
		);
	}
}
