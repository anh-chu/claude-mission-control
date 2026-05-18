/**
 * run-plan-project.ts — Decompose a project goal into tasks automatically.
 *
 * Usage:
 *   node --import tsx scripts/daemon/run-plan-project.ts <projectId> [--auto-run]
 *
 * This script:
 *   1. Reads the project description and linked goals
 *   2. Loads available agents from agents.json
 *   3. Builds a decomposition prompt for Claude
 *   4. Spawns Claude Code to write tasks directly into tasks.json with
 *      assignedTo, blockedBy, subtasks, and acceptanceCriteria wired
 *   5. If --auto-run is passed, triggers the mission immediately after
 */

import path from "node:path";
import { getWorkspaceDir } from "../../src/lib/paths";
import { gitSnapshot, sanitizeGitRef } from "../../src/lib/workspace-git";
import { loadConfig } from "./config";
import { readJSON } from "./data-io";
import { logger } from "./logger";
import { AgentRunner } from "./runner";
import { getWorkspaceEnv } from "./workspace-env";
import { readWorkspaceSettingsSync } from "./workspace-settings";

const WORKSPACE_DIR = getWorkspaceDir(
	process.env.MANDIO_WORKSPACE_ID ?? "default",
);

// ─── Data Types ──────────────────────────────────────────────────────────────

interface ProjectDef {
	id: string;
	name: string;
	description: string;
	status: string;
}

interface GoalDef {
	id: string;
	title: string;
	type: string;
	status: string;
	projectId: string | null;
	description?: string;
}

interface AgentDef {
	id: string;
	name: string;
	description: string;
	capabilities: string[];
	status: string;
}

// ─── Prompt Construction ─────────────────────────────────────────────────────

function buildPlanPrompt(project: ProjectDef): string {
	const allGoals =
		readJSON<{ goals: GoalDef[] }>(path.join(WORKSPACE_DIR, "goals.json"))
			?.goals ?? [];
	const projectGoals = allGoals.filter((g) => g.projectId === project.id);

	const agents =
		readJSON<{ agents: AgentDef[] }>(
			path.join(WORKSPACE_DIR, "agents.json"),
		)?.agents.filter((a) => a.status === "active") ?? [];

	const lines: string[] = [];

	lines.push("# Project Task Decomposition");
	lines.push("");
	lines.push(
		"You are a project planner. Your job is to decompose a project goal into concrete, actionable tasks and write them directly into tasks.json.",
	);
	lines.push("");

	lines.push("## Project");
	lines.push(`- **Name:** ${project.name}`);
	lines.push(`- **ID:** \`${project.id}\``);
	if (project.description) {
		lines.push(`- **Description:** ${project.description}`);
	}
	lines.push("");

	if (projectGoals.length > 0) {
		lines.push("## Project Goals");
		for (const g of projectGoals) {
			lines.push(
				`- **${g.title}** (id: \`${g.id}\`, type: ${g.type}, status: ${g.status})`,
			);
			if (g.description) lines.push(`  ${g.description}`);
		}
		lines.push("");
	}

	lines.push("## Available AI Agents");
	lines.push(
		"Assign tasks to the most suitable agent based on their capabilities.",
	);
	lines.push("");
	for (const a of agents) {
		const caps = a.capabilities?.length
			? ` — ${a.capabilities.slice(0, 3).join(", ")}`
			: "";
		lines.push(`- **${a.name}** (id: \`${a.id}\`)${caps}: ${a.description}`);
	}
	lines.push("");

	lines.push("---");
	lines.push("");
	lines.push("## Your Task");
	lines.push("");
	lines.push(
		"Decompose this project into **5–15 concrete tasks**. Then write them all into `tasks.json`.",
	);
	lines.push("");
	lines.push("### Rules for task design");
	lines.push(
		"- Each task must be completable by one agent in a single session (≤ 480 min)",
	);
	lines.push(
		"- Order by dependency: tasks that block others get lower IDs and must appear in `blockedBy` of dependents",
	);
	lines.push("- Research/investigation tasks come before implementation tasks");
	lines.push(
		'- Assign `assignedTo` using agent IDs from the list above — never `"me"` unless the task genuinely requires human judgment',
	);
	lines.push("- Break complex tasks into `subtasks` (3–7 steps each)");
	lines.push("- Write specific, testable `acceptanceCriteria`");
	lines.push("");
	lines.push("### Size guidance");
	lines.push("- Small (30–90 min): single file, config, targeted fix");
	lines.push("- Medium (90–240 min): new component, API endpoint, integration");
	lines.push("- Large (240–480 min): multi-file feature, complex logic");
	lines.push("");
	lines.push("### Writing tasks to tasks.json");
	lines.push("");
	lines.push(`1. Read \`${WORKSPACE_DIR}/tasks.json\``);
	lines.push(
		"2. Generate task IDs as `task_{timestamp + index}` (e.g. `task_1700000000000`, `task_1700000000001`)",
	);
	lines.push("3. For each task, add to the `tasks` array:");
	lines.push("   ```json");
	lines.push("   {");
	lines.push(`     "id": "task_{timestamp}",`);
	lines.push(`     "title": "<action-oriented title>",`);
	lines.push(`     "description": "<what needs to be done, 2-3 sentences>",`);
	lines.push(`     "importance": "important" | "not-important",`);
	lines.push(`     "urgency": "urgent" | "not-urgent",`);
	lines.push(`     "kanban": "not-started",`);
	lines.push(`     "projectId": "${project.id}",`);
	lines.push(`     "milestoneId": null,`);
	lines.push(`     "assignedTo": "<agent-id from the list above>",`);
	lines.push(`     "collaborators": [],`);
	lines.push(
		`     "subtasks": [{ "id": "sub_1", "title": "...", "done": false }],`,
	);
	lines.push(
		`     "blockedBy": ["<task IDs this depends on — use the IDs you generated above>"],`,
	);
	lines.push(`     "estimatedMinutes": <number>,`);
	lines.push(`     "acceptanceCriteria": "<criterion 1>\\n<criterion 2>",`);
	lines.push(`     "tags": ["<relevant-tag>"],`);
	lines.push(`     "comments": [],`);
	lines.push(`     "createdAt": "<ISO timestamp>",`);
	lines.push(`     "updatedAt": "<ISO timestamp>",`);
	lines.push(`     "completedAt": null,`);
	lines.push(`     "actualMinutes": null,`);
	lines.push(`     "deletedAt": null`);
	lines.push("   }");
	lines.push("   ```");
	lines.push(
		"4. Write the updated array back to `tasks.json` with 2-space indentation.",
	);
	lines.push("");
	lines.push("### After writing tasks");
	lines.push("");
	lines.push(
		`Log activity: read \`${WORKSPACE_DIR}/activity-log.json\` and append:`,
	);
	lines.push("   ```json");
	lines.push("   {");
	lines.push(`     "id": "evt_{Date.now()}",`);
	lines.push(`     "type": "project_planned",`);
	lines.push(`     "actor": "planner",`);
	lines.push(`     "projectId": "${project.id}",`);
	lines.push(
		`     "summary": "Planned project '${project.name}' — <N> tasks created",`,
	);
	lines.push(`     "details": "Task IDs: <comma-separated list>",`);
	lines.push(`     "createdAt": "<ISO timestamp>"`);
	lines.push("   }");
	lines.push("   ```");
	lines.push("");
	lines.push("### Important");
	lines.push("- Read each file before writing. Use 2-space indentation.");
	lines.push("- Do NOT modify existing tasks — only append new ones.");
	lines.push(
		'- Do NOT change task `kanban` to anything other than `"not-started"`.',
	);
	lines.push(
		"- `blockedBy` must reference only task IDs you are creating in this run.",
	);
	lines.push(
		"- Output a final summary: total tasks created, estimated total time, dependency chain.",
	);

	return lines.join("\n");
}

