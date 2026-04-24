import { NextResponse } from "next/server";
import { mkdir } from "fs/promises";
import path from "path";
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

	const body: { path?: string } = await request.json();
	const rel = body.path;

	if (!rel || typeof rel !== "string" || /[<>:"|?*]/.test(rel)) {
		return NextResponse.json({ error: "Invalid folder path" }, { status: 400 });
	}

	const folderPath = safeWikiPath(wikiDir, rel);
	if (!folderPath)
		return NextResponse.json({ error: "Invalid path" }, { status: 400 });

	try {
		await mkdir(folderPath, { recursive: true });
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json(
			{ error: "Failed to create folder" },
			{ status: 500 },
		);
	}
}
