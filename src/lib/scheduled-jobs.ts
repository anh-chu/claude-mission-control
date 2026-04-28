/**
 * Server-side background jobs registered via instrumentation.ts.
 * All jobs run in the Node.js process for the lifetime of the server.
 */

import { spawn } from "node:child_process";
import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	unlinkSync,
} from "node:fs";
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import cron from "node-cron";
import { DATA_DIR } from "./paths";

// Get base directory for script resolution.
// Priority: MANDIO_INSTALL_DIR env var > __dirname-based > process.cwd() fallback.
function getBaseDir(): string {
	// CLI wrapper sets MANDIO_INSTALL_DIR when installed as npm package
	if (process.env.MANDIO_INSTALL_DIR) {
		return process.env.MANDIO_INSTALL_DIR;
	}
	// __dirname-relative: up from lib/ to package root
	const packageRoot = path.resolve(__dirname, "..", "..");
	if (existsSync(path.join(packageRoot, "scripts", "daemon"))) {
		return packageRoot;
	}
	// Fallback for dev compatibility (pnpm dev)
	return process.cwd();
}

const GRACE_MS = 60 * 60 * 1000; // 1 hour
const LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const UPLOAD_RE = /\/uploads\/[^"'\s)\]]+/g;

function collectReferencedFilenames(): Set<string> {
	const refs = new Set<string>();

	function extractFromValue(val: unknown) {
		if (typeof val === "string") {
			for (const match of val.matchAll(UPLOAD_RE)) {
				refs.add(path.basename(match[0]));
			}
		} else if (Array.isArray(val)) {
			for (const item of val) extractFromValue(item);
		} else if (val && typeof val === "object") {
			for (const v of Object.values(val as Record<string, unknown>))
				extractFromValue(v);
		}
	}

	function scanFile(filePath: string) {
		try {
			extractFromValue(JSON.parse(readFileSync(filePath, "utf-8")));
		} catch {
			/* ignore unreadable */
		}
	}

	const workspacesDir = path.join(DATA_DIR, "workspaces");
	if (existsSync(workspacesDir)) {
		for (const ws of readdirSync(workspacesDir)) {
			const wsDir = path.join(workspacesDir, ws);
			try {
				for (const file of readdirSync(wsDir).filter((f) =>
					f.endsWith(".json"),
				)) {
					scanFile(path.join(wsDir, file));
				}
			} catch {
				/* ignore */
			}
		}
	}

	try {
		for (const file of readdirSync(DATA_DIR).filter((f) =>
			f.endsWith(".json"),
		)) {
			scanFile(path.join(DATA_DIR, file));
		}
	} catch {
		/* ignore */
	}

	return refs;
}

function runUploadsCleanup() {
	const refs = collectReferencedFilenames();
	const now = Date.now();
	let deleted = 0;

	const workspacesDir = path.join(DATA_DIR, "workspaces");
	if (!existsSync(workspacesDir)) return;

	try {
		for (const ws of readdirSync(workspacesDir)) {
			const uploadsDir = path.join(workspacesDir, ws, "uploads");
			if (!existsSync(uploadsDir)) continue;
			try {
				for (const filename of readdirSync(uploadsDir).filter(
					(f) => !f.startsWith("."),
				)) {
					const filePath = path.join(uploadsDir, filename);
					try {
						const { mtimeMs } = statSync(filePath);
						if (!refs.has(filename) && now - mtimeMs >= GRACE_MS) {
							unlinkSync(filePath);
							deleted++;
						}
					} catch {
						/* ignore per-file errors */
					}
				}
			} catch {
				/* ignore dir errors */
			}
		}
	} catch {
		/* ignore workspaces dir errors */
	}

	if (deleted > 0) {
		console.log(`[cleanup:uploads] removed ${deleted} orphaned file(s)`);
	}
}

export function scheduleUploadsCleanup() {
	// Run immediately on startup (catches anything left from last session)
	runUploadsCleanup();

	// Then run every hour
	cron.schedule("0 * * * *", runUploadsCleanup);
	console.log("[cleanup:uploads] scheduler registered (hourly)");
}

async function cleanupDirectoryOlderThan(
	dir: string,
	maxAgeMs: number,
): Promise<number> {
	if (!existsSync(dir)) return 0;

	let deleted = 0;
	const entries = await readdir(dir, { withFileTypes: true });
	const now = Date.now();

	await Promise.all(
		entries.map(async (entry) => {
			if (!entry.isFile()) return;
			const filePath = path.join(dir, entry.name);

			try {
				const fileStat = await stat(filePath);
				if (now - fileStat.mtimeMs < maxAgeMs) return;
				await unlink(filePath);
				deleted += 1;
			} catch {
				// Ignore per-file errors so one bad file does not stop cleanup.
			}
		}),
	);

	return deleted;
}

async function runLogCleanup() {
	try {
		const [logFilesDeleted, streamFilesDeleted] = await Promise.all([
			cleanupDirectoryOlderThan(path.join(DATA_DIR, "logs"), LOG_RETENTION_MS),
			cleanupDirectoryOlderThan(
				path.join(DATA_DIR, "agent-streams"),
				LOG_RETENTION_MS,
			),
		]);

		if (logFilesDeleted > 0 || streamFilesDeleted > 0) {
			console.log(
				`[cleanup:logs] removed ${logFilesDeleted} log file(s) and ${streamFilesDeleted} stream file(s)`,
			);
		}
	} catch {
		// Non-fatal: cleanup should never break app startup.
	}
}

export function scheduleLogCleanup() {
	void runLogCleanup();
	cron.schedule("0 3 * * *", () => {
		void runLogCleanup();
	});
	console.log("[cleanup:logs] scheduler registered (daily)");
}

// ─── Daemon Watchdog ─────────────────────────────────────────────────────────

function spawnDaemon(): number | null {
	const baseDir = getBaseDir();
	const distPath = path.resolve(baseDir, "dist", "daemon.js");
	if (existsSync(distPath)) {
		const child = spawn(process.execPath, [distPath, "start"], {
			cwd: process.cwd(),
			detached: true,
			stdio: "ignore",
			shell: false,
		});
		child.unref();
		return child.pid ?? null;
	}
	// Fallback: use tsx for development
	const scriptPath = path.resolve(baseDir, "scripts", "daemon", "index.ts");
	if (!existsSync(scriptPath)) {
		console.error(
			`[watchdog:daemon] daemon not found at ${distPath} or ${scriptPath}, skipping restart`,
		);
		return null;
	}
	const child = spawn(
		process.execPath,
		["--import", "tsx", scriptPath, "start"],
		{
			cwd: process.cwd(),
			detached: true,
			stdio: "ignore",
			shell: false,
		},
	);
	child.unref();
	return child.pid ?? null;
}

function isDaemonRunning(): boolean {
	const pidFile = path.join(DATA_DIR, "daemon.pid");
	if (!existsSync(pidFile)) return false;
	try {
		const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
		if (Number.isNaN(pid)) return false;
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function checkAndRestartDaemon() {
	try {
		const configFile = path.join(DATA_DIR, "daemon-config.json");
		if (!existsSync(configFile)) return;
		const config = JSON.parse(readFileSync(configFile, "utf-8")) as Record<
			string,
			unknown
		>;
		if (config.autoStart !== true) return;
		if (isDaemonRunning()) return;
		const pid = spawnDaemon();
		console.log(`[watchdog:daemon] daemon was down, restarted (pid: ${pid})`);
	} catch {
		// Non-fatal
	}
}

export function scheduleDaemonWatchdog() {
	// Delay the initial check slightly so a concurrently-starting daemon
	// has time to write its PID file before we probe liveness.
	setTimeout(checkAndRestartDaemon, 10_000);
	// Then watch every 60 seconds
	cron.schedule("* * * * *", checkAndRestartDaemon);
	console.log("[watchdog:daemon] scheduler registered (every 60s)");
}
