"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Role } from "@prisma/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet";
import {
  SheetDetailContent,
  SheetDetailField,
  SheetDetailList,
} from "@/components/ui/sheet-detail-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  canEditRoadmapItem,
  canSetPublicRoadmap,
  canEditRoadmap,
} from "@/lib/permissions";
import { api } from "@/lib/api";
import { toast } from "sonner";

type RoadmapDetail = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignedTeam: string | null;
  targetPhase: string | null;
  epicId: string | null;
  milestoneId: string | null;
  isPublic: boolean;
  epic?: { id: string; name: string; targetPhase: string | null } | null;
  milestone?: { id: string; name: string; targetDate: Date | null } | null;
  roadmapHistory: {
    id: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    changedAt: string;
    changedBy?: { name: string | null; email: string } | null;
  }[];
  tasks: { id: string; title: string; status: string }[];
};

export function RoadmapDetailSheet({
  id,
  role,
  phases,
  onClose,
  onUpdated,
  onDeleted,
}: {
  id: string;
  role: Role;
  phases: string[];
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [item, setItem] = useState<RoadmapDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const canEdit = item
    ? canEditRoadmapItem(role, item.assignedTeam)
    : false;
  const canSetPublic = canSetPublicRoadmap(role);
  const canDelete = canEditRoadmap(role);

  useEffect(() => {
    api<RoadmapDetail>(`/api/roadmap/${id}`)
      .then(setItem)
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleTogglePublic() {
    if (!item || !canSetPublic) return;
    try {
      await api(`/api/roadmap/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPublic: !item.isPublic }),
      });
      setItem((p) => (p ? { ...p, isPublic: !p.isPublic } : null));
      toast.success(item.isPublic ? "Removed from public" : "Marked as public");
    } catch {
      toast.error("Failed to update");
    }
  }

  async function handleDelete() {
    if (!canDelete || !confirm("Remove this roadmap item?")) return;
    try {
      await api(`/api/roadmap/${id}`, { method: "DELETE" });
      onDeleted();
    } catch {
      toast.error("Failed to delete");
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Roadmap item</SheetTitle>
        </SheetHeader>
        <SheetBody>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : item && editing ? (
            <RoadmapDetailEditForm
              item={item}
              id={id}
              role={role}
              phases={phases}
              onClose={() => setEditing(false)}
              onSaved={async () => {
                setEditing(false);
                toast.success("Saved");
                const full = await api<RoadmapDetail>(`/api/roadmap/${id}`);
                setItem(full);
                onUpdated();
              }}
            />
          ) : item ? (
            <SheetDetailContent>
              <SheetDetailField label="Title">
                <p className="font-medium">{item.title}</p>
              </SheetDetailField>
              {item.description && (
                <SheetDetailField label="Description">
                  <p className="whitespace-pre-wrap">{item.description}</p>
                </SheetDetailField>
              )}
              <div className="flex flex-wrap gap-2">
                <Badge>{item.status.replace("_", " ")}</Badge>
                <Badge variant="outline">{item.priority}</Badge>
                {item.assignedTeam && (
                  <span className="text-sm text-muted-foreground">
                    {item.assignedTeam}
                  </span>
                )}
                {item.targetPhase && (
                  <span className="text-sm text-muted-foreground">
                    {item.targetPhase}
                  </span>
                )}
                {item.epic && (
                  <span className="text-sm text-muted-foreground">
                    Epic: {item.epic.name}
                  </span>
                )}
                {item.milestone && (
                  <span className="text-sm text-muted-foreground">
                    Milestone: {item.milestone.name}
                  </span>
                )}
              </div>
              {canSetPublic && (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Public roadmap</span>
                  <Button
                    variant={item.isPublic ? "default" : "outline"}
                    size="sm"
                    onClick={handleTogglePublic}
                  >
                    {item.isPublic ? "Yes" : "No"}
                  </Button>
                </div>
              )}
              {item.tasks.length > 0 && (
                <SheetDetailList title="Linked tasks">
                  {item.tasks.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/sprint?task=${t.id}`}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {t.title}
                      </Link>
                      {" — "}
                      {t.status.replace("_", " ")}
                    </li>
                  ))}
                </SheetDetailList>
              )}
              {item.roadmapHistory.length > 0 && (
                <SheetDetailList title="Change log">
                  {item.roadmapHistory.map((h) => (
                    <li key={h.id} className="text-xs text-muted-foreground">
                      <span className="font-medium">{h.field}</span>:{" "}
                      {h.oldValue ?? "—"} → {h.newValue ?? "—"}
                      {" · "}
                      {h.changedBy?.name || h.changedBy?.email || "Someone"}{" "}
                      {new Date(h.changedAt).toLocaleString()}
                    </li>
                  ))}
                </SheetDetailList>
              )}
              {(canEdit || canDelete) && (
                <div className="flex gap-2 border-t border-border pt-4">
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(true)}
                    >
                      Edit
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="destructive" size="sm" onClick={handleDelete}>
                      Remove
                    </Button>
                  )}
                </div>
              )}
            </SheetDetailContent>
          ) : (
            <p className="text-sm text-muted-foreground">Item not found.</p>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

const STATUS_OPTIONS = ["PLANNED", "IN_PROGRESS", "SHIPPED", "CANCELLED"];
const PRIORITY_OPTIONS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const TEAM_OPTIONS = ["Product", "Engineering", "Design"];

function RoadmapDetailEditForm({
  item,
  id,
  role,
  phases,
  onClose,
  onSaved,
}: {
  item: RoadmapDetail;
  id: string;
  role: Role;
  phases: string[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const lockTeam = role === "ENGINEERING_LEAD";
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [status, setStatus] = useState(item.status);
  const [priority, setPriority] = useState(item.priority);
  const [assignedTeam, setAssignedTeam] = useState(item.assignedTeam ?? "");
  const [targetPhase, setTargetPhase] = useState(item.targetPhase ?? "");
  const [epicId, setEpicId] = useState(item.epicId ?? "");
  const [milestoneId, setMilestoneId] = useState(item.milestoneId ?? "");
  const [epics, setEpics] = useState<{ id: string; name: string }[]>([]);
  const [milestones, setMilestones] = useState<{ id: string; name: string; targetDate: Date | null }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ id: string; name: string }[]>("/api/roadmap/epics").then(setEpics).catch(() => { }),
      api<{ id: string; name: string; targetDate: Date | null }[]>("/api/roadmap/milestones").then(setMilestones).catch(() => { }),
    ]);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/api/roadmap/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          assignedTeam: assignedTeam || null,
          targetPhase: targetPhase || null,
          epicId: epicId || null,
          milestoneId: milestoneId || null,
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
        <Label htmlFor="edit-title">Title</Label>
        <Input
          id="edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="edit-desc">Description</Label>
        <textarea
          id="edit-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Status</Label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Priority</Label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Team</Label>
          <select
            value={assignedTeam}
            onChange={(e) => setAssignedTeam(e.target.value)}
            disabled={lockTeam}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">—</option>
            {TEAM_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Target phase</Label>
          <select
            value={targetPhase}
            onChange={(e) => setTargetPhase(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">No phase</option>
            {(item.targetPhase && !phases.includes(item.targetPhase)
              ? [item.targetPhase, ...phases]
              : phases
            ).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label>Epic</Label>
        <select
          value={epicId}
          onChange={(e) => setEpicId(e.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">—</option>
          {epics.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>
      <div>
        <Label>Milestone</Label>
        <select
          value={milestoneId}
          onChange={(e) => setMilestoneId(e.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">—</option>
          {milestones.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.targetDate && ` (${new Date(m.targetDate).toLocaleDateString()})`}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
