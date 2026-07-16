"use client";

import { Badge } from "@/components/ui/badge";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_TYPE_LABELS } from "@/lib/constants";

export type CampaignOption = {
  id: string;
  name: string;
  type: string;
  status: string;
  ownerId: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  owner?: { id: string; name: string | null; email: string } | null;
};

export function GtmCampaignList({
  campaigns,
  onSelect,
}: {
  campaigns: CampaignOption[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Name</th>
            <th className="px-4 py-3 text-left font-medium">Type</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Owner</th>
            <th className="px-4 py-3 text-left font-medium">Dates</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr
              key={c.id}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
              onClick={() => onSelect(c.id)}
            >
              <td className="px-4 py-3 font-medium">{c.name}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {CAMPAIGN_TYPE_LABELS[c.type as keyof typeof CAMPAIGN_TYPE_LABELS] ?? c.type}
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline">
                  {CAMPAIGN_STATUS_LABELS[c.status as keyof typeof CAMPAIGN_STATUS_LABELS] ?? c.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {c.owner?.name || c.owner?.email || "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {c.startDate || c.endDate
                  ? [c.startDate ? new Date(c.startDate).toLocaleDateString() : "", c.endDate ? new Date(c.endDate).toLocaleDateString() : ""].filter(Boolean).join(" → ")
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
