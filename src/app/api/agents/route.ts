import { NextResponse } from "next/server";
import {
	ensureDocMaintainerAgentForWorkspace,
	getAgents,
	mutateAgents,
	mutateTasks,
} from "@/lib/data";
import {
	CACHE_HEADERS,
	paginateItems,
	parsePaginationParams,
} from "@/lib/paginate";
import { getGlobalSkillDir, getGlobalSkillsDir } from "@/lib/paths";
import { readAllSkills, writeSkillFile } from "@/lib/skill-files";
import { syncAgentCommand } from "@/lib/sync-commands";
import type { AgentDefinition } from "@/lib/types";
import {
	agentCreateSchema,
	agentUpdateSchema,
	validateBody,
} from "@/lib/validations";
import { applyWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const id = searchParams.get("id");
	const status = searchParams.get("status");

	const workspaceId = await applyWorkspaceContext();
	await ensureDocMaintainerAgentForWorkspace(workspaceId);
	const data = await getAgents();
	const total = data.agents.length;
	let agents = data.agents;

	if (id) {
		agents = agents.filter((a) => a.id === id);
	}
	if (status) {
		agents = agents.filter((a) => a.status === status);
	}

	// Pagination
	const pagination = parsePaginationParams(searchParams);
	const paginated = paginateItems(agents, pagination, total);
	agents = paginated.data;

	return NextResponse.json(
		{ data: agents, agents, meta: paginated.meta },
		{ headers: CACHE_HEADERS },
	);
}

export async function POST(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const validation = await validateBody(request, agentCreateSchema);
	if (!validation.success) return validation.error;
	const body = validation.data;

	const newAgent = await mutateAgents(async (data) => {
		// Check for duplicate ID
		if (data.agents.some((a) => a.id === body.id)) {
			return null;
		}

		const now = new Date().toISOString();
		const agent: AgentDefinition = {
			id: body.id,
			name: body.name,
			icon: body.icon,
			description: body.description,
			instructions: body.instructions,
			skillIds: body.skillIds,
			status: body.status,
			model: body.model,
			createdAt: now,
			updatedAt: now,
		};
		data.agents.push(agent);
		return agent;
	});

	if (!newAgent) {
		return NextResponse.json(
			{ error: `Agent with id "${body.id}" already exists` },
			{ status: 409 },
		);
	}

	// Side effect: regenerate command file
	try {
		await syncAgentCommand(newAgent, workspaceId);
	} catch {
		// Non-fatal: command sync failure shouldn't break the API
	}

	return NextResponse.json(newAgent, { status: 201 });
}

export async function PUT(request: Request) {
	const workspaceId = await applyWorkspaceContext();
	const validation = await validateBody(request, agentUpdateSchema);
	if (!validation.success) return validation.error;
	const body = validation.data;

	const updatedAgent = await mutateAgents(async (data) => {
		const idx = data.agents.findIndex((a) => a.id === body.id);
		if (idx === -1) {
			return null;
		}

		data.agents[idx] = {
			...data.agents[idx],
			...body,
			updatedAt: new Date().toISOString(),
		};
		return data.agents[idx];
	});

	if (!updatedAgent) {
		return NextResponse.json({ error: "Agent not found" }, { status: 404 });
	}

	// Side effect: regenerate command file
	try {
		await syncAgentCommand(updatedAgent, workspaceId);
	} catch {
		// Non-fatal
	}

	return NextResponse.json(updatedAgent);
}

export async function DELETE(request: Request) {
	const { searchParams } = new URL(request.url);
	const id = searchParams.get("id");
	const hard = searchParams.get("hard") === "true";
	if (!id) {
		return NextResponse.json({ error: "id required" }, { status: 400 });
	}

	// Built-in agents can't be hard-deleted, only deactivated
	const builtIn = [
		"me",
		"researcher",
		"developer",
		"marketer",
		"business-analyst",
	];
	if (builtIn.includes(id) && !hard) {
		// Soft delete: set status to inactive
		const result = await mutateAgents(async (data) => {
			const idx = data.agents.findIndex((a) => a.id === id);
			if (idx === -1) return null;
			data.agents[idx] = {
				...data.agents[idx],
				status: "inactive",
				updatedAt: new Date().toISOString(),
			};
			return true;
		});
		if (!result) {
			return NextResponse.json({ error: "Agent not found" }, { status: 404 });
		}
		return NextResponse.json({ ok: true, softDeleted: true });
	}

	// Hard delete (non-builtin, or builtin with ?hard=true — though builtins still just deactivate)
	if (builtIn.includes(id)) {
		// Built-in agents: always soft-delete even with hard=true
		const result = await mutateAgents(async (data) => {
			const idx = data.agents.findIndex((a) => a.id === id);
			if (idx === -1) return null;
			data.agents[idx] = {
				...data.agents[idx],
				status: "inactive",
				updatedAt: new Date().toISOString(),
			};
			return true;
		});
		if (!result) {
			return NextResponse.json({ error: "Agent not found" }, { status: 404 });
		}
		return NextResponse.json({ ok: true, softDeleted: true });
	}

	// Non-builtin agent: hard delete
	await mutateAgents(async (data) => {
		data.agents = data.agents.filter((a) => a.id !== id);
	});

	// Clean up references in tasks (assignedTo + collaborators)
	await mutateTasks(async (data) => {
		for (const task of data.tasks) {
			if (task.assignedTo === id) {
				task.assignedTo = null;
				task.updatedAt = new Date().toISOString();
			}
			if (task.collaborators.includes(id)) {
				task.collaborators = task.collaborators.filter((c) => c !== id);
				task.updatedAt = new Date().toISOString();
			}
		}
	});

	// Clean up agentIds in skills (SKILL.md files in global store)
	const skillsDir = getGlobalSkillsDir();
	const allSkills = await readAllSkills(skillsDir);
	for (const skill of allSkills) {
		if (skill.agentIds.includes(id)) {
			skill.agentIds = skill.agentIds.filter((a) => a !== id);
			const skillDir = getGlobalSkillDir(skill.id);
			await writeSkillFile(skillDir, skill);
		}
	}

	return NextResponse.json({ ok: true });
}
