import { Mutex } from "async-mutex";
import { existsSync } from "fs";
import {
	copyFile,
	cp,
	mkdir,
	readdir,
	readFile,
	unlink,
	writeFile,
} from "fs/promises";
import path from "path";
import { DATA_DIR, getWikiDir } from "./paths";
import type {
	ActiveRunsFile,
	ActivityLogFile,
	AgentsFile,
	BrainDumpFile,
	DecisionsFile,
	GoalsFile,
	InboxFile,
	InitiativesFile,
	ProjectsFile,
	SkillsLibraryFile,
	TasksFile,
	WorkspacesFile,
	AgentDefinition,
} from "./types";

export const DOC_MAINTAINER_AGENT_ID = "doc-maintainer";
export const DOC_MAINTAINER_AGENT_INSTRUCTIONS =
	"Follow llm-wiki-pm plugin skill instructions exactly.";

const CHECKPOINTS_DIR = path.join(DATA_DIR, "checkpoints");

// ─── Workspace path helpers ───────────────────────────────────────────────────

let _currentWorkspaceId = "default";

export function getCurrentWorkspace(): string {
	return _currentWorkspaceId;
}

export function setCurrentWorkspace(id: string): void {
	_currentWorkspaceId = id;
}

export function getWorkspaceDataDir(workspaceId: string): string {
	return path.join(DATA_DIR, "workspaces", workspaceId);
}

function filePath(name: string): string {
	return path.join(getWorkspaceDataDir(_currentWorkspaceId), name);
}

// Artifacts directory containing seed templates for new workspaces.
// process.cwd() is always mission-control/ root in both dev and production.
const ARTIFACTS_DIR = path.join(
	process.cwd(),
	"artifacts",
	"workspaces",
	"default",
);

async function seedFile(
	dest: string,
	artifactSrc: string | null,
	fallback: unknown,
): Promise<void> {
	try {
		await readFile(dest, "utf-8"); // already exists, skip
	} catch {
		if (artifactSrc && existsSync(artifactSrc)) {
			await copyFile(artifactSrc, dest);
		} else {
			await writeFile(dest, JSON.stringify(fallback, null, 2), "utf-8");
		}
	}
}

export async function ensureWorkspaceDir(workspaceId: string): Promise<void> {
	const wsDir = getWorkspaceDataDir(workspaceId);
	await mkdir(wsDir, { recursive: true });

	// Files seeded from artifacts when available, otherwise empty defaults
	const seedFiles: Array<{
		name: string;
		artifact?: string;
		fallback: unknown;
	}> = [
		{ name: "tasks.json", fallback: { tasks: [] } },
		{ name: "tasks-archive.json", fallback: { tasks: [] } },
		{ name: "goals.json", fallback: { goals: [] } },
		{ name: "initiatives.json", fallback: { initiatives: [] } },
		{ name: "projects.json", fallback: { projects: [] } },
		{ name: "brain-dump.json", fallback: { entries: [] } },
		{ name: "activity-log.json", fallback: { events: [] } },
		{ name: "inbox.json", fallback: { messages: [] } },
		{ name: "decisions.json", fallback: { decisions: [] } },
		{
			name: "agents.json",
			artifact: path.join(ARTIFACTS_DIR, "agents.json"),
			fallback: { agents: [] },
		},
		{
			name: "skills-library.json",
			artifact: path.join(ARTIFACTS_DIR, "skills-library.json"),
			fallback: { skills: [] },
		},
		{ name: "active-runs.json", fallback: { runs: [] } },
		{
			name: "daemon-config.json",
			artifact: path.join(ARTIFACTS_DIR, "daemon-config.json"),
			fallback: {},
		},
	];
	await Promise.all(
		seedFiles.map(({ name, artifact, fallback }) =>
			seedFile(path.join(wsDir, name), artifact ?? null, fallback),
		),
	);

	// Copy CLAUDE.md from artifacts if available
	const claudeMdSrc = path.join(ARTIFACTS_DIR, "CLAUDE.md");
	const claudeMdDest = path.join(wsDir, "CLAUDE.md");
	try {
		await readFile(claudeMdDest, "utf-8");
	} catch {
		if (existsSync(claudeMdSrc)) {
			await copyFile(claudeMdSrc, claudeMdDest);
		}
	}

	// Copy .claude/ (commands + skills) from artifacts if available.
	// These are workspace-scoped and included in spawned agent prompts.
	const claudeDirSrc = path.join(ARTIFACTS_DIR, ".claude");
	const claudeDirDest = path.join(wsDir, ".claude");
	if (existsSync(claudeDirSrc) && !existsSync(claudeDirDest)) {
		await cp(claudeDirSrc, claudeDirDest, { recursive: true });
	}

	// Bootstrap wiki structure for llm-wiki-pm skill
	await initWikiDir(workspaceId);
	await ensureDocMaintainerAgentForWorkspace(workspaceId);
}

