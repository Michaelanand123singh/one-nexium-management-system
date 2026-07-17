"use client";

import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Compute a canvas size that fits all node positions at ~1× zoom (for native scroll). */
export function flowCanvasSize(
  nodes: { position: { x: number; y: number } }[],
  opts?: { nodeWidth?: number; nodeHeight?: number; pad?: number }
): { width: number; height: number } {
  const nodeWidth = opts?.nodeWidth ?? 260;
  const nodeHeight = opts?.nodeHeight ?? 110;
  const pad = opts?.pad ?? 96;
  let maxX = 480;
  let maxY = 320;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.position.x + nodeWidth);
    maxY = Math.max(maxY, n.position.y + nodeHeight);
  }
  return {
    width: Math.ceil(maxX + pad),
    height: Math.ceil(maxY + pad),
  };
}

/**
 * Scrollable diagram shell: outer viewport scrolls; inner canvas is sized to the graph.
 */
export function ScrollableDiagram({
  nodes,
  maxHeightClass = "max-h-[70vh]",
  className,
  children,
  nodeWidth,
  nodeHeight,
}: {
  nodes: { position: { x: number; y: number } }[];
  maxHeightClass?: string;
  className?: string;
  children: ReactNode;
  nodeWidth?: number;
  nodeHeight?: number;
}) {
  const size = useMemo(
    () => flowCanvasSize(nodes, { nodeWidth, nodeHeight }),
    [nodes, nodeWidth, nodeHeight]
  );

  return (
    <div
      className={cn(
        "rounded-lg border bg-background/50 overflow-auto overscroll-contain",
        maxHeightClass,
        className
      )}
    >
      <div
        className="relative"
        style={{ width: size.width, height: size.height, minWidth: "100%" }}
      >
        {children}
      </div>
    </div>
  );
}
