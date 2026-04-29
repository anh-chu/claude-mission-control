import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Assert that an ID is safe (no path traversal, valid characters).
 * Throws Error if ID contains `..`, `/`, `\`, or doesn't match safe pattern.
 */
export function assertSafeSkillId(id: string): void {
	if (
		id.includes("..") ||
		id.includes("/") ||
		id.includes("\\") ||
		!/^[a-zA-Z0-9_-]+$/.test(id)
	) {
		throw new Error(`Invalid skill ID: ${id}`);
	}
}

/**
 * Root directory for all Mandio runtime data.
 * Defaults to ~/.mandio — override with MANDIO_DATA_DIR env var.
 */
export const DATA_DIR: string = process.env.MANDIO_DATA_DIR
	? path.resolve(process.env.MANDIO_DATA_DIR)
	: path.join(os.homedir(), ".mandio");

/** Returns the data directory for a specific workspace. */
export function getWorkspaceDir(workspaceId: string): string {
	return path.join(DATA_DIR, "workspaces", workspaceId);
}

/** Directory where uploaded attachments are stored for a workspace. */
export function getUploadsDir(workspaceId: string): string {
	return path.join(DATA_DIR, "workspaces", workspaceId, "uploads");
}

/** Path to the .wiki-path sentinel file for a workspace. */
export function getWikiPathFile(workspaceId: string): string {
	return path.join(getWorkspaceDir(workspaceId), ".wiki-path");
}

/**
 * Directory where wiki documents are stored for a workspace.
 *
 * llm-wiki-pm v2.5.0 precedence:
 *   1. .wiki-path file in workspace dir (single-line absolute path)
 *   2. Default: <workspace>/wiki/
 */
export function getWikiDir(workspaceId: string): string {
	const sentinel = getWikiPathFile(workspaceId);
	if (existsSync(sentinel)) {
		try {
			const override = readFileSync(sentinel, "utf-8").trim();
			if (override && path.isAbsolute(override)) return override;
		} catch {
			// fall through to default
		}
	}
	return path.join(DATA_DIR, "workspaces", workspaceId, "wiki");
}

/**
 * Default wiki directory (ignores .wiki-path override).
 * Use when writing the sentinel itself to avoid circular reads.
 */
export function getDefaultWikiDir(workspaceId: string): string {
	return path.join(DATA_DIR, "workspaces", workspaceId, "wiki");
}

/**
 * Get base directory for artifacts resolution.
 * Priority: MANDIO_INSTALL_DIR env var > __dirname-based > process.cwd() fallback.
 * Checks for package.json OR artifacts/ OR scripts/daemon to identify package root.
 */
export function getBaseDir(): string {
	// CLI wrapper sets MANDIO_INSTALL_DIR when installed as npm package
	if (process.env.MANDIO_INSTALL_DIR) {
		return process.env.MANDIO_INSTALL_DIR;
	}
	// __dirname-relative: up from lib/ to package root
	const packageRoot = path.resolve(__dirname, "..", "..");
	// Check for any package root indicator: package.json, artifacts, or scripts/daemon
	if (
		existsSync(path.join(packageRoot, "package.json")) ||
		existsSync(path.join(packageRoot, "artifacts")) ||
		existsSync(path.join(packageRoot, "scripts", "daemon"))
	) {
		return packageRoot;
	}
	// fallback to current working directory
	return process.cwd();
}

/** Global skills store: ~/.mandio/artifacts/skills/ */
export function getGlobalSkillsDir(): string {
	return path.join(DATA_DIR, "artifacts", "skills");
}

/** Single global skill dir: ~/.mandio/artifacts/skills/<id>/ */
export function getGlobalSkillDir(skillId: string): string {
	assertSafeSkillId(skillId);
	return path.join(getGlobalSkillsDir(), skillId);
}

/** Prefix applied to workspace-scoped skill symlink names. */
export const MANDIO_SKILL_PREFIX = "mandio-";

/** Workspace skill symlink target dir: <wsDir>/.pi/agent/skills/ */
export function getWorkspaceSkillsDir(workspaceId: string): string {
	return path.join(getWorkspaceDir(workspaceId), ".pi", "agent", "skills");
}

/** Single workspace skill symlink: <wsDir>/.pi/agent/skills/mandio-<id>/ */
export function getWorkspaceSkillLink(
	workspaceId: string,
	skillId: string,
): string {
	assertSafeSkillId(workspaceId);
	assertSafeSkillId(skillId);
	return path.join(
		getWorkspaceSkillsDir(workspaceId),
		`${MANDIO_SKILL_PREFIX}${skillId}`,
	);
}

/** Package artifacts skills dir for seeding */
export function getArtifactsSkillsDir(): string {
	return path.join(getBaseDir(), "artifacts", "skills");
}