// ─── Wiki bootstrap (llm-wiki-pm layout) ────────────────────────────────────

const WIKI_SCHEMA_TEMPLATE = `# Wiki Schema

## Domain

Knowledge base. Scope:
- Competitive landscape
- Customer relations
- Strategy and roadmap
- Internal org (people, teams, decisions)
- AI market intelligence

Out of scope: code specifics.

## Conventions

- Filenames: lowercase, hyphens, no spaces
- Every wiki page starts with YAML frontmatter
- \`[[wikilinks]]\` between pages, minimum 2 outbound per page
- Bump \`updated:\` date on any edit
- Every new page → add to \`index.md\` under correct section
- Every action → append to \`log.md\`

## Frontmatter

\`\`\`yaml
---
title: Page Title
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: entity | concept | comparison | query | summary
tags: [from taxonomy below]
sources: []
contradictions: []
supersedes: []
superseded_by: null
private: false
confidence: verified
---
\`\`\`

## Tag Taxonomy

Every tag on a page must appear here. Add new tags here FIRST, then use.

### Entities
- \`company\`, external org
- \`product\`, named product or SKU
- \`person\`, named individual
- \`team\`, org unit
- \`model\`, AI model
- \`vendor\`, tool/platform provider

### Domains
- \`competitive\`, rival positioning
- \`customer\`, named account or persona
- \`strategy\`, direction, positioning
- \`roadmap\`, planned or shipped work
- \`ai\`, AI features, market, models
- \`pricing\`, pricing, packaging
- \`gtm\`, sales, marketing, enablement

### Meta
- \`comparison\`, side-by-side
- \`timeline\`, chronological synthesis
- \`decision\`, recorded decision + rationale
- \`risk\`, identified risk
- \`question\`, open question

Rule: tag sprawl kills wikis. Max ~40 tags. Consolidate quarterly.

## Page Thresholds

- **Create** when entity/concept appears in 2+ sources OR is central to one source
- **Update** existing page for new info on covered ground
- **Don't create** for passing mentions or out-of-scope items
- **Archive** when fully superseded, move to \`_archive/\`, remove from index
`;

const WIKI_INDEX_TEMPLATE = `# Wiki Index

> Content catalog. Every wiki page under its type with a one-line summary.
> Read this first to find relevant pages for any query.
> Last updated: YYYY-MM-DD | Total pages: 0

## Entities
<!-- Alphabetical. Companies, products, people, teams, models, vendors. -->

## Concepts
<!-- Strategies, themes, frameworks, ongoing bets. -->

## Comparisons
<!-- Side-by-side analyses. -->

## Queries
<!-- Filed Q&A worth keeping. -->
`;

const WIKI_LOG_TEMPLATE = `# Wiki Log

> Chronological record of all wiki actions. Append-only.
> Format: \`## [YYYY-MM-DD] action | subject\`
> Actions: ingest, update, query, lint, create, archive, delete
> Rotate when > 500 entries: rename to \`log-YYYY.md\`, start fresh.
`;

