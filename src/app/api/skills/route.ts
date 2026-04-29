import { rm } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getAgents, getWorkspaces } from "@/lib/data";
import { getGlobalSkillDir, getGlobalSkillsDir } from "@/lib/paths";
import {
	activateSkill as _activateSkill,
	deactivateSkillFromAllWorkspaces,
	listActivatedSkills,
} from "@/lib/skill-activation";
import {
	readAllSkills,
	readSkillFile,
	writeSkillFile,
} from "@/lib/skill-files";
import { syncAgentCommand } from "@/lib/sync-commands";
import type { SkillDefinition } from "@/lib/types";
import { generateId } from "@/lib/utils";
import {
	safeId,
	skillCreateSchema,
	skillUpdateSchema,
	validateBody,
} from "@/lib/validations";
import { applyWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const { searchParams } = new URL(request.url);
	const id = searchParams.get("id");

	// Single skill fetch: validate ID before path operations
	if (id) {
		const parseResult = safeId.safeParse(id);
		if (!parseResult.success) {
			return NextResponse.json({ error: "Invalid skill ID" }, { status: 400 });
		}
		const skillDir = getGlobalSkillDir(id);
		const skill = await readSkillFile(skillDir);
		if (!skill) {
			return NextResponse.json({ error: "Skill not found" }, { status: 404 });
		}
		let activated = false;
		if (workspaceId) {
			const activatedIds = await listActivatedSkills(workspaceId);
			activated = activatedIds.includes(id);
		}
		return NextResponse.json({ skill: { ...skill, activated } });
	}

	// List all skills
	const rawSkills = await readAllSkills(getGlobalSkillsDir());

	let activatedIds: Set<string> | null = null;
	if (workspaceId) {
		const ids = await listActivatedSkills(workspaceId);
		activatedIds = new Set(ids);
	}

	const skills: SkillDefinition[] = rawSkills.map((s) => ({
		...s,
		...(activatedIds !== null ? { activated: activatedIds.has(s.id) } : {}),
	}));

	return NextResponse.json({ skills });
}

export async function POST(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const validation = await validateBody(request, skillCreateSchema);
	if (!validation.success) return validation.error;
	const body = validation.data;

	// Use supplied ID if valid, otherwise generate a collision-safe ID
	let id: string;
	if (body.id) {
		const parseResult = safeId.safeParse(body.id);
		if (!parseResult.success) {
			return NextResponse.json({ error: "Invalid skill ID" }, { status: 400 });
		}
		id = body.id;
	} else {
		id = generateId("skill");
	}
	const now = new Date().toISOString();
	const skill: SkillDefinition = {
		id,
		name: body.name,
		description: body.description,
		content: body.content,
		agentIds: body.agentIds,
		tags: body.tags,
		createdAt: now,
		updatedAt: now,
	};

	const skillDir = getGlobalSkillDir(id);
	await writeSkillFile(skillDir, skill);

	// Re-sync agent commands for linked agents
	try {
		const agentsData = await getAgents();
		for (const agent of agentsData.agents) {
			if (agent.status === "active" && skill.agentIds.includes(agent.id)) {
				await syncAgentCommand(agent, workspaceId);
			}
		}
	} catch (err) {
		console.warn(
			`[skills] POST: failed to sync agent commands for skill ${id}:`,
			err,
		);
	}

	return NextResponse.json(skill, { status: 201 });
}

export async function PUT(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const validation = await validateBody(request, skillUpdateSchema);
	if (!validation.success) return validation.error;
	const body = validation.data;

	// Validate ID before path operations
	const parseResult = safeId.safeParse(body.id);
	if (!parseResult.success) {
		return NextResponse.json({ error: "Invalid skill ID" }, { status: 400 });
	}

	const skillDir = getGlobalSkillDir(body.id);
	const existing = await readSkillFile(skillDir);
	if (!existing) {
		return NextResponse.json({ error: "Skill not found" }, { status: 404 });
	}

	const previousAgentIds = existing.agentIds;
	const updated: SkillDefinition = {
		...existing,
		...(body.name !== undefined ? { name: body.name } : {}),
		...(body.description !== undefined
			? { description: body.description }
			: {}),
		...(body.content !== undefined ? { content: body.content } : {}),
		...(body.agentIds !== undefined ? { agentIds: body.agentIds } : {}),
		...(body.tags !== undefined ? { tags: body.tags } : {}),
		updatedAt: new Date().toISOString(),
	};

	await writeSkillFile(skillDir, updated);

	// Re-sync agents that were linked before OR after the update
	try {
		const affectedAgentIds = new Set([
			...previousAgentIds,
			...updated.agentIds,
		]);
		const agentsData = await getAgents();
		for (const agent of agentsData.agents) {
			if (agent.status === "active" && affectedAgentIds.has(agent.id)) {
				await syncAgentCommand(agent, workspaceId);
			}
		}
	} catch (err) {
		console.warn(
			`[skills] PUT: failed to sync agent commands for skill ${body.id}:`,
			err,
		);
	}

	return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const { searchParams } = new URL(request.url);
	const id = searchParams.get("id");
	if (!id) {
		return NextResponse.json({ error: "id required" }, { status: 400 });
	}

	// Validate ID before path operations
	const parseResult = safeId.safeParse(id);
	if (!parseResult.success) {
		return NextResponse.json({ error: "Invalid skill ID" }, { status: 400 });
	}

	const skillDir = getGlobalSkillDir(id);
	const existing = await readSkillFile(skillDir);

	if (existing) {
		// Remove symlinks from all workspaces
		try {
			const workspacesData = await getWorkspaces();
			const workspaceIds = workspacesData.workspaces.map((w) => w.id);
			await deactivateSkillFromAllWorkspaces(id, workspaceIds);
		} catch (err) {
			console.warn(
				`[skills] DELETE: failed to deactivate skill ${id} from workspaces:`,
				err,
			);
		}

		// Remove global skill directory
		await rm(skillDir, { recursive: true, force: true });

		// Re-sync agent commands that referenced the deleted skill
		try {
			const agentsData = await getAgents();
			for (const agent of agentsData.agents) {
				const wasLinked =
					agent.skillIds.includes(id) || existing.agentIds.includes(agent.id);
				if (agent.status === "active" && wasLinked) {
					await syncAgentCommand(agent, workspaceId);
				}
			}
		} catch (err) {
			console.warn(
				`[skills] DELETE: failed to sync agent commands after deleting skill ${id}:`,
				err,
			);
		}
	}

	return NextResponse.json({ ok: true });
}
