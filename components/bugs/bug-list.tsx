"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { BUG_STATUS_LABELS, BUG_SEVERITY_LABELS } from "@/lib/constants";
import type { BugOption } from "@/components/bugs/bugs-view";

type SortKey = "title" | "severity" | "status" | "assignee" | "reporter";

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

export function BugList({
  bugs,
  canEdit,
  onSelect,
  onUpdated,
}: {
  bugs: BugOption[];
  canEdit: boolean;
  onSelect: (id: string) => void;
  onUpdated: () => void;
}) {
  void canEdit;
  void onUpdated;
  const [sortBy, setSortBy] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    return [...bugs].sort((a, b) => {
      let aVal: string;
      let bVal: string;
      switch (sortBy) {
        case "title":
          aVal = a.title;
          bVal = b.title;
          break;
        case "severity":
          aVal = a.severity;
          bVal = b.severity;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "assignee":
          aVal = a.assignee?.name || a.assignee?.email || "";
          bVal = b.assignee?.name || b.assignee?.email || "";
          break;
        case "reporter":
          aVal = a.reporter?.name || a.reporter?.email || "";
          bVal = b.reporter?.name || b.reporter?.email || "";
          break;
        default:
          return 0;
      }
      const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [bugs, sortBy, sortDir]);

  return (
    <div className="rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <SortHeader label="Title" sortKey="title" currentSort={sortBy} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Severity" sortKey="severity" currentSort={sortBy} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Status" sortKey="status" currentSort={sortBy} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Assignee" sortKey="assignee" currentSort={sortBy} dir={sortDir} onSort={handleSort} />
            <SortHeader label="Reporter" sortKey="reporter" currentSort={sortBy} dir={sortDir} onSort={handleSort} />
            <th className="px-4 py-3 text-left font-medium">Linked task</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((bug) => (
            <tr
              key={bug.id}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
              onClick={() => onSelect(bug.id)}
            >
              <td className="px-4 py-3 font-medium">{bug.title}</td>
              <td className="px-4 py-3">
                <Badge
                  variant={
                    bug.severity === "CRITICAL" || bug.severity === "HIGH"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {BUG_SEVERITY_LABELS[bug.severity as keyof typeof BUG_SEVERITY_LABELS] ?? bug.severity}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline">
                  {BUG_STATUS_LABELS[bug.status as keyof typeof BUG_STATUS_LABELS] ?? bug.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {bug.assignee?.name || bug.assignee?.email || "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {bug.reporter?.name || bug.reporter?.email || "—"}
              </td>
              <td className="px-4 py-3">
                {bug.task ? (
                  <Link
                    href={
                      bug.task.sprintId
                        ? `/sprint?sprint=${bug.task.sprintId}&task=${bug.task.id}`
                        : `/sprint?task=${bug.task.id}`
                    }
                    className="text-primary underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {bug.task.title}
                  </Link>
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
