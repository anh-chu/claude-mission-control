import { NextResponse } from "next/server";
import {
	activateCommand,
	deactivateCommand,
	forkCommand,
	listActivatedCommands,
	resetCommand,
} from "@/lib/command-activation";
import { commandActivateSchema, safeId, validateBody } from "@/lib/validations";
import { applyWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const validation = await validateBody(request, commandActivateSchema);
	if (!validation.success) return validation.error;
	const { commandId, active, action } = validation.data;

	// Additional explicit validation before path operations
	const cmdParse = safeId.safeParse(commandId);
	const wsParse = safeId.safeParse(workspaceId);
	if (!cmdParse.success || !wsParse.success) {
		return NextResponse.json(
			{ error: "Invalid commandId or workspaceId" },
			{ status: 400 },
		);
	}

	// Resolve effective action: explicit action field takes precedence over legacy active boolean
	const effectiveAction =
		action ??
		(active === true ? "activate" : active === false ? "deactivate" : null);

	if (!effectiveAction) {
		return NextResponse.json(
			{ error: "Provide action or active field" },
			{ status: 400 },
		);
	}

	switch (effectiveAction) {
		case "activate":
			await activateCommand(workspaceId, commandId);
			break;
		case "deactivate":
			await deactivateCommand(workspaceId, commandId);
			break;
		case "fork":
			await forkCommand(workspaceId, commandId);
			break;
		case "reset":
			await resetCommand(workspaceId, commandId);
			break;
	}

	return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
	const workspaceId = await applyWorkspaceContext();

	if (!workspaceId) {
		return NextResponse.json(
			{ error: "workspaceId required" },
			{ status: 400 },
		);
	}

	const parseResult = safeId.safeParse(workspaceId);
	if (!parseResult.success) {
		return NextResponse.json({ error: "Invalid workspaceId" }, { status: 400 });
	}

	const activatedCommandIds = await listActivatedCommands(workspaceId);
	return NextResponse.json({ activatedCommandIds });
}
