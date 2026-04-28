import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Data directory constants (replicated from src/lib/paths.ts to avoid cross-module issues)
const DATA_DIR: string = process.env.MANDIO_DATA_DIR
	? path.resolve(process.env.MANDIO_DATA_DIR)
	: path.join(os.homedir(), ".mandio");

function getWorkspaceDir(workspaceId: string): string {
	return path.join(DATA_DIR, "workspaces", workspaceId);
}

const VERSION_FILE = ".version";

/**
 * Bootstrap the data directory for Mandio.
 * Creates the base ~/.mandio/ structure and runs migrations if needed.
 */
export async function bootstrapDataDir(): Promise<void> {
	ensureDataDir();
	ensureDefaultWorkspace();
	ensureLogsDir();
	writeVersion();
}

/**
 * Ensure the base data directory exists.
 */
function ensureDataDir(): void {
	if (!existsSync(DATA_DIR)) {
		mkdirSync(DATA_DIR, { recursive: true });
		console.log(`[bootstrap] Created ${DATA_DIR}`);
	}
}

/**
 * Read the current package version from package.json.
 */
function getCurrentVersion(): string {
	const pkgPath = path.join(__dirname, "..", "package.json");
	const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
	return pkg.version;
}

/**
 * Write the current version to ~/.mandio/.version.
 */
function writeVersion(): void {
	const versionPath = path.join(DATA_DIR, VERSION_FILE);
	const currentVersion = getCurrentVersion();

	if (!existsSync(versionPath)) {
		writeFileSync(versionPath, currentVersion, "utf-8");
		console.log(`[bootstrap] Written ${VERSION_FILE}: ${currentVersion}`);
	} else {
		const existing = readFileSync(versionPath, "utf-8").trim();
		if (existing !== currentVersion) {
			writeFileSync(versionPath, currentVersion, "utf-8");
			console.log(
				`[bootstrap] Updated ${VERSION_FILE}: ${existing} -> ${currentVersion}`,
			);
		}
	}
}

/**
 * Ensure the default workspace exists with seed structure.
 */
function ensureDefaultWorkspace(): void {
	const defaultWs = getWorkspaceDir("default");

	// Seed files to create if they don't exist
	const seedFiles: Record<string, unknown> = {
		"tasks.json": [],
		"projects.json": [],
		"inbox.json": [],
	};

	for (const [filename, defaultContent] of Object.entries(seedFiles)) {
		const filePath = path.join(defaultWs, filename);
		if (!existsSync(filePath)) {
			const dir = path.dirname(filePath);
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true });
			}
			writeFileSync(filePath, JSON.stringify(defaultContent, null, 2), "utf-8");
			console.log(`[bootstrap] Created ${filename} in default workspace`);
		}
	}

	// Create logs subdirectory if needed
	const logsSubDir = path.join(defaultWs, "logs");
	if (!existsSync(logsSubDir)) {
		mkdirSync(logsSubDir, { recursive: true });
		console.log(`[bootstrap] Created logs/ in default workspace`);
	}
}

/**
 * Ensure the logs directory exists at ~/.mandio/logs/.
 */
function ensureLogsDir(): void {
	const logsDir = path.join(DATA_DIR, "logs");
	if (!existsSync(logsDir)) {
		mkdirSync(logsDir, { recursive: true });
		console.log(`[bootstrap] Created ${logsDir}`);
	}
}

/**
 * Read stored version from ~/.mandio/.version.
 */
function _getStoredVersion(): string | null {
	const versionPath = path.join(DATA_DIR, VERSION_FILE);
	if (!existsSync(versionPath)) return null;

	try {
		return readFileSync(versionPath, "utf-8").trim();
	} catch {
		return null;
	}
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	bootstrapDataDir()
		.then(() => {
			console.log("[bootstrap] Done");
			process.exit(0);
		})
		.catch((err) => {
			console.error("[bootstrap] Error:", err);
			process.exit(1);
		});
}
