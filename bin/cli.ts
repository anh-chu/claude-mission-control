#!/usr/bin/env node
/**
 * Mandio CLI Entry Point
 *
 * Usage:
 *   mandio start    - Start the server (production mode)
 *   mandio dev     - Start in development mode
 *   mandio stop    - Stop running server
 *   mandio status  - Show server status
 *   mandio version - Show version
 */

import { type ChildProcess, spawn } from "child_process";
import * as fs from "fs";
import * as http from "http";
import os from "os";
import * as path from "path";
import treeKill from "tree-kill";
import { fileURLToPath } from "url";
import { DATA_DIR } from "../src/lib/paths";
import { bootstrapDataDir } from "./bootstrap";
import {
	checkClaudeCLI,
	checkDataDirWritable,
	checkNodeVersion,
	checkPortAvailable,
} from "./checks";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const PID_FILE = path.join(DATA_DIR, "mandio.pid");

interface CliOptions {
	port?: number;
	daemon?: boolean;
}

interface PidInfo {
	pid: number;
	serverPid: number;
	daemonPid?: number;
	port: number;
	startedAt: string;
}

// --- PID File Functions ---

function loadPidFile(): PidInfo | null {
	if (!fs.existsSync(PID_FILE)) return null;
	try {
		const content = fs.readFileSync(PID_FILE, "utf-8");
		return JSON.parse(content);
	} catch {
		return null;
	}
}

function writePidFile(info: PidInfo): void {
	const dir = path.dirname(PID_FILE);
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	fs.writeFileSync(PID_FILE, JSON.stringify(info, null, 2), "utf-8");
}

function clearPidFile(): void {
	if (fs.existsSync(PID_FILE)) {
		fs.unlinkSync(PID_FILE);
	}
}

function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

// --- Server Functions ---

function startServerProcess(port: number): ChildProcess {
	const serverScript = path.join(rootDir, ".next", "standalone", "server.js");
	const proc = spawn(process.execPath, [serverScript], {
		stdio: "inherit",
		shell: false,
		env: { ...process.env, PORT: String(port), MANDIO_INSTALL_DIR: rootDir },
		cwd: rootDir,
	});
	return proc;
}

function killProcess(
	pid: number,
	signal: "SIGTERM" | "SIGKILL" = "SIGTERM",
): Promise<boolean> {
	return new Promise((resolve) => {
		treeKill(pid, signal, (err) => {
			if (err) {
				try {
					process.kill(pid, 0);
					resolve(false);
				} catch {
					resolve(true);
				}
			} else {
				resolve(true);
			}
		});
	});
}

async function stopServer(pid: number): Promise<boolean> {
	return killProcess(pid, "SIGTERM");
}

function forkDaemon(
	command: string,
	args: string[],
	env: NodeJS.ProcessEnv,
): number {
	const daemon = spawn(command, args, {
		detached: true,
		stdio: "ignore",
		cwd: rootDir,
		env,
	});
	daemon.unref();
	return daemon.pid!;
}

function httpGet(url: string, timeout: number = 5000): Promise<string> {
	return new Promise((resolve, reject) => {
		const req = http.get(url, (res) => {
			let data = "";
			res.on("data", (chunk) => (data += chunk));
			res.on("end", () => resolve(data));
		});
		req.on("error", reject);
		req.setTimeout(timeout, () => {
			req.destroy();
			reject(new Error("Request timeout"));
		});
	});
}

async function healthCheck(port: number): Promise<boolean> {
	const url = `http://localhost:${port}/api/server-status`;
	for (let i = 0; i < 10; i++) {
		try {
			const response = await httpGet(url, 5000);
			const data = JSON.parse(response);
			if (data && data.status === "ok") {
				return true;
			}
		} catch {
			if (i < 9) await new Promise((r) => setTimeout(r, 1000));
		}
	}
	return false;
}

// --- CLI Commands ---

