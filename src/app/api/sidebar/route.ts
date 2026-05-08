import { NextResponse } from "next/server";
import { getAgents, getDecisions, getInbox, getTasks } from "@/lib/data";
import { applyWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export async function GET() {
	return applyWorkspaceContext(async (workspaceId) => {
		const [tasksData, inboxData, decisionsData, agentsData] = await Promise.all(
			[getTasks(), getInbox(), getDecisions(), getAgents()],
		);

		const tasks = tasksData.tasks.filter((t) => !t.deletedAt && !t.isScheduled);
		const unreadInbox = inboxData.messages.filter(
			(m) => m.status === "unread",
		).length;
		const pendingDecisions = decisionsData.decisions.filter(
			(d) => d.status === "pending",
		).length;
		const agents = agentsData.agents;

		return NextResponse.json(
			{ tasks, unreadInbox, pendingDecisions, agents },
			{
				headers: {
					"Cache-Control": "private, max-age=2, stale-while-revalidate=5",
				},
			},
		);
	});
}
