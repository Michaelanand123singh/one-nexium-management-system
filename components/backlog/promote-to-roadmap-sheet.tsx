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
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { PHASES } from "@/lib/constants";
import { usePhase } from "@/lib/phase-context";

export function PromoteToRoadmapSheet({
  itemId,
  itemTitle,
  epics,
  onClose,
  onPromoted,
}: {
  itemId: string;
  itemTitle: string;
  epics: { id: string; name: string }[];
  onClose: () => void;
  onPromoted: () => void;
}) {
  const { phases: orgPhases, selectedPhase } = usePhase();
  const boardPhases = orgPhases.length > 0 ? orgPhases : PHASES;
  const [targetPhase, setTargetPhase] = useState(
    () => selectedPhase || boardPhases[0] || ""
  );
  const [epicId, setEpicId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api(`/api/backlog/${itemId}/promote-to-roadmap`, {
        method: "POST",
        body: JSON.stringify({
          targetPhase: targetPhase || undefined,
          epicId: epicId || undefined,
        }),
      });
      toast.success("Added to roadmap");
      onPromoted();
      onClose();
    } catch {
      toast.error("Failed to promote");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add to roadmap</SheetTitle>
        </SheetHeader>
        <SheetBody>
        <p className="text-sm text-muted-foreground">
          &ldquo;{itemTitle}&rdquo; will be created as a roadmap item.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <Label>Target phase</Label>
            <select
              value={targetPhase}
              onChange={(e) => setTargetPhase(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">No phase</option>
              {boardPhases.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Epic</Label>
            <select
              value={epicId}
              onChange={(e) => setEpicId(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">—</option>
              {epics.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add to roadmap"}
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
