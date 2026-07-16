"use client";

import { useState, useEffect } from "react";
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
} from "@/components/ui/sheet-detail-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { toast } from "sonner";

type BacklogDetail = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  source: string;
  priorityScore: number | null;
  status: string;
  effortEstimate: string | null;
  epic?: { id: string; name: string } | null;
  sprint?: { id: string; name: string } | null;
  featureRequest?: { id: string; status: string; votes: number } | null;
};

type EpicType = { id: string; name: string };
type SprintOption = { id: string; name: string; status: string };

const STATUS_OPTIONS = ["NEW", "REFINED", "GROOMED", "IN_SPRINT", "DONE", "REJECTED"];
const TYPE_OPTIONS = ["FEATURE", "IMPROVEMENT", "TECH_DEBT", "RESEARCH"];
const SOURCE_OPTIONS = ["INTERNAL", "CUSTOMER_FEEDBACK", "PARTNER_REQUEST", "COMPETITOR_ANALYSIS"];

export function BacklogDetailSheet({
  id,
  canEdit,
  epics,
  onClose,
  onUpdated,
  onDeleted,
}: {
  id: string;
  canEdit: boolean;
  epics: EpicType[];
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [item, setItem] = useState<BacklogDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [sprints, setSprints] = useState<SprintOption[]>([]);

  useEffect(() => {
    api<BacklogDetail>(`/api/backlog/${id}`)
      .then(setItem)
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    api<SprintOption[]>("/api/sprints").then(setSprints).catch(() => {});
  }, []);

  async function handleDelete() {
    if (!canEdit || !confirm("Remove this backlog item?")) return;
    try {
      await api(`/api/backlog/${id}`, { method: "DELETE" });
      onDeleted();
    } catch {
      toast.error("Failed to delete");
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Backlog item</SheetTitle>
        </SheetHeader>
        <SheetBody>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : item && editing ? (
            <BacklogDetailEditForm
              item={item}
              id={id}
              epics={epics}
              sprints={sprints}
              onClose={() => setEditing(false)}
              onSaved={async () => {
                setEditing(false);
                toast.success("Saved");
                const full = await api<BacklogDetail>(`/api/backlog/${id}`);
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
                <Badge variant="secondary">{item.type.replace("_", " ")}</Badge>
                <Badge variant="outline">{item.source.replace("_", " ")}</Badge>
                <Badge>{item.status.replace("_", " ")}</Badge>
                {item.priorityScore != null && (
                  <span className="text-sm text-muted-foreground">
                    Priority: {item.priorityScore}
                  </span>
                )}
                {item.effortEstimate && (
                  <span className="text-sm text-muted-foreground">
                    Effort: {item.effortEstimate}
                  </span>
                )}
                {item.epic && (
                  <span className="text-sm text-muted-foreground">Epic: {item.epic.name}</span>
                )}
                {item.sprint && (
                  <span className="text-sm text-muted-foreground">Sprint: {item.sprint.name}</span>
                )}
              </div>
              {item.featureRequest && (
                <SheetDetailField label="Linked feature request">
                  <p>
                    Votes: {item.featureRequest.votes} · Status: {item.featureRequest.status}
                  </p>
                </SheetDetailField>
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
            </SheetDetailContent>
          ) : (
            <p className="text-sm text-muted-foreground">Item not found.</p>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function BacklogDetailEditForm({
  item,
  id,
  epics,
  sprints,
  onClose,
  onSaved,
}: {
  item: BacklogDetail;
  id: string;
  epics: EpicType[];
  sprints: SprintOption[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description ?? "");
  const [type, setType] = useState(item.type);
  const [source, setSource] = useState(item.source);
  const [status, setStatus] = useState(item.status);
  const [priorityScore, setPriorityScore] = useState(
    item.priorityScore != null ? String(item.priorityScore) : ""
  );
  const [effortEstimate, setEffortEstimate] = useState(item.effortEstimate ?? "");
  const [epicId, setEpicId] = useState(item.epic?.id ?? "");
  const [sprintId, setSprintId] = useState(item.sprint?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/api/backlog/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          type,
          source,
          status,
          priorityScore: priorityScore ? Number(priorityScore) : null,
          effortEstimate: effortEstimate || null,
          epicId: epicId || null,
          sprintId: sprintId || null,
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
        <Label htmlFor="bl-edit-title">Title</Label>
        <Input
          id="bl-edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="bl-edit-desc">Description</Label>
        <textarea
          id="bl-edit-desc"
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
            {TYPE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Source</Label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
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
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Priority score</Label>
          <Input
            type="number"
            step="0.1"
            value={priorityScore}
            onChange={(e) => setPriorityScore(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <Label>Effort estimate</Label>
        <Input
          value={effortEstimate}
          onChange={(e) => setEffortEstimate(e.target.value)}
          placeholder="e.g. 3 points, M"
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Epic</Label>
          <select
            value={epicId}
            onChange={(e) => setEpicId(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">—</option>
            {epics.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
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
