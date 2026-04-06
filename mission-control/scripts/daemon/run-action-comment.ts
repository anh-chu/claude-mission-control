/**
 * run-action-comment.ts — Handle an @-mention in an action comment.
 *
 * Usage:
 *   node --import tsx scripts/daemon/run-action-comment.ts <actionId> --agent <agentId> --comment "<text>" --comment-author "<author>"
 *
 * This script:
 *   1. Reads the action and agent definition
 *   2. Builds a prompt with agent persona + action context + the user's comment
 *   3. Instructs the agent to reply with a comment
 *   4. Captures the agent's response and appends it as a comment on the action
 *   5. Posts a notification to inbox
 *   6. Logs an activity event
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { AgentRunner, parseClaudeOutput } from "./runner";
import { logger } from "./logger";
import { fenceTaskData, enforcePromptLimit } from "./security";
import type { AgentBackend } from "./types";

// ─── Paths ──────────────────────────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, "../../data");
const ACTIONS_FILE = path.join(DATA_DIR, "workspaces", "default", "actions.json");
const AGENTS_FILE = path.join(DATA_DIR, "agents.json");
const SKILLS_FILE = path.join(DATA_DIR, "skills-library.json");
const INBOX_FILE = path.join(DATA_DIR, "inbox.json");
const ACTIVITY_LOG_FILE = path.join(DATA_DIR, "activity-log.json");
const ACTIVE_RUNS_FILE = path.join(DATA_DIR, "active-runs.json");
const STREAMS_DIR = path.join(DATA_DIR, "agent-streams");
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");

// ─── Data Readers ───────────────────────────────────────────────────────────

interface ActionDef {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  assignedTo: string | null;
  comments?: Array<{ id: string; author: string; content: string; createdAt: string }>;
  updatedAt?: string;
}

interface AgentDef {
  id: string;
  name: string;
  description: string;
  instructions: string;
  capabilities: string[];
  skillIds: string[];
  backend?: AgentBackend;
}

interface SkillDef {
  id: string;
  name: string;
  content: string;
  agentIds: string[];
}

function readActions(): { actions: ActionDef[] } {
  return JSON.parse(readFileSync(ACTIONS_FILE, "utf-8"));
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

function buildCommentPrompt(agent: AgentDef, action: ActionDef, comment: string, commentAuthor: string): string {
  const lines: string[] = [];

  // Agent persona
  lines.push(`You are acting as ${agent.name} — ${agent.description}.`);
  lines.push("");

  if (agent.instructions) {
    lines.push("## Your Instructions");
    lines.push(agent.instructions);
    lines.push("");
  }

  if (agent.capabilities.length > 0) {
    lines.push("## Your Capabilities");
    for (const cap of agent.capabilities) {
      lines.push(`- ${cap}`);
    }
    lines.push("");
  }

  // Linked skills
  const skillsData = readSkills();
  const linkedSkills = skillsData.skills.filter((s) =>
    agent.skillIds.includes(s.id) || s.agentIds.includes(agent.id)
  );
  if (linkedSkills.length > 0) {
    lines.push("## Your Skills");
    for (const skill of linkedSkills) {
      lines.push(`### ${skill.name}`);
      lines.push(skill.content);
      lines.push("");
    }
  }

  // Action context
  lines.push("## Action Context");
  lines.push("");
  lines.push(`**Title:** ${action.title}`);
  lines.push(`**Action ID:** ${action.id}`);
  lines.push(`**Status:** ${action.status}`);
  lines.push(`**Type:** ${action.type}`);

  if (action.description) {
    lines.push("");
    lines.push("**Description:**");
    lines.push(action.description);
  }

  // Recent comments for context (last 5)
  const comments = action.comments ?? [];
  if (comments.length > 0) {
    lines.push("");
    lines.push("**Recent Comments:**");
    const recentComments = comments.slice(-5);
    for (const c of recentComments) {
      lines.push(`- **${c.author}** (${c.createdAt}): ${c.content.slice(0, 300)}`);
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
  lines.push("Reply to the message. The system will capture your response and add it as a comment on the action.");
  lines.push("");
  lines.push("**IMPORTANT:** Focus on responding to the specific message. Be concise and helpful.");
  lines.push("Do NOT modify actions.json, inbox.json, or activity-log.json directly.");

  const raw = lines.join("\n");
  return enforcePromptLimit(fenceTaskData(raw));
}

// ─── Active Runs Tracking ───────────────────────────────────────────────────

interface ActiveRunEntry {
  id: string;
  taskId: string;
  agentId: string;
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
      } catch { continue; }
    }
  } catch { /* fall through */ }

  // Fallback: last 10 lines of raw text
  const textLines = stdout.trim().split("\n");
  const tail = textLines.slice(-10).join("\n");
  return tail.length > 3000 ? tail.slice(0, 2997) + "..." : tail || "(no response)";
}

