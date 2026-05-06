import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import {
	DOC_MAINTAINER_AGENT_INSTRUCTIONS,
	getWorkspaceDataDir,
} from "../../src/lib/data";
import { getWikiDir, getWorkspaceDir } from "../../src/lib/paths";
import { readActiveRuns, writeActiveRuns } from "./active-runs";
import { logger } from "./logger";
import {
	appendStreamEvent,
	consumeStream,
	getWarmHandle,
	runWithSdk,
} from "./warm-sdk";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WikiAgentConfig {
	id: string;
	name?: string;
	instructions?: string;
}

interface WikiJobFile {
	runId: string;
	workspaceId: string;
	agentId: string;
	model: string;
	sessionId: string | null;
	message: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readAgentConfig(
	workspaceId: string,
	agentId: string,
): WikiAgentConfig | null {
	try {
		const agentsPath = path.join(
			getWorkspaceDataDir(workspaceId),
			"agents.json",
		);
		const raw = readFileSync(agentsPath, "utf-8");
		const data = JSON.parse(raw) as { agents?: WikiAgentConfig[] };
		if (!Array.isArray(data.agents)) return null;
		return data.agents.find((a) => a.id === agentId) ?? null;
	} catch {
		return null;
	}
}

function deleteJobFile(filePath: string): void {
	try {
		rmSync(filePath);
	} catch {
		// best-effort
	}
}

// ─── Job Processor ────────────────────────────────────────────────────────────

async function processWikiJob(
	jobFilePath: string,
	workspaceId: string,
): Promise<void> {
	let job: WikiJobFile | null = null;
	// Retry once after short delay for partial writes
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			job = JSON.parse(readFileSync(jobFilePath, "utf-8")) as WikiJobFile;
			break;
		} catch (err) {
			if (attempt === 0) {
				await new Promise((r) => setTimeout(r, 100));
				continue;
			}
			logger.error(
				"wiki-processor",
				`Failed to read job file ${jobFilePath}: ${err instanceof Error ? err.message : String(err)}`,
			);
			return;
		}
	}
	if (!job) return;

	const { runId, agentId, model, sessionId, message } = job;
	logger.info(
		"wiki-processor",
		`[${workspaceId}] Processing wiki job ${runId}`,
	);

	const workspaceDir = getWorkspaceDir(workspaceId);
	const wikiDir = getWikiDir(workspaceId);
	const agentStreamsDir = path.join(
		getWorkspaceDataDir(workspaceId),
		"agent-streams",
	);
	mkdirSync(agentStreamsDir, { recursive: true });
	const streamFile = path.join(agentStreamsDir, `${runId}.jsonl`);

	// Ensure stream file exists (should be pre-created by generate route, but fallback)
	if (!existsSync(streamFile)) {
		writeFileSync(streamFile, "", "utf-8");
	}

	const selectedAgent = readAgentConfig(workspaceId, agentId);
	const agentInstruction =
		selectedAgent?.instructions?.trim() || DOC_MAINTAINER_AGENT_INSTRUCTIONS;

	let pluginPath: string;
	try {
		pluginPath = readFileSync(
			path.join(wikiDir, ".plugin-path"),
			"utf-8",
		).trim();
	} catch (err) {
		logger.error(
			"wiki-processor",
			`[${workspaceId}] Failed to read .plugin-path for job ${runId}: ${err instanceof Error ? err.message : String(err)}`,
		);
		const activeRunsPath = path.join(
			getWorkspaceDataDir(workspaceId),
			"active-runs.json",
		);
		try {
			const activeRunsData = readActiveRuns(activeRunsPath);
			const idx = activeRunsData.runs.findIndex((r) => r.id === runId);
			if (idx !== -1) {
				const entry = activeRunsData.runs[
					idx
				] as (typeof activeRunsData.runs)[number];
				entry.status = "failed";
				entry.exitCode = 1;
				entry.completedAt = new Date().toISOString();
				writeActiveRuns(activeRunsPath, activeRunsData);
			}
		} catch {
			// best-effort
		}
		deleteJobFile(jobFilePath);
		return;
	}

	const prompt =
		sessionId && message ? message : message?.trim() || "Run wiki maintenance.";

	const sdkBuildOpts = {
		pluginPath,
		agentInstruction,
		workspaceDir,
		wikiDir,
		model: model || "",
		sessionId,
	};

	let exitCode = 1;
	let finalSessionId: string | null = null;

	try {
		const expectedKey = JSON.stringify({
			pluginPath: sdkBuildOpts.pluginPath,
			agentInstruction: sdkBuildOpts.agentInstruction,
			workspaceDir: sdkBuildOpts.workspaceDir,
			wikiDir: sdkBuildOpts.wikiDir,
			model: sdkBuildOpts.model,
		});
		const warmHandle = !sessionId ? getWarmHandle(expectedKey) : null;
		let result: { exitCode: number; sessionId: string | null };

		if (warmHandle) {
			logger.info(
				"wiki-processor",
				`[${workspaceId}] Using warm SDK handle for wiki job ${runId}`,
			);
			const q = warmHandle.query(prompt);
			result = await consumeStream(q, streamFile);
		} else {
			logger.info(
				"wiki-processor",
				`[${workspaceId}] Using cold SDK path for wiki job ${runId} (resume=${!!sessionId})`,
			);
			result = await runWithSdk({ prompt, ...sdkBuildOpts, streamFile });
		}

		exitCode = result.exitCode;
		finalSessionId = result.sessionId;

		// Stale session: retry as fresh run (no resume)
		if (exitCode !== 0 && sessionId) {
			const streamContent = readFileSync(streamFile, "utf-8");
			if (streamContent.includes("No conversation found with session ID")) {
				logger.warn(
					"wiki-processor",
					`[${workspaceId}] Stale session for ${runId}, retrying as fresh run`,
				);
				appendStreamEvent(streamFile, {
					type: "system",
					subtype: "info",
					message: "Previous session expired. Starting fresh conversation.",
				});
				const freshOpts = { ...sdkBuildOpts, sessionId: null };
				const freshResult = await runWithSdk({
					prompt,
					...freshOpts,
					streamFile,
				});
				exitCode = freshResult.exitCode;
				finalSessionId = freshResult.sessionId;
			}
		}
	} catch (err) {
		appendStreamEvent(streamFile, {
			type: "system",
			subtype: "sdk_error",
			message: err instanceof Error ? err.message : String(err),
		});
		logger.error(
			"wiki-processor",
			`[${workspaceId}] Wiki job ${runId} SDK error: ${err instanceof Error ? err.message : String(err)}`,
		);
		exitCode = 1;
	}

	// Update active-runs.json
	const completedAt = new Date().toISOString();
	const activeRunsPath = path.join(
		getWorkspaceDataDir(workspaceId),
		"active-runs.json",
	);
	try {
		const activeRunsData = readActiveRuns(activeRunsPath);
		const idx = activeRunsData.runs.findIndex((r) => r.id === runId);
		if (idx !== -1) {
			const entry = activeRunsData.runs[
				idx
			] as (typeof activeRunsData.runs)[number];
			entry.status = exitCode === 0 ? "completed" : "failed";
			entry.exitCode = exitCode;
			entry.completedAt = completedAt;
			entry.sessionId = finalSessionId ?? null;
			writeActiveRuns(activeRunsPath, activeRunsData);
		}
	} catch (err) {
		logger.warn(
			"wiki-processor",
			`[${workspaceId}] Failed to update active-runs for wiki job ${runId}: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	logger.info(
		"wiki-processor",
		`[${workspaceId}] Wiki job ${runId} finished with exit code ${exitCode}`,
	);
	deleteJobFile(jobFilePath);
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

const [jobFilePath, workspaceId] = process.argv.slice(2);

if (!jobFilePath || !workspaceId) {
	console.error(
		"Usage: node --import tsx scripts/daemon/wiki-processor.ts <jobFilePath> <workspaceId>",
	);
	process.exit(1);
}

processWikiJob(jobFilePath, workspaceId)
	.then(() => {
		process.exit(0);
	})
	.catch((err) => {
		logger.error(
			"wiki-processor",
			`Fatal: ${err instanceof Error ? err.message : String(err)}`,
		);
		process.exit(1);
	});
