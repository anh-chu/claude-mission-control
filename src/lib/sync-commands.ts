import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getAgents, getSkillsLibrary } from "./data";
import type { AgentDefinition, SkillDefinition } from "./types";

// Workspace root is the project root (cwd)
const WORKSPACE_ROOT = process.cwd();
const COMMANDS_DIR = path.join(WORKSPACE_ROOT, ".claude", "commands");
const SKILLS_DIR = path.join(WORKSPACE_ROOT, "skills");

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

/**
 * Resolves all skills linked to an agent from both directions:
 * 1. Skills referenced in the agent's `skillIds` array
 * 2. Skills that list the agent in their `agentIds` array
 * Returns deduplicated skills in stable order.
 */
export async function syncAgentCommand(agent: AgentDefinition): Promise<void> {
	// Skip "me" — no command file needed for the human
	if (agent.id === "me") return;

	const skillsData = await getSkillsLibrary();
	const allSkills = skillsData.skills;
	const linkedSkills = allSkills.filter(
		(skill) =>
			agent.skillIds.includes(skill.id) || skill.agentIds.includes(agent.id),
	);

	const content = generateAgentCommandMarkdown(agent, linkedSkills);
	const dir = path.join(COMMANDS_DIR, agent.id);
	await mkdir(dir, { recursive: true });
	await writeFile(path.join(dir, "user.md"), content, "utf-8");
}

/**
 * Syncs all active agent commands from the registry.
 */
export async function syncAllAgentCommands(): Promise<void> {
	const data = await getAgents();
	for (const agent of data.agents) {
		if (agent.status === "active") {
			await syncAgentCommand(agent);
		}
	}
}

// ─── Skill File Generation ──────────────────────────────────────────────────

function generateSkillFileContent(skill: SkillDefinition): string {
	const lines: string[] = [];
	lines.push("---");
	lines.push(`name: ${skill.id}`);
	lines.push(`description: >`);
	lines.push(`  ${skill.description}`);
	lines.push("---");
	lines.push("");
	lines.push(skill.content);
	return lines.join("\n");
}

/**
 * Writes/updates `skills/<skill.id>/SKILL.md` from skill data.
 */
export async function syncSkillFile(skill: SkillDefinition): Promise<void> {
	const content = generateSkillFileContent(skill);
	const dir = path.join(SKILLS_DIR, skill.id);
	await mkdir(dir, { recursive: true });
	await writeFile(path.join(dir, "SKILL.md"), content, "utf-8");
}

/**
 * Syncs all skill files from the library.
 */
export async function syncAllSkillFiles(): Promise<void> {
	const data = await getSkillsLibrary();
	for (const skill of data.skills) {
		await syncSkillFile(skill);
	}
}
