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
  PHASES,
  OKR_LEVELS,
  OKR_LEVEL_LABELS,
  OKR_CONFIDENCE,
  OKR_CONFIDENCE_LABELS,
} from "@/lib/constants";
import { api } from "@/lib/api";
import { toast } from "sonner";

type KeyResultRow = {
  id?: string;
  metricName: string;
  currentValue: number;
  targetValue: number;
  unit: string | null;
  confidence: string;
};

type OkrDetail = {
  id: string;
  objective: string;
  period: string;
  level: string;
  ownerId: string;
  parentOkrId: string | null;
  owner?: { id: string; name: string | null; email: string } | null;
  parentOkr?: { id: string; objective: string; period: string } | null;
  keyResults: {
    id: string;
    metricName: string;
    currentValue: number;
    targetValue: number;
    unit: string | null;
    progress: number;
    confidence: string;
  }[];
  childOkrs?: { id: string; objective: string; period: string; level: string }[];
};

export function OkrDetailSheet({
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
  const [okr, setOkr] = useState<OkrDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [parentOkrs, setParentOkrs] = useState<{ id: string; objective: string; period: string }[]>([]);

  useEffect(() => {
    api<OkrDetail>(`/api/okrs/${id}`)
      .then(setOkr)
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    api<{ id: string; objective: string; period: string }[]>("/api/okrs")
      .then((r) => setParentOkrs(Array.isArray(r) ? r.filter((o) => o.id !== id).map((o) => ({ id: o.id, objective: o.objective, period: o.period })) : []))
      .catch(() => { });
  }, [id]);

  async function handleDelete() {
    if (!canEdit || !confirm("Remove this OKR? Key results will be deleted.")) return;
    try {
      await api(`/api/okrs/${id}`, { method: "DELETE" });
      onDeleted();
    } catch {
      toast.error("Failed to delete");
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>OKR</SheetTitle>
        </SheetHeader>
        <SheetBody>
          {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : okr && editing ? (
          <OkrDetailEditForm
            okr={okr}
            id={id}
            members={members}
            parentOkrs={parentOkrs}
            onClose={() => setEditing(false)}
            onSaved={async () => {
              setEditing(false);
              toast.success("Saved");
              const full = await api<OkrDetail>(`/api/okrs/${id}`);
              setOkr(full);
              onUpdated();
            }}
          />
        ) : okr ? (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Objective</h3>
              <p className="mt-1 font-medium">{okr.objective}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{okr.period}</Badge>
              <Badge variant="secondary">
                {OKR_LEVEL_LABELS[okr.level as keyof typeof OKR_LEVEL_LABELS] ?? okr.level}
              </Badge>
              {okr.owner && (
                <span className="text-sm text-muted-foreground">
                  Owner: {okr.owner.name || okr.owner.email}
                </span>
              )}
            </div>
            {okr.parentOkr && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Parent OKR</h3>
                <p className="mt-1 text-sm">
                  {okr.parentOkr.objective} ({okr.parentOkr.period})
                </p>
              </div>
            )}
            {okr.keyResults && okr.keyResults.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Key results</h3>
                <ul className="mt-2 space-y-2">
                  {okr.keyResults.map((kr) => (
                    <li
                      key={kr.id}
                      className="rounded-md border border-border bg-muted/30 p-3 text-sm"
                    >
                      <div className="font-medium">{kr.metricName}</div>
                      <div className="mt-1 text-muted-foreground">
                        {kr.currentValue} / {kr.targetValue}
                        {kr.unit ? ` ${kr.unit}` : ""} — {Math.round(kr.progress)}%
                      </div>
                      <Badge variant="outline" className="mt-1">
                        {OKR_CONFIDENCE_LABELS[kr.confidence as keyof typeof OKR_CONFIDENCE_LABELS] ?? kr.confidence}
                      </Badge>
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
          <p className="text-sm text-muted-foreground">OKR not found.</p>
        )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function OkrDetailEditForm({
  okr,
  id,
  members,
  parentOkrs,
  onClose,
  onSaved,
}: {
  okr: OkrDetail;
  id: string;
  members: { id: string; name: string | null; email: string }[];
  parentOkrs: { id: string; objective: string; period: string }[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [objective, setObjective] = useState(okr.objective);
  const [period, setPeriod] = useState(okr.period);
  const [level, setLevel] = useState(okr.level);
  const [ownerId, setOwnerId] = useState(okr.ownerId);
  const [parentOkrId, setParentOkrId] = useState(okr.parentOkrId ?? "");
  const [keyResults, setKeyResults] = useState<KeyResultRow[]>(
    okr.keyResults.map((kr) => ({
      id: kr.id,
      metricName: kr.metricName,
      currentValue: kr.currentValue,
      targetValue: kr.targetValue,
      unit: kr.unit,
      confidence: kr.confidence,
    }))
  );
  const [saving, setSaving] = useState(false);

  function addKr() {
    setKeyResults((p) => [
      ...p,
      { metricName: "", currentValue: 0, targetValue: 0, unit: null, confidence: "ON_TRACK" },
    ]);
  }

  function removeKr(index: number) {
    setKeyResults((p) => p.filter((_, i) => i !== index));
  }

  function updateKr(index: number, field: keyof KeyResultRow, value: string | number | null) {
    setKeyResults((p) => {
      const next = [...p];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const invalidKr = keyResults.some((kr) => !kr.metricName.trim() || kr.targetValue === 0);
    if (invalidKr) {
      toast.error("Each key result needs a name and target > 0");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/okrs/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          objective: objective.trim(),
          period: period.trim(),
          level,
          ownerId,
          parentOkrId: parentOkrId || null,
          keyResults: keyResults.map((kr) => ({
            id: kr.id,
            metricName: kr.metricName.trim(),
            currentValue: kr.currentValue,
            targetValue: kr.targetValue,
            unit: kr.unit?.trim() || null,
            confidence: kr.confidence,
          })),
        }),
      });
      await onSaved();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
      <div>
        <Label>Objective</Label>
        <Input
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          required
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Period</Label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className={inputClass}
          >
            {PHASES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Level</Label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className={inputClass}
          >
            {OKR_LEVELS.map((l) => (
              <option key={l} value={l}>{OKR_LEVEL_LABELS[l]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Owner</Label>
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className={inputClass}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.email}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Parent OKR</Label>
          <select
            value={parentOkrId}
            onChange={(e) => setParentOkrId(e.target.value)}
            className={inputClass}
          >
            <option value="">—</option>
            {parentOkrs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.objective} ({o.period})
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label>Key results</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addKr}>
            Add key result
          </Button>
        </div>
        <ul className="mt-2 space-y-3">
          {keyResults.map((kr, index) => (
            <li key={index} className="rounded-md border border-border p-3 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">#{index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-destructive"
                  onClick={() => removeKr(index)}
                >
                  Remove
                </Button>
              </div>
              <Input
                placeholder="Metric name"
                value={kr.metricName}
                onChange={(e) => updateKr(index, "metricName", e.target.value)}
                className="h-8"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Current</Label>
                  <Input
                    type="number"
                    step="any"
                    value={kr.currentValue}
                    onChange={(e) => updateKr(index, "currentValue", parseFloat(e.target.value) || 0)}
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Target</Label>
                  <Input
                    type="number"
                    step="any"
                    value={kr.targetValue}
                    onChange={(e) => updateKr(index, "targetValue", parseFloat(e.target.value) || 0)}
                    className="h-8"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Unit</Label>
                  <Input
                    value={kr.unit ?? ""}
                    onChange={(e) => updateKr(index, "unit", e.target.value || null)}
                    placeholder="e.g. %"
                    className="h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Confidence</Label>
                  <select
                    value={kr.confidence}
                    onChange={(e) => updateKr(index, "confidence", e.target.value)}
                    className={inputClass}
                  >
                    {OKR_CONFIDENCE.map((c) => (
                      <option key={c} value={c}>{OKR_CONFIDENCE_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
