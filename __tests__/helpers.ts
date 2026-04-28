import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Mirror the path resolution in src/lib/paths.ts so backups hit the same files
// that data.ts reads and writes during tests.
const CMC_DATA_DIR = process.env.CMC_DATA_DIR
	? path.resolve(process.env.CMC_DATA_DIR)
	: path.join(os.homedir(), ".cmc");
const WORKSPACE_DIR = path.join(CMC_DATA_DIR, "workspaces", "default");

// Backup and restore data files for test isolation
export async function backupDataFiles(): Promise<Record<string, string>> {
	const files = await fs.readdir(WORKSPACE_DIR);
	const backups: Record<string, string> = {};
	for (const file of files) {
		if (file.endsWith(".json")) {
			backups[file] = await fs.readFile(
				path.join(WORKSPACE_DIR, file),
				"utf-8",
			);
		}
	}
	return backups;
}

export async function restoreDataFiles(
	backups: Record<string, string>,
): Promise<void> {
	for (const [file, content] of Object.entries(backups)) {
		await fs.writeFile(path.join(WORKSPACE_DIR, file), content, "utf-8");
	}
}
