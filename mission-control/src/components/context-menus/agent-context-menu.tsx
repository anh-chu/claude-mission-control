"use client";

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import type { AgentDefinition } from "@/lib/types";

interface AgentContextMenuContentProps {
  agent: AgentDefinition;
  href: string;
  onEdit?: (agentId: string) => void;
  onNewTask?: (agentId: string) => void;
  onToggleStatus?: (agentId: string, currentStatus: AgentDefinition["status"]) => void;
}

export function AgentContextMenuContent({
  agent,
  href,
  onEdit,
  onNewTask,
  onToggleStatus,
}: AgentContextMenuContentProps) {
  return (
    <ContextMenuContent>
      <ContextMenuItem onClick={() => window.open(href, "_blank")}>
        Open in New Tab
      </ContextMenuItem>

      {onEdit && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onEdit(agent.id)}>Edit agent</ContextMenuItem>
        </>
      )}

      {onNewTask && (
        <ContextMenuItem onClick={() => onNewTask(agent.id)}>
          New task for agent
        </ContextMenuItem>
      )}

      {onToggleStatus && (
        <>
          <ContextMenuSeparator />
          {agent.status === "active" ? (
            <ContextMenuItem onClick={() => onToggleStatus(agent.id, agent.status)}>
              Deactivate
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onClick={() => onToggleStatus(agent.id, agent.status)}>
              Activate
            </ContextMenuItem>
          )}
        </>
      )}
    </ContextMenuContent>
  );
}