const WIKI_OVERVIEW_TEMPLATE = `---
title: Overview
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: summary
tags: [strategy]
sources: []
---

# Wiki Overview

> Evolving synthesis of the domain. Single entry point. Keep under 200 lines.
> Update whenever an ingest materially shifts understanding.

## Current State

_What do we know right now? Short paragraphs per theme._

## Active Bets

_Strategic bets in flight. One line each, link to concept page._

## Open Questions

_Things worth investigating. Link to query pages once answered._

## Recent Shifts

_What changed in the last 30 days. Link to log entries or updated pages._

## Key Entities

_Top 10-20 most-linked pages. Quick navigation._
`;

const WIKI_SUBDIRS = [
	"raw/articles",
	"raw/papers",
	"raw/transcripts",
	"raw/internal",
	"raw/assets",
	"entities",
	"concepts",
	"comparisons",
	"queries",
	"_archive",
];

export async function initWikiDir(workspaceId: string): Promise<void> {
	const wikiDir = getWikiDir(workspaceId);

	// Idempotent: already initialized if SCHEMA.md exists
	if (existsSync(path.join(wikiDir, "SCHEMA.md"))) return;

	await mkdir(wikiDir, { recursive: true });
	await Promise.all(
		WIKI_SUBDIRS.map((d) => mkdir(path.join(wikiDir, d), { recursive: true })),
	);

	const today = new Date().toISOString().slice(0, 10);
	const logContent =
		WIKI_LOG_TEMPLATE +
		`\n## [${today}] create | Wiki initialized\n- Structure scaffolded\n`;

	await Promise.all([
		writeFile(path.join(wikiDir, "SCHEMA.md"), WIKI_SCHEMA_TEMPLATE, "utf-8"),
		writeFile(
			path.join(wikiDir, "index.md"),
			WIKI_INDEX_TEMPLATE.replace(/YYYY-MM-DD/g, today),
			"utf-8",
		),
		writeFile(path.join(wikiDir, "log.md"), logContent, "utf-8"),
		writeFile(
			path.join(wikiDir, "overview.md"),
			WIKI_OVERVIEW_TEMPLATE.replace(/YYYY-MM-DD/g, today),
			"utf-8",
		),
	]);
}

export function getCheckpointsDir(): string {
	return CHECKPOINTS_DIR;
}

export async function ensureCheckpointsDir(): Promise<void> {
	await mkdir(CHECKPOINTS_DIR, { recursive: true });
}

// ─── Checkpoint metadata type ────────────────────────────────────────────────

export interface CheckpointMeta {
	id: string;
	name: string;
	description: string;
	createdAt: string;
	version: number;
	stats: {
		tasks: number;
		projects: number;
		goals: number;
		brainDump: number;
		inbox: number;
		decisions: number;
		agents: number;
		skills: number;
	};
}

export interface CheckpointFile {
	id: string;
	name: string;
	description: string;
	createdAt: string;
	version: number;
	data: {
		tasks: TasksFile;
		goals: GoalsFile;
		projects: ProjectsFile;
		brainDump: BrainDumpFile;
		inbox: InboxFile;
		decisions: DecisionsFile;
		agents: AgentsFile;
		skillsLibrary: SkillsLibraryFile;
	};
}

// ─── Bulk checkpoint helpers ─────────────────────────────────────────────────

export async function getAllCoreData(): Promise<CheckpointFile["data"]> {
	const [
		tasks,
		goals,
		projects,
		brainDump,
		inbox,
		decisions,
		agents,
		skillsLibrary,
	] = await Promise.all([
		getTasks(),
		getGoals(),
		getProjects(),
		getBrainDump(),
		getInbox(),
		getDecisions(),
		getAgents(),
		getSkillsLibrary(),
	]);
	return {
		tasks,
		goals,
		projects,
		brainDump,
		inbox,
		decisions,
		agents,
		skillsLibrary,
	};
}

export async function loadCoreData(
	data: CheckpointFile["data"],
): Promise<void> {
	// Write sequentially to avoid overwhelming mutexes
	await saveTasks(data.tasks);
	await saveGoals(data.goals);
	await saveProjects(data.projects);
	await saveBrainDump(data.brainDump);
	await saveInbox(data.inbox);
	await saveDecisions(data.decisions);
	await saveAgents(data.agents);
	await saveSkillsLibrary(data.skillsLibrary);
	// Reset activity log to empty
	await saveActivityLog({ events: [] });
}

