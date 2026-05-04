import { readdir, rmdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getWikiDir } from "@/lib/paths";
import { isAppFolder } from "@/lib/wiki-helpers";
import { applyWorkspaceContext } from "@/lib/workspace-context";

function safeWikiPath(wikiDir: string, rel: string): string | null {
	if (!rel || rel === ".") return wikiDir;
	const resolved = path.resolve(wikiDir, rel);
	if (resolved !== wikiDir && !resolved.startsWith(wikiDir + path.sep))
		return null;
	return resolved;
}

export async function GET(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const wikiDir = getWikiDir(workspaceId);
	const { searchParams } = new URL(request.url);
	const dir = searchParams.get("dir") ?? "";

	const targetDir = safeWikiPath(wikiDir, dir);
	if (!targetDir)
		return NextResponse.json({ error: "Invalid path" }, { status: 400 });

	try {
		let names: string[];
		try {
			names = await readdir(targetDir);
		} catch {
			return NextResponse.json({ entries: [] });
		}

		const entries = await Promise.all(
			names.map(async (name) => {
				const filePath = path.join(targetDir, name);
				const info = await stat(filePath);
				if (info.isDirectory()) {
					const relPath = dir ? `${dir}/${name}` : name;
					const isApp = await isAppFolder(wikiDir, relPath);
					return {
						name,
						type: (isApp ? "app" : "dir") as "app" | "dir",
						modifiedAt: info.mtime.toISOString(),
					};
				}
				return {
					name,
					type: "file" as const,
					size: info.size,
					modifiedAt: info.mtime.toISOString(),
				};
			}),
		);

		entries.sort((a, b) => {
			const aIsDir = a.type === "dir" || a.type === "app";
			const bIsDir = b.type === "dir" || b.type === "app";
			if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
			return a.name.localeCompare(b.name);
		});

		return NextResponse.json({ entries });
	} catch {
		return NextResponse.json(
			{ error: "Failed to list directory" },
			{ status: 500 },
		);
	}
}

export async function DELETE(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const wikiDir = getWikiDir(workspaceId);

	const body: { path?: string } = await request.json();
	const rel = body.path;
	if (!rel || typeof rel !== "string") {
		return NextResponse.json({ error: "Invalid path" }, { status: 400 });
	}

	const filePath = safeWikiPath(wikiDir, rel);
	if (!filePath || filePath === wikiDir) {
		return NextResponse.json({ error: "Invalid path" }, { status: 400 });
	}

	try {
		const info = await stat(filePath);
		if (info.isDirectory()) {
			await rmdir(filePath); // only succeeds if empty
		} else {
			await unlink(filePath);
		}
		return NextResponse.json({ ok: true });
	} catch (e: unknown) {
		const code = (e as NodeJS.ErrnoException).code;
		if (code === "ENOENT")
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		if (code === "ENOTEMPTY")
			return NextResponse.json(
				{ error: "Folder is not empty" },
				{ status: 409 },
			);
		return NextResponse.json({ error: "Delete failed" }, { status: 500 });
	}
}
