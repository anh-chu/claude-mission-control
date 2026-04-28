import { execSync } from "child_process";
import * as fs from "fs";
import * as net from "net";
import * as path from "path";

// ANSI color codes
const colors = {
	reset: "\x1b[0m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
};

function printResult(
	checkName: string,
	passed: boolean,
	message?: string,
): boolean {
	const status = passed
		? `${colors.green}✓ PASS${colors.reset}`
		: `${colors.red}✗ FAIL${colors.reset}`;
	console.log(`${status} - ${checkName}${message ? `: ${message}` : ""}`);
	return passed;
}

export function checkNodeVersion(minVersion: string = "18.0.0"): boolean {
	const nodeVersion = process.version.slice(1); // Remove 'v'
	const [major, minor, patch] = nodeVersion.split(".").map(Number);
	const [minMajor, minMinor, minPatch] = minVersion.split(".").map(Number);

	if (major < minMajor) {
		return printResult(
			"Node.js version",
			false,
			`required >= ${minVersion}, got ${process.version}`,
		);
	}
	if (major === minMajor && minor < minMinor) {
		return printResult(
			"Node.js version",
			false,
			`required >= ${minVersion}, got ${process.version}`,
		);
	}
	if (major === minMajor && minor === minMinor && patch < minPatch) {
		return printResult(
			"Node.js version",
			false,
			`required >= ${minVersion}, got ${process.version}`,
		);
	}

	return printResult("Node.js version", true, process.version);
}

export function checkClaudeCLI(): boolean {
	try {
		execSync("claude --version", { stdio: "ignore" });
		return printResult("Claude CLI", true);
	} catch {
		printResult("Claude CLI", false, "not installed");
		console.log(
			`${colors.yellow}  Please install: npm install -g @anthropic-ai/claude-code${colors.reset}`,
		);
		return false;
	}
}

export async function checkPortAvailable(
	port: number = 3000,
): Promise<boolean> {
	return new Promise<boolean>((resolve) => {
		const server = net.createServer();

		server.once("error", (err: NodeJS.ErrnoException) => {
			if (err.code === "EADDRINUSE") {
				printResult(`Port ${port}`, false, "already in use");
				resolve(false);
			} else {
				printResult(`Port ${port}`, false, err.message);
				resolve(false);
			}
		});

		server.once("listening", () => {
			server.close(() => {
				printResult(`Port ${port}`, true, "available");
				resolve(true);
			});
		});

		server.listen(port);
	});
}

export function checkDataDirWritable(dataDir: string): boolean {
	try {
		fs.mkdirSync(dataDir, { recursive: true });

		// Test write access by creating a temp file
		const testFile = path.join(dataDir, ".write-test-" + Date.now());
		fs.writeFileSync(testFile, "test");
		fs.unlinkSync(testFile);

		return printResult("Data directory", true, dataDir);
	} catch (err) {
		const message = err instanceof Error ? err.message : "unknown error";
		printResult("Data directory", false, message);
		return false;
	}
}
