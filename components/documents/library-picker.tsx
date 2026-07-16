"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { File } from "lucide-react";

export type LibraryDocumentOption = {
  id: string;
  title: string;
  fileName: string | null;
  fileUrl: string;
  mimeType: string | null;
  sourceType: string | null;
  updatedAt: string;
};

export function LibraryPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (doc: LibraryDocumentOption) => void;
}) {
  const [list, setList] = useState<LibraryDocumentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    if (!open) return;
    setLoading(true);
    const params: Record<string, string> = {};
    if (q.trim()) {
      params.q = q.trim();
    }
    api<LibraryDocumentOption[]>("/api/documents/library", { params })
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [open, q]);

  useEffect(() => {
    if (open) {
      setQ("");
      load();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [q, load]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Choose from library</SheetTitle>
        </SheetHeader>
        <SheetBody className="flex flex-col overflow-hidden">
        <Input
          placeholder="Search by name..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="shrink-0"
        />
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground">No file in library.</p>
          ) : (
            <ul className="space-y-1">
              {list.map((doc) => (
                <li key={doc.id}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-left font-normal"
                    size="sm"
                    onClick={() => {
                      onSelect(doc);
                      onClose();
                    }}
                  >
                    <File className="h-4 w-4 shrink-0" />
                    <span className="truncate">{doc.title}</span>
                    {doc.fileName && doc.fileName !== doc.title && (
                      <span className="truncate text-muted-foreground">({doc.fileName})</span>
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
