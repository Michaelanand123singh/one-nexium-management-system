"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentsFilters, type DocumentsFiltersState } from "@/components/documents/documents-filters";
import { DocumentDetailSheet } from "@/components/documents/document-detail-sheet";
import { DocumentCreateSheet } from "@/components/documents/document-create-sheet";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

export type DocumentRow = {
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

export function DocumentsView() {
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("doc") || null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState<DocumentsFiltersState>({
    kind: "all",
    type: "",
  });

  useEffect(() => {
    setSelectedId(searchParams.get("doc"));
  }, [searchParams]);

  const setSelectedIdAndUrl = useCallback((id: string | null) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("doc", id);
    else url.searchParams.delete("doc");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  const load = useCallback(() => {
    const params: Record<string, string> = {};
    if (filters.kind !== "all") params.kind = filters.kind;
    if (filters.type) params.type = filters.type;
    setLoading(true);
    api<DocumentRow[]>("/api/documents", { params })
      .then(setDocuments)
      .catch(() => toast.error("Failed to load documents"))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageShell
      title="Documents & Library"
      description="Wiki, specs, and uploaded files. Any file uploaded in the app appears here."
      actions={
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add document
        </Button>
      }
    >
      <div className="space-y-4">
        <DocumentsFilters filters={filters} onFiltersChange={setFilters} />
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title={
              filters.kind !== "all" || filters.type
                ? "No documents match your filters"
                : "No documents"
            }
            description={
              filters.kind !== "all" || filters.type
                ? "Try clearing filters or add a new document."
                : "Create a wiki document or upload a file. Files attached to bugs or GTM assets also appear here."
            }
            action={
              filters.kind !== "all" || filters.type ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFilters({ kind: "all", type: "" })}
                >
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add document
                </Button>
              )
            }
          />
        ) : (
          <DocumentList documents={documents} onSelect={setSelectedIdAndUrl} />
        )}
      </div>
      {selectedId && (
        <DocumentDetailSheet
          id={selectedId}
          onClose={() => setSelectedIdAndUrl(null)}
          onDeleted={load}
          onUpdated={load}
        />
      )}
      <DocumentCreateSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(docs) => {
          setDocuments((prev) => [...docs, ...prev]);
          setCreateOpen(false);
        }}
      />
    </PageShell>
  );
}
