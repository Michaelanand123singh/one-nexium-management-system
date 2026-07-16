"use client";

import { Badge } from "@/components/ui/badge";
import { CUSTOMER_PLAN_LABELS, CHURN_RISK_LABELS } from "@/lib/constants";
import type { CustomerOption } from "@/components/customers/customers-view";

export function CustomerList({
  customers,
  onSelect,
}: {
  customers: CustomerOption[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Name</th>
            <th className="px-4 py-3 text-left font-medium">Email</th>
            <th className="px-4 py-3 text-left font-medium">Plan</th>
            <th className="px-4 py-3 text-left font-medium">Churn risk</th>
            <th className="px-4 py-3 text-left font-medium">CSM</th>
            <th className="px-4 py-3 text-left font-medium">Tickets</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr
              key={c.id}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
              onClick={() => onSelect(c.id)}
            >
              <td className="px-4 py-3 font-medium">{c.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
              <td className="px-4 py-3">
                <Badge variant="outline">
                  {CUSTOMER_PLAN_LABELS[c.plan as keyof typeof CUSTOMER_PLAN_LABELS] ?? c.plan}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant={
                    c.churnRisk === "HIGH" ? "destructive" : c.churnRisk === "MEDIUM" ? "secondary" : "outline"
                  }
                >
                  {CHURN_RISK_LABELS[c.churnRisk as keyof typeof CHURN_RISK_LABELS] ?? c.churnRisk}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {c.assignedCsm?.name || c.assignedCsm?.email || "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {c._count?.supportTickets ?? 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
