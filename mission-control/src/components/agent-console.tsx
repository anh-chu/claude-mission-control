"use client";

import { useEffect, useRef, useState } from "react";
import { useAgentStream, type StreamLine } from "@/hooks/use-agent-stream";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Square, ChevronRight, ChevronDown, Terminal, Wrench, MessageSquare, CheckCircle2, Loader2 } from "lucide-react";

interface AgentConsoleProps {
  runId: string;
  onStop?: () => void;
}

// Content block types inside assistant/user messages
interface TextBlock { type: "text"; text: string }
interface ToolUseBlock { type: "tool_use"; id: string; name: string; input: unknown }
interface ToolResultBlock { type: "tool_result"; tool_use_id: string; content: unknown }
type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | { type: string; [key: string]: unknown };

function ToolUseEntry({ block }: { block: ToolUseBlock }) {
  const [open, setOpen] = useState(false);
  const input = block.input ? JSON.stringify(block.input, null, 2) : "";
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 py-1 px-2 w-full hover:bg-muted/50 rounded text-left">
        {open ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
        <Wrench className="h-3 w-3 shrink-0 text-amber-400" />
        <span className="text-xs font-mono text-amber-400">{block.name}</span>
      </CollapsibleTrigger>
      {input && (
        <CollapsibleContent>
          <pre className="text-[10px] text-muted-foreground font-mono px-7 py-1 overflow-x-auto max-h-40">
            {input.length > 2000 ? input.slice(0, 2000) + "\n..." : input}
          </pre>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function ToolResultEntry({ block }: { block: ToolResultBlock }) {
  const [open, setOpen] = useState(false);
  const raw = typeof block.content === "string"
    ? block.content
    : JSON.stringify(block.content, null, 2);
  const hint = (() => {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return `(${raw.length} bytes JSON)`;
    const first = trimmed.split("\n")[0] ?? "";
    return first.length > 60 ? first.slice(0, 60) + "…" : first;
  })();
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 py-1 px-2 w-full hover:bg-muted/50 rounded text-left">
        {open ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
        <CheckCircle2 className="h-3 w-3 shrink-0 text-green-400" />
        <span className="text-xs font-mono text-green-400">result</span>
        {hint && !open && <span className="text-[10px] text-muted-foreground truncate max-w-[300px]">{hint}</span>}
      </CollapsibleTrigger>
      {raw && (
        <CollapsibleContent>
          <pre className="text-[10px] text-muted-foreground font-mono px-7 py-1 overflow-x-auto max-h-40">
            {raw.length > 2000 ? raw.slice(0, 2000) + "\n..." : raw}
          </pre>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function StreamEntry({ line }: { line: StreamLine }) {
  const [open, setOpen] = useState(false);

  // assistant: line.message.content[] has text/tool_use/thinking blocks
  if (line.type === "assistant") {
    const blocks = ((line.message as { content?: ContentBlock[] })?.content ?? []);
    const rendered = blocks.flatMap((block, i) => {
      if (block.type === "text") {
        const text = (block as TextBlock).text;
        if (!text?.trim()) return [];
        return [(
          <div key={i} className="flex gap-2 py-1.5 px-2">
            <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400" />
            <pre className="text-xs text-foreground/90 whitespace-pre-wrap break-words font-mono leading-relaxed">{text}</pre>
          </div>
        )];
      }
      if (block.type === "tool_use") {
        return [<ToolUseEntry key={i} block={block as ToolUseBlock} />];
      }
      // skip thinking blocks
      return [];
    });
    if (rendered.length === 0) return null;
    return <>{rendered}</>;
  }

  // user: line.message.content[] has tool_result blocks
  if (line.type === "user") {
    const blocks = ((line.message as { content?: ContentBlock[] })?.content ?? []);
    const rendered = blocks.flatMap((block, i) => {
      if (block.type === "tool_result") {
        return [<ToolResultEntry key={i} block={block as ToolResultBlock} />];
      }
      return [];
    });
    if (rendered.length === 0) return null;
    return <>{rendered}</>;
  }

  if (line.type === "result") {
    const cost = typeof line.total_cost_usd === "number" ? `$${line.total_cost_usd.toFixed(4)}` : null;
    const turns = typeof line.num_turns === "number" ? line.num_turns : null;
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 bg-muted/30 rounded">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
        <span className="text-xs text-muted-foreground">
          Session complete
          {cost && <> &middot; {cost}</>}
          {turns != null && <> &middot; {turns} turns</>}
        </span>
      </div>
    );
  }

  // Skip system events (hook lifecycle, init, etc.)
  if (line.type === "system") return null;

  // Unknown type — collapsible with content on demand
  const unknownContent = JSON.stringify(line, null, 2);
  const unknownHint = (() => {
    for (const key of ["subtype", "message", "content", "text", "error", "summary"]) {
      const val = line[key];
      if (typeof val === "string" && val.trim()) {
        const s = val.trim().split("\n")[0] ?? "";
        return s.length > 80 ? s.slice(0, 80) + "…" : s;
      }
    }
    return null;
  })();
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 py-1 px-2 w-full hover:bg-muted/50 rounded text-left opacity-60">
        {open ? <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
        <Terminal className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground font-mono">{line.type}</span>
        {unknownHint && !open && <span className="text-[10px] text-muted-foreground truncate max-w-[300px]">{unknownHint}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="text-[10px] text-muted-foreground font-mono px-7 py-1 overflow-x-auto max-h-40">
          {unknownContent.length > 2000 ? unknownContent.slice(0, 2000) + "\n..." : unknownContent}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AgentConsole({ runId, onStop }: AgentConsoleProps) {
  const { lines, isConnected, isDone } = useAgentStream(runId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      const el = scrollRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [lines.length, autoScroll]);

  // Detect manual scroll-up to disable auto-scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(isAtBottom);
  };

  const elapsed = lines.length > 0 ? `${lines.length} events` : "waiting...";

  return (
    <div className="border rounded-lg bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Live Console</span>
          {isConnected && !isDone && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-500 border-green-500/30">
              <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
              streaming
            </Badge>
          )}
          {isDone && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              done
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">{elapsed}</span>
        </div>
        {onStop && !isDone && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
            onClick={onStop}
          >
            <Square className="h-3 w-3 mr-1 fill-current" />
            Stop
          </Button>
        )}
      </div>

      {/* Stream output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-[300px] overflow-y-auto p-1 space-y-0.5"
      >
        {lines.length === 0 && !isDone && (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Waiting for agent output...
          </div>
        )}
        {lines.length === 0 && isDone && (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            No output captured
          </div>
        )}
        {lines.map((line, i) => (
          <StreamEntry key={i} line={line} />
        ))}
      </div>
    </div>
  );
}
