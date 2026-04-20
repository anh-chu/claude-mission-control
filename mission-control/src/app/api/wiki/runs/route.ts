import { existsSync } from "fs";
import { readdir, readFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import { getWikiDir } from "@/lib/paths";
import { applyWorkspaceContext } from "@/lib/workspace-context";
import type { WikiRunRecord } from "../../../../../scripts/daemon/run-wiki-generate";

// ─── GET: List wiki runs ─────────────────────────────────────────────────────

export async function GET() {
	try {
		const workspaceId = await applyWorkspaceContext();
		const runsDir = path.join(getWikiDir(workspaceId), ".runs");

		if (!existsSync(runsDir)) {
			return NextResponse.json({ runs: [] });
		}

		let names: string[];
		try {
			names = await readdir(runsDir);
		} catch {
			return NextResponse.json({ runs: [] });
		}

		const jsonFiles = names
			.filter((n) => n.endsWith(".json"))
			.sort()
			.reverse();

		const runs: WikiRunRecord[] = [];
		for (const name of jsonFiles.slice(0, 20)) {
			try {
				const raw = await readFile(path.join(runsDir, name), "utf-8");
				runs.push(JSON.parse(raw) as WikiRunRecord);
			} catch {
				// skip malformed
			}
		}

		// Sort newest first
		runs.sort(
			(a, b) =>
				new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
		);

		return NextResponse.json({ runs });
	} catch (err) {
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : "Failed to list runs" },
			{ status: 500 },
		);
	}
}