// ─── Checkpoint CRUD helpers ─────────────────────────────────────────────────

export async function listCheckpoints(): Promise<CheckpointMeta[]> {
	await ensureCheckpointsDir();
	const files = await readdir(CHECKPOINTS_DIR);
	const jsonFiles = files.filter((f) => f.endsWith(".json"));
	const metas: CheckpointMeta[] = [];
	for (const file of jsonFiles) {
		try {
			const raw = await readFile(path.join(CHECKPOINTS_DIR, file), "utf-8");
			const snap = JSON.parse(raw) as CheckpointFile;
			metas.push({
				id: snap.id,
				name: snap.name,
				description: snap.description,
				createdAt: snap.createdAt,
				version: snap.version,
				stats: {
					tasks: snap.data.tasks.tasks.length,
					projects: snap.data.projects.projects.length,
					goals: snap.data.goals.goals.length,
					brainDump: snap.data.brainDump.entries.length,
					inbox: snap.data.inbox.messages.length,
					decisions: snap.data.decisions.decisions.length,
					agents: snap.data.agents.agents.length,
					skills: snap.data.skillsLibrary.skills.length,
				},
			});
		} catch {
			// Skip malformed checkpoint files
		}
	}
	return metas.sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);
}

export async function getCheckpoint(id: string): Promise<CheckpointFile> {
	const raw = await readFile(path.join(CHECKPOINTS_DIR, `${id}.json`), "utf-8");
	return JSON.parse(raw) as CheckpointFile;
}

export async function saveCheckpoint(snap: CheckpointFile): Promise<void> {
	await ensureCheckpointsDir();
	await writeFile(
		path.join(CHECKPOINTS_DIR, `${snap.id}.json`),
		JSON.stringify(snap, null, 2),
		"utf-8",
	);
}

export async function deleteCheckpoint(id: string): Promise<void> {
	await unlink(path.join(CHECKPOINTS_DIR, `${id}.json`));
}

// ─── Internal write helper (no mutex — caller must hold the lock) ────────────

async function _writeJson(name: string, data: unknown): Promise<void> {
	await writeFile(filePath(name), JSON.stringify(data, null, 2), "utf-8");
}

// ─── Per-file mutexes for concurrent write safety ─────────────────────────────

const fileMutexes = {
	tasks: new Mutex(),
	tasksArchive: new Mutex(),
	goals: new Mutex(),
	projects: new Mutex(),
	brainDump: new Mutex(),
	activityLog: new Mutex(),
	inbox: new Mutex(),
	decisions: new Mutex(),
	agents: new Mutex(),
	skillsLibrary: new Mutex(),
	activeRuns: new Mutex(),
	daemonConfig: new Mutex(),
};

function buildDocMaintainerAgent(now: string): AgentDefinition {
	return {
		id: DOC_MAINTAINER_AGENT_ID,
		name: "Doc Maintainer",
		icon: "BookOpen",
		description: "Maintains workspace wiki using llm-wiki-pm skill",
		instructions: DOC_MAINTAINER_AGENT_INSTRUCTIONS,
		capabilities: ["wiki-maintenance", "documentation"],
		skillIds: [],
		status: "active",
		createdAt: now,
		updatedAt: now,
	};
}

export async function ensureDocMaintainerAgentForWorkspace(
	workspaceId: string,
): Promise<void> {
	await fileMutexes.agents.runExclusive(async () => {
		await mkdir(getWorkspaceDataDir(workspaceId), { recursive: true });
		const agentsPath = path.join(
			getWorkspaceDataDir(workspaceId),
			"agents.json",
		);
		let data: AgentsFile;
		try {
			const raw = await readFile(agentsPath, "utf-8");
			data = JSON.parse(raw) as AgentsFile;
		} catch {
			data = { agents: [] };
		}

		if (data.agents.some((a) => a.id === DOC_MAINTAINER_AGENT_ID)) return;

		const now = new Date().toISOString();
		data.agents.push(buildDocMaintainerAgent(now));
		await writeFile(agentsPath, JSON.stringify(data, null, 2), "utf-8");
	});
}

