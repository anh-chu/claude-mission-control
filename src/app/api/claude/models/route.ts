import { type ModelInfo, startup } from "@anthropic-ai/claude-agent-sdk";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guards";
import { resolveClaudeExecutable } from "@/lib/claude-sdk";

let cachedModels: ModelInfo[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getModels(): Promise<ModelInfo[]> {
	const now = Date.now();
	if (cachedModels && now < cacheExpiry) {
		return cachedModels;
	}

	let models: ModelInfo[] = [];
	const pathToClaudeCodeExecutable = resolveClaudeExecutable() ?? undefined;
	const warm = await startup({
		options: { maxTurns: 1, pathToClaudeCodeExecutable },
	});
	const q = warm.query("__init_probe__");

	try {
		for await (const message of q) {
			if (message.type === "system" && message.subtype === "init") {
				models = await q.supportedModels();
				break;
			}
		}
	} finally {
		q.close();
	}

	// Only cache non-empty results so a single bad cold start can't poison the
	// cache for an hour.
	if (models.length > 0) {
		cachedModels = models;
		cacheExpiry = now + CACHE_TTL;
	}
	return models;
}

export async function GET() {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;
	try {
		const models = await getModels();
		return NextResponse.json(
			{ models },
			{ headers: { "Cache-Control": "public, max-age=3600" } },
		);
	} catch (err) {
		console.error("[claude/models] failed to load models:", err);
		return NextResponse.json({ models: [] });
	}
}
