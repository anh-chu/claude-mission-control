/**
 * Server-side background jobs registered via instrumentation.ts.
 * All jobs run in the Node.js process for the lifetime of the server.
 */
import cron from "node-cron";
import { readdirSync, statSync, unlinkSync, existsSync, readFileSync } from "fs";
import path from "path";
import { DATA_DIR, UPLOADS_DIR } from "./paths";
const GRACE_MS = 60 * 60 * 1000; // 1 hour
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
      for (const v of Object.values(val as Record<string, unknown>)) extractFromValue(v);
    }
  }

  function scanFile(filePath: string) {
    try {
      extractFromValue(JSON.parse(readFileSync(filePath, "utf-8")));
    } catch { /* ignore unreadable */ }
  }

  const workspacesDir = path.join(DATA_DIR, "workspaces");
  if (existsSync(workspacesDir)) {
    for (const ws of readdirSync(workspacesDir)) {
      const wsDir = path.join(workspacesDir, ws);
      try {
        for (const file of readdirSync(wsDir).filter(f => f.endsWith(".json"))) {
          scanFile(path.join(wsDir, file));
        }
      } catch { /* ignore */ }
    }
  }

  try {
    for (const file of readdirSync(DATA_DIR).filter(f => f.endsWith(".json"))) {
      scanFile(path.join(DATA_DIR, file));
    }
  } catch { /* ignore */ }

  return refs;
}

function runUploadsCleanup() {
  if (!existsSync(UPLOADS_DIR)) return;
  const refs = collectReferencedFilenames();
  const now = Date.now();
  let deleted = 0;

  try {
    for (const filename of readdirSync(UPLOADS_DIR).filter(f => !f.startsWith("."))) {
      const filePath = path.join(UPLOADS_DIR, filename);
      try {
        const { mtimeMs } = statSync(filePath);
        if (!refs.has(filename) && now - mtimeMs >= GRACE_MS) {
          unlinkSync(filePath);
          deleted++;
        }
      } catch { /* ignore per-file errors */ }
    }
  } catch { /* ignore dir errors */ }

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
