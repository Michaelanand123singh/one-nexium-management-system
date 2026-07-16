"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from "@/lib/constants";

export type DocumentsFiltersState = {
  kind: "all" | "file" | "wiki";
  type: string;
};

export function DocumentsFilters({
  filters,
  onFiltersChange,
}: {
  filters: DocumentsFiltersState;
  onFiltersChange: (f: DocumentsFiltersState) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Kind:</span>
      {(["all", "file", "wiki"] as const).map((k) => (
        <Button
          key={k}
          variant={filters.kind === k ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onFiltersChange({ ...filters, kind: k })}
        >
          {k === "all" ? "All" : k === "file" ? "Files" : "Wiki"}
        </Button>
      ))}
      <span className="ml-2 text-sm text-muted-foreground">Type:</span>
      <Select
        value={filters.type || "all"}
        onValueChange={(v) => onFiltersChange({ ...filters, type: v === "all" ? "" : v })}
      >
        <SelectTrigger className="h-9 w-[140px]">
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {DOCUMENT_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {DOCUMENT_TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