export async function ensureDocMaintainerAgent(): Promise<void> {
	await ensureDocMaintainerAgentForWorkspace(_currentWorkspaceId);
}

// ─── Read functions (no locking needed — reads are safe) ──────────────────────

export async function getTasks(): Promise<TasksFile> {
	try {
		const raw = await readFile(filePath("tasks.json"), "utf-8");
		return JSON.parse(raw) as TasksFile;
	} catch {
		return { tasks: [] };
	}
}

export async function getTasksArchive(): Promise<TasksFile> {
	try {
		const raw = await readFile(filePath("tasks-archive.json"), "utf-8");
		return JSON.parse(raw) as TasksFile;
	} catch {
		return { tasks: [] };
	}
}

export async function getGoals(): Promise<GoalsFile> {
	try {
		const raw = await readFile(filePath("goals.json"), "utf-8");
		return JSON.parse(raw) as GoalsFile;
	} catch {
		return { goals: [] };
	}
}

export async function getProjects(): Promise<ProjectsFile> {
	try {
		const raw = await readFile(filePath("projects.json"), "utf-8");
		return JSON.parse(raw) as ProjectsFile;
	} catch {
		return { projects: [] };
	}
}

export async function getBrainDump(): Promise<BrainDumpFile> {
	try {
		const raw = await readFile(filePath("brain-dump.json"), "utf-8");
		return JSON.parse(raw) as BrainDumpFile;
	} catch {
		return { entries: [] };
	}
}

export async function getActivityLog(): Promise<ActivityLogFile> {
	try {
		const raw = await readFile(filePath("activity-log.json"), "utf-8");
		return JSON.parse(raw) as ActivityLogFile;
	} catch {
		return { events: [] };
	}
}

export async function getInbox(): Promise<InboxFile> {
	try {
		const raw = await readFile(filePath("inbox.json"), "utf-8");
		return JSON.parse(raw) as InboxFile;
	} catch {
		return { messages: [] };
	}
}

export async function getDecisions(): Promise<DecisionsFile> {
	try {
		const raw = await readFile(filePath("decisions.json"), "utf-8");
		return JSON.parse(raw) as DecisionsFile;
	} catch {
		return { decisions: [] };
	}
}

export async function getAgents(): Promise<AgentsFile> {
	try {
		const raw = await readFile(filePath("agents.json"), "utf-8");
		return JSON.parse(raw) as AgentsFile;
	} catch {
		return { agents: [] };
	}
}

export async function getSkillsLibrary(): Promise<SkillsLibraryFile> {
	try {
		const raw = await readFile(filePath("skills-library.json"), "utf-8");
		return JSON.parse(raw) as SkillsLibraryFile;
	} catch {
		return { skills: [] };
	}
}

export async function getActiveRuns(): Promise<ActiveRunsFile> {
	try {
		const raw = await readFile(filePath("active-runs.json"), "utf-8");
		return JSON.parse(raw) as ActiveRunsFile;
	} catch {
		return { runs: [] };
	}
}

const DEFAULT_DAEMON_CONFIG = {
	polling: { enabled: true, intervalMinutes: 5 },
	concurrency: { maxParallelAgents: 6 },
	schedule: {},
	execution: {
		maxTurns: 57,
		timeoutMinutes: 30,
		retries: 1,
		retryDelayMinutes: 5,
		skipPermissions: false,
		allowedTools: [
			"Edit",
			"Write",
			"Read",
			"Glob",
			"Grep",
			"Bash",
			"WebSearch",
			"WebFetch",
		],
		agentTeams: false,
		claudeBinaryPath: null,
		maxTaskContinuations: 2,
	},
	inbox: {
		maxContinuations: 2,
		maxTurnsPerSession: 25,
		timeoutPerSessionMinutes: 15,
	},
};

