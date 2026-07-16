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
  CAMPAIGN_TYPES,
  CAMPAIGN_TYPE_LABELS,
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_LABELS,
} from "@/lib/constants";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { CampaignOption } from "@/components/gtm/gtm-campaign-list";

type CampaignDetail = CampaignOption & {
  targetMetric: string | null;
  actualResult: string | null;
  description: string | null;
};

export function GtmCampaignDetailSheet({
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
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api<CampaignDetail>(`/api/campaigns/${id}`)
      .then(setCampaign)
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!canEdit || !confirm("Remove this campaign?")) return;
    try {
      await api(`/api/campaigns/${id}`, { method: "DELETE" });
      onDeleted();
    } catch {
      toast.error("Failed to delete");
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Campaign</SheetTitle>
        </SheetHeader>
        <SheetBody>
          {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : campaign && editing ? (
          <GtmCampaignEditForm
            campaign={campaign}
            id={id}
            members={members}
            onClose={() => setEditing(false)}
            onSaved={async () => {
              setEditing(false);
              toast.success("Saved");
              const full = await api<CampaignDetail>(`/api/campaigns/${id}`);
              setCampaign(full);
              onUpdated();
            }}
          />
        ) : campaign ? (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Name</h3>
              <p className="mt-1 font-medium">{campaign.name}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                {CAMPAIGN_TYPE_LABELS[campaign.type as keyof typeof CAMPAIGN_TYPE_LABELS] ?? campaign.type}
              </Badge>
              <Badge variant="secondary">
                {CAMPAIGN_STATUS_LABELS[campaign.status as keyof typeof CAMPAIGN_STATUS_LABELS] ?? campaign.status}
              </Badge>
              {campaign.owner && (
                <span className="text-sm text-muted-foreground">
                  Owner: {campaign.owner.name || campaign.owner.email}
                </span>
              )}
            </div>
            {(campaign.startDate || campaign.endDate) && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Dates</h3>
                <p className="mt-1 text-sm">
                  {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : "—"} →{" "}
                  {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : "—"}
                </p>
              </div>
            )}
            {campaign.budget != null && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Budget</h3>
                <p className="mt-1 text-sm">{campaign.budget}</p>
              </div>
            )}
            {campaign.targetMetric && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Target metric</h3>
                <p className="mt-1 text-sm">{campaign.targetMetric}</p>
              </div>
            )}
            {campaign.actualResult && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Actual result</h3>
                <p className="mt-1 text-sm">{campaign.actualResult}</p>
              </div>
            )}
            {campaign.description && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{campaign.description}</p>
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
          <p className="text-sm text-muted-foreground">Campaign not found.</p>
        )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function GtmCampaignEditForm({
  campaign,
  id,
  members,
  onClose,
  onSaved,
}: {
  campaign: CampaignDetail;
  id: string;
  members: { id: string; name: string | null; email: string }[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(campaign.name);
  const [type, setType] = useState(campaign.type);
  const [status, setStatus] = useState(campaign.status);
  const [ownerId, setOwnerId] = useState(campaign.ownerId ?? "");
  const [startDate, setStartDate] = useState(campaign.startDate ? new Date(campaign.startDate).toISOString().slice(0, 10) : "");
  const [endDate, setEndDate] = useState(campaign.endDate ? new Date(campaign.endDate).toISOString().slice(0, 10) : "");
  const [budget, setBudget] = useState(campaign.budget ?? "");
  const [targetMetric, setTargetMetric] = useState(campaign.targetMetric ?? "");
  const [actualResult, setActualResult] = useState(campaign.actualResult ?? "");
  const [description, setDescription] = useState(campaign.description ?? "");
  const [saving, setSaving] = useState(false);

  const inputClass = "mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/api/campaigns/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          type,
          status,
          ownerId: ownerId || null,
          startDate: startDate || null,
          endDate: endDate || null,
          budget: budget === "" ? null : parseFloat(String(budget)),
          targetMetric: targetMetric.trim() || null,
          actualResult: actualResult.trim() || null,
          description: description.trim() || null,
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
        <Label>Actual result</Label>
        <Input value={actualResult} onChange={(e) => setActualResult(e.target.value)} className="mt-1" />
      </div>
      <div>
        <Label>Description</Label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
