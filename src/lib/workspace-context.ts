import { headers } from "next/headers";
import { ensureSkillsMigrated, setCurrentWorkspace } from "./data";

/**
 * Call this at the top of every API route handler to scope
 * data access to the correct workspace based on the x-workspace-id
 * header injected by middleware.
 */
export async function applyWorkspaceContext(): Promise<string> {
	const headersList = await headers();
	const workspaceId = headersList.get("x-workspace-id") ?? "default";
	setCurrentWorkspace(workspaceId);
	await ensureSkillsMigrated(workspaceId);
	return workspaceId;
}
