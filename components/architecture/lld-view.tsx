"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { MarkdownDocViewer, slugify } from "@/components/architecture/markdown-doc-viewer";
import { findLldDiagram } from "@/components/architecture/lld-diagrams-data";
import {
  buildLldOverview,
  deriveLldShortLabel,
  splitLldMarkdown,
} from "@/components/architecture/split-lld-markdown";
import type { ArchitectureDocSection, ArchitectureNodeData } from "@/components/architecture/types";
import { ScrollableDiagram } from "@/components/architecture/scrollable-diagram";

function FlowNode({ data }: NodeProps) {
  const d = data as unknown as ArchitectureNodeData;
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5 shadow-sm w-60 cursor-pointer hover:border-primary/50 transition-colors">
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <p className="text-sm font-medium leading-tight">{d.label}</p>
      {d.subtitle && (
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug break-words">
          {d.subtitle}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}

const nodeTypes = { flowNode: FlowNode };

type PickerItem = {
  id: string;
  shortLabel: string;
  title: string;
  kind: ArchitectureDocSection["kind"] | "overview";
  section: ArchitectureDocSection;
  hasDiagram: boolean;
};

function buildPickerItems(lldMarkdown: string): PickerItem[] {
  const sections = splitLldMarkdown(lldMarkdown);
  const overview = buildLldOverview(sections);
  const firstContentIdx = sections.findIndex(
    (s) => s.kind === "layer" || s.kind === "cross-cutting"
  );
  const rest = firstContentIdx === -1 ? sections.slice(1) : sections.slice(firstContentIdx);

  const items: PickerItem[] = [];
  if (overview) {
    items.push({
      id: overview.id,
      shortLabel: "Overview",
      title: "Overview",
      kind: "overview",
      section: overview,
      hasDiagram: false,
    });
  }

  for (const section of rest) {
    // Skip bare TOC if it somehow remains (already in overview).
    if (/^table of contents$/i.test(section.heading)) continue;
    items.push({
      id: section.id,
      shortLabel: deriveLldShortLabel(section.heading),
      title: section.heading.replace(/^Layer\s+\d+[A-Z]?\s*—\s*/i, "") || section.heading,
      kind: section.kind,
      section,
      hasDiagram: Boolean(findLldDiagram(section.heading)),
    });
  }

  return items;
}

export function LldView({
  markdown,
  focusHeading,
  onFocusConsumed,
}: {
  markdown: string;
  focusHeading?: string | null;
  onFocusConsumed?: () => void;
}) {
  const pickerItems = useMemo(() => buildPickerItems(markdown), [markdown]);
  const [activeId, setActiveId] = useState(pickerItems[0]?.id ?? "overview");
  const [selected, setSelected] = useState<ArchitectureNodeData | null>(null);

  const active = useMemo(
    () => pickerItems.find((i) => i.id === activeId) ?? pickerItems[0],
    [pickerItems, activeId]
  );

  const diagram = useMemo(
    () => (active ? findLldDiagram(active.section.heading) : undefined),
    [active]
  );

  const nodes = useMemo(
    () => (diagram?.nodes ?? []) as unknown as Node[],
    [diagram]
  );
  const edges = useMemo(() => diagram?.edges ?? [], [diagram]);

  useEffect(() => {
    if (!focusHeading || pickerItems.length === 0) return;
    const raw = focusHeading.trim();
    const slug = slugify(raw);
    const match =
      pickerItems.find((i) => i.section.heading === raw) ??
      pickerItems.find(
        (i) => slugify(i.section.heading) === slug || i.section.id === slug
      ) ??
      pickerItems.find(
        (i) => slugify(i.section.heading) === raw || i.section.id === raw
      ) ??
      pickerItems.find((i) => i.id === raw);
    if (match) {
      setActiveId(match.id);
      setSelected(null);
      const t = setTimeout(() => {
        document.getElementById("lld-section-doc")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        onFocusConsumed?.();
      }, 80);
      return () => clearTimeout(t);
    }
    onFocusConsumed?.();
  }, [focusHeading, pickerItems, onFocusConsumed]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelected(node.data as unknown as ArchitectureNodeData);
  }, []);

  const selectItem = (id: string) => {
    setActiveId(id);
    setSelected(null);
  };

  if (!active) {
    return <p className="text-sm text-muted-foreground">No LLD content available.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground max-w-3xl">
          LLD diagrams are deeper than HLD (files, guards, handlers, stores). Each chip shows that
          section&apos;s diagram when available, plus only that section&apos;s document text.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {pickerItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectItem(item.id)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                item.id === active.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40"
              )}
              title={
                item.hasDiagram
                  ? item.section.heading
                  : `${item.section.heading} (document only)`
              }
            >
              {item.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <h2 className="text-sm font-medium">{active.section.heading}</h2>
        {diagram ? (
          <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
            {diagram.description}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
            Low-level detail for this section (document only — no separate diagram).
          </p>
        )}
      </div>

      {diagram && (
        <div className="relative">
          <ScrollableDiagram nodes={nodes} maxHeightClass="max-h-[60vh]" nodeWidth={260} nodeHeight={100}>
            <ReactFlow
              key={diagram.id}
              className="h-full w-full"
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              defaultViewport={{ x: 24, y: 24, zoom: 0.9 }}
              panOnScroll={false}
              zoomOnScroll={false}
              preventScrolling={false}
              minZoom={0.25}
              maxZoom={1.5}
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
            </ReactFlow>
          </ScrollableDiagram>

          {selected && (
            <div className="absolute top-4 right-4 w-80 max-h-[min(24rem,55vh)] overflow-y-auto rounded-lg border bg-card p-4 shadow-lg z-10">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-sm">{selected.label}</h3>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                {selected.summary}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 w-full"
                onClick={() => {
                  document.getElementById("lld-section-doc")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
              >
                Read this section&apos;s LLD
              </Button>
            </div>
          )}
        </div>
      )}

      <section id="lld-section-doc" className="space-y-3 border-t pt-6 scroll-mt-4">
        <h3 className="text-sm font-medium">LLD — {active.shortLabel}</h3>
        <MarkdownDocViewer key={active.id} markdown={active.section.markdown} />
      </section>
    </div>
  );
}
