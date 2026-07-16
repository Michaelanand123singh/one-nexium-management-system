"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CUSTOMER_PLANS,
  CUSTOMER_PLAN_LABELS,
  CHURN_RISKS,
  CHURN_RISK_LABELS,
  TICKET_STATUS_LABELS,
} from "@/lib/constants";
import { api } from "@/lib/api";
import { toast } from "sonner";

type TicketRow = {
  id: string;
  title: string;
  status: string;
  severity: string | null;
  assignedCsm?: { id: string; name: string | null; email: string } | null;
};

type CustomerDetail = {
  id: string;
  name: string;
  email: string;
  plan: string;
  churnRisk: string;
  signupDate: string;
  lastActiveAt: string | null;
  onboardingStatus: string | null;
  npsScore: number | null;
  assignedCsmId: string | null;
  notes: string | null;
  assignedCsm?: { id: string; name: string | null; email: string } | null;
  supportTickets: TicketRow[];
  feedback: { id: string; type: string | null; content: string; createdAt: string }[];
  npsResponses: { id: string; score: number; feedback: string | null; createdAt: string }[];
};

export function CustomerDetailSheet({
  id,
  canEdit,
  members,
  onClose,
  onUpdated,
  onDeleted,
}: {
  id: string;
  canEdit: boolean;
  members: { id: string; name: string | null; email: string }[];
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [addTicketOpen, setAddTicketOpen] = useState(false);
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketSubmitting, setTicketSubmitting] = useState(false);

  useEffect(() => {
    api<CustomerDetail>(`/api/customers/${id}`)
      .then(setCustomer)
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!canEdit || !confirm("Remove this customer? This cannot be undone.")) return;
    try {
      await api(`/api/customers/${id}`, { method: "DELETE" });
      onDeleted();
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function handleAddTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!ticketTitle.trim()) return;
    setTicketSubmitting(true);
    try {
      await api("/api/support-tickets", {
        method: "POST",
        body: JSON.stringify({
          customerId: id,
          title: ticketTitle.trim(),
          description: ticketDescription.trim() || null,
          status: "OPEN",
        }),
      });
      const updated = await api<CustomerDetail>(`/api/customers/${id}`);
      setCustomer(updated);
      setTicketTitle("");
      setTicketDescription("");
      setAddTicketOpen(false);
      onUpdated();
      toast.success("Ticket created");
    } catch {
      toast.error("Failed to create ticket");
    } finally {
      setTicketSubmitting(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Customer</SheetTitle>
        </SheetHeader>
        <SheetBody>
          {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : customer && editing ? (
          <CustomerEditForm
            customer={customer}
            id={id}
            members={members}
            onClose={() => setEditing(false)}
            onSaved={async () => {
              setEditing(false);
              toast.success("Saved");
              const full = await api<CustomerDetail>(`/api/customers/${id}`);
              setCustomer(full);
              onUpdated();
            }}
          />
        ) : customer ? (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Name</h3>
              <p className="mt-1 font-medium">{customer.name}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Email</h3>
              <p className="mt-1 text-sm">{customer.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                {CUSTOMER_PLAN_LABELS[customer.plan as keyof typeof CUSTOMER_PLAN_LABELS] ?? customer.plan}
              </Badge>
              <Badge
                variant={
                  customer.churnRisk === "HIGH" ? "destructive" : customer.churnRisk === "MEDIUM" ? "secondary" : "outline"
                }
              >
                {CHURN_RISK_LABELS[customer.churnRisk as keyof typeof CHURN_RISK_LABELS] ?? customer.churnRisk}
              </Badge>
              {customer.assignedCsm && (
                <span className="text-sm text-muted-foreground">
                  CSM: {customer.assignedCsm.name || customer.assignedCsm.email}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {customer.signupDate && (
                <span>Signed up: {new Date(customer.signupDate).toLocaleDateString()}</span>
              )}
              {customer.lastActiveAt && (
                <span>Last active: {new Date(customer.lastActiveAt).toLocaleDateString()}</span>
              )}
              {customer.npsScore != null && <span>NPS: {customer.npsScore}</span>}
            </div>
            {customer.onboardingStatus && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Onboarding</h3>
                <p className="mt-1 text-sm">{customer.onboardingStatus}</p>
              </div>
            )}
            {customer.notes && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Notes</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{customer.notes}</p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">Support tickets</h3>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddTicketOpen(true)}
                  >
                    Add ticket
                  </Button>
                )}
              </div>
              {addTicketOpen && canEdit && (
                <form onSubmit={handleAddTicket} className="mt-2 rounded-md border border-border bg-muted/30 p-3 space-y-2">
                  <Input
                    placeholder="Ticket title"
                    value={ticketTitle}
                    onChange={(e) => setTicketTitle(e.target.value)}
                    required
                    className="h-8"
                  />
                  <textarea
                    placeholder="Description (optional)"
                    value={ticketDescription}
                    onChange={(e) => setTicketDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={ticketSubmitting}>
                      {ticketSubmitting ? "Creating…" : "Create"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setAddTicketOpen(false); setTicketTitle(""); setTicketDescription(""); }}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
              <ul className="mt-2 space-y-2">
                {customer.supportTickets.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No tickets</li>
                ) : (
                  customer.supportTickets.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{t.title}</span>
                      <Badge variant="outline">
                        {TICKET_STATUS_LABELS[t.status as keyof typeof TICKET_STATUS_LABELS] ?? t.status}
                      </Badge>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {customer.feedback.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Recent feedback</h3>
                <ul className="mt-2 space-y-1">
                  {customer.feedback.slice(0, 5).map((f) => (
                    <li key={f.id} className="text-sm text-muted-foreground line-clamp-2">
                      {f.type && <span className="font-medium">{f.type}: </span>}
                      {f.content}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {customer.npsResponses.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Recent NPS</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {customer.npsResponses.slice(0, 5).map((n) => (
                    <li key={n.id}>
                      Score: {n.score}
                      {n.feedback && ` — ${n.feedback}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {canEdit && (
              <div className="flex gap-2 border-t border-border pt-4">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  Remove
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Customer not found.</p>
        )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function CustomerEditForm({
  customer,
  id,
  members,
  onClose,
  onSaved,
}: {
  customer: CustomerDetail;
  id: string;
  members: { id: string; name: string | null; email: string }[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email);
  const [plan, setPlan] = useState(customer.plan);
  const [churnRisk, setChurnRisk] = useState(customer.churnRisk);
  const [assignedCsmId, setAssignedCsmId] = useState(customer.assignedCsmId ?? "");
  const [onboardingStatus, setOnboardingStatus] = useState(customer.onboardingStatus ?? "");
  const [npsScore, setNpsScore] = useState(customer.npsScore ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [saving, setSaving] = useState(false);

  const inputClass = "mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/api/customers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          plan,
          churnRisk,
          assignedCsmId: assignedCsmId || null,
          onboardingStatus: onboardingStatus.trim() || null,
          npsScore: npsScore === "" ? null : parseInt(String(npsScore), 10),
          notes: notes.trim() || null,
        }),
      });
      await onSaved();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
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
        <Label>Onboarding status</Label>
        <Input value={onboardingStatus} onChange={(e) => setOnboardingStatus(e.target.value)} className="mt-1" />
      </div>
      <div>
        <Label>NPS score</Label>
        <Input type="number" min={0} max={10} value={npsScore} onChange={(e) => setNpsScore(e.target.value)} className="mt-1" />
      </div>
      <div>
        <Label>Notes</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
