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
  CAMPAIGN_TYPES,
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_LABELS,
} from "@/lib/constants";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { CampaignOption } from "@/components/gtm/gtm-campaign-list";

export function GtmCampaignCreateSheet({
  members,
  onClose,
  onCreated,
}: {
  members: { id: string; name: string | null; email: string }[];
  onClose: () => void;
  onCreated: (campaign: CampaignOption) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("CONTENT");
  const [status, setStatus] = useState("PLANNED");
  const [ownerId, setOwnerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [targetMetric, setTargetMetric] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const inputClass = "mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const campaign = await api<CampaignOption>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          type,
          status,
          ownerId: ownerId || null,
          startDate: startDate || null,
          endDate: endDate || null,
          budget: budget ? parseFloat(budget) : null,
          targetMetric: targetMetric.trim() || null,
          description: description.trim() || null,
        }),
      });
      onCreated(campaign);
      onClose();
    } catch {
      toast.error("Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add campaign</SheetTitle>
        </SheetHeader>
        <SheetBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
                {CAMPAIGN_TYPES.map((t) => (
                  <option key={t} value={t}>{CAMPAIGN_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Status</Label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                {CAMPAIGN_STATUSES.map((s) => (
                  <option key={s} value={s}>{CAMPAIGN_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label>Owner</Label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputClass}>
              <option value="">—</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name || m.email}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>End date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Budget</Label>
            <Input type="number" step="any" value={budget} onChange={(e) => setBudget(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Target metric</Label>
            <Input value={targetMetric} onChange={(e) => setTargetMetric(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create"}</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
