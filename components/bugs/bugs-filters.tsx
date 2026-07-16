"use client";

import { BUG_STATUSES, BUG_STATUS_LABELS, BUG_SEVERITIES, BUG_SEVERITY_LABELS } from "@/lib/constants";

const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export type BugsFiltersState = {
  status: string;
  severity: string;
  assignedToId: string;
};

export function BugsFilters({
  filters,
  setFilters,
  members,
}: {
  filters: BugsFiltersState;
  setFilters: (f: BugsFiltersState) => void;
  members: { id: string; name: string | null; email: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={inputClass}
        value={filters.status}
        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
      >
        <option value="">All statuses</option>
        {BUG_STATUSES.map((s) => (
          <option key={s} value={s}>
            {BUG_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={filters.severity}
        onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
      >
        <option value="">All severities</option>
        {BUG_SEVERITIES.map((s) => (
          <option key={s} value={s}>
            {BUG_SEVERITY_LABELS[s]}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={filters.assignedToId}
        onChange={(e) => setFilters({ ...filters, assignedToId: e.target.value })}
      >
        <option value="">All assignees</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || m.email}
          </option>
        ))}
      </select>
    </div>
  );
}