export async function getDaemonConfig(): Promise<Record<string, unknown>> {
	try {
		const raw = await readFile(filePath("daemon-config.json"), "utf-8");
		const config = JSON.parse(raw) as Record<string, unknown>;
		return { ...DEFAULT_DAEMON_CONFIG, ...config };
	} catch {
		return { ...DEFAULT_DAEMON_CONFIG };
	}
}

// ─── Save functions (mutex-protected to prevent concurrent write corruption) ──

export async function saveTasks(data: TasksFile): Promise<void> {
	await fileMutexes.tasks.runExclusive(async () => {
		await _writeJson("tasks.json", data);
	});
}

export async function saveTasksArchive(data: TasksFile): Promise<void> {
	await fileMutexes.tasksArchive.runExclusive(async () => {
		await _writeJson("tasks-archive.json", data);
	});
}

export async function saveGoals(data: GoalsFile): Promise<void> {
	await fileMutexes.goals.runExclusive(async () => {
		await _writeJson("goals.json", data);
	});
}

export async function saveProjects(data: ProjectsFile): Promise<void> {
	await fileMutexes.projects.runExclusive(async () => {
		await _writeJson("projects.json", data);
	});
}

export async function saveBrainDump(data: BrainDumpFile): Promise<void> {
	await fileMutexes.brainDump.runExclusive(async () => {
		await _writeJson("brain-dump.json", data);
	});
}

export async function saveActivityLog(data: ActivityLogFile): Promise<void> {
	await fileMutexes.activityLog.runExclusive(async () => {
		await _writeJson("activity-log.json", data);
	});
}

export async function saveInbox(data: InboxFile): Promise<void> {
	await fileMutexes.inbox.runExclusive(async () => {
		await _writeJson("inbox.json", data);
	});
}

export async function saveDecisions(data: DecisionsFile): Promise<void> {
	await fileMutexes.decisions.runExclusive(async () => {
		await _writeJson("decisions.json", data);
	});
}

export async function saveAgents(data: AgentsFile): Promise<void> {
	await fileMutexes.agents.runExclusive(async () => {
		await _writeJson("agents.json", data);
	});
}

export async function saveSkillsLibrary(
	data: SkillsLibraryFile,
): Promise<void> {
	await fileMutexes.skillsLibrary.runExclusive(async () => {
		await _writeJson("skills-library.json", data);
	});
}

export async function saveActiveRuns(data: ActiveRunsFile): Promise<void> {
	await fileMutexes.activeRuns.runExclusive(async () => {
		await _writeJson("active-runs.json", data);
	});
}

// ─── Atomic read-modify-write helpers (legacy — read-only inside lock) ────────
// NOTE: These do NOT write back. Calling save*() inside these will DEADLOCK
// (async-mutex is not reentrant). Use mutate*() below for mutations instead.

