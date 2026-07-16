"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TASK_STATUSES, TASK_STATUS_LABELS, TASK_TYPES, TASK_TYPE_LABELS } from "@/lib/constants";
import { api } from "@/lib/api";
import { toast } from "sonner";

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  storyPoints: number | null;
  dueDate: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  assignee?: { id: string; name: string | null; email: string } | null;
  reporter?: { id: string; name: string | null; email: string } | null;
  sprint?: { id: string; name: string; status: string } | null;
  epic?: { id: string; name: string } | null;
  roadmapItem?: { id: string; title: string } | null;
  subtasks: { id: string; title: string; completed: boolean; order: number }[];
};

const PRIORITY_OPTIONS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export function TaskDetailSheet({
  id,
  canEdit,
  members,
  onClose,
  onUpdated,
  onDeleted,
}: {
  id: string;
  canEdit: boolean;
  members: { id: string; name: string | null; email: string }[];
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [sprints, setSprints] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    api<TaskDetail>(`/api/tasks/${id}`)
      .then(setTask)
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    api<{ id: string; name: string }[]>("/api/sprints").then(setSprints).catch(() => {});
  }, []);

  async function handleDelete() {
    if (!canEdit || !confirm("Remove this task?")) return;
    try {
      await api(`/api/tasks/${id}`, { method: "DELETE" });
      onDeleted();
    } catch {
      toast.error("Failed to delete");
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Task</SheetTitle>
        </SheetHeader>
        <SheetBody>
          {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : task && editing ? (
          <TaskDetailEditForm
            task={task}
            id={id}
            members={members}
            sprints={sprints}
            onClose={() => setEditing(false)}
            onSaved={async () => {
              setEditing(false);
              toast.success("Saved");
              const full = await api<TaskDetail>(`/api/tasks/${id}`);
              setTask(full);
              onUpdated();
            }}
          />
        ) : task ? (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Title</h3>
              <p className="mt-1 font-medium">{task.title}</p>
            </div>
            {task.description && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{task.description}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {TASK_TYPE_LABELS[task.type as keyof typeof TASK_TYPE_LABELS] ?? task.type}
              </Badge>
              <Badge>{TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ?? task.status}</Badge>
              <Badge variant="outline">{task.priority}</Badge>
              {task.storyPoints != null && (
                <span className="text-sm text-muted-foreground">{task.storyPoints} pts</span>
              )}
              {task.assignee && (
                <span className="text-sm text-muted-foreground">
                  Assignee: {task.assignee.name || task.assignee.email}
                </span>
              )}
              {task.sprint && (
                <span className="text-sm text-muted-foreground">Sprint: {task.sprint.name}</span>
              )}
              {task.epic && (
                <span className="text-sm text-muted-foreground">Epic: {task.epic.name}</span>
              )}
              {task.roadmapItem && (
                <Link
                  href={`/roadmap?item=${task.roadmapItem.id}`}
                  className="text-sm text-primary underline"
                >
                  Roadmap: {task.roadmapItem.title}
                </Link>
              )}
              {task.dueDate && (
                <span className="text-sm text-muted-foreground">
                  Due: {new Date(task.dueDate).toLocaleDateString()}
                </span>
              )}
              {task.isBlocked && (
                <Badge variant="destructive">
                  Blocked{task.blockedReason ? `: ${task.blockedReason}` : ""}
                </Badge>
              )}
            </div>
            {task.subtasks.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Subtasks</h3>
                <ul className="mt-2 space-y-1">
                  {task.subtasks.map((st) => (
                    <li key={st.id} className="flex items-center gap-2 text-sm">
                      <span className={st.completed ? "text-muted-foreground line-through" : ""}>
                        {st.title}
                      </span>
                      {st.completed && <Badge variant="secondary">Done</Badge>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {canEdit && (
              <div className="flex gap-2 border-t border-border pt-4">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  Remove
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Task not found.</p>
        )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function TaskDetailEditForm({
  task,
  id,
  members,
  sprints,
  onClose,
  onSaved,
}: {
  task: TaskDetail;
  id: string;
  members: { id: string; name: string | null; email: string }[];
  sprints: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [type, setType] = useState(task.type);
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [storyPoints, setStoryPoints] = useState(task.storyPoints != null ? String(task.storyPoints) : "");
  const [assigneeId, setAssigneeId] = useState(task.assignee?.id ?? "");
  const [sprintId, setSprintId] = useState(task.sprint?.id ?? "");
  const [dueDate, setDueDate] = useState(
    task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""
  );
  const [isBlocked, setIsBlocked] = useState(task.isBlocked);
  const [blockedReason, setBlockedReason] = useState(task.blockedReason ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          type,
          status,
          priority,
          storyPoints: storyPoints ? parseInt(storyPoints, 10) : null,
          assigneeId: assigneeId || null,
          sprintId: sprintId || null,
          dueDate: dueDate || null,
          isBlocked,
          blockedReason: blockedReason.trim() || null,
        }),
      });
      await onSaved();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1" />
      </div>
      <div>
        <Label>Description</Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Type</Label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {TASK_TYPES.map((t) => (
              <option key={t} value={t}>
                {TASK_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Status</Label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Priority</Label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Story points</Label>
          <Input
            type="number"
            min={0}
            value={storyPoints}
            onChange={(e) => setStoryPoints(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Assignee</Label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">—</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Sprint</Label>
          <select
            value={sprintId}
            onChange={(e) => setSprintId(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">No sprint</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label>Due date</Label>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="mt-1"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="blocked"
          checked={isBlocked}
          onChange={(e) => setIsBlocked(e.target.checked)}
        />
        <Label htmlFor="blocked">Blocked</Label>
      </div>
      {isBlocked && (
        <div>
          <Label>Blocked reason</Label>
          <Input
            value={blockedReason}
            onChange={(e) => setBlockedReason(e.target.value)}
            placeholder="Why is this blocked?"
            className="mt-1"
          />
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
