"use client";

import { PHASES, OKR_LEVELS, OKR_LEVEL_LABELS } from "@/lib/constants";

const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export type OkrsFiltersState = {
  period: string;
  level: string;
  ownerId: string;
};

export function OkrsFilters({
  filters,
  setFilters,
  members,
}: {
  filters: OkrsFiltersState;
  setFilters: (f: OkrsFiltersState) => void;
  members: { id: string; name: string | null; email: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={inputClass}
        value={filters.period}
        onChange={(e) => setFilters({ ...filters, period: e.target.value })}
      >
        <option value="">All periods</option>
        {PHASES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={filters.level}
        onChange={(e) => setFilters({ ...filters, level: e.target.value })}
      >
        <option value="">All levels</option>
        {OKR_LEVELS.map((l) => (
          <option key={l} value={l}>
            {OKR_LEVEL_LABELS[l]}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={filters.ownerId}
        onChange={(e) => setFilters({ ...filters, ownerId: e.target.value })}
      >
        <option value="">All owners</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || m.email}
          </option>
        ))}
      </select>
    </div>
  );
}