export async function withTasks<T>(
	fn: (data: TasksFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.tasks.runExclusive(async () => {
		const data = await getTasks();
		return fn(data);
	});
}

export async function withTasksArchive<T>(
	fn: (data: TasksFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.tasksArchive.runExclusive(async () => {
		const data = await getTasksArchive();
		return fn(data);
	});
}

export async function withGoals<T>(
	fn: (data: GoalsFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.goals.runExclusive(async () => {
		const data = await getGoals();
		return fn(data);
	});
}

export async function withProjects<T>(
	fn: (data: ProjectsFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.projects.runExclusive(async () => {
		const data = await getProjects();
		return fn(data);
	});
}

export async function withBrainDump<T>(
	fn: (data: BrainDumpFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.brainDump.runExclusive(async () => {
		const data = await getBrainDump();
		return fn(data);
	});
}

export async function withActivityLog<T>(
	fn: (data: ActivityLogFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.activityLog.runExclusive(async () => {
		const data = await getActivityLog();
		return fn(data);
	});
}

export async function withInbox<T>(
	fn: (data: InboxFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.inbox.runExclusive(async () => {
		const data = await getInbox();
		return fn(data);
	});
}

export async function withDecisions<T>(
	fn: (data: DecisionsFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.decisions.runExclusive(async () => {
		const data = await getDecisions();
		return fn(data);
	});
}

export async function withAgents<T>(
	fn: (data: AgentsFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.agents.runExclusive(async () => {
		const data = await getAgents();
		return fn(data);
	});
}

export async function withSkillsLibrary<T>(
	fn: (data: SkillsLibraryFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.skillsLibrary.runExclusive(async () => {
		const data = await getSkillsLibrary();
		return fn(data);
	});
}

export async function withActiveRuns<T>(
	fn: (data: ActiveRunsFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.activeRuns.runExclusive(async () => {
		const data = await getActiveRuns();
		return fn(data);
	});
}

// ─── Atomic mutate helpers (lock → read → callback → auto-write → unlock) ────
// Use these for ALL mutation operations. The callback mutates `data` in place,
// and the file is automatically written after the callback returns.
// If the callback throws, the file is NOT written (implicit rollback).

export async function mutateTasks<T>(
	fn: (data: TasksFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.tasks.runExclusive(async () => {
		const raw = await readFile(filePath("tasks.json"), "utf-8");
		const data = JSON.parse(raw) as TasksFile;
		const result = await fn(data);
		await _writeJson("tasks.json", data);
		return result;
	});
}

export async function mutateTasksArchive<T>(
	fn: (data: TasksFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.tasksArchive.runExclusive(async () => {
		let data: TasksFile;
		try {
			const raw = await readFile(filePath("tasks-archive.json"), "utf-8");
			data = JSON.parse(raw) as TasksFile;
		} catch {
			data = { tasks: [] };
		}
		const result = await fn(data);
		await _writeJson("tasks-archive.json", data);
		return result;
	});
}

export async function mutateGoals<T>(
	fn: (data: GoalsFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.goals.runExclusive(async () => {
		const raw = await readFile(filePath("goals.json"), "utf-8");
		const data = JSON.parse(raw) as GoalsFile;
		const result = await fn(data);
		await _writeJson("goals.json", data);
		return result;
	});
}

export async function mutateProjects<T>(
	fn: (data: ProjectsFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.projects.runExclusive(async () => {
		const raw = await readFile(filePath("projects.json"), "utf-8");
		const data = JSON.parse(raw) as ProjectsFile;
		const result = await fn(data);
		await _writeJson("projects.json", data);
		return result;
	});
}

export async function mutateBrainDump<T>(
	fn: (data: BrainDumpFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.brainDump.runExclusive(async () => {
		const raw = await readFile(filePath("brain-dump.json"), "utf-8");
		const data = JSON.parse(raw) as BrainDumpFile;
		const result = await fn(data);
		await _writeJson("brain-dump.json", data);
		return result;
	});
}

export async function mutateInbox<T>(
	fn: (data: InboxFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.inbox.runExclusive(async () => {
		const raw = await readFile(filePath("inbox.json"), "utf-8");
		const data = JSON.parse(raw) as InboxFile;
		const result = await fn(data);
		await _writeJson("inbox.json", data);
		return result;
	});
}

export async function mutateDecisions<T>(
	fn: (data: DecisionsFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.decisions.runExclusive(async () => {
		const raw = await readFile(filePath("decisions.json"), "utf-8");
		const data = JSON.parse(raw) as DecisionsFile;
		const result = await fn(data);
		await _writeJson("decisions.json", data);
		return result;
	});
}

export async function mutateActivityLog<T>(
	fn: (data: ActivityLogFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.activityLog.runExclusive(async () => {
		const raw = await readFile(filePath("activity-log.json"), "utf-8");
		const data = JSON.parse(raw) as ActivityLogFile;
		const result = await fn(data);
		await _writeJson("activity-log.json", data);
		return result;
	});
}

export async function mutateAgents<T>(
	fn: (data: AgentsFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.agents.runExclusive(async () => {
		let data: AgentsFile;
		try {
			const raw = await readFile(filePath("agents.json"), "utf-8");
			data = JSON.parse(raw) as AgentsFile;
		} catch {
			data = { agents: [] };
		}
		const result = await fn(data);
		await _writeJson("agents.json", data);
		return result;
	});
}

export async function mutateSkillsLibrary<T>(
	fn: (data: SkillsLibraryFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.skillsLibrary.runExclusive(async () => {
		let data: SkillsLibraryFile;
		try {
			const raw = await readFile(filePath("skills-library.json"), "utf-8");
			data = JSON.parse(raw) as SkillsLibraryFile;
		} catch {
			data = { skills: [] };
		}
		const result = await fn(data);
		await _writeJson("skills-library.json", data);
		return result;
	});
}

export async function mutateActiveRuns<T>(
	fn: (data: ActiveRunsFile) => Promise<T>,
): Promise<T> {
	return fileMutexes.activeRuns.runExclusive(async () => {
		let data: ActiveRunsFile;
		try {
			const raw = await readFile(filePath("active-runs.json"), "utf-8");
			data = JSON.parse(raw) as ActiveRunsFile;
		} catch {
			data = { runs: [] };
		}
		const result = await fn(data);
		await _writeJson("active-runs.json", data);
		return result;
	});
}

export async function mutateDaemonConfig<T>(
	fn: (data: Record<string, unknown>) => Promise<T>,
): Promise<T> {
	return fileMutexes.daemonConfig.runExclusive(async () => {
		let data: Record<string, unknown>;
		try {
			const raw = await readFile(filePath("daemon-config.json"), "utf-8");
			data = JSON.parse(raw) as Record<string, unknown>;
		} catch {
			data = {};
		}
		const result = await fn(data);
		await _writeJson("daemon-config.json", data);
		return result;
	});
}

// ─── Workspaces (root-level, not workspace-scoped) ────────────────────────────

const workspacesMutex = new Mutex();
const WORKSPACES_FILE = path.join(DATA_DIR, "workspaces.json");

export async function getWorkspaces(): Promise<WorkspacesFile> {
	try {
		const raw = await readFile(WORKSPACES_FILE, "utf-8");
		return JSON.parse(raw) as WorkspacesFile;
	} catch {
		return {
			workspaces: [
				{
					id: "default",
					name: "Personal",
					description: "",
					color: "#6366f1",
					isDefault: true,
					settings: {},
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			],
		};
	}
}

export async function mutateWorkspaces<T>(
	fn: (data: WorkspacesFile) => Promise<T>,
): Promise<T> {
	return workspacesMutex.runExclusive(async () => {
		let data: WorkspacesFile;
		try {
			const raw = await readFile(WORKSPACES_FILE, "utf-8");
			data = JSON.parse(raw) as WorkspacesFile;
		} catch {
			data = {
				workspaces: [
					{
						id: "default",
						name: "Personal",
						description: "",
						color: "#6366f1",
						isDefault: true,
						settings: {},
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
					},
				],
			};
		}
		const result = await fn(data);
		await writeFile(WORKSPACES_FILE, JSON.stringify(data, null, 2), "utf-8");
		return result;
	});
}

// ─── Initiatives ──────────────────────────────────────────────────────────────

const initiativesMutex = new Mutex();

export async function getInitiatives(): Promise<InitiativesFile> {
	try {
		const raw = await readFile(filePath("initiatives.json"), "utf-8");
		return JSON.parse(raw) as InitiativesFile;
	} catch {
		return { initiatives: [] };
	}
}

export async function mutateInitiatives<T>(
	fn: (data: InitiativesFile) => Promise<T>,
): Promise<T> {
	return initiativesMutex.runExclusive(async () => {
		let data: InitiativesFile;
		try {
			const raw = await readFile(filePath("initiatives.json"), "utf-8");
			data = JSON.parse(raw) as InitiativesFile;
		} catch {
			data = { initiatives: [] };
		}
		const result = await fn(data);
		await writeFile(
			filePath("initiatives.json"),
			JSON.stringify(data, null, 2),
			"utf-8",
		);
		return result;
	});
}
