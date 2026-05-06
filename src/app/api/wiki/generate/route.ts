import { spawn } from "node:child_process";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import {
	DOC_MAINTAINER_AGENT_ID,
	getWorkspaceDataDir,
	mutateActiveRuns,
} from "@/lib/data";
import { getWikiDir } from "@/lib/paths";
import { resolveScriptEntrypoint } from "@/lib/script-entrypoints";
import { applyWorkspaceContext } from "@/lib/workspace-context";

interface WikiJobFile {
	runId: string;
	workspaceId: string;
	agentId: string;
	model: string;
	sessionId: string | null;
	message: string | null;
}

function writeJobFile(wikiDir: string, job: WikiJobFile): string {
	const jobsDir = path.join(wikiDir, ".jobs");
	mkdirSync(jobsDir, { recursive: true });
	// Atomic write: tmp then rename to avoid partial-read races
	const tmpPath = path.join(jobsDir, `${job.runId}.tmp`);
	const finalPath = path.join(jobsDir, `${job.runId}.json`);
	writeFileSync(tmpPath, JSON.stringify(job, null, 2), "utf-8");
	renameSync(tmpPath, finalPath);
	return finalPath;
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

		// Write job file
		const job: WikiJobFile = {
			runId,
			workspaceId,
			agentId: body.agentId?.trim() || DOC_MAINTAINER_AGENT_ID,
			model: body.model?.trim() || "",
			sessionId: body.sessionId?.trim() || null,
			message: body.message?.trim() || null,
		};
		const jobFilePath = writeJobFile(wikiDir, job);

		// Spawn wiki-processor as a detached child process
		const cwd = process.cwd();
		const wikiEntry = resolveScriptEntrypoint("wiki-processor");
		const args = [...wikiEntry.args, jobFilePath, workspaceId];

		let pid = 0;
		try {
			const child = spawn(wikiEntry.runner, args, {
				cwd,
				detached: true,
				stdio: "ignore",
				shell: false,
			});
			child.unref();
			pid = child.pid ?? 0;
		} catch (err) {
			return NextResponse.json(
				{
					error: `Failed to spawn wiki processor: ${err instanceof Error ? err.message : String(err)}`,
				},
				{ status: 500 },
			);
		}

		// Write ActiveRunEntry with actual PID
		await mutateActiveRuns(async (data) => {
			data.runs.push({
				id: runId,
				taskId: "",
				agentId: job.agentId,
				source: "wiki",
				projectId: null,
				missionId: null,
				pid,
				status: "running",
				startedAt,
				completedAt: null,
				exitCode: null,
				error: null,
				costUsd: null,
				numTurns: null,
				continuationIndex: 0,
				streamFile: streamFilePath,
				sessionId: job.sessionId,
				firstMessage: job.message,
				model: body.model?.trim() || null,
				noPrune: true,
			});
			return undefined;
		});

		return NextResponse.json(
			{ runId, workspaceId, startedAt, pid },
			{ status: 202 },
		);
	} catch (err) {
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : "Internal server error" },
			{ status: 500 },
		);
	}
}
