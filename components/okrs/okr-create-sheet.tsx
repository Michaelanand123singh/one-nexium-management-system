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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PHASES, OKR_LEVELS, OKR_LEVEL_LABELS } from "@/lib/constants";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { OkrOption } from "@/components/okrs/okrs-view";

type KrInput = { metricName: string; targetValue: number; unit: string };

export function OkrCreateSheet({
  members,
  onClose,
  onCreated,
}: {
  members: { id: string; name: string | null; email: string }[];
  onClose: () => void;
  onCreated: (okr: OkrOption) => void;
}) {
  const [objective, setObjective] = useState("");
  const [period, setPeriod] = useState(PHASES[0] ?? "Phase 1");
  const [level, setLevel] = useState("COMPANY");
  const [ownerId, setOwnerId] = useState("");
  const [parentOkrId, setParentOkrId] = useState("");
  const [keyResults, setKeyResults] = useState<KrInput[]>([
    { metricName: "", targetValue: 0, unit: "" },
  ]);
  const [parentOkrs, setParentOkrs] = useState<{ id: string; objective: string; period: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<{ id: string; objective: string; period: string }[]>("/api/okrs")
      .then((r) => setParentOkrs(Array.isArray(r) ? r.map((o) => ({ id: o.id, objective: o.objective, period: o.period })) : []))
      .catch(() => { });
  }, []);

  function addKr() {
    setKeyResults((p) => [...p, { metricName: "", targetValue: 0, unit: "" }]);
  }

  function removeKr(index: number) {
    setKeyResults((p) => p.filter((_, i) => i !== index));
  }

  function updateKr(index: number, field: keyof KrInput, value: string | number) {
    setKeyResults((p) => {
      const next = [...p];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!objective.trim()) return;
    const krs = keyResults.filter((kr) => kr.metricName.trim() && kr.targetValue > 0);
    setSubmitting(true);
    try {
      const okr = await api<OkrOption>("/api/okrs", {
        method: "POST",
        body: JSON.stringify({
          objective: objective.trim(),
          period: period.trim(),
          level,
          ownerId: ownerId || undefined,
          parentOkrId: parentOkrId || null,
          keyResults: krs.length ? krs.map((kr) => ({
            metricName: kr.metricName.trim(),
            targetValue: kr.targetValue,
            unit: kr.unit.trim() || null,
          })) : undefined,
        }),
      });
      onCreated(okr);
      onClose();
    } catch {
      toast.error("Failed to create OKR");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add OKR</SheetTitle>
        </SheetHeader>
        <SheetBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="okr-objective">Objective</Label>
            <Input
              id="okr-objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Ship the new dashboard by end of Q2"
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
                <option value="">Me</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.email}
                  </option>
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
              <Label>Key results (optional)</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addKr}>
                Add
              </Button>
            </div>
            <ul className="mt-2 space-y-3">
              {keyResults.map((kr, index) => (
                <li key={index} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2">
                  <div className="min-w-[140px] flex-1">
                    <Label className="text-xs">Metric</Label>
                    <Input
                      value={kr.metricName}
                      onChange={(e) => updateKr(index, "metricName", e.target.value)}
                      placeholder="e.g. DAU"
                      className="h-8"
                    />
                  </div>
                  <div className="w-20">
                    <Label className="text-xs">Target</Label>
                    <Input
                      type="number"
                      step="any"
                      value={kr.targetValue || ""}
                      onChange={(e) => updateKr(index, "targetValue", parseFloat(e.target.value) || 0)}
                      className="h-8"
                    />
                  </div>
                  <div className="w-16">
                    <Label className="text-xs">Unit</Label>
                    <Input
                      value={kr.unit}
                      onChange={(e) => updateKr(index, "unit", e.target.value)}
                      placeholder="%"
                      className="h-8"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive"
                    onClick={() => removeKr(index)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create OKR"}
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
