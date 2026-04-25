/**
 * run-task-comment.ts — Handle an @-mention in a task comment.
 *
 * Usage:
 *   node --import tsx scripts/daemon/run-task-comment.ts <taskId> --agent <agentId> --comment "<text>" --comment-author "<author>"
 *
 * This script:
 *   1. Reads the task and agent definition
 *   2. Builds a prompt with agent persona + task context + the user's comment
 *   3. Instructs the agent to either: (a) reply with a comment, or (b) reopen and work on the task
 *   4. Captures the agent's response and appends it as a comment on the task
 *   5. Posts a notification to inbox
 *   6. Logs an activity event
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { createLogger } from "../../src/lib/logger";
import { logger } from "./logger";
import { AgentRunner, parseClaudeOutput } from "./runner";
import { enforcePromptLimit, fenceTaskData } from "./security";
import type { AgentBackend } from "./types";

const taskLogger = createLogger("task", { sync: true });

// ─── Paths ──────────────────────────────────────────────────────────────────

import { getWorkspaceDir } from "../../src/lib/paths";

const WORKSPACE_DIR = getWorkspaceDir(
	process.env.CMC_WORKSPACE_ID ?? "default",
);
const TASKS_FILE = path.join(WORKSPACE_DIR, "tasks.json");
const AGENTS_FILE = path.join(WORKSPACE_DIR, "agents.json");
const SKILLS_FILE = path.join(WORKSPACE_DIR, "skills-library.json");
const INBOX_FILE = path.join(WORKSPACE_DIR, "inbox.json");
const ACTIVITY_LOG_FILE = path.join(WORKSPACE_DIR, "activity-log.json");
const ACTIVE_RUNS_FILE = path.join(WORKSPACE_DIR, "active-runs.json");
const STREAMS_DIR = path.join(WORKSPACE_DIR, "agent-streams");

// ─── Data Readers ───────────────────────────────────────────────────────────

interface TaskDef {
	id: string;
	title: string;
	description: string;
	importance: string;
	urgency: string;
	kanban: string;
	assignedTo: string | null;
	projectId: string | null;
	subtasks: Array<{ id: string; title: string; done: boolean }>;
	acceptanceCriteria: string[];
	notes: string;
	comments?: Array<{
		id: string;
		author: string;
		content: string;
		createdAt: string;
	}>;
	estimatedMinutes: number | null;
	updatedAt?: string;
	completedAt?: string | null;
}

interface AgentDef {
	id: string;
	name: string;
	description: string;
	instructions: string;
	skillIds: string[];
	backend?: AgentBackend;
}

interface SkillDef {
	id: string;
	name: string;
	content: string;
	agentIds: string[];
}

function readTasks(): { tasks: TaskDef[] } {
	return JSON.parse(readFileSync(TASKS_FILE, "utf-8"));
}

function readAgents(): { agents: AgentDef[] } {
	return JSON.parse(readFileSync(AGENTS_FILE, "utf-8"));
}

function readSkills(): { skills: SkillDef[] } {
	try {
		return JSON.parse(readFileSync(SKILLS_FILE, "utf-8"));
	} catch {
		return { skills: [] };
	}
}

// ─── Prompt Builder ─────────────────────────────────────────────────────────

function buildCommentPrompt(
	agent: AgentDef,
	task: TaskDef,
	comment: string,
	commentAuthor: string,
): string {
	const lines: string[] = [];

	// Agent persona
	lines.push(`You are acting as ${agent.name} — ${agent.description}.`);
	lines.push("");

	if (agent.instructions) {
		lines.push("## Your Instructions");
		lines.push(agent.instructions);
		lines.push("");
	}

	// Linked skills
	const skillsData = readSkills();
	const linkedSkills = skillsData.skills.filter(
		(s) => agent.skillIds.includes(s.id) || s.agentIds.includes(agent.id),
	);
	if (linkedSkills.length > 0) {
		lines.push("## Your Skills");
		for (const skill of linkedSkills) {
			lines.push(`### ${skill.name}`);
			lines.push(skill.content);
			lines.push("");
		}
	}

	// Task context
	lines.push("## Task Context");
	lines.push("");
	lines.push(`**Title:** ${task.title}`);
	lines.push(`**Task ID:** ${task.id}`);
	lines.push(`**Status:** ${task.kanban}`);
	lines.push(`**Priority:** ${task.importance} / ${task.urgency}`);

	if (task.description) {
		lines.push("");
		lines.push("**Description:**");
		lines.push(task.description);
	}

	if (task.subtasks.length > 0) {
		lines.push("");
		lines.push("**Subtasks:**");
		for (const sub of task.subtasks) {
			lines.push(`- [${sub.done ? "x" : " "}] ${sub.title}`);
		}
	}

	if (task.notes) {
		lines.push("");
		lines.push("**Notes:**");
		lines.push(task.notes);
	}

	// Recent comments for context (last 5)
	const comments = task.comments ?? [];
	if (comments.length > 0) {
		lines.push("");
		lines.push("**Recent Comments:**");
		const recentComments = comments.slice(-5);
		for (const c of recentComments) {
			lines.push(
				`- **${c.author}** (${c.createdAt}): ${c.content.slice(0, 300)}`,
			);
		}
	}

	// The @-mention instruction
	lines.push("");
	lines.push("---");
	lines.push("");
	lines.push(`## You have been mentioned by @${commentAuthor}`);
	lines.push("");
	lines.push("**Their message:**");
	lines.push(comment);
	lines.push("");
	lines.push("## How to Respond");
	lines.push("");
	lines.push("You have two options:");
	lines.push("");
	lines.push("**Option A — Reply with a comment only:**");
	lines.push(
		"If the message is a question, request for info, or feedback that doesn't require code changes,",
	);
	lines.push(
		"simply write your reply. The system will capture your response and add it as a comment on the task.",
	);
	lines.push("");
	lines.push("**Option B — Reopen and work on the task:**");
	lines.push(
		`If the task needs rework (even though its current status is "${task.kanban}"), you should:`,
	);
	lines.push("1. Explain what needs to change");
	lines.push("2. Then do the actual work (edit files, run commands, etc.)");
	lines.push("3. Write a summary of what you did");
	lines.push("");
	lines.push("The system will automatically:");
	lines.push("- Capture your response as a comment");
	lines.push(
		"- If you made file changes, update the task status appropriately",
	);
	lines.push("");
	lines.push(
		"**IMPORTANT:** Focus on responding to the specific message. Be concise and helpful.",
	);
	lines.push(
		"Do NOT modify tasks.json, inbox.json, or activity-log.json directly.",
	);

	const raw = lines.join("\n");
	return enforcePromptLimit(fenceTaskData(raw));
}

// ─── Active Runs Tracking ───────────────────────────────────────────────────

interface ActiveRunEntry {
	id: string;
	taskId: string;
	agentId: string;
	source?:
		| "manual"
		| "project-run"
		| "mission-chain"
		| "scheduled"
		| "webhook"
		| "inbox-respond"
		| "comment";
	projectId: string | null;
	missionId: string | null;
	pid: number;
	status: "running" | "completed" | "failed" | "timeout" | "stopped";
	startedAt: string;
	completedAt: string | null;
	exitCode: number | null;
	error: string | null;
	costUsd: number | null;
	numTurns: number | null;
	continuationIndex: number;
	streamFile?: string | null;
}

function readActiveRuns(): { runs: ActiveRunEntry[] } {
	try {
		if (!existsSync(ACTIVE_RUNS_FILE)) return { runs: [] };
		return JSON.parse(readFileSync(ACTIVE_RUNS_FILE, "utf-8"));
	} catch {
		return { runs: [] };
	}
}

function writeActiveRuns(data: { runs: ActiveRunEntry[] }): void {
	writeFileSync(ACTIVE_RUNS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// ─── Side Effects ───────────────────────────────────────────────────────────

function extractResponse(stdout: string): string {
	// Try to get the result text from stream-json output
	try {
		const lines = stdout.trim().split("\n").filter(Boolean);
		for (let i = lines.length - 1; i >= 0; i--) {
			try {
				const parsed = JSON.parse(lines[i]);
				if (parsed.type === "result" && typeof parsed.result === "string") {
					return parsed.result.slice(0, 3000);
				}
			} catch {}
		}
	} catch {
		/* fall through */
	}

	// Fallback: non-JSON lines only (filter out raw stream events)
	const allLines = stdout.trim().split("\n").filter(Boolean);
	const textLines = allLines.filter((l) => {
		try {
			JSON.parse(l);
			return false;
		} catch {
			return true;
		}
	});
	const tail = textLines.slice(-10).join("\n");
	return tail.length > 3000
		? tail.slice(0, 2997) + "..."
		: tail || "(no response)";
}

