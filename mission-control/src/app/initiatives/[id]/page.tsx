"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  ArrowLeft,
  Check,
  Clock,
  CheckCircle2,
  Activity,
  Pause,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AutonomySelector } from "@/components/autonomy-selector";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { FieldTaskCard } from "@/components/field-ops/field-task-card";
import { VaultUnlockDialog } from "@/components/field-ops/vault-unlock-dialog";
import { FieldTaskFormDialog } from "@/components/field-ops/field-task-form-dialog";
import { TaskForm, type TaskFormData } from "@/components/task-form";
import { actionToFieldTask } from "@/lib/action-adapter";
import { useInitiatives, useGoals, useInitiativeTasks, useActions, useActivityLog, useProjects } from "@/hooks/use-data";
import { useFieldServices, useExecuteTask } from "@/hooks/use-field-ops";
import { apiFetch } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";
import type { Initiative, InitiativeStatus, AutonomyLevel, Task, FieldTaskType } from "@/lib/types";

function kanbanBadge(kanban: Task["kanban"]) {
  switch (kanban) {
    case "done":
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">Done</Badge>;
    case "in-progress":
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">In Progress</Badge>;
    case "not-started":
      return <Badge variant="outline" className="text-[10px] text-muted-foreground">Not Started</Badge>;
  }
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return "just now";
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function InitiativeActivitySection({ taskIds }: { taskIds: string[] }) {
  const { events, loading } = useActivityLog();
  const taskIdSet = new Set(taskIds);
  const filtered = events
    .filter((e) => e.taskId && taskIdSet.has(e.taskId))
    .slice(0, 10);

  if (loading) return null;
  if (filtered.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Activity
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1">
            {filtered.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y">
          {filtered.map((event) => (
            <div key={event.id} className="flex items-start gap-3 py-2.5">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0 mt-1.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{event.summary}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {event.actor && event.actor !== "system" && (
                    <span className="text-xs text-muted-foreground">{event.actor}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{relativeTime(event.timestamp)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function InitiativeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const initiativeId = params.id as string;

  const { initiatives, update, loading: loadingInitiatives } = useInitiatives();
  const { goals } = useGoals();
  const { tasks, loading: loadingTasks, refetch: refetchTasks } = useInitiativeTasks(initiativeId);
  const { actions, loading: loadingActions, refetch: refetchActions } = useActions({ initiativeId });
  const { services } = useFieldServices();
  const { execute: executeAction, executingTaskId, dryRunTaskId } = useExecuteTask();
  const { projects } = useProjects();

  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addActionOpen, setAddActionOpen] = useState(false);
  const [vaultUnlockOpen, setVaultUnlockOpen] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");

  const initiative = initiatives.find((i) => i.id === initiativeId);

  const parentGoal = initiative?.parentGoalId ? goals.find((g) => g.id === initiative.parentGoalId) : null;

  const doneCount = tasks.filter((t) => t.kanban === "done").length + actions.filter((a) => a.status === "completed").length;
  const totalCount = tasks.length + actions.length;
  const pendingApprovals = actions.filter((a) => a.status === "pending-approval");

  async function handleTogglePause() {
    if (!initiative) return;
    const newStatus = initiative.status === "paused" ? "active" : "paused";
    setTogglingStatus(true);
    try {
      await update(initiative.id, { status: newStatus });
      showSuccess(newStatus === "paused" ? "Initiative paused" : "Initiative resumed");
    } catch {
      showError("Failed to update status");
    } finally {
      setTogglingStatus(false);
    }
  }

  async function handleSaveTitle() {
    if (!initiative) return;
    if (!titleDraft.trim() || titleDraft === initiative.title) { setEditingTitle(false); return; }
    await update(initiative.id, { title: titleDraft.trim() });
    setEditingTitle(false);
  }

  async function handleSaveDesc() {
    if (!initiative) return;
    if (descDraft === initiative.description) { setEditingDesc(false); return; }
    await update(initiative.id, { description: descDraft.trim() });
    setEditingDesc(false);
  }

  async function handleStatusChange(newStatus: InitiativeStatus) {
    if (!initiative) return;
    await update(initiative.id, { status: newStatus });
  }

  async function handleAutonomyChange(level: AutonomyLevel | null) {
    if (!initiative) return;
    await update(initiative.id, { autonomyLevel: level });
  }

  async function handleCreateAction(data: {
    title: string;
    description: string;
    type: FieldTaskType;
    serviceId: string | null;
    approvalRequired: boolean;
    payload?: Record<string, unknown>;
  }) {
    const res = await apiFetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        initiativeId,
        status: "draft",
        payload: data.payload ?? {},
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? "Failed to create action");
    }
    showSuccess("Action created");
    refetchActions();
  }

  async function handleActionStatusChange(taskId: string, status: string) {
    try {
      const res = await apiFetch("/api/actions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to update status");
      }
      showSuccess(`Status updated to ${status}`);
      refetchActions();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  if (loadingInitiatives) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!initiative) {
    return (
      <div className="space-y-6">
        <BreadcrumbNav items={[
          { label: "Initiatives", href: "/initiatives" },
          { label: "Not Found" },
        ]} />
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-lg font-medium">Initiative not found</h2>
            <p className="text-sm text-muted-foreground mt-1">This initiative may have been deleted.</p>
            <Button className="mt-4 gap-1.5" onClick={() => router.push("/initiatives")}>
              <ArrowLeft className="h-4 w-4" /> Back to Initiatives
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BreadcrumbNav items={[
        { label: "Initiatives", href: "/initiatives" },
        { label: initiative.title },
      ]} />

      <div className="space-y-3">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="h-4 w-4 rounded-full shrink-0 mt-2"
            style={{ backgroundColor: initiative.color }}
          />
          <div className="min-w-0 flex-1 space-y-1">
            {editingTitle ? (
              <input
                autoFocus
                className="w-full text-2xl font-bold bg-transparent border-b border-primary outline-none"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
              />
            ) : (
              <h1
                className="text-2xl font-bold cursor-text hover:opacity-80 transition-opacity"
                onClick={() => { setTitleDraft(initiative.title); setEditingTitle(true); }}
                title="Click to edit"
              >
                {initiative.title}
              </h1>
            )}
            {editingDesc ? (
              <textarea
                autoFocus
                className="w-full text-sm text-muted-foreground bg-transparent border-b border-primary outline-none resize-none"
                value={descDraft}
                rows={2}
                onChange={(e) => setDescDraft(e.target.value)}
                onBlur={handleSaveDesc}
                onKeyDown={(e) => { if (e.key === "Escape") setEditingDesc(false); }}
              />
            ) : (
              <p
                className={`text-sm cursor-text hover:opacity-80 transition-opacity ${initiative.description ? "text-muted-foreground" : "text-muted-foreground/40 italic"}`}
                onClick={() => { setDescDraft(initiative.description ?? ""); setEditingDesc(true); }}
                title="Click to edit"
              >
                {initiative.description || "Click to add description"}
              </p>
            )}
            {parentGoal && (
              <p className="text-xs text-muted-foreground">
                Goal:{" "}
                <Link href="/objectives" className="hover:underline text-primary">
                  {parentGoal.title}
                </Link>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-7">
          <span className="text-xs text-muted-foreground">Status:</span>
          {(["active", "paused", "completed", "archived"] as InitiativeStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleStatusChange(s)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all capitalize ${
                initiative.status === s
                  ? s === "active" ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                    : s === "paused" ? "bg-zinc-500/20 text-zinc-400 border-zinc-500/40"
                    : s === "completed" ? "bg-green-500/20 text-green-400 border-green-500/40"
                    : "bg-zinc-700/40 text-zinc-500 border-zinc-700/40"
                  : "bg-transparent text-muted-foreground border-border hover:border-muted-foreground/50"
              }`}
            >
              {s}
            </button>
          ))}
          {(initiative.status === "active" || initiative.status === "paused") && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs gap-1 px-2 ml-1"
              onClick={handleTogglePause}
              disabled={togglingStatus}
            >
              {initiative.status === "paused" ? (
                <><Play className="h-3 w-3" /> Resume</>
              ) : (
                <><Pause className="h-3 w-3" /> Pause</>
              )}
            </Button>
          )}
        </div>

      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Autonomy Level</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <AutonomySelector value={initiative.autonomyLevel ?? null} onChange={handleAutonomyChange} showInherit />
        </CardContent>
      </Card>

      {pendingApprovals.length > 0 && (
        <Card>
          <CardContent className="p-4 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-amber-400">
              <Clock className="h-4 w-4 animate-pulse" />
              <span className="font-medium">
                {pendingApprovals.length} pending approval{pendingApprovals.length !== 1 ? "s" : ""}
              </span>
              <Link href="/approvals">
                <Button variant="ghost" size="sm" className="h-6 text-xs text-amber-400 hover:text-amber-300 px-1.5">
                  Review
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="tasks">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="tasks">
              Tasks {!loadingTasks && <span className="ml-1.5 text-xs opacity-60">({tasks.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="actions">
              Actions {!loadingActions && <span className="ml-1.5 text-xs opacity-60">({actions.length})</span>}
            </TabsTrigger>
          </TabsList>
          {!loadingTasks && !loadingActions && totalCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
              <span>{doneCount} of {totalCount} done</span>
            </div>
          )}
        </div>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Tasks</CardTitle>
                <Button size="sm" className="gap-1.5" onClick={() => setAddTaskOpen(true)}>
                  <Plus className="h-4 w-4" /> Add Task
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTasks ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No tasks linked to this initiative yet.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {tasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between py-2.5 gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {task.kanban === "done" ? (
                          <Check className="h-3.5 w-3.5 text-green-400 shrink-0" />
                        ) : (
                          <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/40 shrink-0" />
                        )}
                        <span className={`text-sm truncate ${task.kanban === "done" ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {task.assignedTo && (
                          <span className="text-xs text-muted-foreground">{task.assignedTo}</span>
                        )}
                        {kanbanBadge(task.kanban)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Actions</CardTitle>
                <Button size="sm" className="gap-1.5" onClick={() => setAddActionOpen(true)}>
                  <Plus className="h-4 w-4" /> Add Action
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingActions ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : actions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No actions linked to this initiative yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {actions.map((action) => (
                    <FieldTaskCard
                      key={action.id}
                      task={actionToFieldTask(action)}
                      services={services}
                      onStatusChange={handleActionStatusChange}
                      onEdit={() => {}}
                      onDelete={() => {}}
                      onReject={() => {}}
                      onDryRun={(task) => void executeAction(task.id, undefined, true)}
                      dryRunning={dryRunTaskId === action.id}
                      executing={executingTaskId === action.id}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <InitiativeActivitySection taskIds={initiative.taskIds} />

      <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>
          <TaskForm
            initial={{ initiativeId }}
            projects={projects}
            goals={goals}
            allTasks={tasks}
            onSubmit={async (data: TaskFormData) => {
              const res = await apiFetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...data,
                  tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
                  acceptanceCriteria: data.acceptanceCriteria ? data.acceptanceCriteria.split("\n").filter(Boolean) : [],
                  initiativeId,
                }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as { error?: string }).error ?? "Failed to create task");
              }
              showSuccess("Task created");
              setAddTaskOpen(false);
              refetchTasks();
            }}
            onCancel={() => setAddTaskOpen(false)}
            submitLabel="Add Task"
          />
        </DialogContent>
      </Dialog>

      <FieldTaskFormDialog
        open={addActionOpen}
        onOpenChange={setAddActionOpen}
        missionId={initiativeId}
        missionAutonomy={initiative.autonomyLevel ?? "approve-all"}
        services={services}
        onSubmit={handleCreateAction}
      />

      <VaultUnlockDialog
        open={vaultUnlockOpen}
        onOpenChange={setVaultUnlockOpen}
        onUnlock={async () => false}
      />
    </div>
  );
}
