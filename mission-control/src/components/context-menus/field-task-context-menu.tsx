"use client";

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import type { FieldTask } from "@/lib/types";

interface FieldTaskContextMenuContentProps {
  task: FieldTask;
  onOpen?: (task: FieldTask) => void;
  onEdit?: (task: FieldTask) => void;
  onDelete?: (taskId: string) => void;
}

export function FieldTaskContextMenuContent({
  task,
  onOpen,
  onEdit,
  onDelete,
}: FieldTaskContextMenuContentProps) {
  return (
    <ContextMenuContent>
      {onOpen && (
        <ContextMenuItem onClick={() => onOpen(task)}>Open detail</ContextMenuItem>
      )}

      {onEdit && (
        <>
          {onOpen && <ContextMenuSeparator />}
          <ContextMenuItem onClick={() => onEdit(task)}>Edit</ContextMenuItem>
        </>
      )}

      {onDelete && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDelete(task.id)}
          >
            Delete
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
}
