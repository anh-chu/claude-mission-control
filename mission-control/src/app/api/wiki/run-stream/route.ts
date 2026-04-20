import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getWikiDir } from "@/lib/paths";
import { applyWorkspaceContext } from "@/lib/workspace-context";
import type { WikiRunRecord } from "../../../../../scripts/daemon/run-wiki-generate";

type StreamLine = { type: string; [key: string]: unknown };

function toEvents(raw: string): StreamLine[] {
	const lines = raw
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	const out: StreamLine[] = [];
	for (const line of lines) {
		try {
			out.push(JSON.parse(line) as StreamLine);
		} catch {
			out.push({
				type: "assistant",
				message: { content: [{ type: "text", text: line }] },
			});
		}
	}
	return out;
}

export async function GET(request: Request) {
	try {
		const workspaceId = await applyWorkspaceContext();
		const { searchParams } = new URL(request.url);
		const runId = searchParams.get("runId") ?? "";
		const sinceParam = searchParams.get("since") ?? "0";
		const since = Number.isFinite(Number(sinceParam))
			? Math.max(0, Number(sinceParam))
			: 0;
		if (!runId) {
			return NextResponse.json({ error: "runId is required" }, { status: 400 });
		}

		const wikiDir = getWikiDir(workspaceId);
		const runFile = path.join(wikiDir, ".runs", `${runId}.json`);
		if (!existsSync(runFile)) {
			return NextResponse.json({ error: "Run not found" }, { status: 404 });
		}

		const runRaw = await readFile(runFile, "utf-8");
		const run = JSON.parse(runRaw) as WikiRunRecord;
		const streamPath = run.streamFile
			? path.join(wikiDir, run.streamFile)
			: path.join(wikiDir, ".runs", `${runId}.stream.jsonl`);

		if (!existsSync(streamPath)) {
			return NextResponse.json({ run, events: [] as StreamLine[], next: 0 });
		}

		const streamRaw = await readFile(streamPath, "utf-8");
		const allEvents = toEvents(streamRaw);
		const next = allEvents.length;
		const events = allEvents.slice(since);
		return NextResponse.json({ run, events, next });
	} catch (err) {
		return NextResponse.json(
			{
				error: err instanceof Error ? err.message : "Failed to read run stream",
			},
			{ status: 500 },
		);
	}
}
