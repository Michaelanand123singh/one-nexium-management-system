"use client";

import { useEffect, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type {
  PlanningBucketDTO,
  PlanningCardDTO,
  PlanningCardAttachmentDTO,
} from "@/components/planning/types";
import { PlanningNotesEditor } from "@/components/planning/planning-notes-editor";
import {
  emptyPlanningNotesDoc,
  isValidTipTapDoc,
  plainTextToTipTapDoc,
} from "@/lib/planning-notes";
import { uploadFileViaApi } from "@/lib/planning-upload-client";
import { Paperclip, X, FileText, ExternalLink, Loader2 } from "lucide-react";

type TaskOption = { id: string; title: string };

/** Uploaded to MinIO but not yet linked to a card (new-card flow). */
type PendingUpload = {
  localId: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number;
  url: string;
};

function cardToInitialNotes(card: PlanningCardDTO | null): JSONContent {
  if (card?.notesJson != null && isValidTipTapDoc(card.notesJson)) {
    return card.notesJson as JSONContent;
  }
  if (card?.description?.trim()) {
    return plainTextToTipTapDoc(card.description) as JSONContent;
  }
  return emptyPlanningNotesDoc() as JSONContent;
}

export function PlanningCardFormSheet({
  open,
  onOpenChange,
  buckets,
  defaultBucketId,
  card,
  taskOptions,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buckets: PlanningBucketDTO[];
  defaultBucketId: string | null;
  card: PlanningCardDTO | null;
  taskOptions: TaskOption[];
  onSaved: () => void | Promise<void>;
  onDeleted?: () => void | Promise<void>;
}) {
  const [editorKey, setEditorKey] = useState(0);
  const [title, setTitle] = useState("");
  const [notesJson, setNotesJson] = useState<JSONContent>(
    () => emptyPlanningNotesDoc() as JSONContent
  );
  const [bucketId, setBucketId] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [taskId, setTaskId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<PlanningCardAttachmentDTO[]>([]);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

  // Reset only when the sheet opens / switches card — not on unrelated board refreshes
  // (those were wiping the file queue and looking like "click does nothing").
  useEffect(() => {
    if (!open) return;
    setEditorKey((k) => k + 1);
    setUploadError(null);
    setPendingUploads([]);
    if (card) {
      setTitle(card.title);
      setNotesJson(cardToInitialNotes(card));
      setBucketId(card.bucketId);
      setPlannedDate(card.plannedDate ? card.plannedDate.slice(0, 10) : "");
      setTaskId(card.taskId ?? "");
      setAttachments(card.attachments ?? []);
    } else {
      setTitle("");
      setNotesJson(emptyPlanningNotesDoc() as JSONContent);
      setBucketId(defaultBucketId ?? buckets[0]?.id ?? "");
      setPlannedDate("");
      setTaskId("");
      setAttachments([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional open/card id only
  }, [open, card?.id]);

  async function removeAttachment(id: string) {
    try {
      await api(`/api/planning/attachments/${id}`, { method: "DELETE" });
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      await onSaved();
      toast.success("Attachment removed");
    } catch {
      toast.error("Failed to remove file");
    }
  }

  async function linkAttachments(
    cardId: string,
    items: Array<{
      url: string;
      fileName: string;
      mimeType: string | null;
      fileSize: number;
    }>
  ) {
    const created: PlanningCardAttachmentDTO[] = [];
    for (const item of items) {
      const row = await api<PlanningCardAttachmentDTO>(
        `/api/planning/cards/${cardId}/attachments`,
        {
          method: "POST",
          body: {
            url: item.url,
            fileName: item.fileName,
            mimeType: item.mimeType,
            fileSize: item.fileSize,
          },
        }
      );
      created.push(row);
    }
    return created;
  }

  async function handlePickFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const picked = Array.from(fileList);
    setUploadError(null);
    setUploading(true);

    try {
      // Always upload to MinIO first so the user sees immediate feedback
      const uploaded: PendingUpload[] = [];
      for (const file of picked) {
        const { url } = await uploadFileViaApi(file);
        uploaded.push({
          localId: crypto.randomUUID(),
          fileName: file.name,
          mimeType: file.type || null,
          fileSize: file.size,
          url,
        });
      }

      if (card?.id) {
        const created = await linkAttachments(
          card.id,
          uploaded.map((u) => ({
            url: u.url,
            fileName: u.fileName,
            mimeType: u.mimeType,
            fileSize: u.fileSize,
          }))
        );
        setAttachments((prev) => {
          const seen = new Set(prev.map((a) => a.id));
          return [...prev, ...created.filter((a) => !seen.has(a.id))];
        });
        await onSaved();
        toast.success(
          picked.length === 1 ? "File uploaded" : `${picked.length} files uploaded`
        );
      } else {
        setPendingUploads((p) => [...p, ...uploaded]);
        toast.success(
          picked.length === 1
            ? "File ready — click Create at the bottom"
            : `${picked.length} files ready — click Create at the bottom`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!card) return;
    if (!confirm(`Delete “${card.title}”? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api(`/api/planning/cards/${card.id}`, { method: "DELETE" });
      toast.success("Card deleted");
      await onDeleted?.();
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete card");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !bucketId) return;
    setSubmitting(true);
    setUploadError(null);
    const uploadQueue = [...pendingUploads];
    try {
      const notesPayload = isValidTipTapDoc(notesJson)
        ? notesJson
        : emptyPlanningNotesDoc();

      if (card) {
        await api<PlanningCardDTO>(`/api/planning/cards/${card.id}`, {
          method: "PATCH",
          body: {
            title: title.trim(),
            notesJson: notesPayload,
            bucketId,
            plannedDate: plannedDate || null,
            taskId: taskId || null,
          },
        });
        toast.success("Card updated");
      } else {
        const created = await api<PlanningCardDTO>("/api/planning/cards", {
          method: "POST",
          body: {
            title: title.trim(),
            notesJson: notesPayload,
            bucketId,
            plannedDate: plannedDate || null,
            taskId: taskId || null,
          },
        });
        if (uploadQueue.length) {
          await linkAttachments(
            created.id,
            uploadQueue.map((u) => ({
              url: u.url,
              fileName: u.fileName,
              mimeType: u.mimeType,
              fileSize: u.fileSize,
            }))
          );
          setPendingUploads([]);
        }
        toast.success("Card created");
      }
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : null;
      setUploadError(msg);
      toast.error(msg || (card ? "Failed to update" : "Failed to create"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="flex w-full flex-col sm:max-w-2xl"
        // OS file dialog steals focus; without this, Radix closes/resets the sheet
        // and the pick looks like it "did nothing".
        onFocusOutside={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle>{card ? "Edit planning card" : "New planning card"}</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <SheetBody className="overflow-y-auto">
            <div className="flex flex-col gap-5">
            <div>
              <Label htmlFor="pc-title">Title</Label>
              <Input
                id="pc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to happen?"
                required
                className="mt-1"
              />
            </div>

            <section className="rounded-md border border-border bg-muted/10 p-3">
              <Label className="text-base">Attachments</Label>
              <p className="text-muted-foreground mt-1 text-xs">
                Stored on MinIO.
                {card
                  ? " Pick a file — it uploads and attaches immediately."
                  : " Pick a file — it uploads now; then click Create at the bottom."}
              </p>

              {uploadError && (
                <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {uploadError}
                </div>
              )}

              <ul className="mt-3 space-y-2">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{a.fileName}</span>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      title="Open"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => void removeAttachment(a.id)}
                      aria-label="Remove attachment"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
                {pendingUploads.map((pf) => (
                  <li
                    key={pf.localId}
                    className="flex items-center gap-2 rounded-md border border-dashed border-primary/40 bg-background px-2 py-1.5 text-sm"
                  >
                    <Paperclip className="text-primary h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-medium">{pf.fileName}</span>
                    <span className="text-primary shrink-0 text-xs">Ready</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        setPendingUploads((p) => p.filter((x) => x.localId !== pf.localId))
                      }
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>

              {attachments.length === 0 && pendingUploads.length === 0 && !uploading && (
                <p className="text-muted-foreground mt-2 text-xs italic">No files yet.</p>
              )}

              <div className="mt-3 flex flex-col gap-2">
                <Label htmlFor="pc-files" className="text-muted-foreground text-xs font-normal">
                  {uploading ? "Uploading…" : "Select files"}
                </Label>
                <input
                  id="pc-files"
                  type="file"
                  multiple
                  disabled={uploading || submitting}
                  className="block w-full cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50"
                  onChange={(e) => {
                    const list = e.target.files;
                    const copy = list?.length ? Array.from(list) : null;
                    e.target.value = "";
                    if (!copy?.length) return;
                    const dt = new DataTransfer();
                    copy.forEach((f) => dt.items.add(f));
                    void handlePickFiles(dt.files);
                  }}
                />
                {uploading && (
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Uploading to MinIO…
                  </div>
                )}
              </div>
            </section>

            <div>
              <Label>Notes</Label>
              <p className="text-muted-foreground text-xs">
                Rich text, lists, links, and inline images.
              </p>
              <div className="mt-1 overflow-hidden rounded-md border border-border">
                <PlanningNotesEditor
                  key={editorKey}
                  value={notesJson}
                  onChange={setNotesJson}
                  disabled={submitting || uploading}
                  onImageUpload={async (file) => {
                    try {
                      const { url } = await uploadFileViaApi(file);
                      return url;
                    } catch (err) {
                      const msg =
                        err instanceof Error ? err.message : "Image upload failed";
                      setUploadError(msg);
                      toast.error(msg);
                      return null;
                    }
                  }}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="pc-bucket">Bucket</Label>
              <select
                id="pc-bucket"
                value={bucketId}
                onChange={(e) => setBucketId(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {buckets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="pc-date">Planned day (optional)</Label>
              <Input
                id="pc-date"
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="pc-task">Link sprint task (optional)</Label>
              <select
                id="pc-task"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— None —</option>
                {taskOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            </div>
          </SheetBody>
          <SheetFooter className="shrink-0 gap-2 sm:justify-between">
            {card ? (
              <Button
                type="button"
                variant="destructive"
                disabled={submitting || uploading || deleting}
                onClick={() => void handleDelete()}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || uploading || deleting}>
                {submitting ? "Saving…" : card ? "Save" : "Create"}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
