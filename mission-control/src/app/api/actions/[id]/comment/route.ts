import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import path from "path";
import { parseAgentMentions, generateId } from "@/lib/utils";
import { applyWorkspaceContext } from "@/lib/workspace-context";
import { getWorkspaceDataDir } from "@/lib/data";

function readJSON<T>(file: string): T | null {
  try {
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf-8")) as T;
  } catch {
    return null;
  }
}

interface CommentAttachment {
  id: string;
  type: "image" | "file";
  url: string;
  filename: string;
}

interface ActionEntry {
  id: string;
  title: string;
  assignedTo: string | null;
  status: string;
  comments?: Array<{
    id: string;
    author: string;
    content: string;
    createdAt: string;
    attachments?: CommentAttachment[];
  }>;
  updatedAt?: string;
  [key: string]: unknown;
}

interface AgentEntry {
  id: string;
  status: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: actionId } = await params;
  const workspaceId = await applyWorkspaceContext();
  const wsDir = getWorkspaceDataDir(workspaceId);
  const ACTIONS_FILE = path.join(wsDir, "actions.json");

  let body: { content: string; author?: string; attachments?: CommentAttachment[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json({ error: "Comment content is required" }, { status: 400 });
  }
  if (content.length > 5000) {
    return NextResponse.json({ error: "Comment too long (max 5000 chars)" }, { status: 400 });
  }

  const author = body.author ?? "me";
  const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : [];

  const actionsData = readJSON<{ actions: ActionEntry[] }>(ACTIONS_FILE);
  if (!actionsData) {
    return NextResponse.json({ error: "Could not read actions" }, { status: 500 });
  }

  const action = actionsData.actions.find((a) => a.id === actionId);
  if (!action) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }

  const comment = {
    id: generateId("cmt"),
    author,
    content,
    createdAt: new Date().toISOString(),
    ...(attachments.length > 0 ? { attachments } : {}),
  };

  if (!Array.isArray(action.comments)) {
    action.comments = [];
  }
  if (action.comments.length >= 100) {
    return NextResponse.json({ error: "Max 100 comments per action" }, { status: 400 });
  }
  action.comments.push(comment);
  action.updatedAt = new Date().toISOString();

  try {
    writeFileSync(ACTIONS_FILE, JSON.stringify(actionsData, null, 2), "utf-8");
  } catch {
    return NextResponse.json({ error: "Failed to write action" }, { status: 500 });
  }

  const mentionedIds = parseAgentMentions(content);
  const agentsData = readJSON<{ agents: AgentEntry[] }>(path.join(wsDir, "agents.json"));
  const validAgents = agentsData?.agents ?? [];
  const validMentions = mentionedIds.filter((id) =>
    validAgents.some((a) => a.id === id && a.status === "active")
  );

  const spawned: Array<{ agentId: string; pid: number }> = [];

  if (validMentions.length > 0) {
    const cwd = process.cwd();
    const scriptPath = path.resolve(cwd, "scripts", "daemon", "run-action-comment.ts");

    for (const agentId of validMentions) {
      try {
        const args = [
          "--import", "tsx",
          scriptPath,
          actionId,
          "--agent", agentId,
          "--comment", content,
          "--comment-author", author,
        ];

        const child = spawn(process.execPath, args, {
          cwd,
          detached: true,
          stdio: "ignore",
          shell: false,
        });
        child.unref();
        spawned.push({ agentId, pid: child.pid ?? 0 });
      } catch {
        // Non-fatal
      }
    }
  }

  try {
    const activityPath = path.join(wsDir, "activity-log.json");
    const activityRaw = existsSync(activityPath)
      ? readFileSync(activityPath, "utf-8")
      : '{"events":[]}';
    const activityData = JSON.parse(activityRaw) as { events: Array<Record<string, unknown>> };

    activityData.events.push({
      id: generateId("evt"),
      type: "message_sent",
      actor: author,
      taskId: null,
      summary: validMentions.length > 0
        ? `Comment on action "${action.title}" mentioning @${validMentions.join(", @")}`
        : `Comment on action "${action.title}"`,
      details: content.slice(0, 300),
      timestamp: new Date().toISOString(),
    });

    writeFileSync(activityPath, JSON.stringify(activityData, null, 2), "utf-8");
  } catch {
    // Non-fatal
  }

  return NextResponse.json({
    comment,
    mentionedAgents: validMentions,
    spawned,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: actionId } = await params;
  const workspaceId = await applyWorkspaceContext();
  const wsDir = getWorkspaceDataDir(workspaceId);
  const ACTIONS_FILE = path.join(wsDir, "actions.json");

  const url = new URL(request.url);
  const commentId = url.searchParams.get("commentId");
  if (!commentId) {
    return NextResponse.json({ error: "commentId query param is required" }, { status: 400 });
  }

  const actionsData = readJSON<{ actions: ActionEntry[] }>(ACTIONS_FILE);
  if (!actionsData) {
    return NextResponse.json({ error: "Could not read actions" }, { status: 500 });
  }

  const action = actionsData.actions.find((a) => a.id === actionId);
  if (!action) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }

  if (!Array.isArray(action.comments)) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const idx = action.comments.findIndex((c) => c.id === commentId);
  if (idx === -1) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const deletedComment = action.comments[idx];
  action.comments.splice(idx, 1);
  action.updatedAt = new Date().toISOString();

  try {
    writeFileSync(ACTIONS_FILE, JSON.stringify(actionsData, null, 2), "utf-8");
  } catch {
    return NextResponse.json({ error: "Failed to write action" }, { status: 500 });
  }

  // Delete uploaded attachment files (best-effort)
  if (Array.isArray(deletedComment.attachments)) {
    for (const att of deletedComment.attachments) {
      if (typeof att.url === "string" && att.url.startsWith("/uploads/")) {
        try {
          unlinkSync(path.join(process.cwd(), "public", att.url));
        } catch { /* ignore */ }
      }
    }
  }

  return NextResponse.json({ deleted: commentId });
}
