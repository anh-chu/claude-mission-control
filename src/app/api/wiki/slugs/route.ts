import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getWikiDir } from "@/lib/paths";
import { applyWorkspaceContext } from "@/lib/workspace-context";

type SlugBuckets = {
	entities: string[];
	concepts: string[];
	comparisons: string[];
	root: string[];
};

async function readMarkdownSlugsFromDir(dirPath: string): Promise<string[]> {
	try {
		const entries = await readdir(dirPath, { withFileTypes: true });
		return entries
			.filter(
				(entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"),
			)
			.map((entry) => entry.name.slice(0, -3))
			.sort((a, b) => a.localeCompare(b));
	} catch (e: unknown) {
		const code = (e as NodeJS.ErrnoException).code;
		if (code === "ENOENT") return [];
		throw e;
	}
}

export async function GET() {
	const workspaceId = await applyWorkspaceContext();
	const wikiDir = getWikiDir(workspaceId);

	try {
		const [entities, concepts, comparisons, root] = await Promise.all([
			readMarkdownSlugsFromDir(path.join(wikiDir, "entities")),
			readMarkdownSlugsFromDir(path.join(wikiDir, "concepts")),
			readMarkdownSlugsFromDir(path.join(wikiDir, "comparisons")),
			readMarkdownSlugsFromDir(wikiDir),
		]);

		const body: SlugBuckets = {
			entities,
			concepts,
			comparisons,
			root,
		};

		return NextResponse.json(body, {
			headers: {
				"Cache-Control": "private, max-age=10",
			},
		});
	} catch {
		return NextResponse.json(
			{ error: "Failed to list slugs" },
			{ status: 500 },
		);
	}
}
