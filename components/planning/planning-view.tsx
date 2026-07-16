"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash2, LayoutGrid, CalendarDays, Sun, CheckCircle2, Circle } from "lucide-react";
import type { PlanningBoardResponse, PlanningBucketDTO, PlanningCardDTO } from "@/components/planning/types";
import { PlanningCardFormSheet } from "@/components/planning/planning-card-form-sheet";
import {
  PlanningCalendarPanel,
  localDateKey,
} from "@/components/planning/planning-calendar-panel";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { isDoneBucketName } from "@/lib/planning";
import { planningNotesExcerpt } from "@/lib/planning-notes";

const DND_TYPE = "text/plain";

function buildReorderItems(buckets: PlanningBucketDTO[]) {
  const items: { id: string; bucketId: string; sortOrder: number }[] = [];
  for (const b of buckets) {
    b.cards.forEach((c, i) => {
      items.push({ id: c.id, bucketId: b.id, sortOrder: i });
    });
  }
  return items;
}

function moveCardInBoard(
  buckets: PlanningBucketDTO[],
  draggedId: string,
  targetBucketId: string,
  beforeCardId: string | null
): PlanningBucketDTO[] {
  const next: PlanningBucketDTO[] = buckets.map((b) => ({
    ...b,
    cards: [...b.cards],
  }));

  let dragged: PlanningCardDTO | null = null;
  for (const b of next) {
    const idx = b.cards.findIndex((c) => c.id === draggedId);
    if (idx >= 0) {
      const [removed] = b.cards.splice(idx, 1);
      dragged = removed;
      break;
    }
  }
  if (!dragged) return buckets;

  const target = next.find((b) => b.id === targetBucketId);
  if (!target) return buckets;

  const updated: PlanningCardDTO = { ...dragged, bucketId: targetBucketId };
  if (!beforeCardId) {
    target.cards.push(updated);
  } else {
    const i = target.cards.findIndex((c) => c.id === beforeCardId);
    if (i < 0) target.cards.push(updated);
    else target.cards.splice(i, 0, updated);
  }

  return next;
}

type TaskOption = { id: string; title: string };

type DayViewPayload = {
  date: string;
  scheduled: PlanningCardDTO[];
  overdue: PlanningCardDTO[];
  weekBucketUnscheduled: PlanningCardDTO[];
};