// ─── CLI Argument Parsing ─────────────────────────────────────────────────────

function parseArgs(): { projectId: string; autoRun: boolean } {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		console.error("Usage: run-plan-project.ts <projectId> [--auto-run]");
		process.exit(1);
	}

	const projectId = args[0];
	const autoRun = args.includes("--auto-run");

	return { projectId, autoRun };
}

// ─── Trigger mission run after planning ──────────────────────────────────────

async function triggerMissionRun(projectId: string): Promise<void> {
	const baseUrl = process.env.MANDIO_BASE_URL ?? "http://localhost:3000";
	const token = process.env.MANDIO_API_TOKEN ?? "";

	try {
		const res = await fetch(`${baseUrl}/api/projects/${projectId}/run`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
			body: JSON.stringify({}),
		});
		logger.info("run-plan-project", `Mission trigger response: ${res.status}`);
	} catch (err) {
		logger.warn(
			"run-plan-project",
			`Could not trigger mission run: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	const { projectId, autoRun } = parseArgs();

	logger.info(
		"run-plan-project",
		`Starting project decomposition for: ${projectId}`,
	);

	// 1. Read project
	const projectsData = readJSON<{ projects: ProjectDef[] }>(
		path.join(WORKSPACE_DIR, "projects.json"),
	);
	const project = projectsData?.projects.find((p) => p.id === projectId);

	if (!project) {
		logger.error("run-plan-project", `Project not found: ${projectId}`);
		process.exit(1);
	}

	// 2. Load execution config
	const config = loadConfig(process.env.MANDIO_WORKSPACE_ID ?? "default");
	const { maxTurns, timeoutMinutes, skipPermissions, allowedTools } =
		config.execution;

	// 3. Build prompt
	const prompt = buildPlanPrompt(project);

	// 4. Pre-spawn snapshot
	const wsId = process.env.MANDIO_WORKSPACE_ID ?? "default";
	const gitSettings = readWorkspaceSettingsSync(wsId)?.git;
	if (gitSettings?.snapshotBeforeAgentRun !== false) {
		const label = sanitizeGitRef(`pre-plan/${projectId}`);
		gitSnapshot(WORKSPACE_DIR, `Pre-plan snapshot: ${label}`);
	}

	// 5. Spawn Claude Code
	const runner = new AgentRunner(WORKSPACE_DIR);

	try {
		const result = await runner.spawnAgent({
			prompt,
			maxTurns: Math.min(maxTurns, 30),
			timeoutMinutes: Math.min(timeoutMinutes, 15),
			skipPermissions,
			allowedTools,
			cwd: WORKSPACE_DIR,
			env: getWorkspaceEnv(wsId),
		});

		if (result.exitCode === 0) {
			logger.info(
				"run-plan-project",
				`Planning complete for project: ${projectId}`,
			);

			if (autoRun) {
				logger.info(
					"run-plan-project",
					`--auto-run set, triggering mission for: ${projectId}`,
				);
				await triggerMissionRun(projectId);
			}
		} else {
			logger.error(
				"run-plan-project",
				`Planning failed: exit code ${result.exitCode}`,
			);
			process.exit(result.exitCode ?? 1);
		}
	} catch (err) {
		logger.error(
			"run-plan-project",
			`Planning error: ${err instanceof Error ? err.message : String(err)}`,
		);
		process.exit(1);
	}
}

main().catch((err) => {
	logger.error(
		"run-plan-project",
		`Unhandled error: ${err instanceof Error ? err.message : String(err)}`,
	);
	process.exit(1);
});
