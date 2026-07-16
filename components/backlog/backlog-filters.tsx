"use client";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "NEW", label: "New" },
  { value: "REFINED", label: "Refined" },
  { value: "GROOMED", label: "Groomed" },
  { value: "IN_SPRINT", label: "In sprint" },
  { value: "DONE", label: "Done" },
  { value: "REJECTED", label: "Rejected" },
];
const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "FEATURE", label: "Feature" },
  { value: "IMPROVEMENT", label: "Improvement" },
  { value: "TECH_DEBT", label: "Tech debt" },
  { value: "RESEARCH", label: "Research" },
];
const SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "INTERNAL", label: "Internal" },
  { value: "CUSTOMER_FEEDBACK", label: "Customer" },
  { value: "PARTNER_REQUEST", label: "Partner" },
  { value: "COMPETITOR_ANALYSIS", label: "Competitor" },
];
const SORT_OPTIONS = [
  { value: "priorityScore", label: "Priority" },
  { value: "createdAt", label: "Newest" },
];

const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export type BacklogFiltersState = {
  status: string;
  type: string;
  source: string;
  epicId: string;
  sort: string;
};

export function BacklogFilters({
  filters,
  setFilters,
  epics,
}: {
  filters: BacklogFiltersState;
  setFilters: (f: BacklogFiltersState) => void;
  epics: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={inputClass}
        value={filters.status}
        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={filters.type}
        onChange={(e) => setFilters({ ...filters, type: e.target.value })}
      >
        {TYPE_OPTIONS.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={filters.source}
        onChange={(e) => setFilters({ ...filters, source: e.target.value })}
      >
        {SOURCE_OPTIONS.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={filters.epicId}
        onChange={(e) => setFilters({ ...filters, epicId: e.target.value })}
      >
        <option value="">All epics</option>
        {epics.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={filters.sort}
        onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
