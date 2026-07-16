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
import { api } from "@/lib/api";
import { toast } from "sonner";
import { PHASES } from "@/lib/constants";
import { usePhase } from "@/lib/phase-context";

export function EpicCreateSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { phases: orgPhases, selectedPhase } = usePhase();
  const boardPhases = orgPhases.length > 0 ? orgPhases : PHASES;
  const [name, setName] = useState("");
  const [targetPhase, setTargetPhase] = useState(
    () => selectedPhase || boardPhases[0] || ""
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await api("/api/roadmap/epics", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          targetPhase: targetPhase || undefined,
        }),
      });
      onCreated();
      onClose();
      toast.success("Epic created");
    } catch {
      toast.error("Failed to create epic");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New epic</SheetTitle>
        </SheetHeader>
        <SheetBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="epic-name">Name</Label>
            <Input
              id="epic-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Platform reliability"
              required
              className="mt-1"
            />
          </div>
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
          <div className="flex gap-2 pt-2">
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
