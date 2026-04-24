import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { nanoid } from "nanoid";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** Generate a collision-proof ID with a prefix (e.g., "task", "goal", "proj") */
export function generateId(prefix: string): string {
	return `${prefix}_${nanoid(12)}`;
}

/**
 * Parse @agent mentions from comment text.
 * Returns an array of unique agent IDs found in the text.
 * Agent IDs must be lowercase alphanumeric with hyphens (matching agent ID format).
 */
export function parseAgentMentions(text: string): string[] {
	const matches = text.match(/@([a-z0-9-]+)/g);
	if (!matches) return [];
	const ids = matches.map((m) => m.slice(1));
	return [...new Set(ids)];
}
