"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { RoadmapItem } from "@/components/roadmap/roadmap-view";

const statusVariant: Record<string, "planned" | "inProgress" | "shipped" | "cancelled"> = {
  PLANNED: "planned",
  IN_PROGRESS: "inProgress",
  SHIPPED: "shipped",
  CANCELLED: "cancelled",
};

type SortKey = "title" | "status" | "priority" | "team" | "phase" | "epic" | "milestone";

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

export function RoadmapList({
  items,
  onSelect,
}: {
  items: RoadmapItem[];
  onSelect: (id: string) => void;
}) {
  const [sortBy, setSortBy] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      let aVal: string | null = null;
      let bVal: string | null = null;
      switch (sortBy) {
        case "title":
          aVal = a.title;
          bVal = b.title;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "priority":
          aVal = a.priority;
          bVal = b.priority;
          break;
        case "team":
          aVal = a.assignedTeam ?? "";
          bVal = b.assignedTeam ?? "";
          break;
        case "phase":
          aVal = a.targetPhase ?? "";
          bVal = b.targetPhase ?? "";
          break;
        case "epic":
          aVal = a.epic?.name ?? "";
          bVal = b.epic?.name ?? "";
          break;
        case "milestone":
          aVal = a.milestone?.name ?? "";
          bVal = b.milestone?.name ?? "";
          break;
        default:
          return 0;
      }
      const cmp = (aVal ?? "").localeCompare(bVal ?? "", undefined, { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, sortBy, sortDir]);

  return (
    <div className="rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <SortHeader
              label="Title"
              sortKey="title"
              currentSort={sortBy}
              dir={sortDir}
              onSort={handleSort}
            />
            <SortHeader
              label="Status"
              sortKey="status"
              currentSort={sortBy}
              dir={sortDir}
              onSort={handleSort}
            />
            <SortHeader
              label="Priority"
              sortKey="priority"
              currentSort={sortBy}
              dir={sortDir}
              onSort={handleSort}
            />
            <SortHeader
              label="Team"
              sortKey="team"
              currentSort={sortBy}
              dir={sortDir}
              onSort={handleSort}
            />
            <SortHeader
              label="Phase"
              sortKey="phase"
              currentSort={sortBy}
              dir={sortDir}
              onSort={handleSort}
            />
            <SortHeader
              label="Epic"
              sortKey="epic"
              currentSort={sortBy}
              dir={sortDir}
              onSort={handleSort}
            />
            <SortHeader
              label="Milestone"
              sortKey="milestone"
              currentSort={sortBy}
              dir={sortDir}
              onSort={handleSort}
            />
            <th className="px-4 py-3 text-left font-medium">Public</th>
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
              <td className="px-4 py-3">
                <Badge variant={statusVariant[item.status] ?? "secondary"}>
                  {item.status.replace("_", " ")}
                </Badge>
              </td>
              <td className="px-4 py-3">{item.priority}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {item.assignedTeam ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {item.targetPhase ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {item.epic?.name ?? "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {item.milestone?.name ?? "—"}
              </td>
              <td className="px-4 py-3">
                {item.isPublic ? (
                  <span className="text-xs text-muted-foreground">Yes</span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
