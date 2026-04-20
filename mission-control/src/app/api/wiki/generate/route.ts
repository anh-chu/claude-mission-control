import { spawn } from "child_process";
import { NextResponse } from "next/server";
import path from "path";
import { applyWorkspaceContext } from "@/lib/workspace-context";

// ─── POST: Trigger wiki generation ──────────────────────────────────────────

export async function POST(request: Request) {
	try {
		const workspaceId = await applyWorkspaceContext();

		let body: { promptOverride?: string; agentId?: string; model?: string } =
			{};
		try {
			body = (await request.json()) as {
				promptOverride?: string;
				agentId?: string;
				model?: string;
			};
		} catch {
			// body is optional
		}

		const runId = `wiki_${Date.now()}`;
		const cwd = process.cwd();
		const scriptPath = path.resolve(
			cwd,
			"scripts",
			"daemon",
			"run-wiki-generate.ts",
		);

		const args: string[] = [
			"--import",
			"tsx",
			scriptPath,
			"--run-id",
			runId,
			"--workspace-id",
			workspaceId,
		];

		if (body.promptOverride?.trim()) {
			args.push("--prompt-override", body.promptOverride.trim());
		}

		if (body.agentId?.trim()) {
			args.push("--agent-id", body.agentId.trim());
		}

		if (body.model?.trim()) {
			args.push("--model", body.model.trim());
		}

		try {
			const child = spawn(process.execPath, args, {
				cwd,
				detached: true,
				stdio: "ignore",
				shell: false,
			});

			child.unref();

			return NextResponse.json(
				{
					runId,
					pid: child.pid ?? 0,
					workspaceId,
					startedAt: new Date().toISOString(),
				},
				{ status: 202 },
			);
		} catch (err) {
			return NextResponse.json(
				{
					error: `Failed to spawn: ${err instanceof Error ? err.message : String(err)}`,
				},
				{ status: 500 },
			);
		}
	} catch (err) {
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : "Internal server error" },
			{ status: 500 },
		);
	}
}
