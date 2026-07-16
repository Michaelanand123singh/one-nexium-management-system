"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { SprintKanban } from "@/components/sprint/sprint-kanban";
import { TaskDetailSheet } from "@/components/sprint/task-detail-sheet";
import { TaskCreateSheet } from "@/components/sprint/task-create-sheet";
import { SprintCreateSheet } from "@/components/sprint/sprint-create-sheet";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Kanban, Plus, Calendar } from "lucide-react";
import { canEditSprint } from "@/lib/permissions";
import { api } from "@/lib/api";
import { toast } from "sonner";

export type SprintOption = {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  startDate: string;
  endDate: string;
};

export type TaskOption = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  storyPoints: number | null;
  sprintId: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  assignee?: { id: string; name: string | null; email: string } | null;
  sprint?: { id: string; name: string } | null;
  epic?: { id: string; name: string } | null;
  roadmapItem?: { id: string; title: string } | null;
};

const BACKLOG_ID = "__backlog__";

export function SprintView({
  role,
  organisationId,
}: {
  role: Role;
  organisationId: string;
}) {
  void organisationId;
  const searchParams = useSearchParams();
  const [sprints, setSprints] = useState<SprintOption[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sprintId, setSprintId] = useState<string | null>(() => searchParams.get("sprint") || null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(() => searchParams.get("task") || null);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createSprintOpen, setCreateSprintOpen] = useState(false);
  const canEdit = canEditSprint(role);

  const setSprintAndUrl = useCallback((id: string | null) => {
    setSprintId(id);
    const url = new URL(window.location.href);
    if (id && id !== BACKLOG_ID) url.searchParams.set("sprint", id);
    else url.searchParams.delete("sprint");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  const setSelectedTaskAndUrl = useCallback((id: string | null) => {
    setSelectedTaskId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("task", id);
    else url.searchParams.delete("task");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  useEffect(() => {
    setSelectedTaskId(searchParams.get("task"));
    const s = searchParams.get("sprint");
    setSprintId(s || null);
    if (searchParams.get("new") === "task" && canEditSprint(role)) {
      setCreateTaskOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [searchParams, role]);

  // Resolve sprint from task deep-link when ?task= is set without ?sprint=
  useEffect(() => {
    const taskId = searchParams.get("task");
    const sprintParam = searchParams.get("sprint");
    if (!taskId || sprintParam) return;
    let cancelled = false;
    api<{ sprintId: string | null }>(`/api/tasks/${taskId}`)
      .then((task) => {
        if (cancelled || !task.sprintId) return;
        setSprintAndUrl(task.sprintId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [searchParams, setSprintAndUrl]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<SprintOption[]>("/api/sprints").then((r) => {
        if (!cancelled) {
          setSprints(r);
          if (!sprintId && r.length > 0) {
            const active = r.find((s) => s.status === "ACTIVE") ?? r[0];
            setSprintAndUrl(active.id);
          }
        }
      }),
      api<{ id: string; name: string | null; email: string }[]>("/api/team/members").then((r) => {
        if (!cancelled) setMembers(r);
      }),
    ]).catch(() => toast.error("Failed to load")).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sprintId) {
      setTasks([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    if (sprintId === BACKLOG_ID) {
      api<TaskOption[]>("/api/tasks")
        .then((r) => {
          if (!cancelled) setTasks(r.filter((t) => !t.sprintId));
        })
        .catch(() => {
          if (!cancelled) toast.error("Failed to load tasks");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      api<TaskOption[]>("/api/tasks", { params: { sprintId } })
        .then((r) => {
          if (!cancelled) setTasks(r);
        })
        .catch(() => {
          if (!cancelled) toast.error("Failed to load tasks");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => { cancelled = true; };
  }, [sprintId]);

  const refetchTasks = useCallback(() => {
    if (!sprintId) return;
    if (sprintId === BACKLOG_ID) {
      api<TaskOption[]>("/api/tasks").then((r) => setTasks(r.filter((t) => !t.sprintId))).catch(() => {});
    } else {
      api<TaskOption[]>("/api/tasks", { params: { sprintId } }).then(setTasks).catch(() => {});
    }
  }, [sprintId]);

  const refetchSprints = useCallback(() => {
    api<SprintOption[]>("/api/sprints").then(setSprints).catch(() => {});
  }, []);

  const currentSprint = sprintId && sprintId !== BACKLOG_ID ? sprints.find((s) => s.id === sprintId) : null;
  const velocity = currentSprint
    ? tasks.filter((t) => t.status === "DONE").reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
    : 0;
  const totalPoints = currentSprint ? tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0) : 0;

  if (loading && sprints.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <PageShell
      title="Sprint Board"
      description="Kanban board, velocity, and sprint backlog"
      actions={
        <>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={sprintId ?? ""}
            onChange={(e) => setSprintAndUrl(e.target.value || null)}
          >
            <option value="">Select sprint</option>
            <option value={BACKLOG_ID}>Backlog (no sprint)</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status})
              </option>
            ))}
          </select>
          {currentSprint && (
            <Card className="border-border">
              <CardContent className="flex items-center gap-4 py-2 pl-4 pr-4">
                <span className="text-sm text-muted-foreground">
                  Done: <strong>{velocity}</strong> pts
                </span>
                <span className="text-sm text-muted-foreground">
                  Total: <strong>{totalPoints}</strong> pts
                </span>
              </CardContent>
            </Card>
          )}
          {canEdit && (
            <>
              <Button size="sm" variant="outline" onClick={() => setCreateSprintOpen(true)}>
                <Calendar className="mr-2 h-4 w-4" />
                New sprint
              </Button>
              <Button
                size="sm"
                onClick={() => setCreateTaskOpen(true)}
                disabled={!sprintId}
              >
                <Plus className="mr-2 h-4 w-4" />
                New task
              </Button>
            </>
          )}
        </>
      }
    >
      {!sprintId ? (
        <EmptyState
          icon={<Kanban className="h-6 w-6" />}
          title="Select a sprint"
          description="Choose a sprint from the dropdown above to view and manage tasks, or create a new sprint."
          action={
            canEdit ? (
              <Button onClick={() => setCreateSprintOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create sprint
              </Button>
            ) : undefined
          }
        />
      ) : loading && tasks.length === 0 ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <SprintKanban
          tasks={tasks}
          canEdit={canEdit}
          onSelectTask={setSelectedTaskAndUrl}
          onStatusChange={refetchTasks}
        />
      )}

      {selectedTaskId && (
        <TaskDetailSheet
          id={selectedTaskId}
          canEdit={canEdit}
          members={members}
          onClose={() => setSelectedTaskAndUrl(null)}
          onUpdated={refetchTasks}
          onDeleted={() => {
            setTasks((p) => p.filter((t) => t.id !== selectedTaskId));
            setSelectedTaskAndUrl(null);
          }}
        />
      )}

      {createTaskOpen && canEdit && (
        <TaskCreateSheet
          sprintId={sprintId === BACKLOG_ID ? null : sprintId}
          sprints={sprints.filter((s) => s.id !== BACKLOG_ID)}
          members={members}
          onClose={() => setCreateTaskOpen(false)}
          onCreated={(task) => {
            const viewSprint = sprintId === BACKLOG_ID ? null : sprintId;
            if ((task.sprintId ?? null) === viewSprint) {
              setTasks((p) => [...p, task]);
            } else if (task.sprintId) {
              setSprintAndUrl(task.sprintId);
            }
            setCreateTaskOpen(false);
            toast.success("Task created");
          }}
        />
      )}

      {createSprintOpen && canEdit && (
        <SprintCreateSheet
          onClose={() => setCreateSprintOpen(false)}
          onCreated={() => {
            setCreateSprintOpen(false);
            refetchSprints();
            toast.success("Sprint created");
          }}
        />
      )}
    </PageShell>
  );
}