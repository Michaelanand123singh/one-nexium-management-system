"use client";

import { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TASK_STATUSES, TASK_STATUS_LABELS } from "@/lib/constants";
import type { TaskOption } from "@/components/sprint/sprint-view";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function SprintKanban({
  tasks,
  canEdit,
  onSelectTask,
  onStatusChange,
}: {
  tasks: TaskOption[];
  canEdit: boolean;
  onSelectTask: (id: string) => void;
  onStatusChange: () => void;
}) {
  const byStatus = useCallback(() => {
    const map: Record<string, TaskOption[]> = {};
    TASK_STATUSES.forEach((s) => (map[s] = []));
    tasks.forEach((t) => {
      const s = t.status || "BACKLOG";
      if (!map[s]) map[s] = [];
      map[s].push(t);
    });
    return map;
  }, [tasks])();

  async function handleStatusChange(taskId: string, newStatus: string) {
    if (!canEdit) return;
    try {
      await api(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success("Status updated");
      onStatusChange();
    } catch {
      toast.error("Failed to update");
    }
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-4">
        {TASK_STATUSES.map((status) => (
          <div
            key={status}
            className="flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/30"
          >
            <div className="border-b border-border px-3 py-2 text-sm font-medium">
              {TASK_STATUS_LABELS[status]}
              <span className="ml-2 text-muted-foreground">
                ({(byStatus[status] ?? []).length})
              </span>
            </div>
            <div className="flex min-h-[8rem] flex-col gap-2 p-2">
              {(byStatus[status] ?? []).map((task) => (
                <Card
                  key={task.id}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => onSelectTask(task.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium line-clamp-2">
                        {task.title}
                      </span>
                      {task.storyPoints != null && (
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs">
                          {task.storyPoints} pts
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {task.priority}
                      </Badge>
                      {task.assignee && (
                        <span className="text-xs text-muted-foreground">
                          {task.assignee.name || task.assignee.email}
                        </span>
                      )}
                      {task.isBlocked && (
                        <Badge variant="destructive" className="text-xs">
                          Blocked
                        </Badge>
                      )}
                    </div>
                    {canEdit && (
                      <select
                        className="mt-2 h-7 w-full rounded border border-input bg-background px-2 text-xs"
                        value={task.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleStatusChange(task.id, e.target.value);
                        }}
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {TASK_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
