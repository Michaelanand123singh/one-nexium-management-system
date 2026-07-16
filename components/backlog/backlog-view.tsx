"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { BacklogList } from "@/components/backlog/backlog-list";
import { BacklogFilters, type BacklogFiltersState } from "@/components/backlog/backlog-filters";
import { FeatureRequestList } from "@/components/backlog/feature-request-list";
import { BacklogDetailSheet } from "@/components/backlog/backlog-detail-sheet";
import { BacklogCreateSheet } from "@/components/backlog/backlog-create-sheet";
import { FeatureRequestCreateSheet } from "@/components/backlog/feature-request-create-sheet";
import { EpicCreateSheet } from "@/components/backlog/epic-create-sheet";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { ListTodo, Inbox, Layers, Plus } from "lucide-react";
import { canEditBacklog } from "@/lib/permissions";
import { usePhase } from "@/lib/phase-context";
import { api } from "@/lib/api";
import { toast } from "sonner";

export type BacklogItemType = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  source: string;
  priorityScore: number | null;
  status: string;
  epicId: string | null;
  effortEstimate: string | null;
  sprintId: string | null;
  epic?: { id: string; name: string } | null;
  sprint?: { id: string; name: string } | null;
};

export type FeatureRequestType = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  votes: number;
  customer?: { id: string; name: string; email: string } | null;
  backlogItem?: { id: string; title: string; status: string } | null;
};

export type EpicType = { id: string; name: string; targetPhase: string | null };

const TABS = [
  { id: "backlog" as const, label: "Feature Backlog", icon: ListTodo },
  { id: "requests" as const, label: "Feature Request Inbox", icon: Inbox },
  { id: "epics" as const, label: "Epics", icon: Layers },
];

