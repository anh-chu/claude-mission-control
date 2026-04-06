import { spawn, execSync, type ChildProcess } from "child_process";
import { existsSync, readFileSync, createWriteStream, mkdirSync } from "fs";
import path from "path";
import { logger } from "./logger";
import { loadConfig } from "./config";
import { validateBinary, buildSafeEnv, scrubCredentials } from "./security";
import type { SpawnOptions, SpawnResult, ClaudeOutputMeta, ClaudeUsage, AgentBackend } from "./types";

// tree-kill for killing process trees on Windows
import treeKill from "tree-kill";

const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const MAX_STDOUT_SIZE = 10_000_000; // 10MB max captured output

// ─── Claude Binary Detection ─────────────────────────────────────────────────

/**
 * Resolved Claude binary info.
 * On Windows, npm global installs create .cmd shim files that can't be
 * spawned directly with shell: false. Instead we resolve the underlying
 * JS entry point and spawn it via node.exe.
 */
interface ResolvedBinary {
  /** The binary to spawn (claude, claude.exe, or node.exe for .cmd shims) */
  bin: string;
  /** Extra args to prepend (the JS entry point path when using node.exe) */
  prefixArgs: string[];
  /** Original path for logging */
  originalPath: string;
}

// Cache the resolved binary to avoid repeated lookups
let cachedBinary: ResolvedBinary | null = null;

/**
 * Resolve the JS entry point from an npm .cmd shim file.
 * npm .cmd files contain: "%_prog%" "%dp0%\node_modules\...\cli.js" %*
 * We extract the relative path and resolve it.
 */
