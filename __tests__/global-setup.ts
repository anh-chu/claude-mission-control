import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const TEST_DATA_DIR = path.join(__dirname, "..", ".test-data");
const WORKSPACE_DIR = path.join(TEST_DATA_DIR, "workspaces", "default");

// Files needed by src/lib/data.ts (workspace-scoped reads)
const WORKSPACE_SEED: Record<string, unknown> = {
	"tasks.json": { tasks: [] },
	"goals.json": { goals: [] },
	"projects.json": { projects: [] },
	"brain-dump.json": { entries: [] },
	"inbox.json": { messages: [] },
	"activity-log.json": { events: [] },
	"decisions.json": { decisions: [] },
	"agents.json": { agents: [] },
	"skills-library.json": { skills: [] },
	"active-runs.json": { runs: [] },
};

// Files needed by scripts/daemon/* (root DATA_DIR reads, non-workspace-scoped)
const ROOT_SEED: Record<string, unknown> = {
	"tasks.json": { tasks: [] },
	"decisions.json": { decisions: [] },
	"agents.json": { agents: [] },
	"skills-library.json": { skills: [] },
	"missions.json": { missions: [] },
	"active-runs.json": { runs: [] },
};

async function writeSeeds(
	dir: string,
	seeds: Record<string, unknown>,
): Promise<void> {
	for (const [name, content] of Object.entries(seeds)) {
		await writeFile(
			path.join(dir, name),
			JSON.stringify(content, null, 2),
			"utf-8",
		);
	}
}

export async function setup(): Promise<void> {
	await mkdir(WORKSPACE_DIR, { recursive: true });
	await mkdir(TEST_DATA_DIR, { recursive: true });

	await writeSeeds(WORKSPACE_DIR, WORKSPACE_SEED);
	await writeSeeds(TEST_DATA_DIR, ROOT_SEED);
}

export async function teardown(): Promise<void> {
	await rm(TEST_DATA_DIR, { recursive: true, force: true });
}
