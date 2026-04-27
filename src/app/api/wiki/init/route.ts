import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { initWikiDir } from "@/lib/data";
import { getWikiDir, getWorkspaceDir } from "@/lib/paths";
import {
	ensureWikiBootstrappedFromPlugin,
	ensureWikiPluginInstalledDetailed,
	reconcileWikiWithPlugin,
} from "@/lib/wiki-plugin";
import { applyWorkspaceContext } from "@/lib/workspace-context";

const UPDATE_DEBOUNCE_MS = 60 * 60 * 1000; // 1 hour

function shouldUpdatePlugin(wikiDir: string): boolean {
	const stampFile = path.join(wikiDir, ".plugin-update-ts");
	if (!existsSync(stampFile)) return true;
	try {
		const ts = Number(readFileSync(stampFile, "utf-8").trim());
		return Date.now() - ts > UPDATE_DEBOUNCE_MS;
	} catch {
		return true;
	}
}

function markPluginUpdated(wikiDir: string): void {
	try {
		writeFileSync(
			path.join(wikiDir, ".plugin-update-ts"),
			String(Date.now()),
			"utf-8",
		);
	} catch {
		// best-effort
	}
}

function cachePluginPath(wikiDir: string, installPath: string): void {
	try {
		writeFileSync(path.join(wikiDir, ".plugin-path"), installPath, "utf-8");
	} catch {
		// best-effort
	}
}

export async function POST() {
	try {
		const workspaceId = await applyWorkspaceContext();
		await initWikiDir(workspaceId);

		const wikiDir = getWikiDir(workspaceId);
		const workspaceDir = getWorkspaceDir(workspaceId);
		const doUpdate = shouldUpdatePlugin(wikiDir);
		const plugin = ensureWikiPluginInstalledDetailed(workspaceDir, {
			update: doUpdate,
		});
		if (doUpdate) {
			markPluginUpdated(wikiDir);
			// Main daemon will re-preheat SDK naturally on next job consumption
		}
		cachePluginPath(wikiDir, plugin.installPath);
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
