/**
 * Node.js-only instrumentation logic.
 * Imported dynamically from instrumentation.ts to avoid Edge bundling.
 */
import { existsSync, mkdirSync, copyFileSync, cpSync, writeFileSync, readFileSync } from "fs";
import { spawn } from "child_process";
import path from "path";
import os from "os";
import { scheduleUploadsCleanup } from "@/lib/scheduled-jobs";

const DATA_DIR = process.env.CMC_DATA_DIR
  ? path.resolve(process.env.CMC_DATA_DIR)
  : path.join(os.homedir(), ".cmc");

// ─── Seed default workspace on fresh install ────────────────────────────────

const wsDir = path.join(DATA_DIR, "workspaces", "default");
const fieldOpsDir = path.join(wsDir, "field-ops");
const artifactsDir = path.join(process.cwd(), "artifacts", "workspaces", "default");

if (!existsSync(wsDir)) {
  mkdirSync(fieldOpsDir, { recursive: true });

  if (existsSync(artifactsDir)) {
    for (const file of ["agents.json", "skills-library.json", "daemon-config.json", "CLAUDE.md"]) {
      const src = path.join(artifactsDir, file);
      if (existsSync(src)) copyFileSync(src, path.join(wsDir, file));
    }
    const claudeSrc = path.join(artifactsDir, ".claude");
    if (existsSync(claudeSrc)) {
      cpSync(claudeSrc, path.join(wsDir, ".claude"), { recursive: true });
    }
    const foSrc = path.join(artifactsDir, "field-ops");
    if (existsSync(foSrc)) {
      cpSync(foSrc, fieldOpsDir, { recursive: true });
    }
  }

  const emptySeeds: Record<string, unknown> = {
    "tasks.json": { tasks: [] },
    "tasks-archive.json": { tasks: [] },
    "goals.json": { goals: [] },
    "initiatives.json": { initiatives: [] },
    "actions.json": { actions: [] },
    "projects.json": { projects: [] },
    "brain-dump.json": { entries: [] },
    "activity-log.json": { events: [] },
    "inbox.json": { messages: [] },
    "decisions.json": { decisions: [] },
    "active-runs.json": { runs: [] },
  };
  for (const [file, content] of Object.entries(emptySeeds)) {
    const dest = path.join(wsDir, file);
    if (!existsSync(dest)) writeFileSync(dest, JSON.stringify(content, null, 2), "utf-8");
  }

  const foEmptySeeds: Record<string, unknown> = {
    "missions.json": { missions: [] },
    "tasks.json": { tasks: [] },
    "services.json": { services: [] },
    "activity-log.json": { events: [] },
    "approval-config.json": { config: { mode: "approve-all", overrides: {} } },
    "safety-limits.json": {
      global: { enabled: true, dailyBudgetUsd: 100, weeklyBudgetUsd: 500, monthlyBudgetUsd: 2000, pauseOnBreach: true },
      services: {},
      spendLog: [],
    },
    "templates.json": { templates: [] },
  };
  for (const [file, content] of Object.entries(foEmptySeeds)) {
    const dest = path.join(fieldOpsDir, file);
    if (!existsSync(dest)) writeFileSync(dest, JSON.stringify(content, null, 2), "utf-8");
  }
}

// ─── Schedule uploads cleanup ───────────────────────────────────────────────

scheduleUploadsCleanup();

// ─── Auto-start daemon if configured ────────────────────────────────────────

try {
  const configFile = path.join(DATA_DIR, "daemon-config.json");
  if (existsSync(configFile)) {
    const config = JSON.parse(readFileSync(configFile, "utf-8")) as Record<string, unknown>;
    if (config.autoStart === true) {
      const pidFile = path.join(DATA_DIR, "daemon.pid");
      let alreadyRunning = false;
      if (existsSync(pidFile)) {
        const pid = parseInt(readFileSync(pidFile, "utf-8").trim());
        if (!isNaN(pid)) {
          try { process.kill(pid, 0); alreadyRunning = true; } catch { /* gone */ }
        }
      }
      if (!alreadyRunning) {
        const scriptPath = path.resolve(process.cwd(), "scripts", "daemon", "index.ts");
        const child = spawn(process.execPath, ["--import", "tsx", scriptPath, "start"], {
          cwd: process.cwd(), detached: true, stdio: "ignore", shell: false,
        });
        child.unref();
      }
    }
  }
} catch {
  // Non-fatal
}
