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
  PARTNER_TYPES,
  PARTNER_TYPE_LABELS,
  PARTNER_TIERS,
  PARTNER_TIER_LABELS,
  PARTNER_STATUSES,
  PARTNER_STATUS_LABELS,
  PARTNER_PIPELINE_STAGES,
  PARTNER_PIPELINE_LABELS,
} from "@/lib/constants";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { PartnerOption } from "@/components/gtm/gtm-partner-list";

export function GtmPartnerCreateSheet({
  members,
  onClose,
  onCreated,
}: {
  members: { id: string; name: string | null; email: string }[];
  onClose: () => void;
  onCreated: (partner: PartnerOption) => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [type, setType] = useState("REFERRAL");
  const [tier, setTier] = useState("BRONZE");
  const [status, setStatus] = useState("APPLIED");
  const [pipelineStage, setPipelineStage] = useState("IDENTIFIED");
  const [region, setRegion] = useState("");
  const [niche, setNiche] = useState("");
  const [audienceSize, setAudienceSize] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const inputClass = "mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) return;
    setSubmitting(true);
    try {
      const partner = await api<PartnerOption>("/api/partners", {
        method: "POST",
        body: JSON.stringify({
          companyName: companyName.trim(),
          contactPerson: contactPerson.trim() || null,
          type,
          tier,
          status,
          pipelineStage,
          region: region.trim() || null,
          niche: niche.trim() || null,
          audienceSize: audienceSize.trim() || null,
          assignedToId: assignedToId || null,
          referralCode: referralCode.trim() || null,
        }),
      });
      onCreated(partner);
      onClose();
    } catch {
      toast.error("Failed to create partner");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add partner</SheetTitle>
        </SheetHeader>
        <SheetBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>Company name</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <Label>Contact person</Label>
            <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
                {PARTNER_TYPES.map((t) => (
                  <option key={t} value={t}>{PARTNER_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Tier</Label>
              <select value={tier} onChange={(e) => setTier(e.target.value)} className={inputClass}>
                {PARTNER_TIERS.map((t) => (
                  <option key={t} value={t}>{PARTNER_TIER_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                {PARTNER_STATUSES.map((s) => (
                  <option key={s} value={s}>{PARTNER_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Pipeline stage</Label>
              <select value={pipelineStage} onChange={(e) => setPipelineStage(e.target.value)} className={inputClass}>
                {PARTNER_PIPELINE_STAGES.map((p) => (
                  <option key={p} value={p}>{PARTNER_PIPELINE_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Region</Label>
              <Input value={region} onChange={(e) => setRegion(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Niche</Label>
              <Input value={niche} onChange={(e) => setNiche(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Audience size</Label>
            <Input value={audienceSize} onChange={(e) => setAudienceSize(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Assigned to</Label>
            <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className={inputClass}>
              <option value="">—</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name || m.email}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Referral code</Label>
            <Input value={referralCode} onChange={(e) => setReferralCode(e.target.value)} className="mt-1" />
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
