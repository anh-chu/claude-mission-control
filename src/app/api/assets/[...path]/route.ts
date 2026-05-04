import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getUploadsDir, getWikiDir } from "@/lib/paths";
import { applyWorkspaceContext } from "@/lib/workspace-context";

const MIME_MAP: Record<string, string> = {
	html: "text/html; charset=utf-8",
	css: "text/css; charset=utf-8",
	js: "text/javascript; charset=utf-8",
	mjs: "text/javascript; charset=utf-8",
	json: "application/json; charset=utf-8",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
	avif: "image/avif",
	ico: "image/x-icon",
	mp4: "video/mp4",
	webm: "video/webm",
	mov: "video/quicktime",
	mp3: "audio/mpeg",
	wav: "audio/wav",
	ogg: "audio/ogg",
	pdf: "application/pdf",
	zip: "application/zip",
	txt: "text/plain; charset=utf-8",
	csv: "text/csv; charset=utf-8",
	xml: "application/xml",
	woff: "font/woff",
	woff2: "font/woff2",
	ttf: "font/ttf",
	otf: "font/otf",
	wasm: "application/wasm",
};

// No-cache for files that may be actively edited
const NO_CACHE_EXTS = new Set(["html", "css", "js", "mjs"]);

function safeWikiPath(wikiDir: string, rel: string): string | null {
	if (!rel) return null;
	const resolved = path.resolve(wikiDir, rel);
	if (resolved === wikiDir || !resolved.startsWith(wikiDir + path.sep))
		return null;
	return resolved;
}

// Resolve a request path to its on-disk location. Paths starting with
// uploads/ are served from the workspace uploads dir; everything else
// resolves against the wiki dir.
function resolveAssetPath(
	workspaceId: string,
	segments: string[],
): string | null {
	if (segments[0] === "uploads") {
		const rest = segments.slice(1).join("/");
		const uploadsDir = getUploadsDir(workspaceId);
		if (!rest) return null;
		const resolved = path.resolve(uploadsDir, rest);
		if (resolved === uploadsDir || !resolved.startsWith(uploadsDir + path.sep))
			return null;
		return resolved;
	}
	return safeWikiPath(getWikiDir(workspaceId), segments.join("/"));
}

function mimeFor(filename: string): string {
	const ext = filename.split(".").pop()?.toLowerCase() ?? "";
	return MIME_MAP[ext] ?? "application/octet-stream";
}

function cacheHeaderFor(filename: string): string {
	const ext = filename.split(".").pop()?.toLowerCase() ?? "";
	return NO_CACHE_EXTS.has(ext)
		? "no-cache, must-revalidate"
		: "private, max-age=300";
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path: segments } = await params;
	if (!segments || segments.length === 0)
		return NextResponse.json({ error: "Invalid path" }, { status: 400 });

	const workspaceId = await applyWorkspaceContext();
	const filePath = resolveAssetPath(workspaceId, segments);
	if (!filePath)
		return NextResponse.json({ error: "Invalid path" }, { status: 400 });

	try {
		const buffer = await readFile(filePath);
		return new Response(buffer, {
			headers: {
				"Content-Type": mimeFor(path.basename(filePath)),
				"Cache-Control": cacheHeaderFor(path.basename(filePath)),
			},
		});
	} catch (e: unknown) {
		if ((e as NodeJS.ErrnoException).code === "ENOENT")
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path: segments } = await params;
	if (!segments || segments.length === 0)
		return NextResponse.json({ error: "Invalid path" }, { status: 400 });

	const workspaceId = await applyWorkspaceContext();
	const filePath = resolveAssetPath(workspaceId, segments);
	if (!filePath)
		return NextResponse.json({ error: "Invalid path" }, { status: 400 });

	try {
		const arrayBuffer = await request.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		await mkdir(path.dirname(filePath), { recursive: true });
		await writeFile(filePath, buffer);
		return NextResponse.json({ ok: true, bytes: buffer.byteLength });
	} catch {
		return NextResponse.json(
			{ error: "Failed to write file" },
			{ status: 500 },
		);
	}
}
