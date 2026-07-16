"use client";

import type { RoadmapFiltersState } from "@/components/roadmap/roadmap-view";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "PLANNED", label: "Planned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "CANCELLED", label: "Cancelled" },
];
const PRIORITY_OPTIONS = [
  { value: "", label: "All priorities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];
const TEAM_OPTIONS = [
  { value: "", label: "All teams" },
  { value: "Product", label: "Product" },
  { value: "Engineering", label: "Engineering" },
  { value: "Design", label: "Design" },
];

const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function RoadmapFilters({
  filters,
  setFilters,
  epics,
  phases,
}: {
  filters: RoadmapFiltersState;
  setFilters: (f: RoadmapFiltersState) => void;
  epics: { id: string; name: string }[];
  phases: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={inputClass}
        value={filters.phase}
        onChange={(e) =>
          setFilters({ ...filters, phase: e.target.value })
        }
      >
        <option value="">All phases</option>
        {phases.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={filters.status}
        onChange={(e) =>
          setFilters({ ...filters, status: e.target.value })
        }
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={filters.priority}
        onChange={(e) =>
          setFilters({ ...filters, priority: e.target.value })
        }
      >
        {PRIORITY_OPTIONS.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={filters.team}
        onChange={(e) =>
          setFilters({ ...filters, team: e.target.value })
        }
      >
        {TEAM_OPTIONS.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={filters.epicId}
        onChange={(e) =>
          setFilters({ ...filters, epicId: e.target.value })
        }
      >
        <option value="">All epics</option>
        {epics.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </div>
  );
}
