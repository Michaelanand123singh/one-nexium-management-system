"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CUSTOMER_PLANS,
  CUSTOMER_PLAN_LABELS,
  CHURN_RISKS,
  CHURN_RISK_LABELS,
} from "@/lib/constants";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { CustomerOption } from "@/components/customers/customers-view";

export function CustomerCreateSheet({
  members,
  onClose,
  onCreated,
}: {
  members: { id: string; name: string | null; email: string }[];
  onClose: () => void;
  onCreated: (customer: CustomerOption) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("FREE");
  const [churnRisk, setChurnRisk] = useState("LOW");
  const [assignedCsmId, setAssignedCsmId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const inputClass = "mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    try {
      const customer = await api<CustomerOption>("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          plan,
          churnRisk,
          assignedCsmId: assignedCsmId || null,
          notes: notes.trim() || null,
        }),
      });
      onCreated(customer);
      onClose();
    } catch {
      toast.error("Failed to create customer");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add customer</SheetTitle>
        </SheetHeader>
        <SheetBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Plan</Label>
              <select value={plan} onChange={(e) => setPlan(e.target.value)} className={inputClass}>
                {CUSTOMER_PLANS.map((p) => (
                  <option key={p} value={p}>{CUSTOMER_PLAN_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Churn risk</Label>
              <select value={churnRisk} onChange={(e) => setChurnRisk(e.target.value)} className={inputClass}>
                {CHURN_RISKS.map((r) => (
                  <option key={r} value={r}>{CHURN_RISK_LABELS[r]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label>Assigned CSM</Label>
            <select value={assignedCsmId} onChange={(e) => setAssignedCsmId(e.target.value)} className={inputClass}>
              <option value="">—</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name || m.email}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
