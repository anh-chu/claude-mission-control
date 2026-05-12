import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guards";
import {
	getBrainDump,
	getDecisions,
	getInbox,
	getProjects,
	getTasks,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;
	// Read all data files in parallel (reads are safe, no locking needed)
	const [tasksData, projectsData, brainDumpData, inboxData, decisionsData] =
		await Promise.all([
			getTasks(),
			getProjects(),
			getBrainDump(),
			getInbox(),
			getDecisions(),
		]);

	// Filter soft-deleted
	const tasks = tasksData.tasks.filter((t) => !t.deletedAt && !t.isScheduled);
	const projects = projectsData.projects.filter((p) => !p.deletedAt);
	const entries = brainDumpData.entries;
	const messages = inboxData.messages;
	const decisions = decisionsData.decisions;

	const unprocessedEntries = entries.filter((e) => !e.processed);
	const unreadMessages = messages.filter((m) => m.status === "unread");
	const pendingDecisions = decisions.filter((d) => d.status === "pending");

	return NextResponse.json(
		{
			stats: {
				unprocessedBrainDump: unprocessedEntries.length,
			},
			tasks,
			projects,
			entries: unprocessedEntries.slice(0, 5),
			messages: unreadMessages,
			decisions: pendingDecisions,
		},
		{
			headers: {
				"Cache-Control": "private, max-age=2, stale-while-revalidate=5",
			},
		},
	);
}
