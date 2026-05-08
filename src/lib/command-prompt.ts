import { existsSync, lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { getWorkspaceDir } from "./paths";

const COMMANDS_DIR = path.join(process.cwd(), ".claude", "commands");
const GLOBAL_COMMANDS_DIR = path.join(
	process.env.HOME ?? process.env.USERPROFILE ?? "/tmp",
	".mandio",
	"artifacts",
	"commands",
);
const MANDIO_COMMAND_PREFIX = "mandio-";

export interface CommandPromptResult {
	found: boolean;
	content: string;
}

/**
 * Load the prompt content for a named command (e.g. "daily-plan", "standup").
 * Checks three locations in order:
 * 1. Workspace symlinked: <wsDir>/.claude/commands/mandio-<command>/user.md
 * 2. Global store: ~/.mandio/artifacts/commands/<command>/user.md
 * 3. Legacy project: <project>/.claude/commands/<command>/user.md
 *
 * Strips YAML frontmatter (--- delimited) before returning.
 * Returns { found: false } when no command file exists.
 */
export function loadCommandPrompt(
	command: string,
	workspaceId: string = process.env.MANDIO_WORKSPACE_ID ?? "default",
): CommandPromptResult {
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
					content: stripFrontmatter(readFileSync(linkedCmdFile, "utf-8")),
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
			content: stripFrontmatter(readFileSync(globalCmdFile, "utf-8")),
		};
	}

	// 3. Legacy project location
	const cmdFile = path.join(COMMANDS_DIR, command, "user.md");
	if (existsSync(cmdFile)) {
		return {
			found: true,
			content: stripFrontmatter(readFileSync(cmdFile, "utf-8")),
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
