"use client";

import type { EventOption } from "@/components/gtm/gtm-view";

export function GtmEventList({
  events,
  onSelect,
}: {
  events: EventOption[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Name</th>
            <th className="px-4 py-3 text-left font-medium">Type</th>
            <th className="px-4 py-3 text-left font-medium">Date</th>
            <th className="px-4 py-3 text-left font-medium">Location</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr
              key={e.id}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
              onClick={() => onSelect(e.id)}
            >
              <td className="px-4 py-3 font-medium">{e.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{e.type ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {e.date ? new Date(e.date).toLocaleDateString() : "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{e.location ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
