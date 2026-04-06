"use client";

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import type { Goal } from "@/lib/types";

interface GoalContextMenuContentProps {
  goal: Goal;
  onEdit?: (goal: Goal) => void;
  onAddMilestone?: (goalId: string) => void;
  onMarkComplete?: (goalId: string) => void;
  onDelete?: (goalId: string) => void;
}

export function GoalContextMenuContent({
  goal,
  onEdit,
  onAddMilestone,
  onMarkComplete,
  onDelete,
}: GoalContextMenuContentProps) {
  return (
    <ContextMenuContent>
      {onEdit && (
        <ContextMenuItem onClick={() => onEdit(goal)}>Edit</ContextMenuItem>
      )}

      {onAddMilestone && (
        <ContextMenuItem onClick={() => onAddMilestone(goal.id)}>
          Add Milestone
        </ContextMenuItem>
      )}

      {onMarkComplete && goal.status !== "completed" && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onMarkComplete(goal.id)}>
            Mark Complete
          </ContextMenuItem>
        </>
      )}

      {onDelete && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDelete(goal.id)}
          >
            Delete
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
}