function resolveJsFromCmd(cmdPath: string): string | null {
  try {
    const content = readFileSync(cmdPath, "utf-8");
    // Match the pattern: "%dp0%\node_modules\...\cli.js" or similar
    const match = content.match(/%dp0%\\([^"]+\.js)/i) ||
                  content.match(/%dp0%\\([^\s"]+\.js)/i);
    if (match) {
      const dir = path.dirname(cmdPath);
      const jsPath = path.join(dir, match[1]);
      if (existsSync(jsPath)) {
        return jsPath;
      }
    }
  } catch { /* couldn't read .cmd file */ }

  // Fallback: check the standard npm global structure
  const dir = path.dirname(cmdPath);
  const standard = path.join(dir, "node_modules", "@anthropic-ai", "claude-code", "cli.js");
  if (existsSync(standard)) {
    return standard;
  }

  return null;
}

function findClaudeBinary(): ResolvedBinary {
  if (cachedBinary) return cachedBinary;

  // 1. Check config override
  try {
    const config = loadConfig();
    if (config.execution.claudeBinaryPath) {
      logger.info("runner", `Using configured binary path: ${config.execution.claudeBinaryPath}`);
      cachedBinary = {
        bin: config.execution.claudeBinaryPath,
        prefixArgs: [],
        originalPath: config.execution.claudeBinaryPath,
      };
      return cachedBinary;
    }
  } catch { /* config load failed, continue with auto-detect */ }

  // 2. Check common install locations (Windows + Unix)
  const candidates: string[] = [];

  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? "";
    const localAppData = process.env.LOCALAPPDATA ?? "";
    const userProfile = process.env.USERPROFILE ?? "";

    candidates.push(
      // npm global
      path.join(appData, "npm", "claude.cmd"),
      path.join(appData, "npm", "claude"),
      // pnpm global
      path.join(localAppData, "pnpm", "claude.cmd"),
      path.join(localAppData, "pnpm", "claude"),
      // User .local/bin (common on WSL-adjacent setups)
      path.join(userProfile, ".local", "bin", "claude"),
      path.join(userProfile, ".local", "bin", "claude.exe"),
    );
  } else {
    const home = process.env.HOME ?? "";
    candidates.push(
      path.join(home, ".local", "bin", "claude"),
      path.join(home, ".npm-global", "bin", "claude"),
      "/usr/local/bin/claude",
      "/usr/bin/claude",
    );
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      logger.info("runner", `Found claude at: ${candidate}`);

      // On Windows, .cmd shims can't be spawned directly — resolve the JS entry point
      if (candidate.endsWith(".cmd")) {
        const jsEntry = resolveJsFromCmd(candidate);
        if (jsEntry) {
          logger.info("runner", `Resolved .cmd shim → ${jsEntry} (via node.exe)`);
          cachedBinary = {
            bin: process.execPath, // node.exe
            prefixArgs: [jsEntry],
            originalPath: candidate,
          };
          return cachedBinary;
        }
      }

      cachedBinary = { bin: candidate, prefixArgs: [], originalPath: candidate };
      return cachedBinary;
    }
  }

  // 3. Try which/where via execSync (catches PATH entries we missed)
  try {
    const cmd = process.platform === "win32" ? "where claude" : "which claude";
    const result = execSync(cmd, { encoding: "utf-8", timeout: 5000 })
      .trim()
      .split("\n")[0]
      .trim();
    if (result) {
      logger.info("runner", `Found claude via PATH: ${result}`);

      if (result.endsWith(".cmd")) {
        const jsEntry = resolveJsFromCmd(result);
        if (jsEntry) {
          logger.info("runner", `Resolved .cmd shim → ${jsEntry} (via node.exe)`);
          cachedBinary = {
            bin: process.execPath,
            prefixArgs: [jsEntry],
            originalPath: result,
          };
          return cachedBinary;
        }
      }

      cachedBinary = { bin: result, prefixArgs: [], originalPath: result };
      return cachedBinary;
    }
  } catch { /* not found in PATH */ }

  // 4. Fallback — return "claude" and let spawn fail with a descriptive error
  logger.warn("runner", "Could not auto-detect claude binary. Set 'claudeBinaryPath' in daemon-config.json or install Claude Code globally (npm i -g @anthropic-ai/claude-code)");
  return { bin: "claude", prefixArgs: [], originalPath: "claude" };
}

// ─── Codex Binary Detection ─────────────────────────────────────────────────

let cachedCodexBinary: ResolvedBinary | null = null;

function findCodexBinary(): ResolvedBinary {
  if (cachedCodexBinary) return cachedCodexBinary;

  // 1. Check config override
  try {
    const config = loadConfig();
    const codexPath = (config.execution as Record<string, unknown>).codexBinaryPath;
    if (typeof codexPath === "string" && codexPath) {
      logger.info("runner", `Using configured codex binary path: ${codexPath}`);
      cachedCodexBinary = { bin: codexPath, prefixArgs: [], originalPath: codexPath };
      return cachedCodexBinary;
    }
  } catch { /* config load failed, continue with auto-detect */ }

  // 2. Check common install locations
  const candidates: string[] = [];
  const home = process.env.HOME ?? "";

  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? "";
    const localAppData = process.env.LOCALAPPDATA ?? "";
    candidates.push(
      path.join(appData, "npm", "codex.cmd"),
      path.join(appData, "npm", "codex"),
      path.join(localAppData, "pnpm", "codex.cmd"),
      path.join(localAppData, "pnpm", "codex"),
    );
  } else {
    candidates.push(
      path.join(home, ".local", "bin", "codex"),
      path.join(home, ".npm-global", "bin", "codex"),
      "/usr/local/bin/codex",
      "/usr/bin/codex",
    );
  }

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      logger.info("runner", `Found codex at: ${candidate}`);
      cachedCodexBinary = { bin: candidate, prefixArgs: [], originalPath: candidate };
      return cachedCodexBinary;
    }
  }

  // 3. Try which/where
  try {
    const cmd = process.platform === "win32" ? "where codex" : "which codex";
    const result = execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim().split("\n")[0].trim();
    if (result) {
      logger.info("runner", `Found codex via PATH: ${result}`);
      cachedCodexBinary = { bin: result, prefixArgs: [], originalPath: result };
      return cachedCodexBinary;
    }
  } catch { /* not found in PATH */ }

  // 4. Fallback
  logger.warn("runner", "Could not auto-detect codex binary. Install Codex CLI (npm i -g @openai/codex) or set 'codexBinaryPath' in daemon-config.json");
  return { bin: "codex", prefixArgs: [], originalPath: "codex" };
}

// ─── CLI Output Parsers ─────────────────────────────────────────────────────

/**
 * Parse a single JSON object into ClaudeOutputMeta fields.
 */
function parseMetaFromObject(parsed: Record<string, unknown>): ClaudeOutputMeta {
  const meta: ClaudeOutputMeta = {
    totalCostUsd: typeof parsed.total_cost_usd === "number" ? parsed.total_cost_usd : null,
    numTurns: typeof parsed.num_turns === "number" ? parsed.num_turns : null,
    subtype: typeof parsed.subtype === "string" ? parsed.subtype : null,
    sessionId: typeof parsed.session_id === "string" ? parsed.session_id : null,
    isError: parsed.is_error === true,
    usage: null,
  };

  if (parsed.usage && typeof parsed.usage === "object") {
    const u = parsed.usage as Record<string, unknown>;
    meta.usage = {
      inputTokens: typeof u.input_tokens === "number" ? u.input_tokens : 0,
      outputTokens: typeof u.output_tokens === "number" ? u.output_tokens : 0,
      cacheReadInputTokens: typeof u.cache_read_input_tokens === "number" ? u.cache_read_input_tokens : 0,
      cacheCreationInputTokens: typeof u.cache_creation_input_tokens === "number" ? u.cache_creation_input_tokens : 0,
    };
  }

  return meta;
}

/**
 * Parse Claude Code's output into structured metadata.
 * Supports both --output-format json (single JSON blob) and
 * --output-format stream-json (JSONL where last line is the result).
 */
export function parseClaudeOutput(stdout: string): ClaudeOutputMeta {
  const empty: ClaudeOutputMeta = {
    totalCostUsd: null,
    numTurns: null,
    subtype: null,
    sessionId: null,
    isError: false,
    usage: null,
  };

  try {
    // Try single JSON blob first (--output-format json)
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    return parseMetaFromObject(parsed);
  } catch {
    // Fall through to stream-json parsing
  }

  // Stream-json: parse last non-empty line (the result message)
  try {
    const lines = stdout.trim().split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(lines[i]) as Record<string, unknown>;
        if (parsed.type === "result") {
          return parseMetaFromObject(parsed);
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Not parseable
  }

  return empty;
}

// ─── Agent Runner ────────────────────────────────────────────────────────────

export class AgentRunner {
  private cwd: string;

  constructor(cwd?: string) {
    this.cwd = cwd ?? WORKSPACE_ROOT;
  }

  /**
   * Spawn an agent CLI session with the given prompt.
   * Supports both Claude Code and Codex CLI backends.
   * Returns when the process exits or times out.
   */
  async spawnAgent(opts: SpawnOptions): Promise<SpawnResult & { pid: number }> {
    const backend: AgentBackend = opts.backend ?? "claude";
    const resolved = backend === "codex" ? findCodexBinary() : findClaudeBinary();

    if (!validateBinary(resolved.originalPath)) {
      throw new Error(`Security: binary "${resolved.originalPath}" is not in the allowed list`);
    }

    let args: string[];

    if (backend === "codex") {
      // Codex CLI: codex -q --full-auto "<prompt>"
      args = [
        ...resolved.prefixArgs,
        "-q",
        "--full-auto",
        opts.prompt,
      ];
      logger.info("runner", "Using Codex CLI backend");
    } else {
      // Claude Code: claude -p "<prompt>" --verbose --output-format stream-json --max-turns N
      // --verbose is required when combining -p with --output-format stream-json
      args = [
        ...resolved.prefixArgs,
        "-p", opts.prompt,
        "--verbose",
        "--output-format", "stream-json",
        "--max-turns", String(opts.maxTurns),
      ];

      if (opts.resumeSessionId) {
        args.push("--resume", opts.resumeSessionId);
        logger.info("runner", `Resuming session: ${opts.resumeSessionId}`);
      }

      if (opts.skipPermissions) {
        args.push("--dangerously-skip-permissions");
        logger.security("runner", "Spawning with --dangerously-skip-permissions");
      } else if (opts.allowedTools && opts.allowedTools.length > 0) {
        args.push("--allowedTools", ...opts.allowedTools);
        logger.info("runner", `Allowed tools: ${opts.allowedTools.join(", ")}`);
      }
    }

    const safeEnv = buildSafeEnv({ agentTeams: opts.agentTeams });

    logger.debug("runner", `Spawning [${backend}]: ${resolved.bin} ${resolved.prefixArgs.length ? resolved.prefixArgs[0] + " " : ""}-p "<prompt>" --max-turns ${opts.maxTurns}`);
    logger.debug("runner", `CWD: ${opts.cwd || this.cwd}`);

    return new Promise<SpawnResult & { pid: number }>((resolve) => {
      const child: ChildProcess = spawn(resolved.bin, args, {
        cwd: opts.cwd || this.cwd,
        env: safeEnv as NodeJS.ProcessEnv,
        stdio: ["ignore", "pipe", "pipe"] as const,
        windowsHide: true,
      });

      const pid = child.pid ?? 0;

      // Notify caller of PID immediately after spawn (for tracking in respond-runs, etc.)
      opts.onSpawned?.(pid);

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      let settled = false;
      let sessionIdEmitted = false;

      // Set up JSONL stream file if requested
      let streamWriter: ReturnType<typeof createWriteStream> | null = null;
      if (opts.streamFile) {
        try {
          const streamDir = path.dirname(opts.streamFile);
          mkdirSync(streamDir, { recursive: true });
          streamWriter = createWriteStream(opts.streamFile, { flags: "a" });
        } catch (err) {
          logger.warn("runner", `Failed to create stream file ${opts.streamFile}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Buffer for incomplete lines from stdout chunks
      let lineBuffer = "";

      // Capture stdout with size limit + write to stream file
      child.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        if (stdout.length < MAX_STDOUT_SIZE) {
          stdout += text;
        }

        // Parse complete lines: detect session_id + write to stream file
        lineBuffer += text;
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;

          // Extract Claude session_id from the first system init event
          if (!sessionIdEmitted && opts.onSessionId && backend === "claude") {
            try {
              const evt = JSON.parse(line) as Record<string, unknown>;
              if (evt.type === "system" && evt.subtype === "init" && typeof evt.session_id === "string") {
                sessionIdEmitted = true;
                opts.onSessionId(evt.session_id);
              }
            } catch { /* not JSON or not the init event */ }
          }

          if (streamWriter) {
            if (backend === "codex") {
              streamWriter.write(JSON.stringify({ type: "assistant", content: [{ type: "text", text: line }] }) + "\n");
            } else {
              streamWriter.write(line + "\n");
            }
          }
        }

      });

      // Capture stderr with size limit
      child.stderr?.on("data", (chunk: Buffer) => {
        if (stderr.length < MAX_STDOUT_SIZE) {
          stderr += chunk.toString();
        }
      });

      // Timeout enforcement
      const timeoutMs = opts.timeoutMinutes * 60 * 1000;
      const timer = setTimeout(() => {
        if (settled) return;
        timedOut = true;
        logger.warn("runner", `Process ${pid} timed out after ${opts.timeoutMinutes} minutes — killing`);

        // Kill the entire process tree (important on Windows)
        treeKill(pid, "SIGTERM", (err?: Error) => {
          if (err) {
            logger.error("runner", `Failed to kill process tree ${pid}: ${err.message}`);
            try { child.kill("SIGKILL"); } catch { /* best effort */ }
          }
        });
      }, timeoutMs);

      // Process exit
      child.on("close", (exitCode: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        // Flush remaining buffer and close stream file
        if (streamWriter) {
          if (lineBuffer.trim()) {
            streamWriter.write(lineBuffer + "\n");
          }
          streamWriter.end();
        }

        // Diagnostic logging on failure — helps debug silent exit code 1 issues
        if (exitCode !== null && exitCode !== 0 && !timedOut) {
          if (stderr.trim()) {
            logger.error("runner", `Process ${pid} stderr: ${scrubCredentials(stderr.slice(0, 500))}`);
          }
          if (stdout.trim()) {
            logger.debug("runner", `Process ${pid} stdout (first 500 chars): ${scrubCredentials(stdout.slice(0, 500))}`);
          }
          if (!stderr.trim() && !stdout.trim()) {
            logger.warn("runner", `Process ${pid} exited with code ${exitCode} but produced no output`);
          }
        }

        resolve({
          pid,
          exitCode,
          stdout: scrubCredentials(stdout),
          stderr: scrubCredentials(stderr),
          timedOut,
        });
      });

      // Spawn error (binary not found, etc.)
      child.on("error", (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);

        const binPath = resolved.originalPath;
        if (err.message.includes("ENOENT")) {
          logger.error("runner", `Claude binary not found (${binPath}). Set "claudeBinaryPath" in daemon-config.json or install Claude Code globally: npm i -g @anthropic-ai/claude-code`);
          // Clear cached path so next attempt retries detection
          cachedBinary = null;
        } else {
          logger.error("runner", `Spawn error: ${err.message}`);
        }
        resolve({
          pid,
          exitCode: 1,
          stdout: "",
          stderr: err.message.includes("ENOENT")
            ? `Claude binary not found. Install Claude Code (npm i -g @anthropic-ai/claude-code) or set "claudeBinaryPath" in Daemon config.`
            : scrubCredentials(err.message),
          timedOut: false,
        });
      });
    });
  }

  /**
   * Kill a running agent session by PID.
   */
  killSession(pid: number): Promise<void> {
    return new Promise((resolve) => {
      treeKill(pid, "SIGTERM", (err?: Error) => {
        if (err) {
          logger.error("runner", `Failed to kill session ${pid}: ${err.message}`);
        } else {
          logger.info("runner", `Killed session ${pid}`);
        }
        resolve();
      });
    });
  }
}
