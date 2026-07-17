import type { Edge, Node } from "@xyflow/react";

/** Doc tab used when jumping from a diagram node into the markdown viewer. */
export type ArchitectureDocTab = "hld" | "lld";

/** Payload carried by interactive architecture diagram nodes. */
export type ArchitectureNodeData = {
  label: string;
  subtitle?: string;
  summary: string;
  docTab: ArchitectureDocTab;
  /** Exact heading text as it appears in the source markdown (anchor via slugify). */
  heading: string;
};

export type ArchitectureFlowNode = Omit<Node, "data"> & {
  data: ArchitectureNodeData;
};

/** One HLD layer with its own React Flow graph. */
export type HldLayerDefinition = {
  id: string;
  /** Short label for the layer picker (e.g. "Layer 0"). */
  shortLabel: string;
  /** Full HLD heading text (must match docs for anchors). */
  heading: string;
  title: string;
  description: string;
  nodes: ArchitectureFlowNode[];
  edges: Edge[];
};

export type ArchitectureDocs = {
  hld: string;
  lld: string;
};

/** Split markdown section (HLD or LLD). */
export type ArchitectureDocSection = {
  id: string;
  heading: string;
  markdown: string;
  /** Layer / Cross-Cutting / Ask Mode / etc. */
  kind: "layer" | "cross-cutting" | "other";
};

/** One LLD section with optional React Flow graph. */
export type LldSectionDefinition = {
  id: string;
  shortLabel: string;
  /** Exact `##` heading text from ONENEXIUM_LLD.md (after backtick strip). */
  heading: string;
  title: string;
  description: string;
  nodes: ArchitectureFlowNode[];
  edges: Edge[];
};
