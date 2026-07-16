"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet";
import { SheetDetailContent, SheetDetailField } from "@/components/ui/sheet-detail-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_SOURCE_LABELS } from "@/lib/constants";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ExternalLink, Trash2 } from "lucide-react";

type DocumentRow = {
  id: string;
  title: string;
  content: string | null;
  type: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  sourceType: string | null;
  updatedAt: string;
};

export function DocumentDetailSheet({
  id,
  onClose,
  onDeleted,
  onUpdated,
}: {
  id: string;
  onClose: () => void;
  onDeleted: () => void;
  onUpdated: () => void;
}) {
  const [doc, setDoc] = useState<DocumentRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<DocumentRow>(`/api/documents/${id}`)
      .then(setDoc)
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!confirm("Delete this document?")) return;
    try {
      await api(`/api/documents/${id}`, { method: "DELETE" });
      onDeleted();
      onUpdated();
      onClose();
    } catch {
      toast.error("Failed to delete");
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Document</SheetTitle>
        </SheetHeader>
        <SheetBody>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : doc ? (
            <SheetDetailContent>
              <SheetDetailField label="Title">
                <div className="flex items-start gap-2">
                  {doc.fileUrl ? (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary underline"
                    >
                      {doc.title}
                    </a>
                  ) : (
                    <span className="font-medium">{doc.title}</span>
                  )}
                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      title="Open file"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </SheetDetailField>
              <div className="flex flex-wrap gap-2">
                {doc.type && (
                  <Badge variant="outline">
                    {DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] ?? doc.type}
                  </Badge>
                )}
                <Badge variant="secondary">
                  {doc.fileUrl ? "File" : "Wiki"}
                </Badge>
                {doc.sourceType && (
                  <span className="text-sm text-muted-foreground">
                    {DOCUMENT_SOURCE_LABELS[doc.sourceType] ?? doc.sourceType}
                  </span>
                )}
              </div>
              {doc.fileName && (
                <p className="text-sm text-muted-foreground">
                  File: {doc.fileName}
                  {doc.fileSize != null && ` (${(doc.fileSize / 1024).toFixed(1)} KB)`}
                </p>
              )}
              {doc.content && (
                <SheetDetailField label="Content">
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="whitespace-pre-wrap">{doc.content}</p>
                  </div>
                </SheetDetailField>
              )}
              <p className="text-xs text-muted-foreground">
                Updated {new Date(doc.updatedAt).toLocaleString()}
              </p>
              <div className="flex gap-2 border-t border-border pt-4">
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </SheetDetailContent>
          ) : (
            <p className="text-sm text-muted-foreground">Document not found.</p>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
