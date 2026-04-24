import {
	createWriteStream,
	mkdirSync,
	renameSync,
	statSync,
	writeFileSync,
	type WriteStream,
} from "fs";
import path from "path";
import { DATA_DIR } from "./paths";
import { scrubCredentials } from "./scrub";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "SECURITY";

export interface Logger {
	setLevel(level: LogLevel): void;
	log(level: LogLevel, module: string, message: string, meta?: unknown): void;
	debug(module: string, message: string, meta?: unknown): void;
	info(module: string, message: string, meta?: unknown): void;
	warn(module: string, message: string, meta?: unknown): void;
	error(module: string, message: string, meta?: unknown): void;
	security(module: string, message: string, meta?: unknown): void;
}

interface LoggerOptions {
	level?: LogLevel;
	sync?: boolean;
}

interface JsonLogEntry {
	ts: string;
	level: LogLevel;
	module: string;
	process: string;
	pid: number;
	msg: string;
	meta?: unknown;
}

const LEVELS: LogLevel[] = ["DEBUG", "INFO", "WARN", "ERROR", "SECURITY"];
const LEVEL_COLORS: Record<LogLevel, string> = {
	DEBUG: "\x1b[90m",
	INFO: "\x1b[36m",
	WARN: "\x1b[33m",
	ERROR: "\x1b[31m",
	SECURITY: "\x1b[35m",
};
const RESET = "\x1b[0m";
const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_ROTATIONS = 3;
const ROTATION_INTERVAL_MS = 30_000;
const ROTATION_WRITE_THRESHOLD = 100;
const LOG_DIR = path.join(DATA_DIR, "logs");
const LEGACY_DAEMON_LOG = path.join(DATA_DIR, "daemon.log");

let logDirReady = false;

function ensureLogDir(): void {
	if (logDirReady) return;
	mkdirSync(LOG_DIR, { recursive: true });
	logDirReady = true;
}

function formatTimestamp(ts: string): string {
	return ts.replace("T", " ").slice(0, 19);
}

function sanitizeMeta(meta: unknown): unknown {
	if (meta == null) return undefined;
	if (typeof meta === "string") return scrubCredentials(meta);
	if (Array.isArray(meta)) return meta.map((item) => sanitizeMeta(item));
	if (typeof meta === "object") {
		const entries = Object.entries(meta as Record<string, unknown>).map(
			([key, value]) => [key, sanitizeMeta(value)],
		);
		return Object.fromEntries(entries);
	}
	return meta;
}

function formatMeta(meta: unknown): string {
	if (meta == null) return "";
	try {
		return ` ${JSON.stringify(meta)}`;
	} catch {
		return ` ${String(meta)}`;
	}
}

function rotateFile(filePath: string): void {
	try {
		const size = statSync(filePath).size;
		if (size < MAX_LOG_SIZE_BYTES) return;
	} catch {
		return;
	}

	for (let i = MAX_ROTATIONS - 1; i >= 1; i--) {
		try {
			renameSync(`${filePath}.${i}`, `${filePath}.${i + 1}`);
		} catch {
			// Missing files are expected while rotating.
		}
	}
	try {
		renameSync(filePath, `${filePath}.1`);
	} catch {
		// Rotation failure is non-fatal.
	}
}

function normalizeProcessName(processName: string): string {
	return processName === "task" ? "tasks" : processName;
}

