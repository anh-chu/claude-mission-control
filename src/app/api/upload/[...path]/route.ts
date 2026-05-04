import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getUploadsDir } from "@/lib/paths";
import { applyWorkspaceContext } from "@/lib/workspace-context";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

function sanitizeFilename(name: string): string {
	const lowered = name.toLowerCase();
	const cleaned = lowered.replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
	const trimmed = cleaned.replace(/^[-.]+/, "").replace(/-+$/, "");
	return trimmed || "file";
}

function safeUploadPath(uploadsDir: string, rel: string): string | null {
	if (!rel) return uploadsDir;
	const resolved = path.resolve(uploadsDir, rel);
	if (resolved !== uploadsDir && !resolved.startsWith(uploadsDir + path.sep))
		return null;
	return resolved;
}

async function pickAvailableName(
	dir: string,
	filename: string,
): Promise<string> {
	const ext = path.extname(filename);
	const stem = filename.slice(0, filename.length - ext.length);
	let candidate = filename;
	let n = 2;
	while (true) {
		try {
			await stat(path.join(dir, candidate));
			candidate = `${stem}-${n}${ext}`;
			n += 1;
		} catch {
			return candidate;
		}
	}
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ path: string[] }> },
) {
	const { path: segments } = await params;
	const workspaceId = await applyWorkspaceContext();
	const uploadsRoot = getUploadsDir(workspaceId);

	const subPath = (segments ?? []).join("/");
	const targetDir = safeUploadPath(uploadsRoot, subPath);
	if (!targetDir)
		return NextResponse.json({ error: "Invalid path" }, { status: 400 });

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return NextResponse.json(
			{ error: "Expected multipart/form-data" },
			{ status: 400 },
		);
	}

	const file = form.get("file");
	if (!(file instanceof File))
		return NextResponse.json({ error: "Missing file field" }, { status: 400 });

	if (file.size > MAX_UPLOAD_BYTES)
		return NextResponse.json(
			{ error: "File exceeds 50MB limit" },
			{ status: 413 },
		);

	const filename = sanitizeFilename(file.name || "file");

	try {
		await mkdir(targetDir, { recursive: true });
		const finalName = await pickAvailableName(targetDir, filename);
		const targetPath = path.join(targetDir, finalName);
		const bytes = Buffer.from(await file.arrayBuffer());
		await writeFile(targetPath, bytes);

		const relParts = [...(segments ?? []), finalName].filter(Boolean);
		const relUrl = relParts.map(encodeURIComponent).join("/");
		const relPath = relParts.join("/");
		return NextResponse.json({
			url: `/api/assets/uploads/${relUrl}`,
			path: `uploads/${relPath}`,
			size: bytes.length,
			mimeType: file.type || "application/octet-stream",
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : "Write failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
