import { Mutex } from "async-mutex";
import { existsSync } from "fs";
import { copyFile, cp, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
	DATA_DIR,
	getDefaultWikiDir,
	getWikiDir,
	getWikiPathFile,
} from "./paths";
import type {
	ActiveRunsFile,
	ActivityLogFile,
	AgentDefinition,
	AgentsFile,
	BrainDumpFile,
	DecisionsFile,
	InboxFile,
	InitiativesFile,
	ProjectsFile,
	SkillsLibraryFile,
	TasksFile,
	WorkspacesFile,
} from "./types";

export const DOC_MAINTAINER_AGENT_ID = "doc-maintainer";
export const DOC_MAINTAINER_AGENT_INSTRUCTIONS =
	"Follow llm-wiki-pm plugin skill instructions exactly.";

// ─── Workspace path helpers ───────────────────────────────────────────────────

let _currentWorkspaceId = "default";

export function setCurrentWorkspace(id: string): void {
	_currentWorkspaceId = id;
}

export function getWorkspaceDataDir(workspaceId: string): string {
	return path.join(DATA_DIR, "workspaces", workspaceId);
}

function filePath(name: string): string {
	return path.join(getWorkspaceDataDir(_currentWorkspaceId), name);
}

// Get base directory for artifacts resolution.
// Priority: MANDIO_INSTALL_DIR env var > __dirname-based > process.cwd() fallback.
function getBaseDir(): string {
	// CLI wrapper sets MANDIO_INSTALL_DIR when installed as npm package
	if (process.env.MANDIO_INSTALL_DIR) {
		return process.env.MANDIO_INSTALL_DIR;
	}
	// __dirname-relative: up from lib/ to package root
	const packageRoot = path.resolve(__dirname, "..", "..");
	if (existsSync(path.join(packageRoot, "artifacts"))) {
		return packageRoot;
	}
	// Fallback for dev compatibility (pnpm dev)
	return process.cwd();
}

// Lazy-initialized artifacts directory.
let _artifactsDir: string | undefined;
function getArtifactsDir(): string {
	if (!_artifactsDir) {
		_artifactsDir = path.join(
			getBaseDir(),
			"artifacts",
			"workspaces",
			"default",
		);
	}
	return _artifactsDir;
}

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
		{ name: "initiatives.json", fallback: { initiatives: [] } },
		{ name: "projects.json", fallback: { projects: [] } },
		{ name: "brain-dump.json", fallback: { entries: [] } },
		{ name: "activity-log.json", fallback: { events: [] } },
		{ name: "inbox.json", fallback: { messages: [] } },
		{ name: "decisions.json", fallback: { decisions: [] } },
		{
			name: "agents.json",
			artifact: path.join(getArtifactsDir(), "agents.json"),
			fallback: { agents: [] },
		},
		{
			name: "skills-library.json",
			artifact: path.join(getArtifactsDir(), "skills-library.json"),
			fallback: { skills: [] },
		},
		{ name: "active-runs.json", fallback: { runs: [] } },
		{
			name: "daemon-config.json",
			artifact: path.join(getArtifactsDir(), "daemon-config.json"),
			fallback: {},
		},
	];
	await Promise.all(
		seedFiles.map(({ name, artifact, fallback }) =>
			seedFile(path.join(wsDir, name), artifact ?? null, fallback),
		),
	);

	// Copy CLAUDE.md from artifacts if available
	const claudeMdSrc = path.join(getArtifactsDir(), "CLAUDE.md");
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
	const claudeDirSrc = path.join(getArtifactsDir(), ".claude");
	const claudeDirDest = path.join(wsDir, ".claude");
	if (existsSync(claudeDirSrc) && !existsSync(claudeDirDest)) {
		await cp(claudeDirSrc, claudeDirDest, { recursive: true });
	}

	// Bootstrap wiki structure for llm-wiki-pm skill
	await initWikiDir(workspaceId);
	await ensureDocMaintainerAgentForWorkspace(workspaceId);
}

// ─── Wiki bootstrap (plugin-first) ──────────────────────────────────────────
// App owns directory existence only. llm-wiki-pm plugin owns wiki scaffold.
// v2.5.0: writes .wiki-path sentinel so plugin discovers wiki dir on SessionStart.
export async function initWikiDir(workspaceId: string): Promise<void> {
	const wikiDir = getWikiDir(workspaceId);
	await mkdir(wikiDir, { recursive: true });

	// Write .wiki-path sentinel for llm-wiki-pm v2.5.0 SessionStart discovery.
	// Use getDefaultWikiDir to avoid circular read of the sentinel itself.
	const sentinelPath = getWikiPathFile(workspaceId);
	const defaultDir = getDefaultWikiDir(workspaceId);
	try {
		await writeFile(
			sentinelPath,
			`${wikiDir !== defaultDir ? wikiDir : defaultDir}\n`,
			"utf-8",
		);
	} catch {
		// non-fatal: plugin falls back to WIKI_PATH env var
	}
}

// ─── Internal write helper (no mutex — caller must hold the lock) ────────────

async function _writeJson(name: string, data: unknown): Promise<void> {
	await writeFile(filePath(name), JSON.stringify(data, null, 2), "utf-8");
}

// ─── Per-file mutexes for concurrent write safety ─────────────────────────────

const fileMutexes = {
	tasks: new Mutex(),
	tasksArchive: new Mutex(),
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

export async function saveProjects(data: ProjectsFile): Promise<void> {
	await fileMutexes.projects.runExclusive(async () => {
		await _writeJson("projects.json", data);
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

// Mutation helpers (lock -> read -> callback -> auto-write -> unlock).
// The callback mutates data in place. File is written after callback returns.
// If callback throws, file is NOT written (implicit rollback).

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
					color: "#fa520f",
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
						color: "#fa520f",
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
