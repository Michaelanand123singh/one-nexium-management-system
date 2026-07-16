"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { BacklogItemType } from "@/components/backlog/backlog-view";
import type { EpicType } from "@/components/backlog/backlog-view";
import { PromoteToRoadmapSheet } from "@/components/backlog/promote-to-roadmap-sheet";
import { api } from "@/lib/api";
import { toast } from "sonner";

type SprintOption = { id: string; name: string; status: string };

const TYPE_LABELS: Record<string, string> = {
  FEATURE: "Feature",
  IMPROVEMENT: "Improvement",
  TECH_DEBT: "Tech Debt",
  RESEARCH: "Research",
};
const SOURCE_LABELS: Record<string, string> = {
  INTERNAL: "Internal",
  CUSTOMER_FEEDBACK: "Customer",
  PARTNER_REQUEST: "Partner",
  COMPETITOR_ANALYSIS: "Competitor",
};

type SortKey = "title" | "type" | "source" | "status" | "priority" | "epic" | "sprint";

function SortHeader({
  label,
  sortKey,
  currentSort,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  const isActive = currentSort === sortKey;
  return (
    <th
      className="cursor-pointer select-none px-4 py-3 text-left font-medium hover:bg-muted/70"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          dir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </span>
    </th>
  );
}

export function BacklogList({
  items,
  epics,
  onSelect,
  onPromoted,
  onUpdated,
  canEdit,
}: {
  items: BacklogItemType[];
  epics: EpicType[];
  onSelect: (id: string) => void;
  onPromoted: () => void;
  onUpdated: () => void;
  canEdit: boolean;
}) {
  const [promoteSheetItem, setPromoteSheetItem] = useState<{ id: string; title: string } | null>(null);
  const [sprints, setSprints] = useState<SprintOption[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    api<SprintOption[]>("/api/sprints").then(setSprints).catch(() => {});
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;
      switch (sortBy) {
        case "title":
          aVal = a.title;
          bVal = b.title;
          break;
        case "type":
          aVal = a.type;
          bVal = b.type;
          break;
        case "source":
          aVal = a.source;
          bVal = b.source;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "priority":
          aVal = a.priorityScore ?? -1;
          bVal = b.priorityScore ?? -1;
          break;
        case "epic":
          aVal = a.epic?.name ?? "";
          bVal = b.epic?.name ?? "";
          break;
        case "sprint":
          aVal = a.sprint?.name ?? "";
          bVal = b.sprint?.name ?? "";
          break;
        default:
          return 0;
      }
      const cmp =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal ?? "").localeCompare(String(bVal ?? ""), undefined, { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, sortBy, sortDir]);

  function openPromoteSheet(item: BacklogItemType) {
    setPromoteSheetItem({ id: item.id, title: item.title });
  }

  async function handleMoveToSprint(item: BacklogItemType, sprintId: string | null) {
    try {
      if (sprintId) {
        const typeMap: Record<string, string> = {
          FEATURE: "FEATURE",
          IMPROVEMENT: "FEATURE",
          TECH_DEBT: "TECH_DEBT",
          RESEARCH: "RESEARCH",
        };
        await api("/api/tasks", {
          method: "POST",
          body: {
            title: item.title,
            description: item.description ?? undefined,
            type: typeMap[item.type] ?? "FEATURE",
            status: "TO_DO",
            priority: "MEDIUM",
            sprintId,
            epicId: item.epicId ?? undefined,
          },
        });
        await api(`/api/backlog/${item.id}`, {
          method: "PATCH",
          body: { sprintId, status: "IN_SPRINT" },
        });
        toast.success("Task created on sprint board");
      } else {
        await api(`/api/backlog/${item.id}`, {
          method: "PATCH",
          body: { sprintId: null },
        });
        toast.success("Removed from sprint");
      }
      onUpdated();
    } catch {
      toast.error("Failed to update");
    }
  }

  return (
    <div className="rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <SortHeader label="Title" sortKey="title" currentSort={sortBy} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Type" sortKey="type" currentSort={sortBy} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Source" sortKey="source" currentSort={sortBy} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Status" sortKey="status" currentSort={sortBy} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Priority" sortKey="priority" currentSort={sortBy} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Epic" sortKey="epic" currentSort={sortBy} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Sprint" sortKey="sprint" currentSort={sortBy} dir={sortDir} onSort={handleSort} />
            {canEdit && <th className="px-4 py-3 text-right font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr
              key={item.id}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
              onClick={() => onSelect(item.id)}
            >
              <td className="px-4 py-3 font-medium">{item.title}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {TYPE_LABELS[item.type] ?? item.type}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {SOURCE_LABELS[item.source] ?? item.source}
              </td>
              <td className="px-4 py-3">
                <Badge variant="secondary">{item.status.replace("_", " ")}</Badge>
              </td>
              <td className="px-4 py-3">{item.priorityScore ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {item.epic?.name ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {item.sprint?.name ?? "—"}
              </td>
              {canEdit && (
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={item.sprintId ?? ""}
                      onChange={(e) =>
                        handleMoveToSprint(item, e.target.value || null)
                      }
                    >
                      <option value="">No sprint</option>
                      {sprints.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPromoteSheet(item)}
                    >
                      To roadmap
                    </Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {promoteSheetItem && (
        <PromoteToRoadmapSheet
          itemId={promoteSheetItem.id}
          itemTitle={promoteSheetItem.title}
          epics={epics}
          onClose={() => setPromoteSheetItem(null)}
          onPromoted={onPromoted}
        />
      )}
    </div>
  );
}
