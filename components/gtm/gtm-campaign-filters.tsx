"use client";

import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TYPES,
  CAMPAIGN_TYPE_LABELS,
} from "@/lib/constants";

const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export type CampaignFiltersState = {
  status: string;
  type: string;
  ownerId: string;
};

export function GtmCampaignFilters({
  filters,
  setFilters,
  members,
}: {
  filters: CampaignFiltersState;
  setFilters: (f: CampaignFiltersState) => void;
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
        {CAMPAIGN_STATUSES.map((s) => (
          <option key={s} value={s}>
            {CAMPAIGN_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={filters.type}
        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
      >
        <option value="">All types</option>
        {CAMPAIGN_TYPES.map((t) => (
          <option key={t} value={t}>
            {CAMPAIGN_TYPE_LABELS[t]}
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
