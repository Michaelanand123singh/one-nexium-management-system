"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FeatureRequestType } from "@/components/backlog/backlog-view";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function FeatureRequestList({
  items,
  onAccepted,
  onRejected,
  canEdit,
}: {
  items: FeatureRequestType[];
  onAccepted: () => void;
  onRejected: () => void;
  canEdit: boolean;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleAccept(id: string) {
    setLoadingId(id);
    try {
      await api(`/api/feature-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "ACCEPTED" }),
      });
      toast.success("Accepted into backlog");
      onAccepted();
    } catch {
      toast.error("Failed to accept");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleReject(id: string) {
    const reason = window.prompt("Rejection reason (optional):");
    if (reason === null) return;
    setLoadingId(id);
    try {
      await api(`/api/feature-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "REJECTED", rejectionReason: reason || null }),
      });
      toast.success("Rejected");
      onRejected();
    } catch {
      toast.error("Failed to reject");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Title</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Votes</th>
            <th className="px-4 py-3 text-left font-medium">Customer</th>
            {canEdit && <th className="px-4 py-3 text-right font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={canEdit ? 5 : 4} className="px-4 py-8 text-center text-muted-foreground">
                No feature requests yet.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-border last:border-0 hover:bg-muted/50"
              >
                <td className="px-4 py-3 font-medium">{item.title}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      item.status === "ACCEPTED"
                        ? "default"
                        : item.status === "REJECTED"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {item.status}
                  </Badge>
                  {item.backlogItem && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      → {item.backlogItem.title}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{item.votes}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {item.customer?.name ?? item.customer?.email ?? "—"}
                </td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    {item.status === "PENDING" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={!!loadingId}
                          onClick={() => handleAccept(item.id)}
                        >
                          {loadingId === item.id ? "…" : "Accept"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!loadingId}
                          onClick={() => handleReject(item.id)}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
