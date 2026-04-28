import { rename, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getWikiDir } from "@/lib/paths";
import { applyWorkspaceContext } from "@/lib/workspace-context";

function safeWikiPath(wikiDir: string, rel: string): string | null {
	if (!rel) return null;
	const resolved = path.resolve(wikiDir, rel);
	if (resolved === wikiDir || !resolved.startsWith(wikiDir + path.sep))
		return null;
	return resolved;
}

export async function POST(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const wikiDir = getWikiDir(workspaceId);

	const body: { from?: string; to?: string } = await request.json();
	if (
		!body.from ||
		!body.to ||
		typeof body.from !== "string" ||
		typeof body.to !== "string"
	) {
		return NextResponse.json(
			{ error: "Missing from/to paths" },
			{ status: 400 },
		);
	}

	const fromPath = safeWikiPath(wikiDir, body.from);
	const toPath = safeWikiPath(wikiDir, body.to);

	if (!fromPath || !toPath) {
		return NextResponse.json({ error: "Invalid path" }, { status: 400 });
	}

	// Prevent moving a directory into itself or a descendant
	if (toPath.startsWith(fromPath + path.sep) || toPath === fromPath) {
		return NextResponse.json(
			{ error: "Cannot move a folder into itself" },
			{ status: 400 },
		);
	}

	try {
		await stat(fromPath); // ensure source exists
	} catch {
		return NextResponse.json({ error: "Source not found" }, { status: 404 });
	}

	try {
		await rename(fromPath, toPath);
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ error: "Move failed" }, { status: 500 });
	}
}
