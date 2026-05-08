import { existsSync, lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { getWorkspaceDir } from "./paths";
import { generateId } from "./utils";

function getFirstActiveAgentId(): string {
	const agentsPath = path.join(
		getWorkspaceDir(process.env.MANDIO_WORKSPACE_ID ?? "default"),
		"agents.json",
	);
	try {
		const raw = readFileSync(agentsPath, "utf-8");
		const data = JSON.parse(raw) as {
			agents: Array<{ id: string; status: string }>;
		};
		const active = data.agents.find((a) => a.status === "active");
		if (active) return active.id;
	} catch {
		/* agents.json missing or unreadable */
	}
	throw new Error(
		"No active agents found. Create an agent in the Crew page before running scheduled commands.",
	);
}

const COMMANDS_DIR = path.join(process.cwd(), ".claude", "commands");
const GLOBAL_COMMANDS_DIR = path.join(
	process.env.HOME ?? process.env.USERPROFILE ?? "/tmp",
	".mandio",
	"artifacts",
	"commands",
);
const MANDIO_COMMAND_PREFIX = "mandio-";
const VALID_COMMAND_RE = /^[a-zA-Z0-9_-]+$/;

export interface CommandPromptResult {
	found: boolean;
	content: string;
}

/**
 * Build a Task object for a scheduled command.
 * Returns a task payload ready to insert into tasks.json.
 * Throws if no active agents exist in the workspace and no agentId is provided.
 */
export function buildScheduledTask(
	command: string,
	description: string,
	agentId?: string,
): {
	id: string;
	title: string;
	description: string;
	importance: "important";
	urgency: "urgent";
	kanban: "not-started";
	projectId: null;
	milestoneId: null;
	assignedTo: string;
	collaborators: [];
	subtasks: [];
	blockedBy: [];
	estimatedMinutes: null;
	actualMinutes: null;
	acceptanceCriteria: "";
	comments: [];
	tags: [];
	dueDate: null;
	createdAt: string;
	updatedAt: string;
	completedAt: null;
	deletedAt: null;
	isScheduled: true;
} {
	const now = new Date().toISOString();
	const assignedTo =
		agentId && agentId.trim() ? agentId.trim() : getFirstActiveAgentId();
	return {
		id: generateId("task"),
		title: `Command: /${command}`,
		description,
		importance: "important",
		urgency: "urgent",
		kanban: "not-started",
		projectId: null,
		milestoneId: null,
		assignedTo,
		collaborators: [],
		subtasks: [],
		blockedBy: [],
		estimatedMinutes: null,
		actualMinutes: null,
		acceptanceCriteria: "",
		comments: [],
		tags: [],
		dueDate: null,
		createdAt: now,
		updatedAt: now,
		completedAt: null,
		deletedAt: null,
		isScheduled: true,
	};
}

/**
 * Load the prompt content for a named command (e.g. "daily-plan", "standup").
 * Checks three locations in order:
 * 1. Workspace symlinked: <wsDir>/.claude/commands/mandio-<command>/user.md
 * 2. Global store: ~/.mandio/artifacts/commands/<command>/user.md
 * 3. Legacy project: <project>/.claude/commands/<command>/user.md
 *
 * Strips YAML frontmatter (--- delimited) and enforces a 100KB prompt limit.
 * Returns { found: false } when no command file exists.
 */
export function loadCommandPrompt(
	command: string,
	workspaceId: string = process.env.MANDIO_WORKSPACE_ID ?? "default",
): CommandPromptResult {
	// Validate command name to prevent path traversal
	if (!VALID_COMMAND_RE.test(command)) {
		return { found: false, content: "" };
	}

	const wsCommandsDir = path.join(
		getWorkspaceDir(workspaceId),
		".claude",
		"commands",
	);

	// 1. Workspace symlinked location
	const linkedCmdFile = path.join(
		wsCommandsDir,
		`${MANDIO_COMMAND_PREFIX}${command}`,
		"user.md",
	);
	if (existsSync(linkedCmdFile)) {
		try {
			const stat = lstatSync(linkedCmdFile);
			if (!stat.isSymbolicLink()) {
				return {
					found: true,
					content: enforceMaxLength(
						stripFrontmatter(readFileSync(linkedCmdFile, "utf-8")),
					),
				};
			}
		} catch {
			// fall through
		}
	}

	// 2. Global command store
	const globalCmdFile = path.join(GLOBAL_COMMANDS_DIR, command, "user.md");
	if (existsSync(globalCmdFile)) {
		return {
			found: true,
			content: enforceMaxLength(
				stripFrontmatter(readFileSync(globalCmdFile, "utf-8")),
			),
		};
	}

	// 3. Legacy project location
	const cmdFile = path.join(COMMANDS_DIR, command, "user.md");
	if (existsSync(cmdFile)) {
		return {
			found: true,
			content: enforceMaxLength(
				stripFrontmatter(readFileSync(cmdFile, "utf-8")),
			),
		};
	}

	return { found: false, content: "" };
}

/**
 * Strip YAML frontmatter from markdown content.
 * Looks for the first ---\n, then everything until the next ---\n (or end)
 * is discarded as frontmatter. Returns the remaining markdown body.
 */
function stripFrontmatter(content: string): string {
	const trimmed = content.trimStart();
	if (!trimmed.startsWith("---")) return content;
	const afterFirstDelim = trimmed.indexOf("\n", 3);
	if (afterFirstDelim === -1) return content;
	const afterSecondDelim = trimmed.indexOf("\n---", afterFirstDelim + 1);
	if (afterSecondDelim === -1) {
		// No closing ---, treat everything after first --- as body
		return trimmed.slice(afterFirstDelim + 1).trimStart();
	}
	return trimmed.slice(afterSecondDelim + 4).trimStart();
}

/** Max prompt length before truncation, matches enforcePromptLimit in daemon. */
const MAX_PROMPT_LENGTH = 100_000;

function enforceMaxLength(content: string): string {
	if (content.length > MAX_PROMPT_LENGTH) {
		return `${content.slice(0, MAX_PROMPT_LENGTH)}\n\n[PROMPT TRUNCATED — exceeded 100KB limit]`;
	}
	return content;
}
