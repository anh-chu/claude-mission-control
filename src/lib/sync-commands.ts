import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAgents } from "./data";
import { getGlobalSkillsDir } from "./paths";
import { listActivatedSkills } from "./skill-activation";
import { readAllSkills } from "./skill-files";
import type { AgentDefinition, SkillDefinition } from "./types";

// Workspace root is the project root (cwd)
const WORKSPACE_ROOT = process.cwd();
const COMMANDS_DIR = path.join(WORKSPACE_ROOT, ".claude", "commands");

// ─── Agent Command Generation ──────────────────────────────────────────────

export function generateAgentCommandMarkdown(
	agent: AgentDefinition,
	linkedSkills: SkillDefinition[],
): string {
	const lines: string[] = [];

	lines.push(`You are acting as a ${agent.name} — ${agent.description}.`);
	lines.push("");

	if (agent.instructions) {
		lines.push("## Your Instructions");
		lines.push(agent.instructions);
		lines.push("");
	}

	if (linkedSkills.length > 0) {
		lines.push("## Your Skills");
		lines.push("");
		for (const skill of linkedSkills) {
			lines.push(`### ${skill.name}`);
			lines.push(skill.content);
			lines.push("");
		}
	}

	lines.push("## Standard Operating Procedures");
	lines.push("1. Read `~/.mandio/ai-context.md` for current state");
	lines.push(
		`2. Check inbox for messages addressed to you: filter \`to: "${agent.id}"\``,
	);
	lines.push(`3. Work on assigned tasks (check \`assignedTo: "${agent.id}"\`)`);
	lines.push("4. Post completion reports to inbox when done");
	lines.push("5. Log activity events for significant actions");
	lines.push("6. Run `pnpm gen:context` after modifying data files");

	return lines.join("\n");
}

export async function syncAgentCommand(
	agent: AgentDefinition,
	workspaceId: string,
): Promise<void> {
	// Skip "me" — no command file needed for the human
	if (agent.id === "me") return;

	const allSkills = await readAllSkills(getGlobalSkillsDir());
	const activatedIds = await listActivatedSkills(workspaceId);
	const linkedSkills = allSkills.filter(
		(skill) =>
			activatedIds.includes(skill.id) &&
			(agent.skillIds.includes(skill.id) || skill.agentIds.includes(agent.id)),
	);

	const content = generateAgentCommandMarkdown(agent, linkedSkills);
	const dir = path.join(COMMANDS_DIR, agent.id);
	await mkdir(dir, { recursive: true });
	await writeFile(path.join(dir, "user.md"), content, "utf-8");
}

/**
 * Syncs all active agent commands from the registry.
 */
export async function syncAllAgentCommands(workspaceId: string): Promise<void> {
	const data = await getAgents();
	for (const agent of data.agents) {
		if (agent.status === "active") {
			await syncAgentCommand(agent, workspaceId);
		}
	}
}
