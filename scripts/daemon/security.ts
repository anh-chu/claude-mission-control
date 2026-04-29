import path from "node:path";

export { scrubCredentials } from "../../src/lib/scrub";

// ─── Path Validation ─────────────────────────────────────────────────────────

/**
 * Validate that a file path resolves within the workspace root.
 * Prevents path traversal attacks (e.g., ../../etc/passwd).
 */
export function validatePathWithinWorkspace(
	filePath: string,
	workspaceRoot: string,
): boolean {
	const resolved = path.resolve(workspaceRoot, filePath);
	const normalizedRoot = path.resolve(workspaceRoot);
	return (
		resolved.startsWith(normalizedRoot + path.sep) ||
		resolved === normalizedRoot
	);
}

// ─── Prompt Sanitization ─────────────────────────────────────────────────────

const MAX_PROMPT_LENGTH = 100_000; // 100KB max prompt

/**
 * Escape content that could break out of the task-context fence.
 * Replaces closing fence tags within the content to prevent injection.
 */
export function escapeFenceContent(content: string): string {
	return content.replace(/<\/task-context>/gi, "<\\/task-context>");
}

/**
 * Wrap task data in delimiters to structurally separate it from agent instructions.
 * This prevents task descriptions from being interpreted as agent commands.
 * Content is escaped to prevent fence breakout via injected closing tags.
 */
export function fenceTaskData(taskData: string): string {
	const escaped = escapeFenceContent(taskData);
	return `<task-context>\n${escaped}\n</task-context>`;
}

/**
 * Enforce maximum prompt length to prevent context stuffing.
 */
export function enforcePromptLimit(prompt: string): string {
	if (prompt.length > MAX_PROMPT_LENGTH) {
		return `${prompt.slice(0, MAX_PROMPT_LENGTH)}\n\n[PROMPT TRUNCATED — exceeded 100KB limit]`;
	}
	return prompt;
}

// ─── Spawn Safety ────────────────────────────────────────────────────────────

const ALLOWED_BINARIES = ["claude", "claude.cmd", "claude.exe"];

/**
 * Validate that only approved CLI binaries are being spawned.
 * Prevents arbitrary command execution.
 */
export function validateBinary(binary: string): boolean {
	const baseName = path.basename(binary).toLowerCase();
	return ALLOWED_BINARIES.includes(baseName);
}

/**
 * Build a safe environment for child processes.
 * Passes PATH, HOME/USERPROFILE, APPDATA, TEMP, and on Windows,
 * SystemRoot/WINDIR/COMSPEC/PATHEXT (required for node.exe).
 * Strips all other env vars to prevent credential leakage.
 */
export function buildSafeEnv(opts?: {
	agentTeams?: boolean;
}): Record<string, string> {
	const safeEnv: Record<string, string> = {};

	// Preserve PATH for binary resolution
	if (process.env.PATH) safeEnv.PATH = process.env.PATH;
	if (process.env.Path) safeEnv.Path = process.env.Path;

	// Preserve HOME/USERPROFILE for Claude Code config resolution
	// On Windows, HOME is often undefined — fall back to USERPROFILE
	const home = process.env.HOME || process.env.USERPROFILE;
	if (home) safeEnv.HOME = home;
	if (process.env.USERPROFILE) safeEnv.USERPROFILE = process.env.USERPROFILE;

	// Preserve APPDATA for Windows applications
	if (process.env.APPDATA) safeEnv.APPDATA = process.env.APPDATA;
	if (process.env.LOCALAPPDATA) safeEnv.LOCALAPPDATA = process.env.LOCALAPPDATA;

	// Preserve temp dirs
	if (process.env.TEMP) safeEnv.TEMP = process.env.TEMP;
	if (process.env.TMP) safeEnv.TMP = process.env.TMP;

	// Windows system vars required for node.exe and native modules.
	// Without SystemRoot, node.exe can't resolve system DLLs → silent exit code 1.
	// These are read-only system paths (no secrets).
	if (process.platform === "win32") {
		if (process.env.SystemRoot) safeEnv.SystemRoot = process.env.SystemRoot;
		if (process.env.SYSTEMROOT) safeEnv.SYSTEMROOT = process.env.SYSTEMROOT;
		if (process.env.WINDIR) safeEnv.WINDIR = process.env.WINDIR;
		if (process.env.COMSPEC) safeEnv.COMSPEC = process.env.COMSPEC;
		if (process.env.PATHEXT) safeEnv.PATHEXT = process.env.PATHEXT;
	}

	// Claude Code OAuth token — v2.1.71+ stores the active token in this env
	// var rather than .credentials.json.  The daemon process inherits it from
	// the user's session; child agent processes need it to authenticate.
	if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
		safeEnv.CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN;
	}

	// Agent Teams: experimental multi-agent coordination
	if (opts?.agentTeams) {
		safeEnv.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1";
	}

	return safeEnv;
}