export function BacklogView({
  role,
  organisationId,
}: {
  role: Role;
  organisationId: string;
}) {
  void organisationId;
  const { selectedPhase } = usePhase();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"backlog" | "requests" | "epics">("backlog");
  const [backlogItems, setBacklogItems] = useState<BacklogItemType[]>([]);
  const [featureRequests, setFeatureRequests] = useState<FeatureRequestType[]>([]);
  const [epics, setEpics] = useState<EpicType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("item"));
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState<BacklogFiltersState>({
    status: "",
    type: "",
    source: "",
    epicId: "",
    sort: "priorityScore",
  });
  const canEdit = canEditBacklog(role);
  const hasFilters = Object.values(filters).some(Boolean) || Boolean(selectedPhase);

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

  useEffect(() => {
    let cancelled = false;
    api<EpicType[]>("/api/roadmap/epics")
      .then((r) => {
        if (!cancelled) setEpics(r);
      })
      .catch(() => toast.error("Failed to load"));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.type) params.type = filters.type;
    if (filters.source) params.source = filters.source;
    if (filters.epicId) params.epicId = filters.epicId;
    if (filters.sort) params.sort = filters.sort;
    if (selectedPhase) params.phase = selectedPhase;
    api<BacklogItemType[]>("/api/backlog", { params })
      .then((r) => {
        if (!cancelled) setBacklogItems(r);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load backlog");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [filters, selectedPhase]);

  const refreshBacklog = useCallback(() => {
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.type) params.type = filters.type;
    if (filters.source) params.source = filters.source;
    if (filters.epicId) params.epicId = filters.epicId;
    if (filters.sort) params.sort = filters.sort;
    if (selectedPhase) params.phase = selectedPhase;
    api<BacklogItemType[]>("/api/backlog", { params }).then(setBacklogItems).catch(() => {});
  }, [filters, selectedPhase]);
  const [requestStatus, setRequestStatus] = useState("");
  const [createRequestOpen, setCreateRequestOpen] = useState(false);
  const [createEpicOpen, setCreateEpicOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("new") !== "feature") return;
    setTab("requests");
    setCreateRequestOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("new");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [searchParams]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (requestStatus) params.status = requestStatus;
    api<FeatureRequestType[]>("/api/feature-requests", { params })
      .then(setFeatureRequests)
      .catch(() => toast.error("Failed to load feature requests"));
  }, [requestStatus]);

  const refreshRequests = useCallback(() => {
    const params: Record<string, string> = {};
    if (requestStatus) params.status = requestStatus;
    api<FeatureRequestType[]>("/api/feature-requests", { params })
      .then(setFeatureRequests)
      .catch(() => {});
  }, [requestStatus]);
  const refreshEpics = useCallback(async () => {
    await api<EpicType[]>("/api/roadmap/epics").then(setEpics).catch(() => {});
  }, []);

  if (loading && backlogItems.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <PageShell
      title="Backlog & Feature Requests"
      actions={
        <>
          {tab === "backlog" && (
            <>
              <BacklogFilters
                filters={filters}
                setFilters={setFilters}
                epics={epics}
              />
              {canEdit && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New backlog item
                </Button>
              )}
            </>
          )}
          {tab === "requests" && (
            <>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={requestStatus}
                onChange={(e) => setRequestStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <Button size="sm" variant="outline" onClick={() => setCreateRequestOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New feature request
              </Button>
            </>
          )}
          {tab === "epics" && canEdit && (
            <Button size="sm" onClick={() => setCreateEpicOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create epic
            </Button>
          )}
        </>
      }
    >
      <div className="flex gap-1 rounded-lg border border-border p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "backlog" && (
        <>
          {backlogItems.length === 0 ? (
            <EmptyState
              icon={<ListTodo className="h-6 w-6" />}
              title={
                hasFilters
                  ? selectedPhase && !Object.values(filters).some(Boolean)
                    ? `No backlog items for ${selectedPhase}`
                    : "No items match your filters"
                  : "No backlog items"
              }
              description={
                hasFilters
                  ? selectedPhase
                    ? "Items without an epic in this phase are hidden. Clear the top-bar phase filter or attach epics to phases."
                    : "Try clearing filters or add new backlog items."
                  : "Add items or accept feature requests into the backlog."
              }
              action={
                hasFilters ? (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setFilters({
                        status: "",
                        type: "",
                        source: "",
                        epicId: "",
                        sort: "priorityScore",
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
          ) : (
            <BacklogList
              items={backlogItems}
              epics={epics}
              onSelect={setSelectedIdAndUrl}
              onPromoted={refreshBacklog}
              onUpdated={refreshBacklog}
              canEdit={canEdit}
            />
          )}
        </>
      )}

      {tab === "requests" && (
        <FeatureRequestList
          items={featureRequests}
          onAccepted={refreshRequests}
          onRejected={refreshRequests}
          canEdit={canEdit}
        />
      )}

      {tab === "epics" && (
        <div className="rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Epic</th>
                <th className="px-4 py-3 text-left font-medium">Target phase</th>
              </tr>
            </thead>
            <tbody>
              {epics.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">
                    No epics yet. Create epics from the Roadmap or Backlog.
                  </td>
                </tr>
              ) : (
                epics.map((epic) => (
                  <tr key={epic.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{epic.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {epic.targetPhase ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <BacklogDetailSheet
          id={selectedId}
          canEdit={canEdit}
          epics={epics}
          onClose={() => setSelectedIdAndUrl(null)}
          onUpdated={refreshBacklog}
          onDeleted={() => {
            setBacklogItems((p) => p.filter((i) => i.id !== selectedId));
            setSelectedIdAndUrl(null);
          }}
        />
      )}

      {createOpen && canEdit && (
        <BacklogCreateSheet
          epics={epics}
          onRefetchEpics={refreshEpics}
          onClose={() => setCreateOpen(false)}
          onCreated={(item) => {
            setBacklogItems((p) => [...p, item]);
            setCreateOpen(false);
            toast.success("Backlog item created");
          }}
        />
      )}

      {createRequestOpen && (
        <FeatureRequestCreateSheet
          onClose={() => setCreateRequestOpen(false)}
          onCreated={() => {
            setCreateRequestOpen(false);
            refreshRequests();
          }}
        />
      )}

      {createEpicOpen && canEdit && (
        <EpicCreateSheet
          onClose={() => setCreateEpicOpen(false)}
          onCreated={() => {
            setCreateEpicOpen(false);
            refreshEpics();
          }}
        />
      )}
    </PageShell>
  );
}