function appendAgentComment(
	taskId: string,
	agentId: string,
	response: string,
): void {
	try {
		const tasksData = readTasks();
		const task = tasksData.tasks.find((t) => t.id === taskId);
		if (!task) return;

		if (!Array.isArray(task.comments)) {
			task.comments = [];
		}

		task.comments.push({
			id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
			author: agentId,
			content: response,
			createdAt: new Date().toISOString(),
		});
		task.updatedAt = new Date().toISOString();

		writeFileSync(TASKS_FILE, JSON.stringify(tasksData, null, 2), "utf-8");
		logger.info(
			"run-task-comment",
			`Appended agent response comment to task ${taskId}`,
		);
	} catch (err) {
		logger.error(
			"run-task-comment",
			`Failed to append comment: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

function postInboxNotification(
	taskId: string,
	agentId: string,
	taskTitle: string,
	response: string,
): void {
	try {
		const inboxRaw = existsSync(INBOX_FILE)
			? readFileSync(INBOX_FILE, "utf-8")
			: '{"messages":[]}';
		const inboxData = JSON.parse(inboxRaw) as {
			messages: Array<Record<string, unknown>>;
		};

		inboxData.messages.push({
			id: `msg_${Date.now()}`,
			from: agentId,
			to: "me",
			type: "update",
			taskId,
			subject: `Reply on: ${taskTitle}`,
			body: response.slice(0, 2000),
			status: "unread",
			createdAt: new Date().toISOString(),
			readAt: null,
		});

		writeFileSync(INBOX_FILE, JSON.stringify(inboxData, null, 2), "utf-8");
	} catch (err) {
		logger.error(
			"run-task-comment",
			`Failed to post inbox notification: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

function logActivity(taskId: string, agentId: string, summary: string): void {
	try {
		const logRaw = existsSync(ACTIVITY_LOG_FILE)
			? readFileSync(ACTIVITY_LOG_FILE, "utf-8")
			: '{"events":[]}';
		const logData = JSON.parse(logRaw) as {
			events: Array<Record<string, unknown>>;
		};

		logData.events.push({
			id: `evt_${Date.now()}`,
			type: "agent_checkin",
			actor: agentId,
			taskId,
			summary,
			details: "",
			timestamp: new Date().toISOString(),
		});

		writeFileSync(ACTIVITY_LOG_FILE, JSON.stringify(logData, null, 2), "utf-8");
	} catch (err) {
		logger.error(
			"run-task-comment",
			`Failed to log activity: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

// ─── CLI Argument Parsing ───────────────────────────────────────────────────

function parseArgs(): {
	taskId: string;
	agentId: string;
	comment: string;
	commentAuthor: string;
} {
	const args = process.argv.slice(2);
	const taskId = args[0];

	if (!taskId) {
		console.error(
			"Usage: run-task-comment.ts <taskId> --agent <agentId> --comment <text> --comment-author <author>",
		);
		process.exit(1);
	}

	let agentId = "";
	let comment = "";
	let commentAuthor = "me";

	for (let i = 1; i < args.length; i++) {
		if (args[i] === "--agent" && args[i + 1]) {
			agentId = args[i + 1];
			i++;
		}
		if (args[i] === "--comment" && args[i + 1]) {
			comment = args[i + 1];
			i++;
		}
		if (args[i] === "--comment-author" && args[i + 1]) {
			commentAuthor = args[i + 1];
			i++;
		}
	}

	if (!agentId || !comment) {
		console.error("Missing required args: --agent and --comment");
		process.exit(1);
	}

	return { taskId, agentId, comment, commentAuthor };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
	const { taskId, agentId, comment, commentAuthor } = parseArgs();

	logger.info(
		"run-task-comment",
		`Handling @${agentId} mention on task ${taskId} from ${commentAuthor}`,
	);
	taskLogger.info("run-task-comment", "Starting comment run", {
		taskId,
		agentId,
		commentAuthor,
	});

	// 1. Read task
	const tasksData = readTasks();
	const task = tasksData.tasks.find((t) => t.id === taskId) as
		| TaskDef
		| undefined;
	if (!task) {
		logger.error("run-task-comment", `Task not found: ${taskId}`);
		process.exit(1);
	}

	// 2. Read agent
	const agentsData = readAgents();
	const agent = agentsData.agents.find((a) => a.id === agentId);
	if (!agent) {
		logger.error("run-task-comment", `Agent not found: ${agentId}`);
		process.exit(1);
	}

	// 3. Load config for execution settings
	let maxTurns = 10; // Lower default for comment responses
	let timeoutMinutes = 15;
	let skipPermissions = false;
	try {
		const configRaw = readFileSync(
			path.join(getWorkspaceDir("default"), "daemon-config.json"),
			"utf-8",
		);
		const config = JSON.parse(configRaw);
		maxTurns = Math.min(config.execution?.maxTurns ?? 10, 15); // Cap at 15 for comments
		timeoutMinutes = Math.min(config.execution?.timeoutMinutes ?? 15, 30);
		skipPermissions = config.execution?.skipPermissions ?? false;
	} catch {
		/* use defaults */
	}

	// 4. Build prompt
	const prompt = buildCommentPrompt(agent, task, comment, commentAuthor);

	// 5. Write "running" entry to active-runs
	const runId = `run_cmt_${Date.now()}`;
	const streamFile = path.join(STREAMS_DIR, `${runId}.jsonl`);
	mkdirSync(STREAMS_DIR, { recursive: true });

	const activeRuns = readActiveRuns();
	activeRuns.runs.push({
		id: runId,
		taskId,
		agentId,
		source: "comment",
		projectId: task.projectId ?? null,
		missionId: null,
		pid: 0,
		status: "running",
		startedAt: new Date().toISOString(),
		completedAt: null,
		exitCode: null,
		error: null,
		costUsd: null,
		numTurns: null,
		continuationIndex: 0,
		streamFile,
	});
	writeActiveRuns(activeRuns);

	// 6. Spawn agent
	const backend: AgentBackend = agent.backend ?? "claude";
	const runner = new AgentRunner(WORKSPACE_DIR);

	try {
		const runStartedAtMs = Date.now();
		const result = await runner.spawnAgent({
			prompt,
			maxTurns,
			timeoutMinutes,
			skipPermissions,
			backend,
			cwd: WORKSPACE_DIR,
			streamFile,
			onSpawned: (pid) => {
				taskLogger.info("run-task-comment", "Agent spawned", {
					taskId,
					agentId,
					pid,
				});
				try {
					const runs = readActiveRuns();
					const run = runs.runs.find((r) => r.id === runId);
					if (run) {
						run.pid = pid;
						writeActiveRuns(runs);
					}
				} catch {
					/* non-fatal */
				}
			},
		});
		const durationMs = Date.now() - runStartedAtMs;
		taskLogger.info("run-task-comment", "Agent exited", {
			taskId,
			agentId,
			exitCode: result.exitCode,
			durationMs,
		});

		// 7. Parse output metadata
		const meta = parseClaudeOutput(result.stdout);

		// 8. Update active-runs entry
		const runs = readActiveRuns();
		const run = runs.runs.find((r) => r.id === runId);
		const errorMsg =
			result.stderr?.trim().slice(0, 500) || `Exit code: ${result.exitCode}`;
		if (run) {
			run.status = result.exitCode === 0 ? "completed" : "failed";
			run.completedAt = new Date().toISOString();
			run.exitCode = result.exitCode;
			run.costUsd = meta.totalCostUsd;
			run.numTurns = meta.numTurns;
			if (result.exitCode !== 0) {
				run.error = errorMsg;
			}
			writeActiveRuns(runs);
		}

		// 9. Handle success vs failure
		if (result.exitCode === 0) {
			const response = extractResponse(result.stdout);

			// Append agent's response as a comment
			appendAgentComment(taskId, agentId, response);

			// Check if agent did substantive work on a done task — reopen if needed
			const didWork = (meta.numTurns ?? 0) > 3;
			if (didWork) {
				try {
					const freshTasks = readTasks();
					const freshTask = freshTasks.tasks.find((t) => t.id === taskId);
					if (freshTask && freshTask.kanban === "done") {
						freshTask.kanban = "in-progress";
						freshTask.completedAt = null;
						freshTask.updatedAt = new Date().toISOString();
						writeFileSync(
							TASKS_FILE,
							JSON.stringify(freshTasks, null, 2),
							"utf-8",
						);
						logger.info(
							"run-task-comment",
							`Reopened task ${taskId} (agent did substantive work)`,
						);
					}
				} catch (err) {
					logger.error(
						"run-task-comment",
						`Failed to reopen task: ${err instanceof Error ? err.message : String(err)}`,
					);
				}
			}

			// Post inbox notification
			postInboxNotification(taskId, agentId, task.title, response);
			logActivity(
				taskId,
				agentId,
				`@${agentId} responded to comment on "${task.title}"`,
			);
			taskLogger.info("run-task-comment", "Comment run completed", {
				taskId,
				agentId,
			});
		} else {
			// Agent failed — post error as comment so user knows what happened
			const errComment = `Failed to respond: ${errorMsg}`;
			appendAgentComment(taskId, agentId, errComment);
			postInboxNotification(taskId, agentId, task.title, errComment);
			logActivity(
				taskId,
				agentId,
				`@${agentId} failed to respond on "${task.title}": ${errorMsg.slice(0, 100)}`,
			);
			taskLogger.error("run-task-comment", "Comment run failed", {
				taskId,
				agentId,
				error: errorMsg,
			});
		}

		const costStr =
			meta.totalCostUsd != null ? ` · $${meta.totalCostUsd.toFixed(4)}` : "";
		logger.info(
			"run-task-comment",
			`Comment handler complete for task ${taskId} (agent: ${agentId}, turns: ${meta.numTurns ?? "?"}${costStr})`,
		);
	} catch (err) {
		// Update run as failed
		const runs = readActiveRuns();
		const run = runs.runs.find((r) => r.id === runId);
		if (run) {
			run.status = "failed";
			run.error = err instanceof Error ? err.message : String(err);
			run.completedAt = new Date().toISOString();
			writeActiveRuns(runs);
		}

		logger.error(
			"run-task-comment",
			`Failed: ${err instanceof Error ? err.message : String(err)}`,
		);
		taskLogger.error("run-task-comment", "Comment run failed", {
			taskId,
			agentId,
			error: err instanceof Error ? err.message : String(err),
		});
		process.exit(1);
	}
}

main().catch((err) => {
	logger.error(
		"run-task-comment",
		`Unhandled error: ${err instanceof Error ? err.message : String(err)}`,
	);
	process.exit(1);
});
