import { type SlashCommand, startup } from "@anthropic-ai/claude-agent-sdk";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guards";
import { resolveClaudeExecutable } from "@/lib/claude-sdk";

let cachedCommands: SlashCommand[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getCommands(): Promise<SlashCommand[]> {
	const now = Date.now();
	if (cachedCommands && now < cacheExpiry) {
		return cachedCommands;
	}

	let commands: SlashCommand[] = [];
	const pathToClaudeCodeExecutable = resolveClaudeExecutable() ?? undefined;
	const warm = await startup({
		options: { maxTurns: 1, pathToClaudeCodeExecutable },
	});
	const q = warm.query("__init_probe__");

	try {
		for await (const message of q) {
			if (message.type === "system" && message.subtype === "init") {
				commands = await q.supportedCommands();
				break;
			}
		}
	} finally {
		q.close();
	}

	// Only cache non-empty results so a single bad cold start can't poison the
	// cache for an hour.
	if (commands.length > 0) {
		cachedCommands = commands;
		cacheExpiry = now + CACHE_TTL;
	}
	return commands;
}

export async function GET() {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;
	try {
		const commands = await getCommands();
		return NextResponse.json(
			{ commands },
			{ headers: { "Cache-Control": "public, max-age=3600" } },
		);
	} catch (err) {
		console.error("[claude/slash-commands] failed to load commands:", err);
		return NextResponse.json({ commands: [] });
	}
}
