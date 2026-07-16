"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RoadmapItem } from "@/components/roadmap/roadmap-view";

const statusVariant: Record<string, "planned" | "inProgress" | "shipped" | "cancelled"> = {
  PLANNED: "planned",
  IN_PROGRESS: "inProgress",
  SHIPPED: "shipped",
  CANCELLED: "cancelled",
};

const NO_PHASE = "No phase";

export function RoadmapTimeline({
  items,
  phases,
  milestones,
  onSelect,
  onPhaseChange,
}: {
  items: RoadmapItem[];
  phases: string[];
  milestones: { id: string; name: string; targetDate: Date | null }[];
  onSelect: (id: string) => void;
  onPhaseChange?: (itemId: string, targetPhase: string | null) => void;
}) {
  const { byPhase, columns } = useMemo(() => {
    const map: Record<string, RoadmapItem[]> = {};
    phases.forEach((p) => {
      map[p] = [];
    });
    map[NO_PHASE] = [];

    const orphans = new Set<string>();
    items.forEach((i) => {
      const p = i.targetPhase || NO_PHASE;
      if (!map[p]) {
        map[p] = [];
        if (p !== NO_PHASE) orphans.add(p);
      }
      map[p].push(i);
    });

    return {
      byPhase: map,
      columns: [...phases, ...Array.from(orphans), NO_PHASE],
    };
  }, [items, phases]);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto pb-1">
        <div className="flex items-stretch gap-4">
          {columns.map((phase) => {
            const columnItems = byPhase[phase] ?? [];
            return (
              <div
                key={phase}
                className="flex w-64 shrink-0 flex-col rounded-lg border border-border bg-card"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("ring-2", "ring-primary");
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove("ring-2", "ring-primary");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("ring-2", "ring-primary");
                  const id = e.dataTransfer.getData("roadmap-item-id");
                  if (id && onPhaseChange) {
                    onPhaseChange(id, phase === NO_PHASE ? null : phase);
                  }
                }}
              >
                <div className="shrink-0 border-b border-border px-3 py-2 text-sm font-medium text-muted-foreground">
                  {phase}
                  <span className="ml-1.5 text-xs font-normal opacity-70">
                    ({columnItems.length})
                  </span>
                </div>
                <div className="flex min-h-48 flex-1 flex-col gap-2 p-2">
                  {columnItems.length === 0 ? (
                    <p className="text-muted-foreground flex flex-1 items-center justify-center px-2 py-8 text-center text-xs">
                      {onPhaseChange ? "Drop cards here" : "No items"}
                    </p>
                  ) : (
                    columnItems.map((item) => (
                      <Card
                        key={item.id}
                        className="cursor-pointer transition-shadow hover:shadow-md"
                        draggable={!!onPhaseChange}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("roadmap-item-id", item.id);
                        }}
                        onClick={() => onSelect(item.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="line-clamp-2 text-sm font-medium">
                              {item.title}
                            </span>
                            {item.isPublic && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                Public
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            <Badge
                              variant={statusVariant[item.status] ?? "secondary"}
                              className="text-xs"
                            >
                              {item.status.replace("_", " ")}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {item.priority}
                            </Badge>
                            {item.epic && (
                              <span className="text-xs text-muted-foreground">
                                {item.epic.name}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {milestones.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Milestones:</span>
          {milestones.map((m) => (
            <span
              key={m.id}
              className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium"
            >
              {m.name}
              {m.targetDate && (
                <span className="ml-1 text-muted-foreground">
                  {new Date(m.targetDate).toLocaleDateString()}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
