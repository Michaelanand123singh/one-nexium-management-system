"use client";

import {
  PARTNER_STATUSES,
  PARTNER_STATUS_LABELS,
  PARTNER_TYPES,
  PARTNER_TYPE_LABELS,
  PARTNER_PIPELINE_STAGES,
  PARTNER_PIPELINE_LABELS,
} from "@/lib/constants";

const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export type PartnerFiltersState = {
  status: string;
  type: string;
  pipelineStage: string;
  assignedToId: string;
};

export function GtmPartnerFilters({
  filters,
  setFilters,
  members,
}: {
  filters: PartnerFiltersState;
  setFilters: (f: PartnerFiltersState) => void;
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
        {PARTNER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {PARTNER_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={filters.type}
        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
      >
        <option value="">All types</option>
        {PARTNER_TYPES.map((t) => (
          <option key={t} value={t}>
            {PARTNER_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={filters.pipelineStage}
        onChange={(e) => setFilters({ ...filters, pipelineStage: e.target.value })}
      >
        <option value="">All stages</option>
        {PARTNER_PIPELINE_STAGES.map((p) => (
          <option key={p} value={p}>
            {PARTNER_PIPELINE_LABELS[p]}
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
