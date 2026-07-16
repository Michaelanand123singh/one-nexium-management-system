"use client";

import type { AssetOption } from "@/components/gtm/gtm-view";

export function GtmAssetList({
  assets,
  onSelect,
}: {
  assets: AssetOption[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Name</th>
            <th className="px-4 py-3 text-left font-medium">Type</th>
            <th className="px-4 py-3 text-left font-medium">Audience</th>
            <th className="px-4 py-3 text-left font-medium">URL</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr
              key={a.id}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
              onClick={() => onSelect(a.id)}
            >
              <td className="px-4 py-3 font-medium">{a.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{a.type ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{a.audience ?? "—"}</td>
              <td className="px-4 py-3">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Link
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
