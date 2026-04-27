import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import {
	DOC_MAINTAINER_AGENT_ID,
	getWorkspaceDataDir,
	mutateActiveRuns,
} from "@/lib/data";
import { getWikiDir } from "@/lib/paths";
import { applyWorkspaceContext } from "@/lib/workspace-context";

interface WikiJobFile {
	runId: string;
	workspaceId: string;
	agentId: string;
	model: string;
	sessionId: string | null;
	message: string | null;
}

function writeJobFile(wikiDir: string, job: WikiJobFile): void {
	const jobsDir = path.join(wikiDir, ".jobs");
	mkdirSync(jobsDir, { recursive: true });
	// Atomic write: tmp then rename to avoid race with fs.watch
	const tmpPath = path.join(jobsDir, `${job.runId}.tmp`);
	const finalPath = path.join(jobsDir, `${job.runId}.json`);
	writeFileSync(tmpPath, JSON.stringify(job, null, 2), "utf-8");
	renameSync(tmpPath, finalPath);
}

// ─── POST: Trigger wiki generation ───────────────────────────────────────────

export async function POST(request: Request) {
	try {
		const workspaceId = await applyWorkspaceContext();

		let body: {
			agentId?: string;
			model?: string;
			sessionId?: string;
			message?: string;
		} = {};
		try {
			body = (await request.json()) as {
				agentId?: string;
				model?: string;
				sessionId?: string;
				message?: string;
			};
		} catch {
			// body is optional
		}

		const runId = `wiki_${Date.now()}`;
		const wikiDir = getWikiDir(workspaceId);
		const workspaceDataDir = getWorkspaceDataDir(workspaceId);
		const agentStreamsDir = path.join(workspaceDataDir, "agent-streams");
		const streamFilePath = path.join(agentStreamsDir, `${runId}.jsonl`);
		const startedAt = new Date().toISOString();

		// Pre-create empty stream file so SSE can connect immediately
		mkdirSync(agentStreamsDir, { recursive: true });
		writeFileSync(streamFilePath, "", "utf-8");

		// Write ActiveRunEntry to active-runs.json
		await mutateActiveRuns(async (data) => {
			data.runs.push({
				id: runId,
				taskId: "",
				agentId: body.agentId?.trim() || DOC_MAINTAINER_AGENT_ID,
				source: "wiki",
				projectId: null,
				missionId: null,
				pid: 0,
				status: "running",
				startedAt,
				completedAt: null,
				exitCode: null,
				error: null,
				costUsd: null,
				numTurns: null,
				continuationIndex: 0,
				streamFile: streamFilePath,
				sessionId: body.sessionId?.trim() || null,
				firstMessage: body.message?.trim() || null,
				model: body.model?.trim() || null,
				noPrune: true,
			});
			return undefined;
		});

		// Write job file — main daemon fs.watch picks it up
		const job: WikiJobFile = {
			runId,
			workspaceId,
			agentId: body.agentId?.trim() || DOC_MAINTAINER_AGENT_ID,
			model: body.model?.trim() || "",
			sessionId: body.sessionId?.trim() || null,
			message: body.message?.trim() || null,
		};
		writeJobFile(wikiDir, job);

		return NextResponse.json(
			{ runId, workspaceId, startedAt, via: "daemon" },
			{ status: 202 },
		);
	} catch (err) {
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : "Internal server error" },
			{ status: 500 },
		);
	}
}
