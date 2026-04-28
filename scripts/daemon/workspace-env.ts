/**
 * workspace-env.ts — Shared utility for loading workspace environment variables.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../../src/lib/paths";

export function getWorkspaceEnv(workspaceId: string): Record<string, string> {
	try {
		const raw = readFileSync(path.join(DATA_DIR, "workspaces.json"), "utf-8");
		const data = JSON.parse(raw) as {
			workspaces: Array<{
				id: string;
				settings?: { envVars?: Record<string, string> };
			}>;
		};
		const ws = data.workspaces.find((w) => w.id === workspaceId);
		return ws?.settings?.envVars ?? {};
	} catch {
		return {};
	}
}
