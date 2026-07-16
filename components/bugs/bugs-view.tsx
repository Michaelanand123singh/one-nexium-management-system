"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { BugList } from "@/components/bugs/bug-list";
import { BugsFilters, type BugsFiltersState } from "@/components/bugs/bugs-filters";
import { BugDetailSheet } from "@/components/bugs/bug-detail-sheet";
import { BugCreateSheet } from "@/components/bugs/bug-create-sheet";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Bug, Plus } from "lucide-react";
import { canEditBugs } from "@/lib/permissions";
import { api } from "@/lib/api";
import { toast } from "sonner";

export type BugOption = {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  reportedById: string | null;
  assignedToId: string | null;
  taskId: string | null;
  reporter?: { id: string; name: string | null; email: string } | null;
  assignee?: { id: string; name: string | null; email: string } | null;
  task?: { id: string; title: string; status: string; sprintId?: string | null } | null;
};

export function BugsView({
  role,
  organisationId,
}: {
  role: Role;
  organisationId: string;
}) {
  void organisationId;
  const searchParams = useSearchParams();
  const [bugs, setBugs] = useState<BugOption[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("bug") || null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState<BugsFiltersState>({
    status: "",
    severity: "",
    assignedToId: "",
  });
  const canEdit = canEditBugs(role);
  const hasFilters = Object.values(filters).some(Boolean);

  useEffect(() => {
    setSelectedId(searchParams.get("bug"));
  }, [searchParams]);

  const setSelectedIdAndUrl = useCallback((id: string | null) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("bug", id);
    else url.searchParams.delete("bug");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<{ id: string; name: string | null; email: string }[]>("/api/team/members")
      .then((r) => {
        if (!cancelled) setMembers(r);
      })
      .catch(() => toast.error("Failed to load"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.severity) params.severity = filters.severity;
    if (filters.assignedToId) params.assignedToId = filters.assignedToId;
    api<BugOption[]>("/api/bugs", { params })
      .then((r) => {
        if (!cancelled) setBugs(r);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load bugs");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [filters]);

  const refetchBugs = useCallback(() => {
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.severity) params.severity = filters.severity;
    if (filters.assignedToId) params.assignedToId = filters.assignedToId;
    api<BugOption[]>("/api/bugs", { params }).then(setBugs).catch(() => {});
  }, [filters]);

  if (loading && bugs.length === 0 && !hasFilters) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <PageShell
      title="Bug Tracker"
      description="Report, triage, and resolve bugs"
      actions={
        <>
          <BugsFilters filters={filters} setFilters={setFilters} members={members} />
          {canEdit && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Report bug
            </Button>
          )}
        </>
      }
    >
      {bugs.length === 0 ? (
        <EmptyState
          icon={<Bug className="h-6 w-6" />}
          title={hasFilters ? "No bugs match your filters" : "No bugs yet"}
          description={
            hasFilters
              ? "Try clearing filters or report a new bug."
              : "Report bugs to track and resolve them."
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() =>
                  setFilters({ status: "", severity: "", assignedToId: "" })
                }
              >
                Clear filters
              </Button>
            ) : canEdit ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Report first bug
              </Button>
            ) : undefined
          }
        />
      ) : (
        <BugList
          bugs={bugs}
          canEdit={canEdit}
          onSelect={setSelectedIdAndUrl}
          onUpdated={refetchBugs}
        />
      )}

      {selectedId && (
        <BugDetailSheet
          id={selectedId}
          canEdit={canEdit}
          members={members}
          onClose={() => setSelectedIdAndUrl(null)}
          onUpdated={refetchBugs}
          onDeleted={() => {
            setBugs((p) => p.filter((b) => b.id !== selectedId));
            setSelectedIdAndUrl(null);
          }}
        />
      )}

      {createOpen && canEdit && (
        <BugCreateSheet
          members={members}
          onClose={() => setCreateOpen(false)}
          onCreated={(bug) => {
            setBugs((p) => [...p, bug]);
            setCreateOpen(false);
            toast.success("Bug reported");
          }}
        />
      )}
    </PageShell>
  );
}
