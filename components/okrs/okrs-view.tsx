"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { OkrList } from "@/components/okrs/okr-list";
import { OkrsFilters, type OkrsFiltersState } from "@/components/okrs/okrs-filters";
import { OkrDetailSheet } from "@/components/okrs/okr-detail-sheet";
import { OkrCreateSheet } from "@/components/okrs/okr-create-sheet";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Plus } from "lucide-react";
import { canEditOkrs } from "@/lib/permissions";
import { usePhase } from "@/lib/phase-context";
import { api } from "@/lib/api";
import { toast } from "sonner";

export type OkrOption = {
  id: string;
  objective: string;
  period: string;
  level: string;
  ownerId: string;
  parentOkrId: string | null;
  owner?: { id: string; name: string | null; email: string } | null;
  parentOkr?: { id: string; objective: string; period: string } | null;
  _count?: { keyResults: number };
};

export function OkrsView({
  role,
  organisationId,
}: {
  role: Role;
  organisationId: string;
}) {
  void organisationId;
  const { selectedPhase } = usePhase();
  const searchParams = useSearchParams();
  const [okrs, setOkrs] = useState<OkrOption[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("okr") || null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState<OkrsFiltersState>({
    period: "",
    level: "",
    ownerId: "",
  });
  const canEdit = canEditOkrs(role);
  const hasFilters = Object.values(filters).some(Boolean);

  useEffect(() => {
    setSelectedId(searchParams.get("okr"));
  }, [searchParams]);

  const setSelectedIdAndUrl = useCallback((id: string | null) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("okr", id);
    else url.searchParams.delete("okr");
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
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params: Record<string, string> = {};
    const period = filters.period || selectedPhase;
    if (period) params.period = period;
    if (filters.level) params.level = filters.level;
    if (filters.ownerId) params.ownerId = filters.ownerId;
    api<OkrOption[]>("/api/okrs", { params })
      .then((r) => {
        if (!cancelled) setOkrs(r);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load OKRs");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, selectedPhase]);

  const refetchOkrs = useCallback(() => {
    const params: Record<string, string> = {};
    if (filters.period) params.period = filters.period;
    if (filters.level) params.level = filters.level;
    if (filters.ownerId) params.ownerId = filters.ownerId;
    api<OkrOption[]>("/api/okrs", { params }).then(setOkrs).catch(() => {});
  }, [filters]);

  if (loading && okrs.length === 0 && !hasFilters) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <PageShell
      title="OKR & Goals"
      description="Company, team, and individual OKRs"
      actions={
        <>
          <OkrsFilters filters={filters} setFilters={setFilters} members={members} />
          {canEdit && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add OKR
            </Button>
          )}
        </>
      }
    >
      {okrs.length === 0 ? (
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title={hasFilters ? "No OKRs match your filters" : "No OKRs yet"}
          description={
            hasFilters
              ? "Try clearing filters or add a new OKR."
              : "Add company, team, or individual objectives and key results."
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() =>
                  setFilters({ period: "", level: "", ownerId: "" })
                }
              >
                Clear filters
              </Button>
            ) : canEdit ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add first OKR
              </Button>
            ) : undefined
          }
        />
      ) : (
        <OkrList okrs={okrs} onSelect={setSelectedIdAndUrl} />
      )}

      {selectedId && (
        <OkrDetailSheet
          id={selectedId}
          canEdit={canEdit}
          members={members}
          onClose={() => setSelectedIdAndUrl(null)}
          onUpdated={refetchOkrs}
          onDeleted={() => {
            setOkrs((p) => p.filter((o) => o.id !== selectedId));
            setSelectedIdAndUrl(null);
          }}
        />
      )}

      {createOpen && canEdit && (
        <OkrCreateSheet
          members={members}
          onClose={() => setCreateOpen(false)}
          onCreated={(okr) => {
            setOkrs((p) => [...p, okr]);
            setCreateOpen(false);
            toast.success("OKR added");
          }}
        />
      )}
    </PageShell>
  );
}
