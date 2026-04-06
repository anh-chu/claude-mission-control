"use client";

import { useState, useCallback } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Shield,
  AlertTriangle,
  Loader2,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { FieldTaskCard } from "@/components/field-ops/field-task-card";
import { VaultUnlockDialog } from "@/components/field-ops/vault-unlock-dialog";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useActions, useAgents } from "@/hooks/use-data";
import { useFieldServices, useExecuteTask } from "@/hooks/use-field-ops";
import { GettingStartedCard } from "@/components/field-ops/getting-started-card";
import { ActionDetailPanel } from "@/components/action-detail-panel";
import { actionToFieldTask } from "@/lib/action-adapter";
import type { Action, FieldTask } from "@/lib/types";
import { showSuccess, showError } from "@/lib/toast";

type RiskFilter = "all" | "high" | "medium" | "low";

function getActionRisk(action: Action): "high" | "medium" | "low" {
  const highRiskTypes = ["payment", "crypto-transfer", "ad-campaign"];
  const mediumRiskTypes = ["email-campaign", "social-post", "publish"];
  if (highRiskTypes.includes(action.type)) return "high";
  if (mediumRiskTypes.includes(action.type)) return "medium";
  return "low";
}

function RejectDialog({
  title,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  onConfirm: (feedback: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [feedback, setFeedback] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Reject: {title}</h2>
        <textarea
          className="w-full rounded-lg border bg-muted px-3 py-2 text-sm resize-none min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Reason for rejection (optional)"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" disabled={loading} onClick={() => onConfirm(feedback)}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const { actions, loading, refetch } = useActions({ status: "pending-approval" });
  const { services } = useFieldServices();
  const { execute: executeAction, executingTaskId, dryRunTaskId } = useExecuteTask();
  const { agents } = useAgents();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailAction, setDetailAction] = useState<Action | null>(null);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [rejectTarget, setRejectTarget] = useState<{ id: string; title: string } | null>(null);
  const [batchAction, setBatchAction] = useState<"approve" | "reject" | null>(null);
  const [vaultUnlockOpen, setVaultUnlockOpen] = useState(false);

  const filteredActions = riskFilter === "all"
    ? actions
    : actions.filter((a) => getActionRisk(a) === riskFilter);

  const highCount = actions.filter((a) => getActionRisk(a) === "high").length;
  const mediumCount = actions.filter((a) => getActionRisk(a) === "medium").length;
  const lowCount = actions.filter((a) => getActionRisk(a) === "low").length;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredActions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredActions.map((a) => a.id)));
    }
  }

  const handleReject = useCallback(async (id: string, feedback: string) => {
    try {
      const res = await apiFetch("/api/actions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "rejected", rejectedBy: "me", rejectionFeedback: feedback }),
      });
      if (res.ok) {
        showSuccess("Action rejected");
        refetch();
        setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      } else {
        showError("Failed to reject");
      }
    } catch {
      showError("Failed to reject");
    } finally {
      setRejectTarget(null);
    }
  }, [refetch]);

  async function handleBatchApprove() {
    if (selectedIds.size === 0) return;
    setBatchAction("approve");
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds).map((id) =>
          apiFetch("/api/actions", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status: "approved", approvedBy: "me" }),
          })
        )
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      showSuccess(`Approved ${succeeded} action(s)`);
      setSelectedIds(new Set());
      refetch();
    } catch {
      showError("Batch approve failed");
    } finally {
      setBatchAction(null);
    }
  }

  const handleStatusChange = useCallback(async (taskId: string, status: string) => {
    try {
      const res = await apiFetch("/api/actions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status }),
      });
      if (res.ok) {
        showSuccess(`Status updated to ${status}`);
        refetch();
      } else {
        showError("Failed to update status");
      }
    } catch {
      showError("Failed to update status");
    }
  }, [refetch]);

  async function handleBatchReject(feedback: string) {
    if (selectedIds.size === 0) return;
    setBatchAction("reject");
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds).map((id) =>
          apiFetch("/api/actions", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status: "rejected", rejectedBy: "me", rejectionFeedback: feedback }),
          })
        )
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      showSuccess(`Rejected ${succeeded} action(s)`);
      setSelectedIds(new Set());
      refetch();
    } catch {
      showError("Batch reject failed");
    } finally {
      setBatchAction(null);
      setRejectTarget(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <BreadcrumbNav items={[{ label: "Approvals" }]} />
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const isEmpty = actions.length === 0;

  return (
    <div className="space-y-6">
      <BreadcrumbNav items={[{ label: "Approvals" }]} />

      <div className="flex items-center gap-3">
        <Clock className="h-6 w-6 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold">Approvals</h1>
          <p className="text-sm text-muted-foreground">
            {isEmpty
              ? "No pending approvals"
              : `${actions.length} action${actions.length !== 1 ? "s" : ""} awaiting your review`}
          </p>
        </div>
      </div>

      {isEmpty && (
        <GettingStartedCard
          title="No pending approvals"
          description="Actions submitted by agents appear here for your review. Configure approval requirements in each initiative's settings."
          steps={[
            "Create an initiative in the Initiatives page",
            "Add actions to the initiative",
            "Actions requiring approval will appear here"
          ]}
          learnMoreHref="/guide"
          storageKey="approvals-getting-started"
        />
      )}

      {!isEmpty && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card
              className={cn("cursor-pointer transition-all", riskFilter === "high" && "ring-1 ring-red-500/50")}
              onClick={() => setRiskFilter(riskFilter === "high" ? "all" : "high")}
            >
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                  High Risk
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-400">{highCount}</div>
              </CardContent>
            </Card>
            <Card
              className={cn("cursor-pointer transition-all", riskFilter === "medium" && "ring-1 ring-amber-500/50")}
              onClick={() => setRiskFilter(riskFilter === "medium" ? "all" : "medium")}
            >
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-amber-400" />
                  Medium Risk
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-400">{mediumCount}</div>
              </CardContent>
            </Card>
            <Card
              className={cn("cursor-pointer transition-all", riskFilter === "low" && "ring-1 ring-emerald-500/50")}
              onClick={() => setRiskFilter(riskFilter === "low" ? "all" : "low")}
            >
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  Low Risk
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-400">{lowCount}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={filteredActions.length > 0 && selectedIds.size === filteredActions.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select for batch actions"}
                </span>

                {riskFilter !== "all" && (
                  <Badge
                    variant="outline"
                    className="gap-1 cursor-pointer"
                    onClick={() => setRiskFilter("all")}
                  >
                    <Filter className="h-3 w-3" />
                    {riskFilter} risk
                    <XCircle className="h-3 w-3 ml-0.5" />
                  </Badge>
                )}

                <div className="flex-1" />

                {selectedIds.size > 0 && (
                  <>
                    <Button
                      size="sm"
                      className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={batchAction !== null}
                      onClick={handleBatchApprove}
                    >
                      {batchAction === "approve" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Approve {selectedIds.size}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1"
                      disabled={batchAction !== null}
                      onClick={() =>
                        setRejectTarget({ id: "__batch__", title: `${selectedIds.size} selected action(s)` })
                      }
                    >
                      {batchAction === "reject" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      Reject {selectedIds.size}
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {filteredActions.map((action) => (
              <div key={action.id} className="flex items-start gap-3">
                <div className="pt-4">
                  <Checkbox
                    checked={selectedIds.has(action.id)}
                    onCheckedChange={() => toggleSelect(action.id)}
                    aria-label={`Select ${action.title}`}
                  />
                </div>
                <div className="flex-1">
                  <FieldTaskCard
                    task={actionToFieldTask(action)}
                    services={services}
                    onStatusChange={handleStatusChange}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onReject={(task: FieldTask) => setRejectTarget({ id: task.id, title: task.title })}
                    onDryRun={(task) => void executeAction(task.id, undefined, true)}
                    dryRunning={dryRunTaskId === action.id}
                    executing={executingTaskId === action.id}
                    onOpen={() => setDetailAction(actions.find(a => a.id === action.id) ?? null)}
                  />
                </div>
              </div>
            ))}
          </div>

          {filteredActions.length === 0 && actions.length > 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Filter className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No {riskFilter}-risk actions pending approval.</p>
                <Button variant="link" size="sm" className="mt-1" onClick={() => setRiskFilter("all")}>
                  Show all actions
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {rejectTarget && (
        <RejectDialog
          title={rejectTarget.title}
          loading={batchAction === "reject"}
          onCancel={() => setRejectTarget(null)}
          onConfirm={(feedback) => {
            if (rejectTarget.id === "__batch__") {
              handleBatchReject(feedback);
            } else {
              handleReject(rejectTarget.id, feedback);
            }
          }}
        />
      )}

      <VaultUnlockDialog
        open={vaultUnlockOpen}
        onOpenChange={setVaultUnlockOpen}
        onUnlock={async () => false}
      />

      <ActionDetailPanel
        action={detailAction}
        open={!!detailAction}
        onClose={() => setDetailAction(null)}
        agents={agents}
      />
    </div>
  );
}
