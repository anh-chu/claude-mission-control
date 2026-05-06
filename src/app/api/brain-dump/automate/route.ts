import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { getBrainDump } from "@/lib/data";
import { resolveScriptEntrypoint } from "@/lib/script-entrypoints";
import { applyWorkspaceContext } from "@/lib/workspace-context";

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface BrainDumpEntry {
	id: string;
	content: string;
	processed: boolean;
}

// ─── POST: Trigger brain dump auto-processing ────────────────────────────────

export async function POST(request: Request) {
	const workspaceId = await applyWorkspaceContext();

	let body: { entryIds?: string[]; all?: boolean };
	try {
		body = (await request.json()) as { entryIds?: string[]; all?: boolean };
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	// 1. Read brain dump entries
	const dumpData = await getBrainDump();

	// 2. Determine which entries to process
	let targetEntries: BrainDumpEntry[];

	if (body.all) {
		targetEntries = dumpData.entries.filter((e) => !e.processed);
	} else if (
		body.entryIds &&
		Array.isArray(body.entryIds) &&
		body.entryIds.length > 0
	) {
		targetEntries = dumpData.entries.filter(
			(e) => !e.processed && body.entryIds?.includes(e.id),
		);
	} else {
		return NextResponse.json(
			{ error: "Provide either 'entryIds' array or 'all: true'" },
			{ status: 400 },
		);
	}

	if (targetEntries.length === 0) {
		return NextResponse.json(
			{ error: "No unprocessed entries found matching the criteria" },
			{ status: 400 },
		);
	}

	// 3. Spawn the processing runner as a detached process
	const cwd = process.cwd();
	const brainDumpEntry = resolveScriptEntrypoint("run-brain-dump-triage");

	const entryIds = targetEntries.map((e) => e.id);

	try {
		const child = spawn(
			brainDumpEntry.runner,
			[...brainDumpEntry.args, ...entryIds],
			{
				cwd,
				detached: true,
				stdio: "ignore",
				shell: false,
				env: {
					...process.env,
					MANDIO_WORKSPACE_ID: workspaceId,
				},
			},
		);

		child.unref();

		return NextResponse.json({
			entryIds,
			count: entryIds.length,
			pid: child.pid ?? 0,
			message: `Auto-processing started for ${entryIds.length} entries`,
		});
	} catch (err) {
		return NextResponse.json(
			{
				error: `Failed to spawn: ${err instanceof Error ? err.message : String(err)}`,
			},
			{ status: 500 },
		);
	}
}
