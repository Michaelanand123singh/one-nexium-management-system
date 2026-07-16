"use client";

import { Badge } from "@/components/ui/badge";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_SOURCE_LABELS } from "@/lib/constants";
import { FileText, File } from "lucide-react";

type DocumentRow = {
  id: string;
  title: string;
  type: string | null;
  fileUrl: string | null;
  fileName: string | null;
  sourceType: string | null;
  updatedAt: string;
};

export function DocumentList({
  documents,
  onSelect,
}: {
  documents: DocumentRow[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Name</th>
            <th className="px-4 py-3 text-left font-medium">Type</th>
            <th className="px-4 py-3 text-left font-medium">Kind</th>
            <th className="px-4 py-3 text-left font-medium">Source</th>
            <th className="px-4 py-3 text-left font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr
              key={d.id}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
              onClick={() => onSelect(d.id)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {d.fileUrl ? (
                    <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-medium">{d.title}</span>
                  {d.fileName && (
                    <span className="text-muted-foreground">({d.fileName})</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                {d.type ? (
                  <Badge variant="outline">
                    {DOCUMENT_TYPE_LABELS[d.type as keyof typeof DOCUMENT_TYPE_LABELS] ?? d.type}
                  </Badge>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {d.fileUrl ? "File" : "Wiki"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {d.sourceType
                  ? DOCUMENT_SOURCE_LABELS[d.sourceType] ?? d.sourceType
                  : "—"}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(d.updatedAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
