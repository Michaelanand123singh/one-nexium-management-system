"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PlanningCardDTO } from "@/components/planning/types";
import { cn } from "@/lib/utils";

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function PlanningCalendarPanel({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  cards,
  selectedDateKey,
  onSelectDate,
  onEditCard,
}: {
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  cards: PlanningCardDTO[];
  selectedDateKey: string;
  onSelectDate: (key: string) => void;
  onEditCard: (card: PlanningCardDTO) => void;
}) {
  const monthIndex = month - 1;
  const firstDow = new Date(year, monthIndex, 1).getDay();
  const totalDays = daysInMonth(year, monthIndex);

  const byDay = useMemo(() => {
    const m = new Map<string, PlanningCardDTO[]>();
    for (const c of cards) {
      if (!c.plannedDate) continue;
      const key = c.plannedDate.slice(0, 10);
      const list = m.get(key) ?? [];
      list.push(c);
      m.set(key, list);
    }
    return m;
  }, [cards]);

  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const selectedCards = byDay.get(selectedDateKey) ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold">
            {new Date(year, monthIndex, 1).toLocaleString("default", {
              month: "long",
              year: "numeric",
            })}
          </CardTitle>
          <div className="flex gap-1">
            <Button type="button" variant="outline" size="icon" onClick={onPrevMonth} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={onNextMonth} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {labels.map((l) => (
              <div key={l} className="py-2">
                {l}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`e-${i}`} className="min-h-[72px] rounded-md bg-muted/20" />;
              }
              const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayCards = byDay.get(key) ?? [];
              const isSelected = key === selectedDateKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectDate(key)}
                  className={cn(
                    "flex min-h-[72px] flex-col rounded-md border p-1 text-left text-sm transition-colors",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-transparent bg-muted/30 hover:bg-muted/50"
                  )}
                >
                  <span className="font-medium">{day}</span>
                  {dayCards.length > 0 && (
                    <span className="text-muted-foreground mt-auto text-[10px]">
                      {dayCards.length} item{dayCards.length === 1 ? "" : "s"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{selectedDateKey}</CardTitle>
          <p className="text-muted-foreground text-xs">Scheduled for this day</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {selectedCards.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing scheduled.</p>
          ) : (
            selectedCards.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onEditCard(c)}
                className="hover:bg-accent w-full rounded-md border border-border p-2 text-left text-sm"
              >
                <div className="font-medium">{c.title}</div>
                {c.task && (
                  <div className="text-muted-foreground mt-0.5 text-xs">Task: {c.task.title}</div>
                )}
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