async function start(options: CliOptions = {}) {
	console.log("🚀 Starting Mandio...\n");

	// Run preflight checks
	const nodeOk = checkNodeVersion();
	if (!nodeOk) {
		console.error("\n❌ Node.js version check failed.");
		process.exit(1);
	}

	const claudeOk = checkClaudeCLI();
	if (!claudeOk) {
		console.error(
			"\n❌ Claude CLI not found. Some features will be unavailable.",
		);
	}

	// Bootstrap data directory
	console.log("📁 Setting up data directory...");
	await bootstrapDataDir();
	console.log("  ✓ Data directory ready\n");

	// Check if already running
	const pidInfo = loadPidFile();
	if (pidInfo && isProcessAlive(pidInfo.pid)) {
		console.error(
			"❌ Mandio is already running (PID:",
			pidInfo.pid + ")",
		);
		console.log("   Use 'mandio stop' to stop it first.");
		process.exit(1);
	}

	const port = options.port || 3000;

	// Check port availability
	const portOk = await checkPortAvailable(port);
	if (!portOk) {
		console.error(`\n❌ Port ${port} is already in use.`);
		process.exit(1);
	}

	// Start server in foreground or daemon mode
	if (options.daemon) {
		console.log(`Starting in daemon mode on port ${port}...`);
		const serverScript = path.join(rootDir, ".next", "standalone", "server.js");
		const pid = forkDaemon(process.execPath, [serverScript], {
			...process.env,
			PORT: String(port),
			MANDIO_INSTALL_DIR: rootDir,
		});

		// Write PID file
		clearPidFile();
		writePidFile({
			pid,
			serverPid: pid,
			daemonPid: pid,
			port,
			startedAt: new Date().toISOString(),
		});

		console.log(`✓ Server started in background (PID: ${pid})`);
		console.log(`  Access at: http://localhost:${port}`);
	} else {
		console.log(`Starting server on port ${port}...`);

		const proc = startServerProcess(port);
		const resolved = false;

		proc.on("error", (err) => {
			if (!resolved) {
				console.error("❌ Server error:", err.message);
				process.exit(1);
			}
		});

		proc.on("exit", (code) => {
			if (code !== 0 && !resolved) {
				console.error(`❌ Server exited with code ${code}`);
				process.exit(1);
			}
		});

		// Wait for server to be ready
		const ready = await healthCheck(port);
		if (!ready) {
			console.warn("⚠ Server may not be ready yet");
		}

		// Write PID file
		clearPidFile();
		writePidFile({
			pid: proc.pid!,
			serverPid: proc.pid!,
			port,
			startedAt: new Date().toISOString(),
		});
	}
}

async function stop() {
	console.log("🛑 Stopping Mandio...\n");

	const pidInfo = loadPidFile();
	if (!pidInfo) {
		console.log("No running instance found.");
		return;
	}

	const stopped = await stopServer(pidInfo.pid);
	if (stopped) {
		clearPidFile();
		console.log("✓ Server stopped");
	} else {
		console.log("⚠ Could not stop server, process may have already exited");
	}
}

async function status() {
	const pidInfo = loadPidFile();

	if (!pidInfo) {
		console.log("Mandio is not running");
		return;
	}

	const isAlive = isProcessAlive(pidInfo.pid);

	console.log("Mandio Status:");
	console.log("  State:", isAlive ? "🟢 Running" : "🔴 Stopped");
	console.log("  PID:", pidInfo.pid);
	console.log("  Port:", pidInfo.port);
	console.log("  Started:", pidInfo.startedAt);
}

function version() {
	const pkgPath = path.join(rootDir, "package.json");
	const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
	console.log(`mandio v${pkg.version}`);
}

async function dev() {
	console.log("🔧 Starting in development mode...\n");

	// Run preflight checks
	checkNodeVersion();
	await checkDataDirWritable(DATA_DIR);

	// Bootstrap
	await bootstrapDataDir();

	// Fork the dev server
	const pid = forkDaemon("pnpm", ["dev"], process.env);

	console.log(`✓ Dev server started (PID: ${pid})`);
	console.log("   Access at: http://localhost:3000");
}

// Main CLI handler
async function main() {
	const args = process.argv.slice(2);
	const command = args[0] || "help";

	// Parse options
	const options: CliOptions = {};
	const portIndex = args.indexOf("--port");
	if (portIndex !== -1 && args[portIndex + 1]) {
		const portArg = parseInt(args[portIndex + 1], 10);
		if (!Number.isInteger(portArg) || portArg < 1 || portArg > 65535) {
			console.error(
				`❌ Invalid port: ${args[portIndex + 1]}. Must be an integer between 1 and 65535.`,
			);
			process.exit(1);
		}
		options.port = portArg;
	}

	if (args.includes("--daemon")) {
		options.daemon = true;
	}

	switch (command) {
		case "start":
			await start(options);
			break;
		case "dev":
			await dev();
			break;
		case "stop":
			await stop();
			break;
		case "status":
			await status();
			break;
		case "version":
			version();
			break;
		case "help":
		default:
			console.log(`
Mandio CLI

Usage:
  mandio <command> [options]

Commands:
  start           Start the server
  dev            Start in development mode  
  stop           Stop the running server
  status         Show server status
  version        Show version

Options:
  --port <n>     Specify port (default: 3000)
  --daemon       Run in background (daemon mode)

Examples:
  mandio start --port 3000
  mandio start --daemon
  mandio stop
  mandio status
			`);
			break;
	}
}

main().catch((err) => {
	console.error("Error:", err.message);
	process.exit(1);
});