export function createLogger(
	processName: string,
	opts: LoggerOptions = {},
): Logger {
	const normalizedProcess = normalizeProcessName(processName);
	const logFilePath = path.join(LOG_DIR, `${normalizedProcess}.jsonl`);
	const syncWrites = opts.sync ?? normalizedProcess !== "app";
	let minLevel: LogLevel = opts.level ?? "INFO";
	let writesSinceRotationCheck = 0;
	let lastRotationCheckAt = 0;
	let stream: WriteStream | null = null;
	let rotationInProgress = false;
	const pendingLines: string[] = [];

	const openStream = (): WriteStream => {
		ensureLogDir();
		return createWriteStream(logFilePath, { flags: "a", encoding: "utf8" });
	};

	const writeLegacyDaemonLine = (line: string): void => {
		if (normalizedProcess !== "daemon") return;
		rotateFile(LEGACY_DAEMON_LOG);
		writeFileSync(LEGACY_DAEMON_LOG, `${line}\n`, { flag: "a" });
	};

	const flushPendingLines = (): void => {
		if (syncWrites) return;
		if (rotationInProgress) return;
		const activeStream = stream ?? openStream();
		stream = activeStream;
		while (pendingLines.length > 0) {
			const nextLine = pendingLines.shift();
			if (nextLine == null) continue;
			activeStream.write(nextLine);
		}
	};

	const rotateAsyncStream = (): void => {
		if (syncWrites || rotationInProgress) return;
		rotationInProgress = true;
		const activeStream = stream ?? openStream();
		stream = null;
		activeStream.end(() => {
			rotateFile(logFilePath);
			if (normalizedProcess === "daemon") {
				rotateFile(LEGACY_DAEMON_LOG);
			}
			rotationInProgress = false;
			flushPendingLines();
		});
	};

	const maybeRotate = (): void => {
		const now = Date.now();
		writesSinceRotationCheck += 1;
		if (
			writesSinceRotationCheck < ROTATION_WRITE_THRESHOLD &&
			now - lastRotationCheckAt < ROTATION_INTERVAL_MS
		) {
			return;
		}
		writesSinceRotationCheck = 0;
		lastRotationCheckAt = now;
		if (syncWrites) {
			rotateFile(logFilePath);
			if (normalizedProcess === "daemon") {
				rotateFile(LEGACY_DAEMON_LOG);
			}
			return;
		}
		rotateAsyncStream();
	};

	if (!syncWrites) {
		process.once("beforeExit", () => {
			if (pendingLines.length > 0) {
				flushPendingLines();
			}
			if (stream) {
				stream.end();
				stream = null;
			}
		});
	}

	const shouldLog = (level: LogLevel): boolean =>
		LEVELS.indexOf(level) >= LEVELS.indexOf(minLevel);

	const writeJsonLine = (line: string): void => {
		if (syncWrites) {
			ensureLogDir();
			writeFileSync(logFilePath, line, { flag: "a" });
			return;
		}
		pendingLines.push(line);
		flushPendingLines();
	};

	const write = (
		level: LogLevel,
		module: string,
		message: string,
		meta?: unknown,
	): void => {
		if (!shouldLog(level)) return;

		const ts = new Date().toISOString();
		const safeMessage = scrubCredentials(message);
		const safeMeta = sanitizeMeta(meta);
		const plainMeta = formatMeta(safeMeta);
		const consoleLine = `[${formatTimestamp(ts)}] [${level}] [${module}] ${safeMessage}${plainMeta}`;
		const jsonEntry: JsonLogEntry = {
			ts,
			level,
			module,
			process: normalizedProcess,
			pid: process.pid,
			msg: safeMessage,
		};

		if (safeMeta !== undefined) {
			jsonEntry.meta = safeMeta;
		}

		console.log(`${LEVEL_COLORS[level]}${consoleLine}${RESET}`);

		try {
			maybeRotate();
			const jsonLine = `${JSON.stringify(jsonEntry)}\n`;
			writeJsonLine(jsonLine);
			writeLegacyDaemonLine(consoleLine);
		} catch {
			// File write failures are non-fatal.
		}
	};

	return {
		setLevel(level: LogLevel): void {
			minLevel = level;
		},
		log(
			level: LogLevel,
			module: string,
			message: string,
			meta?: unknown,
		): void {
			write(level, module, message, meta);
		},
		debug(module: string, message: string, meta?: unknown): void {
			write("DEBUG", module, message, meta);
		},
		info(module: string, message: string, meta?: unknown): void {
			write("INFO", module, message, meta);
		},
		warn(module: string, message: string, meta?: unknown): void {
			write("WARN", module, message, meta);
		},
		error(module: string, message: string, meta?: unknown): void {
			write("ERROR", module, message, meta);
		},
		security(module: string, message: string, meta?: unknown): void {
			write("SECURITY", module, message, meta);
		},
	};
}
