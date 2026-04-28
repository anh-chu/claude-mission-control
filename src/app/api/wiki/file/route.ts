import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getWikiDir } from "@/lib/paths";
import { applyWorkspaceContext } from "@/lib/workspace-context";

const MIME_MAP: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
	pdf: "application/pdf",
	txt: "text/plain; charset=utf-8",
	md: "text/markdown; charset=utf-8",
};

function safeWikiPath(wikiDir: string, rel: string): string | null {
	if (!rel) return null;
	const resolved = path.resolve(wikiDir, rel);
	if (resolved === wikiDir || !resolved.startsWith(wikiDir + path.sep))
		return null;
	return resolved;
}

export async function GET(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const wikiDir = getWikiDir(workspaceId);
	const { searchParams } = new URL(request.url);
	const rel = searchParams.get("path") ?? "";

	const filePath = safeWikiPath(wikiDir, rel);
	if (!filePath)
		return NextResponse.json({ error: "Invalid path" }, { status: 400 });

	try {
		const info = await stat(filePath);
		if (info.isDirectory())
			return NextResponse.json({ error: "Not a file" }, { status: 400 });

		const ext = path.extname(filePath).slice(1).toLowerCase();
		const contentType = MIME_MAP[ext] ?? "application/octet-stream";
		const buffer = await readFile(filePath);

		return new Response(buffer, {
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "private, max-age=60",
			},
		});
	} catch {
		return NextResponse.json({ error: "File not found" }, { status: 404 });
	}
}
