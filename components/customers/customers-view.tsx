"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { CustomerList } from "@/components/customers/customer-list";
import { CustomersFilters, type CustomersFiltersState } from "@/components/customers/customers-filters";
import { CustomerDetailSheet } from "@/components/customers/customer-detail-sheet";
import { CustomerCreateSheet } from "@/components/customers/customer-create-sheet";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus } from "lucide-react";
import { canEditCustomerSuccess } from "@/lib/permissions";
import { api } from "@/lib/api";
import { toast } from "sonner";

export type CustomerOption = {
  id: string;
  name: string;
  email: string;
  plan: string;
  churnRisk: string;
  assignedCsmId: string | null;
  assignedCsm?: { id: string; name: string | null; email: string } | null;
  _count?: { supportTickets: number; feedback: number; npsResponses: number };
};

export function CustomersView({
  role,
  organisationId,
}: {
  role: Role;
  organisationId: string;
}) {
  void organisationId;
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get("customer") || null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState<CustomersFiltersState>({
    plan: "",
    churnRisk: "",
    assignedCsmId: "",
  });
  const canEdit = canEditCustomerSuccess(role);
  const hasFilters = Object.values(filters).some(Boolean);

  useEffect(() => {
    setSelectedId(searchParams.get("customer"));
  }, [searchParams]);

  const setSelectedIdAndUrl = useCallback((id: string | null) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("customer", id);
    else url.searchParams.delete("customer");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<{ id: string; name: string | null; email: string }[]>("/api/team/members")
      .then((r) => {
        if (!cancelled) setMembers(r);
      })
      .catch(() => toast.error("Failed to load"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params: Record<string, string> = {};
    if (filters.plan) params.plan = filters.plan;
    if (filters.churnRisk) params.churnRisk = filters.churnRisk;
    if (filters.assignedCsmId) params.assignedCsmId = filters.assignedCsmId;
    api<CustomerOption[]>("/api/customers", { params })
      .then((r) => {
        if (!cancelled) setCustomers(r);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load customers");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [filters]);

  const refetchCustomers = useCallback(() => {
    const params: Record<string, string> = {};
    if (filters.plan) params.plan = filters.plan;
    if (filters.churnRisk) params.churnRisk = filters.churnRisk;
    if (filters.assignedCsmId) params.assignedCsmId = filters.assignedCsmId;
    api<CustomerOption[]>("/api/customers", { params }).then(setCustomers).catch(() => {});
  }, [filters]);

  if (loading && customers.length === 0 && !hasFilters) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <PageShell
      title="Customer Success"
      description="Accounts, feedback, NPS, and support tickets"
      actions={
        <>
          <CustomersFilters filters={filters} setFilters={setFilters} members={members} />
          {canEdit && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add customer
            </Button>
          )}
        </>
      }
    >
      {customers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={hasFilters ? "No customers match your filters" : "No customers yet"}
          description={
            hasFilters
              ? "Try clearing filters or add a new customer."
              : "Add customers to track accounts, feedback, NPS, and support."
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() =>
                  setFilters({ plan: "", churnRisk: "", assignedCsmId: "" })
                }
              >
                Clear filters
              </Button>
            ) : canEdit ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add first customer
              </Button>
            ) : undefined
          }
        />
      ) : (
        <CustomerList
          customers={customers}
          onSelect={setSelectedIdAndUrl}
        />
      )}

      {selectedId && (
        <CustomerDetailSheet
          id={selectedId}
          canEdit={canEdit}
          members={members}
          onClose={() => setSelectedIdAndUrl(null)}
          onUpdated={refetchCustomers}
          onDeleted={() => {
            setCustomers((p) => p.filter((c) => c.id !== selectedId));
            setSelectedIdAndUrl(null);
          }}
        />
      )}

      {createOpen && canEdit && (
        <CustomerCreateSheet
          members={members}
          onClose={() => setCreateOpen(false)}
          onCreated={(customer) => {
            setCustomers((p) => [...p, customer]);
            setCreateOpen(false);
            toast.success("Customer added");
          }}
        />
      )}
    </PageShell>
  );
}
