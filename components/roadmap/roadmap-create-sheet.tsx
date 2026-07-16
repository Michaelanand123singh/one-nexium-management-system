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
import type { RoadmapItem } from "@/components/roadmap/roadmap-view";

const STATUS_OPTIONS = ["PLANNED", "IN_PROGRESS", "SHIPPED", "CANCELLED"];
const PRIORITY_OPTIONS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const TEAM_OPTIONS = ["Product", "Engineering", "Design"];

export function RoadmapCreateSheet({
  phases,
  epics,
  milestones,
  onRefetchEpics,
  onRefetchMilestones,
  onClose,
  onCreated,
}: {
  phases: string[];
  epics: { id: string; name: string }[];
  milestones: { id: string; name: string; targetDate: Date | null }[];
  onRefetchEpics?: () => Promise<void>;
  onRefetchMilestones?: () => Promise<void>;
  onClose: () => void;
  onCreated: (item: RoadmapItem) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("PLANNED");
  const [priority, setPriority] = useState("MEDIUM");
  const [assignedTeam, setAssignedTeam] = useState("");
  const [targetPhase, setTargetPhase] = useState(() => phases[0] ?? "");
  const [epicId, setEpicId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showNewEpic, setShowNewEpic] = useState(false);
  const [newEpicName, setNewEpicName] = useState("");
  const [showNewMilestone, setShowNewMilestone] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [newMilestoneDate, setNewMilestoneDate] = useState("");
  const [creatingEpic, setCreatingEpic] = useState(false);
  const [creatingMilestone, setCreatingMilestone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const item = await api<RoadmapItem>("/api/roadmap", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          assignedTeam: assignedTeam || undefined,
          targetPhase: targetPhase || undefined,
          epicId: epicId || undefined,
          milestoneId: milestoneId || undefined,
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
          <SheetTitle>New roadmap item</SheetTitle>
        </SheetHeader>
        <SheetBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. AI Chat Editor V2"
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
              placeholder="Optional description"
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Priority</Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Team</Label>
              <select
                value={assignedTeam}
                onChange={(e) => setAssignedTeam(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {TEAM_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Target phase</Label>
              <select
                value={targetPhase}
                onChange={(e) => setTargetPhase(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">No phase</option>
                {phases.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
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
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label>Milestone</Label>
              {onRefetchMilestones && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowNewMilestone((v) => !v)}
                >
                  {showNewMilestone ? "Cancel" : "+ New milestone"}
                </Button>
              )}
            </div>
            {showNewMilestone ? (
              <div className="mt-2 flex flex-col gap-2 rounded-md border border-border p-2">
                <Input
                  placeholder="Milestone name"
                  value={newMilestoneName}
                  onChange={(e) => setNewMilestoneName(e.target.value)}
                  className="h-9 text-sm"
                />
                <input
                  type="date"
                  value={newMilestoneDate}
                  onChange={(e) => setNewMilestoneDate(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!newMilestoneName.trim() || creatingMilestone}
                    onClick={async () => {
                      setCreatingMilestone(true);
                      try {
                        const created = await api<{
                          id: string;
                          name: string;
                          targetDate: Date | null;
                        }>("/api/roadmap/milestones", {
                          method: "POST",
                          body: JSON.stringify({
                            name: newMilestoneName.trim(),
                            targetDate: newMilestoneDate || undefined,
                          }),
                        });
                        setMilestoneId(created.id);
                        await onRefetchMilestones?.();
                        setNewMilestoneName("");
                        setNewMilestoneDate("");
                        setShowNewMilestone(false);
                        toast.success("Milestone created");
                      } catch {
                        toast.error("Failed to create milestone");
                      } finally {
                        setCreatingMilestone(false);
                      }
                    }}
                  >
                    Create
                  </Button>
                </div>
              </div>
            ) : (
              <select
                value={milestoneId}
                onChange={(e) => setMilestoneId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">—</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.targetDate && ` (${new Date(m.targetDate).toLocaleDateString()})`}
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