function appendAgentComment(actionId: string, agentId: string, response: string): void {
  try {
    const actionsData = readActions();
    const action = actionsData.actions.find((a) => a.id === actionId);
    if (!action) return;

    if (!Array.isArray(action.comments)) {
      action.comments = [];
    }

    action.comments.push({
      id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      author: agentId,
      content: response,
      createdAt: new Date().toISOString(),
    });
    action.updatedAt = new Date().toISOString();

    writeFileSync(ACTIONS_FILE, JSON.stringify(actionsData, null, 2), "utf-8");
    logger.info("run-action-comment", `Appended agent response comment to action ${actionId}`);
  } catch (err) {
    logger.error("run-action-comment", `Failed to append comment: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function postInboxNotification(actionId: string, agentId: string, actionTitle: string, response: string): void {
  try {
    const inboxRaw = existsSync(INBOX_FILE)
      ? readFileSync(INBOX_FILE, "utf-8")
      : '{"messages":[]}';
    const inboxData = JSON.parse(inboxRaw) as { messages: Array<Record<string, unknown>> };

    inboxData.messages.push({
      id: `msg_${Date.now()}`,
      from: agentId,
      to: "me",
      type: "update",
      taskId: null,
      subject: `Reply on action: ${actionTitle}`,
      body: response.slice(0, 2000),
      status: "unread",
      createdAt: new Date().toISOString(),
      readAt: null,
    });

    writeFileSync(INBOX_FILE, JSON.stringify(inboxData, null, 2), "utf-8");
  } catch (err) {
    logger.error("run-action-comment", `Failed to post inbox notification: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function logActivity(actionId: string, agentId: string, summary: string): void {
  try {
    const logRaw = existsSync(ACTIVITY_LOG_FILE)
      ? readFileSync(ACTIVITY_LOG_FILE, "utf-8")
      : '{"events":[]}';
    const logData = JSON.parse(logRaw) as { events: Array<Record<string, unknown>> };

    logData.events.push({
      id: `evt_${Date.now()}`,
      type: "agent_checkin",
      actor: agentId,
      taskId: null,
      summary,
      details: actionId,
      timestamp: new Date().toISOString(),
    });

    writeFileSync(ACTIVITY_LOG_FILE, JSON.stringify(logData, null, 2), "utf-8");
  } catch (err) {
    logger.error("run-action-comment", `Failed to log activity: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── CLI Argument Parsing ───────────────────────────────────────────────────

function parseArgs(): {
  actionId: string;
  agentId: string;
  comment: string;
  commentAuthor: string;
} {
  const args = process.argv.slice(2);
  const actionId = args[0];

  if (!actionId) {
    console.error("Usage: run-action-comment.ts <actionId> --agent <agentId> --comment <text> --comment-author <author>");
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

  return { actionId, agentId, comment, commentAuthor };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { actionId, agentId, comment, commentAuthor } = parseArgs();

  logger.info("run-action-comment", `Handling @${agentId} mention on action ${actionId} from ${commentAuthor}`);

  // 1. Read action
  const actionsData = readActions();
  const action = actionsData.actions.find((a) => a.id === actionId) as ActionDef | undefined;
  if (!action) {
    logger.error("run-action-comment", `Action not found: ${actionId}`);
    process.exit(1);
  }

  // 2. Read agent
  const agentsData = readAgents();
  const agent = agentsData.agents.find((a) => a.id === agentId);
  if (!agent) {
    logger.error("run-action-comment", `Agent not found: ${agentId}`);
    process.exit(1);
  }

  // 3. Load config for execution settings
  let maxTurns = 10;
  let timeoutMinutes = 15;
  let skipPermissions = false;
  try {
    const configRaw = readFileSync(path.join(DATA_DIR, "daemon-config.json"), "utf-8");
    const config = JSON.parse(configRaw);
    maxTurns = Math.min(config.execution?.maxTurns ?? 10, 15);
    timeoutMinutes = Math.min(config.execution?.timeoutMinutes ?? 15, 30);
    skipPermissions = config.execution?.skipPermissions ?? false;
  } catch { /* use defaults */ }

  // 4. Build prompt
  const prompt = buildCommentPrompt(agent, action, comment, commentAuthor);

  // 5. Write "running" entry to active-runs
  const runId = `run_cmt_${Date.now()}`;
  const streamFile = path.join(STREAMS_DIR, `${runId}.jsonl`);
  mkdirSync(STREAMS_DIR, { recursive: true });

  const activeRuns = readActiveRuns();
  activeRuns.runs.push({
    id: runId,
    taskId: actionId,
    agentId,
    projectId: null,
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
  const runner = new AgentRunner(WORKSPACE_ROOT);

  try {
    const result = await runner.spawnAgent({
      prompt,
      maxTurns,
      timeoutMinutes,
      skipPermissions,
      backend,
      cwd: WORKSPACE_ROOT,
      streamFile,
      onSpawned: (pid) => {
        try {
          const runs = readActiveRuns();
          const run = runs.runs.find((r) => r.id === runId);
          if (run) {
            run.pid = pid;
            writeActiveRuns(runs);
          }
        } catch { /* non-fatal */ }
      },
    });

    // 7. Parse output metadata
    const meta = parseClaudeOutput(result.stdout);

    // 8. Update active-runs entry
    const runs = readActiveRuns();
    const run = runs.runs.find((r) => r.id === runId);
    const errorMsg = result.stderr?.trim().slice(0, 500) || `Exit code: ${result.exitCode}`;
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
      appendAgentComment(actionId, agentId, response);

      // Post inbox notification
      postInboxNotification(actionId, agentId, action.title, response);
      logActivity(actionId, agentId, `@${agentId} responded to comment on action "${action.title}"`);
    } else {
      // Agent failed — post error as comment so user knows what happened
      const errComment = `Failed to respond: ${errorMsg}`;
      appendAgentComment(actionId, agentId, errComment);
      postInboxNotification(actionId, agentId, action.title, errComment);
      logActivity(actionId, agentId, `@${agentId} failed to respond on action "${action.title}": ${errorMsg.slice(0, 100)}`);
    }

    const costStr = meta.totalCostUsd != null ? ` · $${meta.totalCostUsd.toFixed(4)}` : "";
    logger.info("run-action-comment", `Comment handler complete for action ${actionId} (agent: ${agentId}, turns: ${meta.numTurns ?? "?"}${costStr})`);

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

    logger.error("run-action-comment", `Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error("run-action-comment", `Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
