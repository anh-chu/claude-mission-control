import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getWikiDir } from "@/lib/paths";
import { applyWorkspaceContext } from "@/lib/workspace-context";

const ALLOWED_MIME_TYPES = new Set([
	"application/pdf",
	"text/plain",
	"text/markdown",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/svg+xml",
	"application/octet-stream", // fallback — validated by extension below
]);

const ALLOWED_EXTENSIONS = new Set([
	"pdf",
	"txt",
	"md",
	"doc",
	"docx",
	"xls",
	"xlsx",
	"ppt",
	"pptx",
	"jpg",
	"jpeg",
	"png",
	"gif",
	"webp",
	"svg",
	"csv",
	"json",
	"yaml",
	"yml",
	"xml",
	"html",
	"sh",
]);

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

function sanitizeFilename(name: string): string {
	return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
}

function getExtension(filename: string, mimeType: string): string {
	const ext = filename.split(".").pop()?.toLowerCase();
	if (ext && ext.length <= 5) return ext;
	const mimeMap: Record<string, string> = {
		"application/pdf": "pdf",
		"text/plain": "txt",
		"text/markdown": "md",
		"application/msword": "doc",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document":
			"docx",
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/gif": "gif",
		"image/webp": "webp",
		"image/svg+xml": "svg",
	};
	return mimeMap[mimeType] ?? "bin";
}

function safeWikiPath(wikiDir: string, rel: string): string | null {
	if (!rel || rel === ".") return wikiDir;
	const resolved = path.resolve(wikiDir, rel);
	if (resolved !== wikiDir && !resolved.startsWith(wikiDir + path.sep))
		return null;
	return resolved;
}

export async function POST(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const wikiDir = getWikiDir(workspaceId);

	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
	}

	const file = formData.get("file");
	if (!file || !(file instanceof File)) {
		return NextResponse.json({ error: "No file provided" }, { status: 400 });
	}

	const dir = (formData.get("dir") as string) ?? "";
	const targetDir = safeWikiPath(wikiDir, dir);
	if (!targetDir)
		return NextResponse.json({ error: "Invalid directory" }, { status: 400 });

	const fileExt = file.name.split(".").pop()?.toLowerCase() ?? "";
	if (!ALLOWED_MIME_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.has(fileExt)) {
		return NextResponse.json(
			{ error: `File type not allowed: ${file.name}` },
			{ status: 400 },
		);
	}

	if (file.size > MAX_SIZE_BYTES) {
		return NextResponse.json(
			{ error: "File exceeds 20MB limit" },
			{ status: 400 },
		);
	}

	const ext = getExtension(file.name, file.type);
	const baseName = sanitizeFilename(file.name.replace(/\.[^.]+$/, ""));
	const savedFilename = `${baseName}.${ext}`;
	const filePath = path.join(targetDir, savedFilename);

	try {
		await mkdir(targetDir, { recursive: true });
		const buffer = Buffer.from(await file.arrayBuffer());
		await writeFile(filePath, buffer);
	} catch {
		return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
	}

	const relPath = dir ? `${dir}/${savedFilename}` : savedFilename;
	return NextResponse.json({
		filename: savedFilename,
		path: relPath,
		originalName: file.name,
	});
}
