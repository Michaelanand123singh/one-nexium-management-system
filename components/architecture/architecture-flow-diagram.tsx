"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { E2E_FLOWS, type E2eNodeData } from "@/components/architecture/e2e-flow-data";
import { ScrollableDiagram } from "@/components/architecture/scrollable-diagram";

function E2eNode({ data }: NodeProps) {
  const d = data as unknown as E2eNodeData;
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5 shadow-sm w-[220px] cursor-pointer hover:border-primary/50 transition-colors">
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {d.phase}
      </p>
      <p className="text-sm font-medium leading-tight mt-0.5">{d.label}</p>
      {d.subtitle && (
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug break-words">
          {d.subtitle}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}

const nodeTypes = { e2eNode: E2eNode };

export function ArchitectureFlowDiagram({
  onViewDocs,
}: {
  onViewDocs: (docTab: "hld" | "lld", headingOrAnchor: string) => void;
}) {
  const [flowId, setFlowId] = useState(E2E_FLOWS[0]?.id ?? "first-build");
  const [selected, setSelected] = useState<E2eNodeData | null>(null);

  const flow = useMemo(
    () => E2E_FLOWS.find((f) => f.id === flowId) ?? E2E_FLOWS[0],
    [flowId]
  );

  const nodes = useMemo(() => (flow?.nodes ?? []) as unknown as Node[], [flow]);
  const edges = useMemo(() => flow?.edges ?? [], [flow]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelected(node.data as unknown as E2eNodeData);
  }, []);

  const selectFlow = (id: string) => {
    setFlowId(id);
    setSelected(null);
  };

  if (!flow) {
    return <p className="text-sm text-muted-foreground">No end-to-end flows defined.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
          Three complete journeys from the HLD/LLD — not a single incomplete sketch. Pick a path,
          click any node for the precise contract, then jump into HLD or LLD.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {E2E_FLOWS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => selectFlow(f.id)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                f.id === flow.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40"
              )}
            >
              {f.shortLabel}
            </button>
          ))}
        </div>
        <div className="space-y-0.5">
          <h3 className="text-sm font-medium">{flow.title}</h3>
          <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
            {flow.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" /> Animated = live SSE / live URL
          </span>
          <span>Use the panel scrollbars (or wheel) to move · drag to pan · controls to zoom</span>
          <span>{flow.nodes.length} steps · {flow.edges.length} connections</span>
        </div>
      </div>

      <div className="relative">
        <ScrollableDiagram nodes={nodes} maxHeightClass="max-h-[72vh]" nodeWidth={240} nodeHeight={120}>
          <ReactFlow
            key={flow.id}
            className="h-full w-full"
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            defaultViewport={{ x: 32, y: 32, zoom: 0.85 }}
            minZoom={0.2}
            maxZoom={1.4}
            panOnScroll={false}
            zoomOnScroll={false}
            preventScrolling={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={18} />
            <Controls />
            <MiniMap
              pannable
              zoomable
              className="!bg-card !border"
              nodeStrokeWidth={2}
            />
          </ReactFlow>
        </ScrollableDiagram>

        {selected && (
          <div className="absolute top-4 right-4 w-[22rem] max-h-[min(28rem,70vh)] overflow-y-auto rounded-lg border bg-card p-4 shadow-lg z-10">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {selected.phase}
                </p>
                <h3 className="font-medium text-sm mt-0.5">{selected.label}</h3>
                {selected.subtitle && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{selected.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              {selected.summary}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => onViewDocs(selected.docTab, selected.heading)}
              >
                Open in {selected.docTab === "hld" ? "HLD" : "LLD"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="w-full"
                onClick={() =>
                  onViewDocs(selected.docTab === "hld" ? "lld" : "hld", selected.heading)
                }
              >
                Also try {selected.docTab === "hld" ? "LLD" : "HLD"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
