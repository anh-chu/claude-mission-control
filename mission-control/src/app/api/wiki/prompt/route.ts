import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import { getWikiDir } from "@/lib/paths";
import { applyWorkspaceContext } from "@/lib/workspace-context";
import { initWikiDir } from "@/lib/data";

const DEFAULT_PROMPT = `You are managing a markdown wiki knowledge base.

Review the files in this directory, then:
1. Update or create wiki pages based on any new source documents
2. Maintain consistent cross-links between pages
3. Keep index.md current with a table of contents

Focus on accuracy and conciseness. Do not delete existing wiki pages unless
they are fully superseded. Preserve the existing directory structure.`;

function getPromptFile(workspaceId: string): string {
	return path.join(getWikiDir(workspaceId), "prompts", "default.md");
}

export async function GET() {
	try {
		const workspaceId = await applyWorkspaceContext();

		await initWikiDir(workspaceId);
		const promptFile = getPromptFile(workspaceId);

		if (!existsSync(promptFile)) {
			return NextResponse.json({ content: DEFAULT_PROMPT, isDefault: true });
		}

		const content = await readFile(promptFile, "utf-8");
		return NextResponse.json({ content, isDefault: false });
	} catch (err) {
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : "Failed to read prompt" },
			{ status: 500 },
		);
	}
}

export async function PUT(request: Request) {
	try {
		const workspaceId = await applyWorkspaceContext();

		await initWikiDir(workspaceId);
		const { content } = (await request.json()) as { content?: string };

		if (typeof content !== "string") {
			return NextResponse.json({ error: "content required" }, { status: 400 });
		}

		const promptFile = getPromptFile(workspaceId);
		await mkdir(path.dirname(promptFile), { recursive: true });
		await writeFile(promptFile, content, "utf-8");

		return NextResponse.json({ ok: true });
	} catch (err) {
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : "Failed to save prompt" },
			{ status: 500 },
		);
	}
}
