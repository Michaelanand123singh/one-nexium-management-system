"use client";

import { Badge } from "@/components/ui/badge";
import {
  PARTNER_TYPE_LABELS,
  PARTNER_TIER_LABELS,
  PARTNER_STATUS_LABELS,
  PARTNER_PIPELINE_LABELS,
} from "@/lib/constants";

export type PartnerOption = {
  id: string;
  companyName: string;
  contactPerson: string | null;
  type: string;
  tier: string;
  status: string;
  pipelineStage: string;
  assignedToId: string | null;
  assignedTo?: { id: string; name: string | null; email: string } | null;
};

export function GtmPartnerList({
  partners,
  onSelect,
}: {
  partners: PartnerOption[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Company</th>
            <th className="px-4 py-3 text-left font-medium">Type</th>
            <th className="px-4 py-3 text-left font-medium">Tier</th>
            <th className="px-4 py-3 text-left font-medium">Stage</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Assigned to</th>
          </tr>
        </thead>
        <tbody>
          {partners.map((p) => (
            <tr
              key={p.id}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
              onClick={() => onSelect(p.id)}
            >
              <td className="px-4 py-3 font-medium">{p.companyName}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {PARTNER_TYPE_LABELS[p.type as keyof typeof PARTNER_TYPE_LABELS] ?? p.type}
              </td>
              <td className="px-4 py-3">
                <Badge variant="secondary">
                  {PARTNER_TIER_LABELS[p.tier as keyof typeof PARTNER_TIER_LABELS] ?? p.tier}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {PARTNER_PIPELINE_LABELS[p.pipelineStage as keyof typeof PARTNER_PIPELINE_LABELS] ?? p.pipelineStage}
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline">
                  {PARTNER_STATUS_LABELS[p.status as keyof typeof PARTNER_STATUS_LABELS] ?? p.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {p.assignedTo?.name || p.assignedTo?.email || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
