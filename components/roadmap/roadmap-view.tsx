"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline";
import { RoadmapList } from "@/components/roadmap/roadmap-list";
import { RoadmapDetailSheet } from "@/components/roadmap/roadmap-detail-sheet";
import { RoadmapFilters } from "@/components/roadmap/roadmap-filters";
import { RoadmapCreateSheet } from "@/components/roadmap/roadmap-create-sheet";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Map, List, Plus, Download } from "lucide-react";
import { canEditRoadmap } from "@/lib/permissions";
import { usePhase } from "@/lib/phase-context";
import { api } from "@/lib/api";
import { toast } from "sonner";

export type RoadmapItem = {
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
  epic?: { id: string; name: string } | null;
  milestone?: { id: string; name: string; targetDate: Date | null } | null;
};

export type RoadmapFiltersState = {
  phase: string;
  status: string;
  priority: string;
  team: string;
  epicId: string;
};

import { PHASES } from "@/lib/constants";

export function RoadmapView({
  role,
  organisationId,
}: {
  role: Role;
  organisationId: string;
}) {
  void organisationId; // org-scoped API calls use session
  const { phases: orgPhases, selectedPhase } = usePhase();
  const searchParams = useSearchParams();
  const [view, setView] = useState<"timeline" | "list">("timeline");
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [milestones, setMilestones] = useState<{ id: string; name: string; targetDate: Date | null }[]>([]);
  const [epics, setEpics] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<RoadmapFiltersState>({
    phase: "",
    status: "",
    priority: "",
    team: "",
    epicId: "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("item"));
  const [createOpen, setCreateOpen] = useState(false);
  const canEdit = canEditRoadmap(role);
  const hasFilters = Object.values(filters).some(Boolean);

  // Sync selected item from URL (e.g. deep link or back/forward)
  useEffect(() => {
    setSelectedId(searchParams.get("item"));
  }, [searchParams]);
  const setSelectedIdAndUrl = useCallback((id: string | null) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("item", id);
    else url.searchParams.delete("item");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  const boardPhases = orgPhases.length > 0 ? orgPhases : PHASES;

  const effectivePhase = filters.phase || selectedPhase || undefined;
  const fetchItems = useCallback(async () => {
    const params: Record<string, string> = {};
    if (effectivePhase) params.phase = effectivePhase;
    if (filters.status) params.status = filters.status;
    if (filters.priority) params.priority = filters.priority;
    if (filters.team) params.team = filters.team;
    if (filters.epicId) params.epicId = filters.epicId;
    const list = await api<RoadmapItem[]>("/api/roadmap", { params });
    setItems(list);
  }, [filters, effectivePhase]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchItems().catch(() => {
        if (!cancelled) toast.error("Failed to load roadmap");
      }),
      api<{ id: string; name: string; targetDate: Date | null }[]>("/api/roadmap/milestones").then((r) => {
        if (!cancelled) setMilestones(r);
      }),
      api<{ id: string; name: string }[]>("/api/roadmap/epics").then((r) => {
        if (!cancelled) setEpics(r);
      }),
    ])
      .catch(() => {
        if (!cancelled) toast.error("Failed to load roadmap");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchItems]);

  const onItemSelect = (id: string) => setSelectedIdAndUrl(id);
  const onCloseDetail = () => setSelectedIdAndUrl(null);
  const onUpdated = () => {
    fetchItems();
    setSelectedIdAndUrl(null);
    toast.success("Roadmap item updated");
  };
  const onDeleted = () => {
    setItems((prev) => prev.filter((i) => i.id !== selectedId));
    setSelectedIdAndUrl(null);
    toast.success("Item removed");
  };
  const onCreated = (item: RoadmapItem) => {
    setItems((prev) => [...prev, item]);
    setCreateOpen(false);
    toast.success("Item created");
  };
  const onPhaseChange = async (itemId: string, targetPhase: string | null) => {
    try {
      await api(`/api/roadmap/${itemId}`, {
        method: "PATCH",
        body: { targetPhase },
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, targetPhase } : i
        )
      );
      toast.success("Moved");
    } catch {
      toast.error("Failed to move");
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <PageShell
      title="Roadmap"
      actions={
        <>
          <RoadmapFilters
            filters={filters}
            setFilters={setFilters}
            epics={epics}
            phases={boardPhases}
          />
          <div className="flex rounded-md border border-border bg-background">
            <button
              type="button"
              onClick={() => setView("timeline")}
              className={`rounded-l-md border-r border-border px-3 py-2 text-sm ${view === "timeline"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
                }`}
            >
              <Map className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`rounded-r-md px-3 py-2 text-sm ${view === "list"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
                }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            title="Print / Save as PDF"
          >
            <Download className="mr-2 h-4 w-4" />
            Print
          </Button>
          {canEdit && (
            <Button onClick={() => setCreateOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New item
            </Button>
          )}
        </>
      }
    >
      {effectivePhase && (
        <p className="text-muted-foreground -mt-2 text-xs">
          Filtered to <span className="text-foreground font-medium">{effectivePhase}</span>.
          Clear the phase filter (or set top bar to All phases) to see cards with no target phase.
        </p>
      )}
      {items.length === 0 ? (
        <EmptyState
          icon={<Map className="h-6 w-6" />}
          title={hasFilters ? "No items match your filters" : "No roadmap items"}
          description={
            hasFilters
              ? "Try clearing filters or add new roadmap items."
              : "Add items to build your product roadmap. Filter by phase, status, or epic."
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() =>
                  setFilters({
                    phase: "",
                    status: "",
                    priority: "",
                    team: "",
                    epicId: "",
                  })
                }
              >
                Clear filters
              </Button>
            ) : canEdit ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add first item
              </Button>
            ) : undefined
          }
        />
      ) : view === "timeline" ? (
        <div className="min-h-[24rem]">
          <RoadmapTimeline
            items={items}
            phases={boardPhases}
            milestones={milestones}
            onSelect={onItemSelect}
            onPhaseChange={canEdit ? onPhaseChange : undefined}
          />
        </div>
      ) : (
        <RoadmapList
          items={items}
          onSelect={onItemSelect}
        />
      )}

      {selectedId && (
        <RoadmapDetailSheet
          id={selectedId}
          role={role}
          phases={boardPhases}
          onClose={onCloseDetail}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
        />
      )}

      {createOpen && canEdit && (
        <RoadmapCreateSheet
          phases={boardPhases}
          epics={epics}
          milestones={milestones}
          onRefetchEpics={async () => {
            const r = await api<{ id: string; name: string }[]>("/api/roadmap/epics");
            setEpics(r);
          }}
          onRefetchMilestones={async () => {
            const r = await api<{ id: string; name: string; targetDate: Date | null }[]>(
              "/api/roadmap/milestones"
            );
            setMilestones(r);
          }}
          onClose={() => setCreateOpen(false)}
          onCreated={onCreated}
        />
      )}
    </PageShell>
  );
}
