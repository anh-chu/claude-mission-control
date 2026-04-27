/**
 * migrate-wiki-runs.ts — One-shot migration script for existing wiki runs.
 * Converts legacy .runs/ format to active-runs.json format.
 */

import { readdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { getWorkspaceDataDir, setCurrentWorkspace } from "../src/lib/data";
import { getWikiDir } from "../src/lib/paths";
import type { ActiveRunEntry } from "./daemon/active-runs";

interface OldRunRecord {
	id: string;
	agentId: string;
	status: string;
	startedAt: string;
	completedAt: string | null;
	exitCode: number | null;
	error: string | null;
	sessionId?: string;
	model?: string;
}

const VALID_STATUSES = new Set<ActiveRunEntry["status"]>([
	"running",
	"completed",
	"failed",
	"timeout",
	"stopped",
]);

function mapStatus(oldStatus: string): ActiveRunEntry["status"] {
	return VALID_STATUSES.has(oldStatus as ActiveRunEntry["status"])
		? (oldStatus as ActiveRunEntry["status"])
		: "failed";
}

async function migrateWikiRuns(deleteOldRuns: boolean): Promise<void> {
	const workspaceId = "default";
	setCurrentWorkspace(workspaceId);

	const wikiDir = getWikiDir(workspaceId);
	const runsDir = path.join(wikiDir, ".runs");
	const agentStreamsDir = path.join(
		getWorkspaceDataDir(workspaceId),
		"agent-streams",
	);

	console.log(`📁 Wiki directory: ${wikiDir}`);
	console.log(`📁 Legacy runs directory: ${runsDir}`);
	console.log(`📁 Agent streams directory: ${agentStreamsDir}`);
	console.log("");

	// Read all .runs/*.json files
	let runFiles: string[];
	try {
		runFiles = await readdir(runsDir);
		runFiles = runFiles.filter(
			(f) => f.endsWith(".json") && !f.includes(".stream"),
		);
	} catch {
		console.log("⚠️  No .runs/ directory found. Nothing to migrate.");
		return;
	}

	if (runFiles.length === 0) {
		console.log("⚠️  No run records found in .runs/. Nothing to migrate.");
		return;
	}

	console.log(`📋 Found ${runFiles.length} run record(s) to migrate.`);
	console.log("");

	// Read existing active-runs.json
	const activeRunsPath = path.join(
		getWorkspaceDataDir(workspaceId),
		"active-runs.json",
	);
	let activeRunsData: { runs: ActiveRunEntry[] };
	try {
		const raw = await readFile(activeRunsPath, "utf-8");
		activeRunsData = JSON.parse(raw);
	} catch {
		activeRunsData = { runs: [] };
	}

	const existingIds = new Set(activeRunsData.runs.map((r) => r.id));
	const migratedRuns: ActiveRunEntry[] = [];

	// Process each run record
	for (const file of runFiles) {
		const runId = file.replace(".json", "");
		const runPath = path.join(runsDir, file);

		// Skip if already exists in active-runs.json
		if (existingIds.has(runId)) {
			console.log(`⏭️  Skipping ${runId} (already exists in active-runs.json)`);
			continue;
		}

		try {
			const raw = await readFile(runPath, "utf-8");
			const oldRun: OldRunRecord = JSON.parse(raw);

			// Build stream file paths
			const oldStreamFile = path.join(runsDir, `${runId}.stream.jsonl`);
			const newStreamFile = path.join(agentStreamsDir, `${runId}.jsonl`);

			// Create ActiveRunEntry
			const entry: ActiveRunEntry = {
				id: oldRun.id,
				taskId: "",
				agentId: oldRun.agentId,
				source: "wiki",
				projectId: null,
				missionId: null,
				pid: 0,
				status: mapStatus(oldRun.status),
				startedAt: oldRun.startedAt,
				completedAt: oldRun.completedAt,
				exitCode: oldRun.exitCode,
				error: oldRun.error,
				costUsd: null,
				numTurns: null,
				continuationIndex: 0,
				streamFile: newStreamFile,
				sessionId: oldRun.sessionId ?? null,
				firstMessage: null,
				model: oldRun.model ?? null,
				noPrune: true,
			};

			migratedRuns.push(entry);
			console.log(`✅ Migrated: ${runId} (${oldRun.status})`);
		} catch (err) {
			console.error(`❌ Failed to read ${file}:`, err);
		}
	}

	// Move stream files
	for (const entry of migratedRuns) {
		const oldStreamFile = path.join(runsDir, `${entry.id}.stream.jsonl`);
		const newStreamFile = entry.streamFile;

		try {
			await rename(oldStreamFile, newStreamFile!);
			console.log(
				`📦 Moved stream file: ${entry.id}.stream.jsonl -> agent-streams/${entry.id}.jsonl`,
			);
		} catch (err) {
			console.warn(`⚠️  Could not move stream file for ${entry.id}:`, err);
		}
	}

	// Append entries to active-runs.json
	if (migratedRuns.length > 0) {
		activeRunsData.runs.push(...migratedRuns);
		await writeFile(
			activeRunsPath,
			JSON.stringify(activeRunsData, null, 2),
			"utf-8",
		);
		console.log("");
		console.log(
			`📝 Appended ${migratedRuns.length} run(s) to active-runs.json`,
		);
	}

	// Optionally delete old .runs/ directory
	if (deleteOldRuns) {
		const { rm } = await import("fs/promises");
		await rm(runsDir, { recursive: true, force: true });
		console.log(`🗑️  Removed old .runs/ directory`);
	}

	// Summary
	console.log("");
	console.log("=".repeat(50));
	console.log("📊 Migration Summary");
	console.log("=".repeat(50));
	console.log(`Total run records found: ${runFiles.length}`);
	console.log(`Successfully migrated: ${migratedRuns.length}`);
	console.log(
		`Skipped (already exists): ${runFiles.length - migratedRuns.length}`,
	);
	console.log(
		`Old .runs/ directory: ${deleteOldRuns ? "deleted" : "preserved"}`,
	);
}

// Main entry point
const args = process.argv.slice(2);
const deleteFlag = args.includes("--delete");

migrateWikiRuns(deleteFlag).catch((err) => {
	console.error("Migration failed:", err);
	process.exit(1);
});
