import { slugify } from "@/components/architecture/markdown-doc-viewer";
import type { ArchitectureDocSection } from "@/components/architecture/types";

function normalizeHeading(raw: string): string {
  return raw.replace(/`/g, "").replace(/\*\*/g, "").trim();
}

function sectionKind(heading: string): ArchitectureDocSection["kind"] {
  if (/^layer\s+/i.test(heading)) return "layer";
  if (/^cross-cutting/i.test(heading)) return "cross-cutting";
  return "other";
}

/**
 * Split LLD markdown on `## ` headings only.
 * `###` / `####` subsections stay inside their parent section.
 */
export function splitLldMarkdown(markdown: string): ArchitectureDocSection[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: ArchitectureDocSection[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    const body = currentLines.join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
    if (!body.trim() && currentHeading === null) {
      currentLines = [];
      return;
    }
    const heading = currentHeading ?? "Introduction";
    sections.push({
      id: slugify(heading),
      heading,
      markdown: `${body.trim()}\n`,
      kind: sectionKind(heading),
    });
    currentHeading = null;
    currentLines = [];
  };

  for (const line of lines) {
    const h2 = /^##\s+(.+)$/.exec(line.trim());
    if (h2) {
      flush();
      currentHeading = normalizeHeading(h2[1]);
      currentLines = [line];
      continue;
    }
    currentLines.push(line);
  }
  flush();

  return sections.filter((s) => s.markdown.trim().length > 0);
}

export function findLldSection(
  sections: ArchitectureDocSection[],
  heading: string
): ArchitectureDocSection | undefined {
  const normalized = normalizeHeading(heading);
  const byExact = sections.find(
    (s) => s.heading === heading.trim() || s.heading === normalized
  );
  if (byExact) return byExact;
  const slug = slugify(normalized);
  return sections.find((s) => s.id === slug || slugify(s.heading) === slug);
}

/** Overview = everything before the first Layer / primary content section. */
export function buildLldOverview(
  sections: ArchitectureDocSection[]
): ArchitectureDocSection | null {
  const firstIdx = sections.findIndex(
    (s) => s.kind === "layer" || s.kind === "cross-cutting"
  );
  const before = firstIdx === -1 ? sections.slice(0, 1) : sections.slice(0, firstIdx);
  if (before.length === 0) return null;
  const markdown = before.map((s) => s.markdown.trim()).join("\n\n");
  if (!markdown.trim()) return null;
  return {
    id: "overview",
    heading: "Overview",
    markdown: `${markdown.trim()}\n`,
    kind: "other",
  };
}

export function deriveLldShortLabel(heading: string): string {
  const layer = /^Layer\s+(\d+[A-Z]?)\b/i.exec(heading);
  if (layer) {
    const num = layer[1].toUpperCase();
    if (/publish|deploy/i.test(heading) && num === "11") return "L11 Pub";
    if (/context/i.test(heading) && num === "11") return "L11 Ctx";
    return `L${num}`;
  }
  if (/^Cross-Cutting:\s*(.+)/i.test(heading)) {
    const rest = heading.replace(/^Cross-Cutting:\s*/i, "");
    if (/distributed lock/i.test(rest)) return "Lock";
    if (/billing|credit/i.test(rest)) return "Billing";
    if (/memory/i.test(rest)) return "Memory";
    if (/observability/i.test(rest)) return "Obs";
    return rest.length <= 14 ? rest : `${rest.slice(0, 12)}…`;
  }
  if (/^Ask Mode/i.test(heading)) return "Ask";
  if (/^Clarification/i.test(heading)) return "Clarify";
  if (/^Universal LLM/i.test(heading)) return "LLM";
  if (/^Model Routing/i.test(heading)) return "Routing";
  if (/^Harness V3/i.test(heading)) return "V3 Gates";
  if (/^AppSpec Archetypes/i.test(heading)) return "Archetypes";
  if (/^Spec Interpreter/i.test(heading)) return "Spec Int";
  if (/^Context Compactor/i.test(heading)) return "Compact";
  if (/^Execution Phase/i.test(heading)) return "PER";
  if (/^Build State/i.test(heading)) return "BuildState";
  if (/^Brief Composer/i.test(heading)) return "Brief";
  if (/^Design Agent/i.test(heading)) return "Design";
  if (/^Follow-up/i.test(heading)) return "Follow-up";
  if (/^Configuration/i.test(heading)) return "Config";
  if (/^Missing Layers/i.test(heading)) return "Missing";
  if (/^Table of Contents/i.test(heading)) return "TOC";
  if (/^Introduction$/i.test(heading)) return "Intro";
  return heading.length <= 16 ? heading : `${heading.slice(0, 14)}…`;
}
