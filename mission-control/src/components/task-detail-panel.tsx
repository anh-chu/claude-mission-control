"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import {
  X, Trash2, ListChecks, Link2, CheckCircle2, Rocket,
  Send, Clock, MessageSquare, Activity, Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskForm, type TaskFormData } from "@/components/task-form";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Task, Project, Goal, AgentRole, FieldTask } from "@/lib/types";
import { getQuadrant } from "@/lib/types";
import { useActivityLog, useInbox, useAgents, useDecisions } from "@/hooks/use-data";
import { getAgentIcon } from "@/lib/agent-icons";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Tip } from "@/components/ui/tip";
import { cn, parseAgentMentions } from "@/lib/utils";
import { toast } from "sonner";
import { MentionTextarea } from "@/components/mention-textarea";
import { MarkdownContent } from "@/components/markdown-content";
import { apiFetch } from "@/lib/api-client";

const quadrantLabels: Record<string, { label: string; color: string }> = {
  do: { label: "DO", color: "bg-quadrant-do/20 text-quadrant-do border-quadrant-do/30" },
  schedule: { label: "SCHEDULE", color: "bg-quadrant-schedule/20 text-quadrant-schedule border-quadrant-schedule/30" },
  delegate: { label: "DELEGATE", color: "bg-quadrant-delegate/20 text-quadrant-delegate border-quadrant-delegate/30" },
  eliminate: { label: "ELIMINATE", color: "bg-quadrant-eliminate/20 text-quadrant-eliminate border-quadrant-eliminate/30" },
};

