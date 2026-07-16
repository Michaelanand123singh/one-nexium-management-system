"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { OKR_LEVEL_LABELS } from "@/lib/constants";
import type { OkrOption } from "@/components/okrs/okrs-view";

type SortKey = "objective" | "period" | "level" | "owner";

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

export function OkrList({
  okrs,
  onSelect,
}: {
  okrs: OkrOption[];
  onSelect: (id: string) => void;
}) {
  const [sortBy, setSortBy] = useState<SortKey>("period");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    return [...okrs].sort((a, b) => {
      let aVal: string;
      let bVal: string;
      switch (sortBy) {
        case "objective":
          aVal = a.objective;
          bVal = b.objective;
          break;
        case "period":
          aVal = a.period;
          bVal = b.period;
          break;
        case "level":
          aVal = a.level;
          bVal = b.level;
          break;
        case "owner":
          aVal = a.owner?.name || a.owner?.email || "";
          bVal = b.owner?.name || b.owner?.email || "";
          break;
        default:
          return 0;
      }
      const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [okrs, sortBy, sortDir]);

  return (
    <div className="rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <SortHeader
              label="Objective"
              sortKey="objective"
              currentSort={sortBy}
              dir={sortDir}
              onSort={handleSort}
            />
            <SortHeader
              label="Period"
              sortKey="period"
              currentSort={sortBy}
              dir={sortDir}
              onSort={handleSort}
            />
            <SortHeader
              label="Level"
              sortKey="level"
              currentSort={sortBy}
              dir={sortDir}
              onSort={handleSort}
            />
            <SortHeader
              label="Owner"
              sortKey="owner"
              currentSort={sortBy}
              dir={sortDir}
              onSort={handleSort}
            />
            <th className="px-4 py-3 text-left font-medium">Key results</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((okr) => (
            <tr
              key={okr.id}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
              onClick={() => onSelect(okr.id)}
            >
              <td className="px-4 py-3 font-medium">{okr.objective}</td>
              <td className="px-4 py-3 text-muted-foreground">{okr.period}</td>
              <td className="px-4 py-3">
                <Badge variant="outline">
                  {OKR_LEVEL_LABELS[okr.level as keyof typeof OKR_LEVEL_LABELS] ?? okr.level}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {okr.owner?.name || okr.owner?.email || "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {okr._count?.keyResults ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