export function PlanningView() {
  const [view, setView] = useState<"board" | "calendar" | "today">("board");
  const [buckets, setBuckets] = useState<PlanningBucketDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskOptions, setTaskOptions] = useState<TaskOption[]>([]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<PlanningCardDTO | null>(null);
  const [defaultBucketId, setDefaultBucketId] = useState<string | null>(null);

  const [addBucketOpen, setAddBucketOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const [deleteBucketOpen, setDeleteBucketOpen] = useState(false);
  const [bucketToDelete, setBucketToDelete] = useState<PlanningBucketDTO | null>(null);
  const [moveTargetsTo, setMoveTargetsTo] = useState("");

  const dragIdRef = useRef<string | null>(null);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calCards, setCalCards] = useState<PlanningCardDTO[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [selectedCalDate, setSelectedCalDate] = useState(() => localDateKey(new Date()));

  const [dayDate, setDayDate] = useState(() => localDateKey(new Date()));
  const [dayData, setDayData] = useState<DayViewPayload | null>(null);
  const [dayLoading, setDayLoading] = useState(false);

  const refetchBoard = useCallback(async () => {
    const res = await api<PlanningBoardResponse>("/api/planning/board");
    setBuckets(res.buckets);
    setEditingCard((prev) => {
      if (!prev) return prev;
      for (const b of res.buckets) {
        const found = b.cards.find((c) => c.id === prev.id);
        if (found) return found;
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      refetchBoard(),
      api<TaskOption[]>("/api/tasks").then((tasks) => {
        if (!cancelled) setTaskOptions(tasks.slice(0, 80).map((t) => ({ id: t.id, title: t.title })));
      }),
    ])
      .catch(() => {
        if (!cancelled) toast.error("Failed to load planning board");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refetchBoard]);

  useEffect(() => {
    if (view !== "calendar") return;
    let cancelled = false;
    setCalLoading(true);
    api<{ cards: PlanningCardDTO[] }>("/api/planning/calendar", {
      params: { year: String(calYear), month: String(calMonth) },
    })
      .then((r) => {
        if (!cancelled) setCalCards(r.cards);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load calendar");
      })
      .finally(() => {
        if (!cancelled) setCalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, calYear, calMonth]);

  useEffect(() => {
    if (view !== "today") return;
    let cancelled = false;
    setDayLoading(true);
    api<DayViewPayload>("/api/planning/day", { params: { date: dayDate } })
      .then((d) => {
        if (!cancelled) setDayData(d);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load day view");
      })
      .finally(() => {
        if (!cancelled) setDayLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, dayDate]);

  const persistReorder = async (next: PlanningBucketDTO[]) => {
    await api("/api/planning/reorder", {
      method: "POST",
      body: { items: buildReorderItems(next) },
    });
  };

  const handleDropOnBucket = async (targetBucketId: string, beforeCardId: string | null) => {
    const draggedId = dragIdRef.current;
    if (!draggedId) return;
    const next = moveCardInBoard(buckets, draggedId, targetBucketId, beforeCardId);
    setBuckets(next);
    dragIdRef.current = null;
    try {
      await persistReorder(next);
      await refetchBoard();
    } catch {
      toast.error("Failed to save order");
      void refetchBoard();
    }
  };

  const openCreate = (bucketId: string) => {
    setEditingCard(null);
    setDefaultBucketId(bucketId);
    setSheetOpen(true);
  };

  const openEdit = (card: PlanningCardDTO) => {
    setEditingCard(card);
    setDefaultBucketId(card.bucketId);
    setSheetOpen(true);
  };

  const toggleCardDone = async (card: PlanningCardDTO) => {
    const nextStatus = card.status === "DONE" ? "OPEN" : "DONE";
    try {
      await api(`/api/planning/cards/${card.id}`, {
        method: "PATCH",
        body: { status: nextStatus },
      });
      await refetchBoard();
      if (view === "calendar") {
        const r = await api<{ cards: PlanningCardDTO[] }>("/api/planning/calendar", {
          params: { year: String(calYear), month: String(calMonth) },
        });
        setCalCards(r.cards);
      }
      if (view === "today") {
        const d = await api<DayViewPayload>("/api/planning/day", { params: { date: dayDate } });
        setDayData(d);
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  async function submitNewBucket() {
    if (!newBucketName.trim()) return;
    try {
      await api("/api/planning/buckets", {
        method: "POST",
        body: { name: newBucketName.trim() },
      });
      setNewBucketName("");
      setAddBucketOpen(false);
      await refetchBoard();
      toast.success("Bucket added");
    } catch {
      toast.error("Failed to add bucket");
    }
  }

  async function submitDeleteBucket() {
    if (!bucketToDelete || !moveTargetsTo) return;
    try {
      await api(`/api/planning/buckets/${bucketToDelete.id}`, {
        method: "DELETE",
        body: { targetBucketId: moveTargetsTo },
      });
      setDeleteBucketOpen(false);
      setBucketToDelete(null);
      setMoveTargetsTo("");
      await refetchBoard();
      toast.success("Bucket removed");
    } catch {
      toast.error("Failed to remove bucket");
    }
  }

  return (
    <>
      <PageShell
        title="Planning"
        description="Personal buckets and calendar — like a whiteboard. Cards are yours only; link optional sprint tasks."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={view === "board" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("board")}
            >
              <LayoutGrid className="mr-1 h-4 w-4" />
              Board
            </Button>
            <Button
              type="button"
              variant={view === "calendar" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("calendar")}
            >
              <CalendarDays className="mr-1 h-4 w-4" />
              Calendar
            </Button>
            <Button
              type="button"
              variant={view === "today" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("today")}
            >
              <Sun className="mr-1 h-4 w-4" />
              Today
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setAddBucketOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Bucket
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[420px] w-72 shrink-0 rounded-xl" />
            ))}
          </div>
        ) : view === "board" ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {buckets.map((bucket) => (
              <Card
                key={bucket.id}
                className="flex w-72 shrink-0 flex-col border-border bg-card"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if ((e.target as HTMLElement).closest("[data-planning-card]")) return;
                  void handleDropOnBucket(bucket.id, null);
                }}
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-sm font-semibold">{bucket.name}</CardTitle>
                    {isDoneBucketName(bucket.name) && (
                      <p className="text-muted-foreground mt-0.5 text-xs">Dropping here marks done</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openCreate(bucket.id)}
                      aria-label="Add card"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground h-8 w-8"
                      disabled={buckets.length <= 1}
                      title={buckets.length <= 1 ? "Keep at least one bucket" : "Delete bucket"}
                      onClick={() => {
                        setBucketToDelete(bucket);
                        setMoveTargetsTo(
                          buckets.find((b) => b.id !== bucket.id)?.id ?? ""
                        );
                        setDeleteBucketOpen(true);
                      }}
                      aria-label="Delete bucket"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-2 overflow-y-auto pt-0">
                  {bucket.cards.map((card) => (
                    <div
                      key={card.id}
                      data-planning-card
                      draggable
                      onDragStart={(e) => {
                        dragIdRef.current = card.id;
                        e.dataTransfer.setData(DND_TYPE, card.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        dragIdRef.current = null;
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleDropOnBucket(bucket.id, card.id);
                      }}
                      className={cn(
                        "cursor-grab rounded-lg border border-border bg-background p-2 text-sm active:cursor-grabbing",
                        card.status === "DONE" && "opacity-60"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0"
                          onClick={() => void toggleCardDone(card)}
                          aria-label={card.status === "DONE" ? "Mark open" : "Mark done"}
                        >
                          {card.status === "DONE" ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => openEdit(card)}
                        >
                          <div
                            className={cn(
                              "font-medium leading-snug",
                              card.status === "DONE" && "line-through"
                            )}
                          >
                            {card.title}
                          </div>
                          <CardNotesPreview card={card} />
                          {(card.attachments?.length ?? 0) > 0 && (
                            <div className="text-muted-foreground mt-0.5 text-xs">
                              {card.attachments!.length} attachment
                              {card.attachments!.length === 1 ? "" : "s"}
                            </div>
                          )}
                          {card.plannedDate && (
                            <div className="text-muted-foreground mt-1 text-xs">
                              {card.plannedDate.slice(0, 10)}
                            </div>
                          )}
                          {card.task && (
                            <div className="text-muted-foreground mt-0.5 text-xs">
                              ↗ {card.task.title}
                            </div>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : view === "calendar" ? (
          calLoading ? (
            <Skeleton className="h-[480px] w-full rounded-xl" />
          ) : (
            <PlanningCalendarPanel
              year={calYear}
              month={calMonth}
              onPrevMonth={() => {
                if (calMonth <= 1) {
                  setCalMonth(12);
                  setCalYear((y) => y - 1);
                } else setCalMonth((m) => m - 1);
              }}
              onNextMonth={() => {
                if (calMonth >= 12) {
                  setCalMonth(1);
                  setCalYear((y) => y + 1);
                } else setCalMonth((m) => m + 1);
              }}
              cards={calCards}
              selectedDateKey={selectedCalDate}
              onSelectDate={setSelectedCalDate}
              onEditCard={openEdit}
            />
          )
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="day-pick" className="text-sm">
                Date
              </Label>
              <Input
                id="day-pick"
                type="date"
                value={dayDate}
                onChange={(e) => setDayDate(e.target.value)}
                className="w-auto"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDayDate(localDateKey(new Date()))}
              >
                Today
              </Button>
            </div>
            {dayLoading || !dayData ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <DaySection
                  title="Scheduled"
                  subtitle="Planned for this day"
                  cards={dayData.scheduled}
                  onEdit={openEdit}
                  onToggleDone={toggleCardDone}
                />
                <DaySection
                  title="Overdue"
                  subtitle="Still open, date before this day"
                  cards={dayData.overdue}
                  onEdit={openEdit}
                  onToggleDone={toggleCardDone}
                />
                <DaySection
                  title="This week bucket"
                  subtitle="In “This week”, no date yet"
                  cards={dayData.weekBucketUnscheduled}
                  onEdit={openEdit}
                  onToggleDone={toggleCardDone}
                />
              </div>
            )}
          </div>
        )}
      </PageShell>

      <PlanningCardFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        buckets={buckets}
        defaultBucketId={defaultBucketId}
        card={editingCard}
        taskOptions={taskOptions}
        onSaved={async () => {
          await refetchBoard();
          if (view === "calendar") {
            const r = await api<{ cards: PlanningCardDTO[] }>("/api/planning/calendar", {
              params: { year: String(calYear), month: String(calMonth) },
            });
            setCalCards(r.cards);
          }
          if (view === "today") {
            const d = await api<DayViewPayload>("/api/planning/day", { params: { date: dayDate } });
            setDayData(d);
          }
        }}
        onDeleted={async () => {
          setEditingCard(null);
          await refetchBoard();
          if (view === "calendar") {
            const r = await api<{ cards: PlanningCardDTO[] }>("/api/planning/calendar", {
              params: { year: String(calYear), month: String(calMonth) },
            });
            setCalCards(r.cards);
          }
          if (view === "today") {
            const d = await api<DayViewPayload>("/api/planning/day", { params: { date: dayDate } });
            setDayData(d);
          }
        }}
      />

      <Sheet open={addBucketOpen} onOpenChange={setAddBucketOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>New bucket</SheetTitle>
          </SheetHeader>
          <SheetBody className="space-y-4 pt-4">
            <div>
              <Label htmlFor="nb-name">Name</Label>
              <Input
                id="nb-name"
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value)}
                placeholder="e.g. Blocked"
                className="mt-1"
              />
            </div>
            <Button type="button" onClick={() => void submitNewBucket()}>
              Create
            </Button>
          </SheetBody>
        </SheetContent>
      </Sheet>

      <Sheet open={deleteBucketOpen} onOpenChange={setDeleteBucketOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Delete bucket</SheetTitle>
          </SheetHeader>
          <SheetBody className="space-y-4 pt-4">
            <p className="text-muted-foreground text-sm">
              Move all cards from <strong>{bucketToDelete?.name}</strong> into:
            </p>
            <select
              value={moveTargetsTo}
              onChange={(e) => setMoveTargetsTo(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Choose bucket</option>
              {buckets
                .filter((b) => b.id !== bucketToDelete?.id)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
            <Button
              type="button"
              variant="destructive"
              disabled={!moveTargetsTo}
              onClick={() => void submitDeleteBucket()}
            >
              Delete bucket
            </Button>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </>
  );
}

function CardNotesPreview({ card }: { card: PlanningCardDTO }) {
  const excerpt = planningNotesExcerpt(card.notesJson, card.description, 100);
  if (!excerpt) return null;
  return (
    <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">{excerpt}</div>
  );
}

function DaySection({
  title,
  subtitle,
  cards,
  onEdit,
  onToggleDone,
}: {
  title: string;
  subtitle: string;
  cards: PlanningCardDTO[];
  onEdit: (c: PlanningCardDTO) => void;
  onToggleDone: (c: PlanningCardDTO) => void;
}) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-muted-foreground text-xs">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {cards.length === 0 ? (
          <p className="text-muted-foreground text-sm">None.</p>
        ) : (
          cards.map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-2 rounded-md border border-border p-2 text-sm"
            >
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0"
                onClick={() => void onToggleDone(c)}
                aria-label="Toggle done"
              >
                {c.status === "DONE" ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </button>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onEdit(c)}>
                <div className={cn("font-medium", c.status === "DONE" && "line-through")}>{c.title}</div>
                <CardNotesPreview card={c} />
                {(c.attachments?.length ?? 0) > 0 && (
                  <div className="text-muted-foreground text-xs">
                    {c.attachments!.length} attachment{c.attachments!.length === 1 ? "" : "s"}
                  </div>
                )}
                {c.plannedDate && (
                  <div className="text-muted-foreground text-xs">{c.plannedDate.slice(0, 10)}</div>
                )}
              </button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
