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
import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	unlinkSync,
} from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../src/lib/paths";

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
			for (const v of Object.values(val as Record<string, unknown>))
				extractFromValue(v);
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
			for (const file of readdirSync(wsDir).filter((f) =>
				f.endsWith(".json"),
			)) {
				scanFile(path.join(wsDir, file));
			}
		}
	}

	// Also scan root-level data files (legacy / non-workspace)
	for (const file of readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"))) {
		scanFile(path.join(DATA_DIR, file));
	}

	return refs;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
	const workspacesDir = path.join(DATA_DIR, "workspaces");
	if (!existsSync(workspacesDir)) {
		console.log("No workspaces dir found — nothing to clean.");
		return;
	}

	const refs = collectReferences();
	const now = Date.now();
	let totalFiles = 0;
	let deleted = 0;
	let skipped = 0;
	let graced = 0;

	for (const ws of readdirSync(workspacesDir)) {
		const uploadsDir = path.join(workspacesDir, ws, "uploads");
		if (!existsSync(uploadsDir)) continue;

		const files = readdirSync(uploadsDir).filter((f) => !f.startsWith("."));
		totalFiles += files.length;

		for (const filename of files) {
			const filePath = path.join(uploadsDir, filename);
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
				console.log(
					`[dry-run] would delete: ${ws}/${filename} (age: ${Math.round(ageMsec / 60000)}m)`,
				);
			} else {
				try {
					unlinkSync(filePath);
					console.log(`deleted: ${ws}/${filename}`);
					deleted++;
				} catch (err) {
					console.error(`failed to delete ${ws}/${filename}:`, err);
				}
			}
		}
	}

	const summary = DRY_RUN
		? `Dry run complete — ${totalFiles} files checked, ${refs.size} referenced, ${graced} within grace period, ${totalFiles - skipped - graced} would be deleted`
		: `Done — ${deleted} deleted, ${skipped} referenced (kept), ${graced} within 1h grace period (kept)`;

	console.log(summary);
}

main();