interface TaskDetailPanelProps {
  task: Task;
  projects: Project[];
  goals: Goal[];
  allTasks?: Task[];
  onUpdate: (data: TaskFormData) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function TaskDetailPanel({ task, projects, goals, allTasks, onUpdate, onDelete, onClose }: TaskDetailPanelProps) {
  const { events } = useActivityLog();
  const { messages } = useInbox();
  const { agents } = useAgents();
  const { decisions } = useDecisions();
  const [commentText, setCommentText] = useState("");
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [localComments, setLocalComments] = useState(task.comments ?? []);
  useEffect(() => {
    setLocalComments(task.comments ?? []);
  }, [task.id]);
  const mentionedAgentIds = parseAgentMentions(commentText);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [linkedFieldTasks, setLinkedFieldTasks] = useState<FieldTask[]>([]);
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const activeAgents = agents.filter((a) => a.status === "active");
  const deployableAgents = activeAgents.filter((a) => a.id !== "me");

  // Focus management: move focus into panel on open, restore on close
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
    return () => {
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    };
  }, [task]);

  // Fetch linked field tasks when the task has fieldTaskIds
  useEffect(() => {
    const ids = task.fieldTaskIds;
    if (!ids || ids.length === 0) {
      setLinkedFieldTasks([]);
      return;
    }
    async function fetchFieldTasks() {
      try {
        const res = await fetch("/api/field-ops/tasks");
        if (res.ok) {
          const data = await res.json();
          const all: FieldTask[] = data.tasks ?? [];
          setLinkedFieldTasks(all.filter((ft) => ids!.includes(ft.id)));
        }
      } catch {
        // Silently fail
      }
    }
    fetchFieldTasks();
  }, [task.fieldTaskIds]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleUpdate = useCallback(
    (data: TaskFormData) => {
      onUpdate(data);
      onClose();
    },
    [onUpdate, onClose]
  );

  const handleDeploy = useCallback(
    (role: AgentRole) => {
      const deployData: TaskFormData = {
        title: task.title,
        description: task.description,
        importance: task.importance,
        urgency: task.urgency,
        kanban: task.kanban === "not-started" ? "in-progress" : task.kanban,
        projectId: task.projectId,
        milestoneId: task.milestoneId,
        initiativeId: task.initiativeId ?? null,
        assignedTo: role,
        collaborators: task.collaborators ?? [],
        tags: task.tags.join(", "),
        notes: task.notes,
        subtasks: task.subtasks ?? [],
        blockedBy: task.blockedBy ?? [],
        estimatedMinutes: task.estimatedMinutes ?? null,
        dueDate: task.dueDate ?? null,
        acceptanceCriteria: (task.acceptanceCriteria ?? []).join("\n"),
      };
      const agent = agents.find((a) => a.id === role);
      const agentLabel = agent?.name ?? role;
      toast.success(`Deployed to ${agentLabel}`, { icon: "🚀" });
      onUpdate(deployData);
      onClose();
    },
    [task, agents, onUpdate, onClose]
  );

  const handleAddComment = useCallback(async () => {
    const trimmed = commentText.trim();
    if (!trimmed && stagedFiles.length === 0) return;
    if (!trimmed) return;

    // Upload staged files first
    const uploadedAttachments: Array<{ id: string; type: "image" | "file"; url: string; filename: string }> = [];
    for (const file of stagedFiles) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json() as { url: string; filename: string };
          uploadedAttachments.push({
            id: `att_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            type: file.type.startsWith("image/") ? "image" : "file",
            url: uploadData.url,
            filename: uploadData.filename,
          });
        }
      } catch { /* non-fatal */ }
    }

    try {
      const res = await apiFetch(`/api/tasks/${task.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
          author: "me",
          ...(uploadedAttachments.length > 0 ? { attachments: uploadedAttachments } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to add comment");
        return;
      }

      const data = await res.json();
      setLocalComments((prev) => [...prev, data.comment]);
      setCommentText("");
      setStagedFiles([]);

      const mentions = data.mentionedAgents as string[];
      if (mentions.length > 0) {
        toast.success(`Comment sent — @${mentions.join(", @")} notified`);
      } else {
        toast.success("Comment added");
      }
    } catch {
      toast.error("Failed to add comment");
    }
  }, [commentText, stagedFiles, task]);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      const res = await apiFetch(`/api/tasks/${task.id}/comment?commentId=${encodeURIComponent(commentId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to delete comment");
        return;
      }
      // Optimistically remove from local state
      setLocalComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success("Comment deleted");
    } catch {
      toast.error("Failed to delete comment");
    }
  }, [task]);

  const quadrant = getQuadrant(task);
  const qi = quadrantLabels[quadrant];
  const project = projects.find((p) => p.id === task.projectId);

  // Summary stats
  const subtaskCount = task.subtasks?.length ?? 0;
  const subtaskDone = task.subtasks?.filter((s) => s.done).length ?? 0;
  const depCount = task.blockedBy?.length ?? 0;
  const unmetDepCount = allTasks
    ? (task.blockedBy ?? []).filter((depId) => {
        const dep = allTasks.find((t) => t.id === depId);
        return dep && dep.kanban !== "done";
      }).length
    : depCount;
  const hasAwaitingDecision = decisions.some(
    (d) => d.taskId === task.id && d.status === "pending"
  );
  const criteriaCount = task.acceptanceCriteria?.length ?? 0;

  // Timeline: merge activity events + inbox messages for this task
  const taskEvents = events
    .filter((e) => e.taskId === task.id)
    .map((e) => ({
      id: e.id,
      type: "event" as const,
      actor: e.actor,
      summary: e.summary,
      timestamp: e.timestamp,
    }));
  const taskMessages = messages
    .filter((m) => m.taskId === task.id)
    .map((m) => ({
      id: m.id,
      type: "message" as const,
      actor: m.from,
      summary: `${m.type}: ${m.subject}`,
      timestamp: m.createdAt,
    }));
  const timeline = [...taskEvents, ...taskMessages]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Comments
  const comments = localComments;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm cursor-pointer" onClick={onClose} />

      {/* Panel */}
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Task details"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-full md:max-w-lg flex-col border-l bg-card shadow-2xl animate-in slide-in-from-right duration-200 outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn("text-xs", qi.color)}>
              {qi.label}
            </Badge>
            {project && (
              <Badge
                variant="outline"
                className="text-xs"
                style={{ borderColor: project.color, color: project.color }}
              >
                {project.name}
              </Badge>
            )}
            {/* Quick stats badges */}
            {subtaskCount > 0 && (
              <Badge variant="secondary" className="text-xs gap-1">
                <ListChecks className="h-3 w-3" />
                {subtaskDone}/{subtaskCount}
              </Badge>
            )}
            {depCount > 0 && (
              <Badge variant="secondary" className={cn("text-xs gap-1", unmetDepCount > 0 ? "border-blue-500/30 text-blue-500" : "")}>
                <Link2 className="h-3 w-3" />
                {unmetDepCount > 0 ? `${unmetDepCount} pending dep${unmetDepCount > 1 ? "s" : ""}` : `${depCount} dep${depCount > 1 ? "s" : ""}`}
              </Badge>
            )}
            {hasAwaitingDecision && (
              <Badge variant="secondary" className="text-xs gap-1 border-amber-500/30 text-amber-500">
                <Clock className="h-3 w-3" />
                Awaiting Decision
              </Badge>
            )}
            {criteriaCount > 0 && (
              <Badge variant="secondary" className="text-xs gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {criteriaCount} criteria
              </Badge>
            )}
            {linkedFieldTasks.length > 0 && (
              <Badge variant="secondary" className="text-xs gap-1 border-indigo-500/30 text-indigo-400">
                <Radio className="h-3 w-3" />
                {linkedFieldTasks.length} field task{linkedFieldTasks.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Deploy button */}
            <DropdownMenu>
              <Tip content="Deploy to agent">
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-primary hover:bg-primary/10"
                    aria-label="Deploy to agent"
                  >
                    <Rocket className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </Tip>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                {deployableAgents.map((agent) => {
                  const Icon = getAgentIcon(agent.id, agent.icon);
                  const isCurrentAssignee = task.assignedTo === agent.id;
                  return (
                    <DropdownMenuItem
                      key={agent.id}
                      onClick={() => handleDeploy(agent.id)}
                      className={cn(isCurrentAssignee && "bg-accent")}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <span className="flex-1">{agent.name}</span>
                      {isCurrentAssignee && (
                        <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                          active
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Tip content="Delete task">
              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setShowDeleteConfirm(true)} aria-label="Delete task">
                <Trash2 className="h-4 w-4" />
              </Button>
            </Tip>
            <Tip content="Close panel">
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </Tip>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4">
          {/* Form */}
          <TaskForm
            initial={{
              title: task.title,
              description: task.description,
              importance: task.importance,
              urgency: task.urgency,
              kanban: task.kanban,
              projectId: task.projectId,
              milestoneId: task.milestoneId,
              initiativeId: task.initiativeId ?? null,
              assignedTo: task.assignedTo,
              collaborators: task.collaborators ?? [],
              tags: task.tags.join(", "),
              notes: task.notes,
              subtasks: task.subtasks ?? [],
              blockedBy: task.blockedBy ?? [],
              estimatedMinutes: task.estimatedMinutes ?? null,
              dueDate: task.dueDate ?? null,
              acceptanceCriteria: (task.acceptanceCriteria ?? []).join("\n"),
            }}
            projects={projects}
            goals={goals}
            allTasks={allTasks}
            currentTaskId={task.id}
            onSubmit={handleUpdate}
            onCancel={onClose}
            submitLabel="Save Changes"
          />

          {/* Linked Field Tasks */}
          {linkedFieldTasks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Radio className="h-4 w-4" />
                <span className="text-sm font-medium">
                  Linked Field Tasks ({linkedFieldTasks.length})
                </span>
              </div>
              <div className="space-y-1.5">
                {linkedFieldTasks.map((ft) => {
                  const statusColors: Record<string, string> = {
                    "draft": "bg-zinc-500/20 text-zinc-400",
                    "pending-approval": "bg-amber-500/20 text-amber-400",
                    "approved": "bg-emerald-500/20 text-emerald-400",
                    "executing": "bg-indigo-500/20 text-indigo-400",
                    "completed": "bg-green-500/20 text-green-400",
                    "failed": "bg-red-500/20 text-red-400",
                    "rejected": "bg-orange-500/20 text-orange-400",
                  };
                  return (
                    <a
                      key={ft.id}
                      href={ft.missionId ? `/field-ops/missions/${ft.missionId}` : "/field-ops"}
                      className="flex items-center justify-between rounded-md border p-2 text-xs hover:border-primary/30 transition-colors"
                    >
                      <span className="truncate font-medium">{ft.title}</span>
                      <Badge className={cn("text-[10px] px-1.5 py-0 ml-2 shrink-0", statusColors[ft.status] ?? "bg-muted text-muted-foreground")}>
                        {ft.status}
                      </Badge>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comments Thread */}
          <Collapsible open={commentsOpen} onOpenChange={setCommentsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 hover:text-foreground text-muted-foreground transition-colors">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm font-medium">
                Comments {comments.length > 0 && `(${comments.length})`}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* Existing comments */}
              {comments.length > 0 ? (
                <div className="space-y-3">
                  {comments.map((comment) => {
                    const authorAgent = agents.find((a) => a.id === comment.author);
                    const AuthorIcon = comment.author === "system" ? Activity : getAgentIcon(comment.author, authorAgent?.icon);
                    const isAgent = comment.author !== "me" && comment.author !== "system";
                    return (
                      <div
                        key={comment.id}
                        className={cn(
                          "flex gap-2 group/comment",
                          isAgent && "pl-2 border-l-2 border-blue-500/30"
                        )}
                      >
                        <div className={cn(
                          "h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                          isAgent ? "bg-blue-500/10" : "bg-muted"
                        )}>
                          <AuthorIcon className={cn("h-3 w-3", isAgent ? "text-blue-400" : "text-muted-foreground")} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-xs font-medium", isAgent && "text-blue-400")}>
                              {comment.author === "system" ? "System" : (authorAgent?.name ?? comment.author)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(comment.createdAt).toLocaleDateString()} {new Date(comment.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <button
                              type="button"
                              className="opacity-0 group-hover/comment:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 ml-auto"
                              onClick={() => handleDeleteComment(comment.id)}
                              aria-label="Delete comment"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          <MarkdownContent content={comment.content} />
                          {comment.attachments && comment.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-1.5">
                              {comment.attachments.map((att) => (
                                att.type === "image" ? (
                                  <img
                                    key={att.id}
                                    src={att.url}
                                    alt={att.filename}
                                    className="rounded max-h-32 max-w-[200px] object-contain border border-border/50"
                                  />
                                ) : (
                                  <a
                                    key={att.id}
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 bg-muted rounded px-2 py-0.5 text-xs text-blue-400 hover:text-blue-300"
                                  >
                                    📎 {att.filename}
                                  </a>
                                )
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-1">No comments yet</p>
              )}

              {/* Add comment with @-mention support */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 min-w-0">
                  <MentionTextarea
                    value={commentText}
                    onChange={setCommentText}
                    agents={activeAgents}
                    onSubmit={handleAddComment}
                    stagedFiles={stagedFiles}
                    onFilesChange={setStagedFiles}
                  />
                </div>
                <Tip content={mentionedAgentIds.length > 0 ? `Send to @${mentionedAgentIds.join(", @")}` : "Post comment"}>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "shrink-0 self-end",
                      mentionedAgentIds.length > 0 && "text-blue-400 hover:text-blue-500"
                    )}
                    onClick={handleAddComment}
                    disabled={!commentText.trim() && stagedFiles.length === 0}
                    aria-label={mentionedAgentIds.length > 0 ? `Send to @${mentionedAgentIds.join(", @")}` : "Send comment"}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </Tip>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Activity Timeline */}
          <Collapsible open={timelineOpen} onOpenChange={setTimelineOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 hover:text-foreground text-muted-foreground transition-colors">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">
                Timeline {timeline.length > 0 && `(${timeline.length})`}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              {timeline.length > 0 ? (
                <div className="relative space-y-0 pl-3 border-l border-border">
                  {timeline.map((item) => {
                    const actorAgent = agents.find((a) => a.id === item.actor);
                    const ActorIcon = item.actor === "system" ? Activity : getAgentIcon(item.actor, actorAgent?.icon);
                    return (
                      <div key={item.id} className="relative pb-3 last:pb-0">
                        <div className="absolute -left-[calc(0.75rem+4.5px)] top-1 h-2 w-2 rounded-full bg-border" />
                        <div className="flex items-start gap-2">
                          <ActorIcon className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground truncate">{item.summary}</p>
                            <p className="text-[10px] text-muted-foreground/60">
                              {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                            {item.type === "event" ? "activity" : "message"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-1">No activity yet</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Footer timestamps */}
        <div className="border-t px-4 py-2 text-xs text-muted-foreground flex justify-between">
          <span>Created: {new Date(task.createdAt).toLocaleDateString()}</span>
          <span>Updated: {new Date(task.updatedAt).toLocaleDateString()}</span>
          {task.estimatedMinutes && (
            <span>Est: {task.estimatedMinutes}m</span>
          )}
        </div>
      </aside>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete task?"
        description={`"${task.title}" will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={onDelete}
      />
    </>
  );
}
