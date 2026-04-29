import { NextResponse } from "next/server";
import {
	activateSkill,
	deactivateSkill,
	listActivatedSkills,
} from "@/lib/skill-activation";
import { safeId, skillActivateSchema, validateBody } from "@/lib/validations";
import { applyWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const validation = await validateBody(request, skillActivateSchema);
	if (!validation.success) return validation.error;
	const { skillId, active } = validation.data;

	// Additional explicit validation before path operations
	const skillParse = safeId.safeParse(skillId);
	const wsParse = safeId.safeParse(workspaceId);
	if (!skillParse.success || !wsParse.success) {
		return NextResponse.json(
			{ error: "Invalid skillId or workspaceId" },
			{ status: 400 },
		);
	}

	if (active) {
		await activateSkill(workspaceId, skillId);
	} else {
		await deactivateSkill(workspaceId, skillId);
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
