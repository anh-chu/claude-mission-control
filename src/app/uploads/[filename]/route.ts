import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getUploadsDir } from "@/lib/paths";
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

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ filename: string }> },
) {
	const workspaceId = await applyWorkspaceContext();
	const uploadsDir = getUploadsDir(workspaceId);
	const { filename } = await params;

	// Prevent path traversal
	const safe = path.basename(filename);
	if (!safe || safe !== filename) {
		return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
	}

	const filePath = path.join(uploadsDir, safe);
	if (!existsSync(filePath)) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const ext = safe.split(".").pop()?.toLowerCase() ?? "";
	const contentType = MIME_MAP[ext] ?? "application/octet-stream";

	const buffer = readFileSync(filePath);
	return new Response(buffer, {
		headers: {
			"Content-Type": contentType,
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}
