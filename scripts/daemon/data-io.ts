/**
 * data-io.ts — Shared JSON file reading helper.
 * Shared by multiple daemon scripts.
 */

import { existsSync, readFileSync } from "node:fs";

/**
 * Read and parse a JSON file, returning null on any error.
 * @param filePath Absolute path to the JSON file.
 */
export function readJSON<T>(filePath: string): T | null {
	try {
		if (!existsSync(filePath)) return null;
		return JSON.parse(readFileSync(filePath, "utf-8")) as T;
	} catch {
		return null;
	}
}
