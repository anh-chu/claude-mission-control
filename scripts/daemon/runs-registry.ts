/**
 * runs-registry.ts — Shared CRUD utilities for JSON-run-file registries.
 *
 * Provides generic read/write/prune utilities used by recovery.ts
 * and any module that manages a JSON file containing an array of run/session entries.
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import { logger } from "./logger";

/**
 * Generic JSON file reader with existence check and fallback.
 * Returns `defaultValue` if file doesn't exist or is corrupt.
 */
export function readJsonFile<T>(filePath: string, defaultValue: T): T {
	try {
		if (!existsSync(filePath)) {
			return defaultValue;
		}
		const raw = readFileSync(filePath, "utf-8");
		return JSON.parse(raw) as T;
	} catch {
		return defaultValue;
	}
}

/**
 * Generic JSON file writer with pretty-print formatting.
 */
export function writeJsonFile<T>(filePath: string, data: T): void {
	writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Atomic write: write to temp file, then rename to target.
 * Prevents readers from seeing partial writes.
 */
export function atomicWriteJson<T>(filePath: string, data: T): void {
	const tmp = filePath + ".tmp";
	writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
	renameSync(tmp, filePath);
}

/**
 * Entry with a status field and optional completedAt timestamp.
 */
interface PrunableEntry {
	status?: string | undefined;
	completedAt?: string;
}

/**
 * Prune old entries: keep running entries, keep completed entries younger than `maxAgeMs`.
 *
 * @param entries - array of entries to prune
 * @param maxAgeMs - max age in milliseconds (default: 1 hour)
 * @returns new array with old completed entries removed
 */
export function pruneOldEntries<T extends PrunableEntry>(
	entries: T[],
	maxAgeMs: number = 60 * 60 * 1000,
): T[] {
	const cutoff = Date.now() - maxAgeMs;
	return entries.filter((entry) => {
		// Keep running entries
		if (entry.status === "running") return true;
		// Keep completed entries younger than cutoff
		const completedTime = entry.completedAt
			? new Date(entry.completedAt).getTime()
			: 0;
		return completedTime > cutoff;
	});
}

/**
 * Find a single entry by ID in a registry file.
 */
export function findEntryById<T extends { id: string }>(
	filePath: string,
	id: string,
	defaultValue: T[],
): T | null {
	const data = readJsonFile(filePath, defaultValue);
	return data.find((entry) => entry.id === id) ?? null;
}

/**
 * Update an entry by ID in a registry file.
 * Returns false if entry not found.
 */
export function updateEntryById<T extends { id: string }>(
	filePath: string,
	id: string,
	updates: Partial<T>,
	defaultValue: T[],
): boolean {
	const data = readJsonFile(filePath, defaultValue);
	const entry = data.find((e) => e.id === id);
	if (!entry) {
		logger.warn("runs-registry", `Entry not found: ${id}`);
		return false;
	}
	Object.assign(entry, updates);
	writeJsonFile(filePath, data);
	return true;
}
