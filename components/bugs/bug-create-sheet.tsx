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
import { BUG_SEVERITIES, BUG_SEVERITY_LABELS } from "@/lib/constants";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { BugOption } from "@/components/bugs/bugs-view";

export function BugCreateSheet({
  members,
  onClose,
  onCreated,
}: {
  members: { id: string; name: string | null; email: string }[];
  onClose: () => void;
  onCreated: (bug: BugOption) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [expectedBehaviour, setExpectedBehaviour] = useState("");
  const [actualBehaviour, setActualBehaviour] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [platform, setPlatform] = useState("");
  const [browserDevice, setBrowserDevice] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const bug = await api<BugOption>("/api/bugs", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          stepsToReproduce: stepsToReproduce.trim() || undefined,
          expectedBehaviour: expectedBehaviour.trim() || undefined,
          actualBehaviour: actualBehaviour.trim() || undefined,
          severity,
          platform: platform.trim() || undefined,
          browserDevice: browserDevice.trim() || undefined,
          assignedToId: assigneeId || undefined,
        }),
      });
      onCreated(bug);
      onClose();
    } catch {
      toast.error("Failed to report bug");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Report bug</SheetTitle>
        </SheetHeader>
        <SheetBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="bug-title">Title</Label>
            <Input
              id="bug-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Login fails on Safari"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="bug-desc">Description</Label>
            <textarea
              id="bug-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <Label htmlFor="bug-steps">Steps to reproduce</Label>
            <textarea
              id="bug-steps"
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              rows={2}
              placeholder="1. Go to... 2. Click..."
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <Label>Expected behaviour</Label>
            <Input
              value={expectedBehaviour}
              onChange={(e) => setExpectedBehaviour(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Actual behaviour</Label>
            <Input
              value={actualBehaviour}
              onChange={(e) => setActualBehaviour(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Severity</Label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {BUG_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {BUG_SEVERITY_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Assignee</Label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Platform</Label>
              <Input
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder="e.g. Web, iOS"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Browser / Device</Label>
              <Input
                value={browserDevice}
                onChange={(e) => setBrowserDevice(e.target.value)}
                placeholder="e.g. Chrome 120"
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Reporting…" : "Report bug"}
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
