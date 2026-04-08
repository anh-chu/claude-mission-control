/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Registers background jobs that run for the server's lifetime.
 */
export async function register() {
  // Only run in the Node.js runtime (not edge), and not during build
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NODE_ENV === "test"
  ) {
    return;
  }

  // Ensure the default workspace exists with seeded data on first run
  const { ensureWorkspaceDir } = await import("./src/lib/data");
  await ensureWorkspaceDir("default");

  const { scheduleUploadsCleanup } = await import("./src/lib/scheduled-jobs");
  scheduleUploadsCleanup();

  // Auto-start the daemon if it was running before the server was restarted
  await autoStartDaemon();
}

async function autoStartDaemon() {
  try {
    const { readFileSync, existsSync } = await import("fs");
    const { spawn } = await import("child_process");
    const path = await import("path");
    const { DATA_DIR } = await import("./src/lib/paths");

    const configFile = path.join(DATA_DIR, "daemon-config.json");
    if (!existsSync(configFile)) return;

    const config = JSON.parse(readFileSync(configFile, "utf-8")) as Record<string, unknown>;
    if (config.autoStart !== true) return;

    const pidFile = path.join(DATA_DIR, "daemon.pid");
    if (existsSync(pidFile)) {
      const pid = parseInt(readFileSync(pidFile, "utf-8").trim());
      if (!isNaN(pid)) {
        try {
          process.kill(pid, 0);
          return; // Already running
        } catch {
          // Process is gone — fall through to start
        }
      }
    }

    const cwd = process.cwd();
    const scriptPath = path.resolve(cwd, "scripts", "daemon", "index.ts");
    const child = spawn(process.execPath, ["--import", "tsx", scriptPath, "start"], {
      cwd,
      detached: true,
      stdio: "ignore",
      shell: false,
    });
    child.unref();
  } catch {
    // Non-fatal — server still starts normally
  }
}
