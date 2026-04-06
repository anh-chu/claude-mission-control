#!/usr/bin/env tsx
/**
 * Orphaned upload cleanup
 *
 * Scans all workspace data files for /uploads/ references, then deletes any
 * file in public/uploads/ that is not referenced and is older than the grace
 * period (default 1 hour — covers in-flight description edits).
 *
 * Safe to run repeatedly. Dry-run with: --dry-run
 */
import { readdirSync, statSync, unlinkSync, existsSync, readFileSync } from "fs";
import path from "path";
import { DATA_DIR } from "../src/lib/paths";

const UPLOADS_DIR = path.resolve(process.cwd(), "public", "uploads");
const GRACE_MS = 60 * 60 * 1000; // 1 hour
const DRY_RUN = process.argv.includes("--dry-run");

// ─── Collect referenced URLs ──────────────────────────────────────────────────

function collectReferences(): Set<string> {
  const refs = new Set<string>();
  const UPLOAD_RE = /\/uploads\/[^"'\s)\]]+/g;

  function extractFromString(s: string) {
    for (const match of s.matchAll(UPLOAD_RE)) {
      // Normalize to just the filename
      refs.add(path.basename(match[0]));
    }
  }

  function extractFromValue(val: unknown) {
    if (typeof val === "string") {
      extractFromString(val);
    } else if (Array.isArray(val)) {
      for (const item of val) extractFromValue(item);
    } else if (val && typeof val === "object") {
      for (const v of Object.values(val as Record<string, unknown>)) extractFromValue(v);
    }
  }

  function scanFile(filePath: string) {
    try {
      const raw = readFileSync(filePath, "utf-8");
      extractFromValue(JSON.parse(raw));
    } catch {
      // ignore unreadable files
    }
  }

  // Scan all workspace data files
  const workspacesDir = path.join(DATA_DIR, "workspaces");
  if (existsSync(workspacesDir)) {
    for (const ws of readdirSync(workspacesDir)) {
      const wsDir = path.join(workspacesDir, ws);
      for (const file of readdirSync(wsDir).filter(f => f.endsWith(".json"))) {
        scanFile(path.join(wsDir, file));
      }
    }
  }

  // Also scan root-level data files (legacy / non-workspace)
  for (const file of readdirSync(DATA_DIR).filter(f => f.endsWith(".json"))) {
    scanFile(path.join(DATA_DIR, file));
  }

  return refs;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  if (!existsSync(UPLOADS_DIR)) {
    console.log("public/uploads/ does not exist — nothing to clean.");
    return;
  }

  const refs = collectReferences();
  const now = Date.now();
  const files = readdirSync(UPLOADS_DIR).filter(f => !f.startsWith("."));

  let deleted = 0;
  let skipped = 0;
  let graced = 0;

  for (const filename of files) {
    const filePath = path.join(UPLOADS_DIR, filename);
    const { mtimeMs } = statSync(filePath);
    const ageMsec = now - mtimeMs;

    if (refs.has(filename)) {
      skipped++;
      continue;
    }

    if (ageMsec < GRACE_MS) {
      graced++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[dry-run] would delete: ${filename} (age: ${Math.round(ageMsec / 60000)}m)`);
    } else {
      try {
        unlinkSync(filePath);
        console.log(`deleted: ${filename}`);
        deleted++;
      } catch (err) {
        console.error(`failed to delete ${filename}:`, err);
      }
    }
  }

  const summary = DRY_RUN
    ? `Dry run complete — ${files.length} files checked, ${refs.size} referenced, ${graced} within grace period, ${files.length - skipped - graced} would be deleted`
    : `Done — ${deleted} deleted, ${skipped} referenced (kept), ${graced} within 1h grace period (kept)`;

  console.log(summary);
}

main();
