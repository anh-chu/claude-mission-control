import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { getWikiDir } from "@/lib/paths";
import { applyWorkspaceContext } from "@/lib/workspace-context";

const TEXT_EXTS = new Set([
	"txt",
	"md",
	"markdown",
	"json",
	"yaml",
	"yml",
	"toml",
	"csv",
	"xml",
	"html",
	"css",
	"js",
	"ts",
	"sh",
]);
const MAX_EDIT_SIZE = 1 * 1024 * 1024; // 1MB

function safeWikiPath(wikiDir: string, rel: string): string | null {
	if (!rel) return null;
	const resolved = path.resolve(wikiDir, rel);
	if (resolved === wikiDir || !resolved.startsWith(wikiDir + path.sep))
		return null;
	return resolved;
}

function isTextFile(filename: string): boolean {
	const ext = filename.split(".").pop()?.toLowerCase() ?? "";
	return TEXT_EXTS.has(ext);
}

export async function GET(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const wikiDir = getWikiDir(workspaceId);
	const { searchParams } = new URL(request.url);
	const rel = searchParams.get("path") ?? "";

	const filePath = safeWikiPath(wikiDir, rel);
	if (!filePath)
		return NextResponse.json({ error: "Invalid path" }, { status: 400 });

	const filename = path.basename(filePath);
	if (!isTextFile(filename)) {
		return NextResponse.json(
			{ error: "File is not a text file" },
			{ status: 400 },
		);
	}

	try {
		const buffer = await readFile(filePath);
		if (buffer.length > MAX_EDIT_SIZE) {
			return NextResponse.json(
				{ error: "File too large to edit (max 1MB)" },
				{ status: 413 },
			);
		}
		return NextResponse.json({ content: buffer.toString("utf-8") });
	} catch {
		return NextResponse.json({ error: "File not found" }, { status: 404 });
	}
}

export async function PUT(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const wikiDir = getWikiDir(workspaceId);

	const body: { path?: string; content?: string } = await request.json();
	const rel = body.path;
	const content = body.content;

	if (!rel || typeof rel !== "string") {
		return NextResponse.json({ error: "Invalid path" }, { status: 400 });
	}
	if (typeof content !== "string") {
		return NextResponse.json({ error: "Missing content" }, { status: 400 });
	}

	const filePath = safeWikiPath(wikiDir, rel);
	if (!filePath)
		return NextResponse.json({ error: "Invalid path" }, { status: 400 });

	if (!isTextFile(path.basename(filePath))) {
		return NextResponse.json(
			{ error: "File is not a text file" },
			{ status: 400 },
		);
	}

	try {
		await mkdir(path.dirname(filePath), { recursive: true });
		await writeFile(filePath, content, "utf-8");
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
	}
}
