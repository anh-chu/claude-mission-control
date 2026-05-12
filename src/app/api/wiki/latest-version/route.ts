import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guards";
import { getWikiDir, getWorkspaceDir } from "@/lib/paths";
import {
	compareVersions,
	getLatestAvailableVersion,
	getPluginStatus,
} from "@/lib/wiki-plugin";
import { applyWorkspaceContext } from "@/lib/workspace-context";

const LATEST_VERSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

interface LatestVersionCache {
	latestVersion: string;
	checkedAt: number;
}

function readCache(wikiDir: string): LatestVersionCache | null {
	const stampFile = path.join(wikiDir, ".latest-version-check");
	if (!existsSync(stampFile)) return null;
	try {
		const cached = JSON.parse(
			readFileSync(stampFile, "utf-8"),
		) as LatestVersionCache;
		if (Date.now() - cached.checkedAt < LATEST_VERSION_TTL_MS) return cached;
	} catch {
		// ignore
	}
	return null;
}

function writeCache(wikiDir: string, latestVersion: string): void {
	try {
		writeFileSync(
			path.join(wikiDir, ".latest-version-check"),
			JSON.stringify({ latestVersion, checkedAt: Date.now() }),
			"utf-8",
		);
	} catch {
		// best-effort
	}
}

export async function GET(request: Request) {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;
	const url = new URL(request.url);
	const force = url.searchParams.get("force") === "true";

	return applyWorkspaceContext(async (workspaceId) => {
		try {
			const workspaceDir = getWorkspaceDir(workspaceId);
			const wikiDir = getWikiDir(workspaceId);

			const { version: installedVersion } = getPluginStatus(workspaceDir);

			// Use cache unless forced
			const cached = force ? null : readCache(wikiDir);
			const latestVersion =
				cached?.latestVersion ?? getLatestAvailableVersion();

			if (latestVersion && !cached) {
				writeCache(wikiDir, latestVersion);
			}

			const hasUpdate =
				latestVersion && installedVersion
					? compareVersions(latestVersion, installedVersion) > 0
					: false;

			return NextResponse.json({ installedVersion, latestVersion, hasUpdate });
		} catch {
			return NextResponse.json({
				installedVersion: null,
				latestVersion: null,
				hasUpdate: false,
			});
		}
	});
}
