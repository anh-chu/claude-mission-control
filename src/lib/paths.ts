import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

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
