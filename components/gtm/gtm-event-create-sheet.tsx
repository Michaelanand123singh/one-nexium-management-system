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
import type { EventOption } from "@/components/gtm/gtm-view";

export function GtmEventCreateSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (event: EventOption) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [goals, setGoals] = useState("");
  const [attendees, setAttendees] = useState("");
  const [outcomeNotes, setOutcomeNotes] = useState("");
  const [followUpTasks, setFollowUpTasks] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const event = await api<EventOption>("/api/events", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          type: type.trim() || null,
          date: date || null,
          location: location.trim() || null,
          goals: goals.trim() || null,
          attendees: attendees.trim() || null,
          outcomeNotes: outcomeNotes.trim() || null,
          followUpTasks: followUpTasks.trim() || null,
        }),
      });
      onCreated(event);
      onClose();
    } catch {
      toast.error("Failed to create event");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add event</SheetTitle>
        </SheetHeader>
        <SheetBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <Label>Type</Label>
            <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. conference, webinar" className="mt-1" />
          </div>
          <div>
            <Label>Date & time</Label>
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Goals</Label>
            <textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <Label>Attendees</Label>
            <textarea value={attendees} onChange={(e) => setAttendees(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <Label>Outcome notes</Label>
            <textarea value={outcomeNotes} onChange={(e) => setOutcomeNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <Label>Follow-up tasks</Label>
            <textarea value={followUpTasks} onChange={(e) => setFollowUpTasks(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create"}</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
