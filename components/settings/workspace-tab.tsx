"use client";

import { useCallback, useEffect, useState } from "react";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { canManagePhases } from "@/lib/permissions";
import { usePhase } from "@/lib/phase-context";
import { toast } from "sonner";
import { Layers, Plus, Trash2 } from "lucide-react";

export function WorkspaceTab({ role }: { role: Role }) {
  const canEdit = canManagePhases(role);
  const { phases: contextPhases, reloadPhases } = usePhase();
  const [phases, setPhases] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPhaseNum, setNewPhaseNum] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api<string[]>("/api/settings/phases")
      .then((list) => setPhases(Array.isArray(list) ? list : []))
      .catch(() => toast.error("Failed to load phases"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (contextPhases.length && phases.length === 0 && !loading) {
      setPhases(contextPhases);
    }
  }, [contextPhases, phases.length, loading]);

  async function save(next: string[]) {
    if (!canEdit) return;
    setSaving(true);
    try {
      const saved = await api<string[]>("/api/settings/phases", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setPhases(Array.isArray(saved) ? saved : next);
      await reloadPhases();
      toast.success("Phases updated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save phases");
    } finally {
      setSaving(false);
    }
  }

  function addPhase() {
    const n = parseInt(newPhaseNum, 10);
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Enter a valid phase number (e.g. 7)");
      return;
    }
    const label = `Phase ${n}`;
    if (phases.includes(label)) {
      toast.error(`${label} already exists`);
      return;
    }
    const next = [...phases, label].sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ""), 10) || 0;
      const nb = parseInt(b.replace(/\D/g, ""), 10) || 0;
      return na - nb;
    });
    setNewPhaseNum("");
    void save(next);
  }

  function removePhase(label: string) {
    if (phases.length <= 1) {
      toast.error("Keep at least one phase");
      return;
    }
    void save(phases.filter((p) => p !== label));
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <Layers className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="font-medium">Workspace phases</h3>
            <p className="text-sm text-muted-foreground">
              Phases filter Roadmap, Backlog, and the Command Centre. Names must match{" "}
              <code className="rounded bg-muted px-1 text-xs">Phase N</code>.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <ul className="space-y-2">
            {phases.map((p) => (
              <li
                key={p}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>{p}</span>
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    disabled={saving || phases.length <= 1}
                    onClick={() => removePhase(p)}
                    aria-label={`Remove ${p}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit ? (
          <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="phase-num">Add phase number</Label>
              <Input
                id="phase-num"
                type="number"
                min={1}
                placeholder="e.g. 7"
                value={newPhaseNum}
                onChange={(e) => setNewPhaseNum(e.target.value)}
                className="w-36"
              />
            </div>
            <Button type="button" size="sm" disabled={saving} onClick={addPhase}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add phase
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Only Super Admin and Product Manager can change phases.
          </p>
        )}
      </Card>
    </div>
  );
}
