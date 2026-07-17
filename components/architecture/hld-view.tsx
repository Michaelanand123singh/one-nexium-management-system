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
import { HLD_LAYERS } from "@/components/architecture/hld-layers-data";
import {
  buildHldPickerGroups,
  findSectionForHeading,
  splitHldMarkdown,
  type HldDocSection,
} from "@/components/architecture/split-hld-markdown";
import type { ArchitectureNodeData } from "@/components/architecture/types";
import { ScrollableDiagram } from "@/components/architecture/scrollable-diagram";

function FlowNode({ data }: NodeProps) {
  const d = data as unknown as ArchitectureNodeData;
  return (
    <div className="rounded-lg border bg-card px-4 py-3 shadow-sm w-56 cursor-pointer hover:border-primary/50 transition-colors">
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <p className="text-sm font-medium leading-tight">{d.label}</p>
      {d.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{d.subtitle}</p>}
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}

const nodeTypes = { flowNode: FlowNode };

type PickerItem = {
  id: string;
  shortLabel: string;
  title: string;
  kind: "overview" | "layer" | "other";
  section: HldDocSection;
  diagramLayerId?: string;
};

function buildPickerItems(hldMarkdown: string): PickerItem[] {
  const sections = splitHldMarkdown(hldMarkdown);
  const { overview, layers: layerSections, other } = buildHldPickerGroups(sections);
  const items: PickerItem[] = [];

  if (overview) {
    items.push({
      id: overview.id,
      shortLabel: "Overview",
      title: "Overview",
      kind: "overview",
      section: overview,
    });
  }

  for (const def of HLD_LAYERS) {
    const section =
      findSectionForHeading(layerSections, def.heading) ??
      findSectionForHeading(sections, def.heading);
    if (!section) continue;
    items.push({
      id: def.id,
      shortLabel: def.shortLabel,
      title: def.title,
      kind: "layer",
      section,
      diagramLayerId: def.id,
    });
  }

  for (const section of other) {
    items.push({
      id: `other-${section.id}`,
      shortLabel: shortenLabel(section.heading),
      title: section.heading,
      kind: "other",
      section,
    });
  }

  return items;
}

function shortenLabel(heading: string): string {
  if (heading.length <= 22) return heading;
  return `${heading.slice(0, 20)}…`;
}

export function HldView({
  markdown,
  focusHeading,
  onFocusConsumed,
}: {
  markdown: string;
  /** When set (e.g. from End-to-End Flow), select that layer/section and scroll to its docs. */
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

  const diagramLayer = useMemo(() => {
    if (!active?.diagramLayerId) return null;
    return HLD_LAYERS.find((l) => l.id === active.diagramLayerId) ?? null;
  }, [active]);

  const nodes = useMemo(
    () => (diagramLayer?.nodes ?? []) as unknown as Node[],
    [diagramLayer]
  );
  const edges = useMemo(() => diagramLayer?.edges ?? [], [diagramLayer]);

  useEffect(() => {
    if (!focusHeading || pickerItems.length === 0) return;
    const raw = focusHeading.trim();
    const slug = slugify(raw);
    const match =
      pickerItems.find((i) => i.section.heading === raw) ??
      pickerItems.find((i) => slugify(i.section.heading) === slug || i.section.id === slug) ??
      pickerItems.find((i) => slugify(i.section.heading) === raw || i.section.id === raw) ??
      pickerItems.find((i) => i.id === raw);
    if (match) {
      setActiveId(match.id);
      setSelected(null);
      const t = setTimeout(() => {
        document.getElementById("hld-layer-doc")?.scrollIntoView({
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
    return <p className="text-sm text-muted-foreground">No HLD content available.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground max-w-3xl">
          Each chip shows that layer&apos;s diagram (when available) and only its HLD text — not the
          whole document at once.
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
              title={item.title}
            >
              {item.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <h2 className="text-sm font-medium">{active.title}</h2>
        {diagramLayer && (
          <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
            {diagramLayer.description}
          </p>
        )}
        {active.kind === "overview" && (
          <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
            Product summary, builder mode, and process map from the HLD.
          </p>
        )}
        {active.kind === "other" && (
          <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
            Additional HLD topic (not a numbered pipeline layer).
          </p>
        )}
      </div>

      {diagramLayer && (
        <div className="relative">
          <ScrollableDiagram nodes={nodes} maxHeightClass="max-h-[60vh]" nodeWidth={240} nodeHeight={100}>
            <ReactFlow
              key={diagramLayer.id}
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
                  document.getElementById("hld-layer-doc")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
              >
                Read this layer&apos;s HLD
              </Button>
            </div>
          )}
        </div>
      )}

      <section id="hld-layer-doc" className="space-y-3 border-t pt-6 scroll-mt-4">
        <h3 className="text-sm font-medium">HLD — {active.title}</h3>
        <MarkdownDocViewer key={active.id} markdown={active.section.markdown} />
      </section>
    </div>
  );
}
