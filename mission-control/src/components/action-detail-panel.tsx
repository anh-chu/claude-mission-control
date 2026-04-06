"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  X,
  MessageSquare,
  Shield,
  Clock,
  Send,
  ChevronDown,
  ChevronUp,
  FileText,
  Link2,
  Wrench,
  Mail,
  Megaphone,
  CreditCard,
  Globe,
  Palette,
  Wallet,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { MarkdownContent } from "@/components/markdown-content";
import { MentionTextarea } from "@/components/mention-textarea";
import { getAgentIcon } from "@/lib/agent-icons";
import {
  TASK_TYPE_INFO,
  RISK_BADGE_STYLES,
  TASK_STATUS_STYLES,
  computeTaskRisk,
  type RiskLevel,
} from "@/lib/field-ops-security";
import type {
  Action,
  AgentDefinition,
  CommentAttachment,
  FieldTaskType,
  TaskComment,
} from "@/lib/types";

// ─── Icon lookup ─────────────────────────────────────────────────────────────

const TASK_TYPE_ICONS: Record<string, typeof MessageSquare> = {
  MessageSquare,
  Mail,
  Megaphone,
  CreditCard,
  Globe,
  Palette,
  Wrench,
  Wallet,
};

const TASK_TYPE_COLORS: Record<FieldTaskType, string> = {
  "social-post": "text-blue-400",
  "email-campaign": "text-purple-400",
  "ad-campaign": "text-orange-400",
  payment: "text-green-400",
  publish: "text-teal-400",
  design: "text-pink-400",
  "crypto-transfer": "text-amber-400",
  custom: "text-zinc-400",
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface ActionDetailPanelProps {
  action: Action | null;
  open: boolean;
  onClose: () => void;
  onUpdate?: (id: string, patch: Partial<Action>) => Promise<void>;
  agents: AgentDefinition[];
}

// ─── Payload preview ─────────────────────────────────────────────────────────

function renderPayloadPreview(action: Action): React.ReactNode {
  const p = action.payload;
  if (!p || Object.keys(p).length === 0) return null;

  const MAX_LEN = 480;
  const truncate = (s: string) =>
    s.length > MAX_LEN ? s.slice(0, MAX_LEN) + "\u2026" : s;

  let content: React.ReactNode = null;

  switch (action.type) {
    case "social-post": {
      const text = typeof p.text === "string" ? p.text : null;
      const subreddit = typeof p.subreddit === "string" ? p.subreddit : null;
      const mediaUrls = Array.isArray(p.mediaUrls) ? p.mediaUrls : [];
      if (!text) return null;
      content = (
        <>
          <p className="whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed">
            {truncate(text)}
          </p>
          {(subreddit || mediaUrls.length > 0) && (
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
              {subreddit && (
                <span className="bg-muted rounded px-1.5 py-0.5 font-medium">
                  r/{subreddit}
                </span>
              )}
              {mediaUrls.length > 0 && (
                <span>
                  {mediaUrls.length} media file
                  {mediaUrls.length > 1 ? "s" : ""} attached
                </span>
              )}
            </div>
          )}
        </>
      );
      break;
    }
    case "email-campaign": {
      const subject = typeof p.subject === "string" ? p.subject : null;
      const body = typeof p.body === "string" ? p.body : null;
      const recipients = Array.isArray(p.recipients) ? p.recipients : [];
      if (!subject && !body) return null;
      content = (
        <>
          {subject && (
            <p className="text-xs font-medium text-foreground/70 mb-1">
              Subject: {subject}
            </p>
          )}
          {body && (
            <p className="whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed">
              {truncate(body)}
            </p>
          )}
          {recipients.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {recipients.length} recipient{recipients.length > 1 ? "s" : ""}
            </p>
          )}
        </>
      );
      break;
    }
    case "ad-campaign": {
      const headline = typeof p.headline === "string" ? p.headline : null;
      const body = typeof p.body === "string" ? p.body : null;
      if (!headline && !body) return null;
      content = (
        <>
          {headline && (
            <p className="text-sm font-medium text-foreground/80">{headline}</p>
          )}
          {body && (
            <p className="whitespace-pre-wrap text-sm text-foreground/70 leading-relaxed mt-0.5">
              {truncate(body)}
            </p>
          )}
        </>
      );
      break;
    }
    case "payment":
    case "crypto-transfer": {
      const amount = p.amount;
      const currency = typeof p.currency === "string" ? p.currency : "";
      const recipient = typeof p.recipient === "string" ? p.recipient : null;
      const toAddress = typeof p.toAddress === "string" ? p.toAddress : null;
      const target = recipient ?? toAddress;
      if (amount == null && !target) return null;
      content = (
        <div className="flex flex-col gap-0.5 text-sm">
          {amount != null && (
            <span className="text-foreground/80 font-medium">
              {String(amount)} {currency}
            </span>
          )}
          {target && (
            <span className="text-muted-foreground text-xs font-mono truncate">
              To:{" "}
              {target.length > 42
                ? target.slice(0, 20) + "\u2026" + target.slice(-8)
                : target}
            </span>
          )}
        </div>
      );
      break;
    }
    case "publish": {
      const title = typeof p.title === "string" ? p.title : null;
      const bodyContent = typeof p.content === "string" ? p.content : null;
      const url = typeof p.url === "string" ? p.url : null;
      if (!title && !bodyContent) return null;
      content = (
        <>
          {title && (
            <p className="text-sm font-medium text-foreground/80">{title}</p>
          )}
          {bodyContent && (
            <p className="whitespace-pre-wrap text-sm text-foreground/70 leading-relaxed mt-0.5">
              {truncate(bodyContent)}
            </p>
          )}
          {url && (
            <p className="text-[11px] text-muted-foreground mt-1.5 font-mono truncate">
              {url}
            </p>
          )}
        </>
      );
      break;
    }
    case "design": {
      const prompt = typeof p.prompt === "string" ? p.prompt : null;
      if (!prompt) return null;
      content = (
        <p className="whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed">
          {truncate(prompt)}
        </p>
      );
      break;
    }
    default: {
      const entries = Object.entries(p)
        .filter((e): e is [string, string] => typeof e[1] === "string")
        .slice(0, 3);
      if (entries.length === 0) return null;
      content = (
        <div className="flex flex-col gap-0.5 text-sm">
          {entries.map(([key, val]) => (
            <div key={key}>
              <span className="text-muted-foreground text-xs">{key}: </span>
              <span className="text-foreground/80">{truncate(val)}</span>
            </div>
          ))}
        </div>
      );
      break;
    }
  }

  return (
    <div className="rounded-md border border-border/50 bg-muted/30 p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium mb-1">
        <FileText className="h-3 w-3" />
        Content Preview
      </div>
      {content}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ActionDetailPanel({
  action,
  open,
  onClose,
  onUpdate,
  agents,
}: ActionDetailPanelProps) {
  const [commentText, setCommentText] = useState("");
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [localComments, setLocalComments] = useState<TaskComment[]>(
    action?.comments ?? [],
  );
  const panelRef = useRef<HTMLElement>(null);
  const descFileInputRef = useRef<HTMLInputElement>(null);

  // Sync comments when action changes
  useEffect(() => {
    setLocalComments(action?.comments ?? []);
    setEditingDesc(false);
  }, [action?.id]);

  // Focus management
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => panelRef.current?.focus());
    }
  }, [open]);

  const activeAgents = agents.filter((a) => a.status === "active");

  const handleAddComment = useCallback(async () => {
    if (!action) return;
    const trimmed = commentText.trim();
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
      const res = await apiFetch(`/api/actions/${action.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
          author: "me",
          ...(uploadedAttachments.length > 0 ? { attachments: uploadedAttachments } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        toast.error(err.error ?? "Failed to add comment");
        return;
      }
      const data = await res.json() as { comment: TaskComment; mentionedAgents: string[] };
      setLocalComments((prev) => [...prev, data.comment]);
      setCommentText("");
      setStagedFiles([]);
      const mentions = data.mentionedAgents;
      if (mentions.length > 0) {
        toast.success(`Comment sent — @${mentions.join(", @")} notified`);
      } else {
        toast.success("Comment added");
      }
    } catch {
      toast.error("Failed to add comment");
    }
  }, [commentText, stagedFiles, action]);

  const handleSaveDesc = useCallback(async () => {
    if (!action || !onUpdate) return;
    if (descDraft === action.description) {
      setEditingDesc(false);
      return;
    }
    await onUpdate(action.id, { description: descDraft });
    setEditingDesc(false);
  }, [action, descDraft, onUpdate]);

  const handleDescFileAttach = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) return;
      const data = await res.json() as { url: string; filename: string };
      const md = file.type.startsWith("image/")
        ? `![${data.filename}](${data.url})`
        : `[${data.filename}](${data.url})`;
      setDescDraft((prev) => prev ? `${prev}\n${md}` : md);
    } catch { /* non-fatal */ }
  }, []);

  if (!open || !action) return null;

  const typeInfo = TASK_TYPE_INFO[action.type];
  const TypeIcon = TASK_TYPE_ICONS[typeInfo?.icon ?? "Wrench"] ?? Wrench;
  const statusStyle = TASK_STATUS_STYLES[action.status];
  const riskStyle =
    RISK_BADGE_STYLES[computeTaskRisk(action.type, "medium") as RiskLevel];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Action details"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-full md:max-w-lg flex-col border-l bg-card shadow-2xl animate-in slide-in-from-right duration-200 outline-none overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b px-4 py-3 shrink-0">
          <TypeIcon
            className={cn(
              "h-5 w-5 mt-0.5 shrink-0",
              TASK_TYPE_COLORS[action.type],
            )}
          />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base leading-snug">
              {action.title}
            </h2>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge
                className={cn("text-[10px] px-1.5 py-0", riskStyle.classes)}
              >
                <Shield className="h-2.5 w-2.5 mr-0.5" />
                {riskStyle.label}
              </Badge>
              <Badge
                className={cn("text-[10px] px-1.5 py-0", statusStyle.classes)}
              >
                {action.status === "pending-approval" && (
                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                )}
                {statusStyle.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {typeInfo?.label}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 px-4 py-4 space-y-5">
          {/* Description */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              Description
            </p>
            {editingDesc ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  className="w-full rounded-md border bg-muted px-3 py-2 text-sm resize-none min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary"
                  value={descDraft}
                  rows={4}
                  onChange={(e) => setDescDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditingDesc(false);
                  }}
                />
                <div className="flex gap-2 items-center">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleSaveDesc}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setEditingDesc(false)}
                  >
                    Cancel
                  </Button>
                  <button
                    type="button"
                    title="Attach file"
                    className="ml-auto h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    onClick={() => descFileInputRef.current?.click()}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </button>
                  <input
                    ref={descFileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.txt,.md"
                    onChange={handleDescFileAttach}
                  />
                </div>
              </div>
            ) : (
              <div
                className="cursor-text hover:bg-muted/40 rounded p-1 -mx-1 transition-colors min-h-[32px]"
                onClick={() => {
                  setDescDraft(action.description ?? "");
                  setEditingDesc(true);
                }}
                title="Click to edit"
              >
                {action.description ? (
                  <MarkdownContent content={action.description} />
                ) : (
                  <p className="text-xs text-muted-foreground/40 italic">
                    Click to add description
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Payload preview */}
          {renderPayloadPreview(action)}

          {/* Rejection feedback */}
          {action.rejectionFeedback && (
            <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-3 text-xs space-y-1">
              <p className="font-medium text-orange-400">Rejection feedback</p>
              <p className="text-muted-foreground">{action.rejectionFeedback}</p>
            </div>
          )}

          {/* Linked task */}
          {action.linkedTaskId && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-400">
              <Link2 className="h-3.5 w-3.5" />
              Linked to task {action.linkedTaskId}
            </div>
          )}

          {/* Comments */}
          <Collapsible open={commentsOpen} onOpenChange={setCommentsOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 text-sm font-medium w-full text-left">
                <MessageSquare className="h-4 w-4" />
                Comments
                {localComments.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 ml-1"
                  >
                    {localComments.length}
                  </Badge>
                )}
                {commentsOpen ? (
                  <ChevronUp className="h-3.5 w-3.5 ml-auto" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 ml-auto" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-4">
              {/* Comment list */}
              {localComments.length > 0 && (
                <div className="space-y-3 divide-y divide-border/50">
                  {localComments.map((comment) => {
                    const agent = agents.find((a) => a.id === comment.author);
                    const AgentIcon = agent
                      ? getAgentIcon(agent.id, agent.icon)
                      : null;
                    return (
                      <div key={comment.id} className="pt-3 first:pt-0">
                        <div className="flex items-center gap-2 mb-1">
                          {AgentIcon && (
                            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <AgentIcon className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          <span className="text-xs font-medium">
                            {agent?.name ?? comment.author}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {new Date(comment.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <MarkdownContent content={comment.content} />
                        {comment.attachments && comment.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {comment.attachments.map((att) =>
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
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Comment input */}
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
                <Button
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  disabled={
                    !commentText.trim() && stagedFiles.length === 0
                  }
                  onClick={handleAddComment}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </aside>
    </>
  );
}
