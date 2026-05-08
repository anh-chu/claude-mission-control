import { headers } from "next/headers";
import { ensureCommandsMigrated, ensureSkillsMigrated } from "./data";
import { assertSafeId } from "./paths";
import { workspaceStore } from "./workspace-store";

/**
 * Call this at the top of every API route handler to scope
 * data access to the correct workspace.
 *
 * Extracts x-workspace-id from request headers, validates it,
 * runs migrations, then executes the provided callback inside
 * an AsyncLocalStorage scope so all data-layer functions within
 * the callback read the correct workspace id.
 *
 * Usage:
 *   export async function GET() {
 *     return applyWorkspaceContext(async (workspaceId) => {
 *       const tasks = await getTasks();
 *       return NextResponse.json(tasks);
 *     });
 *   }
 */
export async function applyWorkspaceContext<T>(
	fn: (workspaceId: string) => Promise<T>,
): Promise<T> {
	const headersList = await headers();
	const workspaceId = headersList.get("x-workspace-id") ?? "default";
	assertSafeId(workspaceId); // validate before filesystem access

	return workspaceStore.run(workspaceId, async () => {
		await ensureSkillsMigrated(workspaceId);
		await ensureCommandsMigrated(workspaceId);
		return fn(workspaceId);
	});
}
