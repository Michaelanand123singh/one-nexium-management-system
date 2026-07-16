"use client";

import {
  CUSTOMER_PLANS,
  CUSTOMER_PLAN_LABELS,
  CHURN_RISKS,
  CHURN_RISK_LABELS,
} from "@/lib/constants";

const inputClass =
  "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export type CustomersFiltersState = {
  plan: string;
  churnRisk: string;
  assignedCsmId: string;
};

export function CustomersFilters({
  filters,
  setFilters,
  members,
}: {
  filters: CustomersFiltersState;
  setFilters: (f: CustomersFiltersState) => void;
  members: { id: string; name: string | null; email: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={inputClass}
        value={filters.plan}
        onChange={(e) => setFilters({ ...filters, plan: e.target.value })}
      >
        <option value="">All plans</option>
        {CUSTOMER_PLANS.map((p) => (
          <option key={p} value={p}>
            {CUSTOMER_PLAN_LABELS[p]}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={filters.churnRisk}
        onChange={(e) => setFilters({ ...filters, churnRisk: e.target.value })}
      >
        <option value="">All churn risk</option>
        {CHURN_RISKS.map((r) => (
          <option key={r} value={r}>
            {CHURN_RISK_LABELS[r]}
          </option>
        ))}
      </select>
      <select
        className={inputClass}
        value={filters.assignedCsmId}
        onChange={(e) => setFilters({ ...filters, assignedCsmId: e.target.value })}
      >
        <option value="">All CSMs</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || m.email}
          </option>
        ))}
      </select>
    </div>
  );
}
