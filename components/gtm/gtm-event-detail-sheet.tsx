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
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { EventOption } from "@/components/gtm/gtm-view";

export function GtmEventDetailSheet({
  id,
  canEdit,
  onClose,
  onUpdated,
  onDeleted,
}: {
  id: string;
  canEdit: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [event, setEvent] = useState<EventOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api<EventOption>(`/api/events/${id}`)
      .then(setEvent)
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!canEdit || !confirm("Remove this event?")) return;
    try {
      await api(`/api/events/${id}`, { method: "DELETE" });
      onDeleted();
    } catch {
      toast.error("Failed to delete");
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Event</SheetTitle>
        </SheetHeader>
        <SheetBody>
          {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : event && editing ? (
          <GtmEventEditForm
            event={event as EventDetail}
            id={id}
            onClose={() => setEditing(false)}
            onSaved={async () => {
              setEditing(false);
              toast.success("Saved");
              const full = await api<EventDetail>(`/api/events/${id}`);
              setEvent(full);
              onUpdated();
            }}
          />
        ) : event ? (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Name</h3>
              <p className="mt-1 font-medium">{event.name}</p>
            </div>
            {(event.type || event.location) && (
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                {event.type && <span>Type: {event.type}</span>}
                {event.location && <span>Location: {event.location}</span>}
              </div>
            )}
            {event.date && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Date</h3>
                <p className="mt-1 text-sm">{new Date(event.date).toLocaleDateString()}</p>
              </div>
            )}
            {(event as EventDetail).goals && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Goals</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{(event as EventDetail).goals}</p>
              </div>
            )}
            {(event as EventDetail).attendees && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Attendees</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{(event as EventDetail).attendees}</p>
              </div>
            )}
            {(event as EventDetail).outcomeNotes && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Outcome notes</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{(event as EventDetail).outcomeNotes}</p>
              </div>
            )}
            {(event as EventDetail).followUpTasks && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Follow-up tasks</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{(event as EventDetail).followUpTasks}</p>
              </div>
            )}
            {canEdit && (
              <div className="flex gap-2 border-t border-border pt-4">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
                <Button variant="destructive" size="sm" onClick={handleDelete}>Remove</Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Event not found.</p>
        )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

type EventDetail = EventOption & {
  goals: string | null;
  attendees: string | null;
  outcomeNotes: string | null;
  followUpTasks: string | null;
};

function GtmEventEditForm({
  event,
  id,
  onClose,
  onSaved,
}: {
  event: EventDetail;
  id: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(event.name);
  const [type, setType] = useState(event.type ?? "");
  const [date, setDate] = useState(event.date ? new Date(event.date).toISOString().slice(0, 16) : "");
  const [location, setLocation] = useState(event.location ?? "");
  const [goals, setGoals] = useState(event.goals ?? "");
  const [attendees, setAttendees] = useState(event.attendees ?? "");
  const [outcomeNotes, setOutcomeNotes] = useState(event.outcomeNotes ?? "");
  const [followUpTasks, setFollowUpTasks] = useState(event.followUpTasks ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/api/events/${id}`, {
        method: "PATCH",
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
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
