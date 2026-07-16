"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OnboardingFormSheet } from "@/components/hr/onboarding-form-sheet";
import { toast } from "sonner";

export type OnboardingRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  joiningDate: string | null;
  jobTitle: string | null;
  department: string | null;
  location: string | null;
  status: string;
  ownerUserId: string | null;
  employee?: { id: string; fullName: string } | null;
  owner?: { id: string; name: string | null; email: string } | null;
  documentsCount: number;
  publicUrl: string | null;
  formTemplateJson?: {
    fields: Array<{
      id: string;
      label: string;
      type: "text" | "number" | "date";
      required: boolean;
    }>;
  } | null;
  formDataJson?: Record<string, unknown> | null;
};

type Props = {
  canManage: boolean;
};

export function OnboardingList({ canManage }: Props) {
  const [items, setItems] = useState<OnboardingRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | "">("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<OnboardingRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      const query =
        Object.keys(params).length === 0
          ? ""
          : `?${new URLSearchParams(params).toString()}`;
      const data = await api<OnboardingRow[]>(`/api/hr/onboarding${query}`);
      setItems(data);
    } catch {
      toast.error("Failed to load onboarding list");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, search.trim() ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  const handleCreatedOrUpdated = async () => {
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_INFO">Pending info</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
        >
          Refresh
        </Button>
        {canManage && (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditing(null);
              setSheetOpen(true);
            }}
          >
            New onboarding
          </Button>
        )}
      </div>

      {loading || !items ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No onboarding records yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Email</th>
                <th className="px-3 py-2 text-left font-medium">Joining</th>
                <th className="px-3 py-2 text-left font-medium">Role</th>
                <th className="px-3 py-2 text-left font-medium">Owner</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Docs</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-border/60 last:border-b-0"
                >
                  <td className="px-3 py-2">
                    <div className="font-medium">{o.fullName}</div>
                    {o.department && (
                      <div className="text-xs text-muted-foreground">
                        {o.department}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-xs text-muted-foreground">
                      {o.email}
                    </div>
                    {o.phone && (
                      <div className="text-xs text-muted-foreground">
                        {o.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {o.joiningDate
                      ? new Date(o.joiningDate).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {o.jobTitle ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {o.owner
                      ? o.owner.name || o.owner.email
                      : "Unassigned"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{o.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {o.documentsCount}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(o);
                        setSheetOpen(true);
                      }}
                    >
                      View / Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OnboardingFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onboarding={editing}
        canManage={canManage}
        onSaved={handleCreatedOrUpdated}
      />
    </div>
  );
}

