"use client";

import { useState, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from "@/lib/constants";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Upload, X, FileText } from "lucide-react";

type DocumentOption = {
  id: string;
  title: string;
  content: string | null;
  type: string | null;
  folderId: string | null;
  isFolder: boolean;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  sourceType: string | null;
  sourceId: string | null;
  updatedAt: string;
};

export function DocumentCreateSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (docs: DocumentOption[]) => void;
}) {
  const [mode, setMode] = useState<"wiki" | "file">("wiki");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = Array.from(list);
    setFiles((prev) => {
      const names = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...next.filter((f) => !names.has(`${f.name}:${f.size}`))];
    });
  }

  async function uploadOne(file: File, customTitle: string | null) {
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
    if (!url || typeof url !== "string") {
      throw new Error(`Upload succeeded but no URL for ${file.name}`);
    }
    return api<DocumentOption>("/api/documents", {
      method: "POST",
      body: {
        title: customTitle || file.name,
        fileUrl: url,
        fileName: file.name,
        mimeType: file.type || null,
        fileSize: file.size,
        sourceType: "library",
        type: type || null,
      },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "wiki" && !title.trim()) return;
    if (mode === "file" && files.length === 0) {
      toast.error("Select at least one file");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "file") {
        const created: DocumentOption[] = [];
        // Single file can use optional title override; multi uses each file name
        const titleOverride =
          files.length === 1 && title.trim() ? title.trim() : null;
        for (const file of files) {
          created.push(await uploadOne(file, titleOverride));
        }
        onCreated(created);
        toast.success(
          created.length === 1
            ? "Document uploaded"
            : `${created.length} documents uploaded`
        );
      } else {
        const doc = await api<DocumentOption>("/api/documents", {
          method: "POST",
          body: {
            title: title.trim(),
            content: content.trim() || null,
            type: type || null,
            sourceType: "library",
          },
        });
        onCreated([doc]);
        toast.success("Document created");
      }
      setTitle("");
      setContent("");
      setType("");
      setFiles([]);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add document</SheetTitle>
        </SheetHeader>
        <SheetBody>
          <div className="flex gap-2 border-b border-border py-2">
            <Button
              type="button"
              variant={mode === "wiki" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMode("wiki")}
            >
              Wiki / Note
            </Button>
            <Button
              type="button"
              variant={mode === "file" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMode("file")}
            >
              Upload files
            </Button>
          </div>
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 flex flex-col gap-4">
            <div>
              <Label>Title {mode === "wiki" ? "*" : "(optional)"}</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  mode === "file"
                    ? files.length > 1
                      ? "Ignored when uploading multiple (each file keeps its name)"
                      : "Optional (defaults to file name)"
                    : "Document title"
                }
                className="mt-1"
                required={mode === "wiki"}
              />
            </div>
            {mode === "wiki" && (
              <div>
                <Label>Content (optional)</Label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Markdown or plain text"
                  className="mt-1 min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={5}
                />
              </div>
            )}
            {mode === "file" && (
              <div>
                <Label>Files</Label>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Select one or more files. Each becomes its own library document.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="mt-1 hidden"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {files.length ? "Add more files" : "Choose files"}
                </Button>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {files.map((f) => (
                      <li
                        key={`${f.name}-${f.size}-${f.lastModified}`}
                        className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2 py-1.5 text-sm"
                      >
                        <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() =>
                            setFiles((prev) =>
                              prev.filter(
                                (x) =>
                                  !(
                                    x.name === f.name &&
                                    x.size === f.size &&
                                    x.lastModified === f.lastModified
                                  )
                              )
                            )
                          }
                          aria-label={`Remove ${f.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div>
              <Label>Type (optional)</Label>
              <Select value={type || "none"} onValueChange={(v) => setType(v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {DOCUMENT_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 border-t border-border pt-4">
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting
                  ? "Creating…"
                  : mode === "file" && files.length > 1
                    ? `Upload ${files.length} files`
                    : "Create"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
