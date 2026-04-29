import { NextResponse } from "next/server";
import {
	activateSkill,
	deactivateSkill,
	forkSkill,
	listActivatedSkills,
	resetSkill,
} from "@/lib/skill-activation";
import { safeId, skillActivateSchema, validateBody } from "@/lib/validations";
import { applyWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const validation = await validateBody(request, skillActivateSchema);
	if (!validation.success) return validation.error;
	const { skillId, active, action } = validation.data;

	// Additional explicit validation before path operations
	const skillParse = safeId.safeParse(skillId);
	const wsParse = safeId.safeParse(workspaceId);
	if (!skillParse.success || !wsParse.success) {
		return NextResponse.json(
			{ error: "Invalid skillId or workspaceId" },
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
			await activateSkill(workspaceId, skillId);
			break;
		case "deactivate":
			await deactivateSkill(workspaceId, skillId);
			break;
		case "fork":
			await forkSkill(workspaceId, skillId);
			break;
		case "reset":
			await resetSkill(workspaceId, skillId);
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

	// Validate before path operations
	const parseResult = safeId.safeParse(workspaceId);
	if (!parseResult.success) {
		return NextResponse.json({ error: "Invalid workspaceId" }, { status: 400 });
	}

	const activatedSkillIds = await listActivatedSkills(workspaceId);
	return NextResponse.json({ activatedSkillIds });
}
