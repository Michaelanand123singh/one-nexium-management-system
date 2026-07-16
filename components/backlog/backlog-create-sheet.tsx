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
import type { BacklogItemType } from "@/components/backlog/backlog-view";
import type { EpicType } from "@/components/backlog/backlog-view";

export function BacklogCreateSheet({
  epics,
  onRefetchEpics,
  onClose,
  onCreated,
}: {
  epics: EpicType[];
  onRefetchEpics?: () => void | Promise<void>;
  onClose: () => void;
  onCreated: (item: BacklogItemType) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("FEATURE");
  const [source, setSource] = useState("INTERNAL");
  const [priorityScore, setPriorityScore] = useState("");
  const [epicId, setEpicId] = useState("");
  const [effortEstimate, setEffortEstimate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showNewEpic, setShowNewEpic] = useState(false);
  const [newEpicName, setNewEpicName] = useState("");
  const [creatingEpic, setCreatingEpic] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const item = await api<BacklogItemType>("/api/backlog", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          source,
          priorityScore: priorityScore ? Number(priorityScore) : undefined,
          epicId: epicId || undefined,
          effortEstimate: effortEstimate || undefined,
        }),
      });
      onCreated(item);
      onClose();
    } catch {
      toast.error("Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>New backlog item</SheetTitle>
        </SheetHeader>
        <SheetBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Add dark mode"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="FEATURE">Feature</option>
                <option value="IMPROVEMENT">Improvement</option>
                <option value="TECH_DEBT">Tech Debt</option>
                <option value="RESEARCH">Research</option>
              </select>
            </div>
            <div>
              <Label>Source</Label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="INTERNAL">Internal</option>
                <option value="CUSTOMER_FEEDBACK">Customer feedback</option>
                <option value="PARTNER_REQUEST">Partner request</option>
                <option value="COMPETITOR_ANALYSIS">Competitor analysis</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Priority score</Label>
              <Input
                id="priority"
                type="number"
                step="0.1"
                value={priorityScore}
                onChange={(e) => setPriorityScore(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="effort">Effort estimate</Label>
              <Input
                id="effort"
                value={effortEstimate}
                onChange={(e) => setEffortEstimate(e.target.value)}
                placeholder="e.g. 3 points, M"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label>Epic</Label>
              {onRefetchEpics && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowNewEpic((v) => !v)}
                >
                  {showNewEpic ? "Cancel" : "+ New epic"}
                </Button>
              )}
            </div>
            {showNewEpic ? (
              <div className="mt-2 flex gap-2 rounded-md border border-border p-2">
                <Input
                  placeholder="Epic name"
                  value={newEpicName}
                  onChange={(e) => setNewEpicName(e.target.value)}
                  className="h-9 flex-1 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={!newEpicName.trim() || creatingEpic}
                  onClick={async () => {
                    setCreatingEpic(true);
                    try {
                      const created = await api<{ id: string; name: string }>(
                        "/api/roadmap/epics",
                        {
                          method: "POST",
                          body: JSON.stringify({ name: newEpicName.trim() }),
                        }
                      );
                      setEpicId(created.id);
                      await onRefetchEpics?.();
                      setNewEpicName("");
                      setShowNewEpic(false);
                      toast.success("Epic created");
                    } catch {
                      toast.error("Failed to create epic");
                    } finally {
                      setCreatingEpic(false);
                    }
                  }}
                >
                  Create
                </Button>
              </div>
            ) : (
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
            )}
          </div>
          <div className="flex gap-2 pt-4">
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
