"use client";

import { useState, useEffect, useRef } from "react";
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
import {
  BUG_STATUSES,
  BUG_STATUS_LABELS,
  BUG_SEVERITIES,
  BUG_SEVERITY_LABELS,
} from "@/lib/constants";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Upload, FolderOpen, ExternalLink, Trash2 } from "lucide-react";
import { LibraryPicker, type LibraryDocumentOption } from "@/components/documents/library-picker";

type BugAttachment = { id: string; url: string; type: string; documentId: string | null };
type BugDetail = {
  id: string;
  title: string;
  description: string | null;
  stepsToReproduce: string | null;
  expectedBehaviour: string | null;
  actualBehaviour: string | null;
  severity: string;
  status: string;
  platform: string | null;
  browserDevice: string | null;
  resolutionNotes: string | null;
  closedAt: string | null;
  reporter?: { id: string; name: string | null; email: string } | null;
  assignee?: { id: string; name: string | null; email: string } | null;
  task?: { id: string; title: string; status: string; sprintId?: string | null } | null;
  attachments?: BugAttachment[];
};

export function BugDetailSheet({
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
  const [bug, setBug] = useState<BugDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [tasks, setTasks] = useState<{ id: string; title: string }[]>([]);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<BugDetail>(`/api/bugs/${id}`)
      .then(setBug)
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    api<{ id: string; title: string }[]>("/api/tasks")
      .then((r) => setTasks(Array.isArray(r) ? r.map((t) => ({ id: t.id, title: t.title })) : []))
      .catch(() => {});
  }, []);

  async function handleDelete() {
    if (!canEdit || !confirm("Remove this bug?")) return;
    try {
      await api(`/api/bugs/${id}`, { method: "DELETE" });
      onDeleted();
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files;
    if (!picked?.length || !canEdit) return;
    const files = Array.from(picked);
    e.target.value = "";
    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.set("file", file);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err.error ?? `Upload failed: ${file.name}`);
        }
        const { url } = await uploadRes.json();
        await api(`/api/bugs/${id}/attachments`, {
          method: "POST",
          body: {
            url,
            type: file.type.startsWith("image/")
              ? "image"
              : file.type.startsWith("video/")
                ? "video"
                : "file",
          },
        });
      }
      const full = await api<BugDetail>(`/api/bugs/${id}`);
      setBug(full);
      onUpdated();
      toast.success(
        files.length === 1 ? "Attachment added" : `${files.length} attachments added`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleFromLibrary(doc: LibraryDocumentOption) {
    if (!canEdit) return;
    try {
      await api(`/api/bugs/${id}/attachments`, {
        method: "POST",
        body: JSON.stringify({ url: doc.fileUrl, type: "file", documentId: doc.id }),
      });
      const full = await api<BugDetail>(`/api/bugs/${id}`);
      setBug(full);
      onUpdated();
      toast.success("Attachment added from library");
    } catch {
      toast.error("Failed to add attachment");
    }
  }

  async function handleRemoveAttachment(attachmentId: string) {
    if (!canEdit) return;
    try {
      await api(`/api/bugs/${id}/attachments/${attachmentId}`, { method: "DELETE" });
      const full = await api<BugDetail>(`/api/bugs/${id}`);
      setBug(full);
      onUpdated();
    } catch {
      toast.error("Failed to remove");
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Bug</SheetTitle>
        </SheetHeader>
        <SheetBody>
          {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : bug && editing ? (
          <BugDetailEditForm
            bug={bug}
            id={id}
            members={members}
            tasks={tasks}
            onClose={() => setEditing(false)}
            onSaved={async () => {
              setEditing(false);
              toast.success("Saved");
              const full = await api<BugDetail>(`/api/bugs/${id}`);
              setBug(full);
              onUpdated();
            }}
          />
        ) : bug ? (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Title</h3>
              <p className="mt-1 font-medium">{bug.title}</p>
            </div>
            {bug.description && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{bug.description}</p>
              </div>
            )}
            {bug.stepsToReproduce && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Steps to reproduce</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{bug.stepsToReproduce}</p>
              </div>
            )}
            {bug.expectedBehaviour && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Expected</h3>
                <p className="mt-1 text-sm">{bug.expectedBehaviour}</p>
              </div>
            )}
            {bug.actualBehaviour && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Actual</h3>
                <p className="mt-1 text-sm">{bug.actualBehaviour}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={
                  bug.severity === "CRITICAL" || bug.severity === "HIGH"
                    ? "destructive"
                    : "secondary"
                }
              >
                {BUG_SEVERITY_LABELS[bug.severity as keyof typeof BUG_SEVERITY_LABELS] ?? bug.severity}
              </Badge>
              <Badge variant="outline">
                {BUG_STATUS_LABELS[bug.status as keyof typeof BUG_STATUS_LABELS] ?? bug.status}
              </Badge>
              {bug.platform && (
                <span className="text-sm text-muted-foreground">Platform: {bug.platform}</span>
              )}
              {bug.browserDevice && (
                <span className="text-sm text-muted-foreground">Device: {bug.browserDevice}</span>
              )}
              {bug.assignee && (
                <span className="text-sm text-muted-foreground">
                  Assignee: {bug.assignee.name || bug.assignee.email}
                </span>
              )}
              {bug.reporter && (
                <span className="text-sm text-muted-foreground">
                  Reporter: {bug.reporter.name || bug.reporter.email}
                </span>
              )}
              {bug.closedAt && (
                <span className="text-sm text-muted-foreground">
                  Closed: {new Date(bug.closedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            {bug.task && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Linked task</h3>
                <Link
                  href={
                    bug.task.sprintId
                      ? `/sprint?sprint=${bug.task.sprintId}&task=${bug.task.id}`
                      : `/sprint?task=${bug.task.id}`
                  }
                  className="mt-1 text-sm text-primary underline"
                >
                  {bug.task.title} ({bug.task.status})
                </Link>
              </div>
            )}
            {bug.resolutionNotes && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Resolution notes</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{bug.resolutionNotes}</p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Attachments</h3>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => void handleFileUpload(e)}
                disabled={uploading}
              />
              {(bug.attachments?.length ?? 0) > 0 && (
                <ul className="mt-1 space-y-1">
                  {bug.attachments?.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 text-sm">
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary underline">
                        <ExternalLink className="h-3 w-3" />
                        {a.url.split("/").pop() ?? "File"}
                      </a>
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleRemoveAttachment(a.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canEdit && (
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1">
                    <Upload className="h-4 w-4" />
                    {uploading ? "Uploading…" : "Upload files"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setLibraryPickerOpen(true)} className="gap-1">
                    <FolderOpen className="h-4 w-4" />
                    From library
                  </Button>
                </div>
              )}
            </div>
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
          <p className="text-sm text-muted-foreground">Bug not found.</p>
        )}
        </SheetBody>
        <LibraryPicker
          open={libraryPickerOpen}
          onClose={() => setLibraryPickerOpen(false)}
          onSelect={handleFromLibrary}
        />
      </SheetContent>
    </Sheet>
  );
}

function BugDetailEditForm({
  bug,
  id,
  members,
  tasks,
  onClose,
  onSaved,
}: {
  bug: BugDetail;
  id: string;
  members: { id: string; name: string | null; email: string }[];
  tasks: { id: string; title: string }[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState(bug.title);
  const [description, setDescription] = useState(bug.description ?? "");
  const [stepsToReproduce, setStepsToReproduce] = useState(bug.stepsToReproduce ?? "");
  const [expectedBehaviour, setExpectedBehaviour] = useState(bug.expectedBehaviour ?? "");
  const [actualBehaviour, setActualBehaviour] = useState(bug.actualBehaviour ?? "");
  const [severity, setSeverity] = useState(bug.severity);
  const [status, setStatus] = useState(bug.status);
  const [platform, setPlatform] = useState(bug.platform ?? "");
  const [browserDevice, setBrowserDevice] = useState(bug.browserDevice ?? "");
  const [assigneeId, setAssigneeId] = useState(bug.assignee?.id ?? "");
  const [taskId, setTaskId] = useState(bug.task?.id ?? "");
  const [resolutionNotes, setResolutionNotes] = useState(bug.resolutionNotes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/api/bugs/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          stepsToReproduce: stepsToReproduce.trim() || null,
          expectedBehaviour: expectedBehaviour.trim() || null,
          actualBehaviour: actualBehaviour.trim() || null,
          severity,
          status,
          platform: platform.trim() || null,
          browserDevice: browserDevice.trim() || null,
          assignedToId: assigneeId || null,
          taskId: taskId || null,
          resolutionNotes: resolutionNotes.trim() || null,
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
      <div>
        <Label>Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1" />
      </div>
      <div>
        <Label>Description</Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <Label>Steps to reproduce</Label>
        <textarea
          value={stepsToReproduce}
          onChange={(e) => setStepsToReproduce(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <Label>Expected behaviour</Label>
        <Input
          value={expectedBehaviour}
          onChange={(e) => setExpectedBehaviour(e.target.value)}
          className="mt-1"
        />
      </div>
      <div>
        <Label>Actual behaviour</Label>
        <Input
          value={actualBehaviour}
          onChange={(e) => setActualBehaviour(e.target.value)}
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Severity</Label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {BUG_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {BUG_SEVERITY_LABELS[s]}
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
            {BUG_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BUG_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Platform</Label>
          <Input value={platform} onChange={(e) => setPlatform(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Browser / Device</Label>
          <Input value={browserDevice} onChange={(e) => setBrowserDevice(e.target.value)} className="mt-1" />
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
          <Label>Linked task</Label>
          <select
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">—</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label>Resolution notes</Label>
        <textarea
          value={resolutionNotes}
          onChange={(e) => setResolutionNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
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
