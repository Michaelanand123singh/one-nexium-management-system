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

type PartnerDetail = PartnerOption & {
  region: string | null;
  niche: string | null;
  audienceSize: string | null;
  referralCode: string | null;
};

export function GtmPartnerDetailSheet({
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
  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api<PartnerDetail>(`/api/partners/${id}`)
      .then(setPartner)
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!canEdit || !confirm("Remove this partner?")) return;
    try {
      await api(`/api/partners/${id}`, { method: "DELETE" });
      onDeleted();
    } catch {
      toast.error("Failed to delete");
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Partner</SheetTitle>
        </SheetHeader>
        <SheetBody>
          {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : partner && editing ? (
          <GtmPartnerEditForm
            partner={partner}
            id={id}
            members={members}
            onClose={() => setEditing(false)}
            onSaved={async () => {
              setEditing(false);
              toast.success("Saved");
              const full = await api<PartnerDetail>(`/api/partners/${id}`);
              setPartner(full);
              onUpdated();
            }}
          />
        ) : partner ? (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Company</h3>
              <p className="mt-1 font-medium">{partner.companyName}</p>
            </div>
            {partner.contactPerson && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Contact</h3>
                <p className="mt-1 text-sm">{partner.contactPerson}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{PARTNER_TYPE_LABELS[partner.type as keyof typeof PARTNER_TYPE_LABELS] ?? partner.type}</Badge>
              <Badge variant="secondary">{PARTNER_TIER_LABELS[partner.tier as keyof typeof PARTNER_TIER_LABELS] ?? partner.tier}</Badge>
              <Badge>{PARTNER_STATUS_LABELS[partner.status as keyof typeof PARTNER_STATUS_LABELS] ?? partner.status}</Badge>
              <span className="text-sm text-muted-foreground">
                Stage: {PARTNER_PIPELINE_LABELS[partner.pipelineStage as keyof typeof PARTNER_PIPELINE_LABELS] ?? partner.pipelineStage}
              </span>
            </div>
            {(partner.region || partner.niche) && (
              <div className="text-sm text-muted-foreground">
                {[partner.region, partner.niche].filter(Boolean).join(" · ")}
              </div>
            )}
            {partner.audienceSize && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Audience size</h3>
                <p className="mt-1 text-sm">{partner.audienceSize}</p>
              </div>
            )}
            {partner.assignedTo && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Assigned to</h3>
                <p className="mt-1 text-sm">{partner.assignedTo.name || partner.assignedTo.email}</p>
              </div>
            )}
            {partner.referralCode && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Referral code</h3>
                <p className="mt-1 font-mono text-sm">{partner.referralCode}</p>
              </div>
            )}
            {canEdit && (
              <div className="flex gap-2 border-t border-border pt-4">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
                <Button variant="destructive" size="sm" onClick={handleDelete}>Remove</Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Partner not found.</p>
        )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function GtmPartnerEditForm({
  partner,
  id,
  members,
  onClose,
  onSaved,
}: {
  partner: PartnerDetail;
  id: string;
  members: { id: string; name: string | null; email: string }[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [companyName, setCompanyName] = useState(partner.companyName);
  const [contactPerson, setContactPerson] = useState(partner.contactPerson ?? "");
  const [type, setType] = useState(partner.type);
  const [tier, setTier] = useState(partner.tier);
  const [status, setStatus] = useState(partner.status);
  const [pipelineStage, setPipelineStage] = useState(partner.pipelineStage);
  const [region, setRegion] = useState(partner.region ?? "");
  const [niche, setNiche] = useState(partner.niche ?? "");
  const [audienceSize, setAudienceSize] = useState(partner.audienceSize ?? "");
  const [assignedToId, setAssignedToId] = useState(partner.assignedToId ?? "");
  const [referralCode, setReferralCode] = useState(partner.referralCode ?? "");
  const [saving, setSaving] = useState(false);

  const inputClass = "mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/api/partners/${id}`, {
        method: "PATCH",
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
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
