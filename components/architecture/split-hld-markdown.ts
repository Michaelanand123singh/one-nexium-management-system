import { slugify } from "@/components/architecture/markdown-doc-viewer";

export type HldDocSection = {
  /** Stable id (slug of heading). */
  id: string;
  /** Exact heading text without markdown markers. */
  heading: string;
  /** Section body including the heading line. */
  markdown: string;
  /** True when heading is a Layer N / Layer NB section. */
  isLayer: boolean;
};

/**
 * Split HLD markdown into sections.
 * - Splits on all `## ` headings
 * - Splits on `### Layer …` headings (keeps other ### / #### inside the parent layer)
 */
export function splitHldMarkdown(markdown: string): HldDocSection[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: HldDocSection[] = [];
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
      isLayer: /^layer\s+/i.test(heading),
    });
    currentHeading = null;
    currentLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const h2 = /^##\s+(.+)$/.exec(trimmed);
    const h3Layer = /^###\s+(Layer\s+.+)$/i.exec(trimmed);

    if (h2 || h3Layer) {
      flush();
      const raw = (h2?.[1] ?? h3Layer?.[1] ?? "").trim();
      // Strip backticks / bold markers only — keep underscores (e.g. HATCHET_ENABLED).
      currentHeading = raw.replace(/`/g, "").replace(/\*\*/g, "").trim();
      currentLines = [line];
      continue;
    }

    currentLines.push(line);
  }
  flush();

  return sections.filter((s) => s.markdown.trim().length > 0);
}

/** Match a diagram layer heading to a split section (exact, then slug). */
export function findSectionForHeading(
  sections: HldDocSection[],
  heading: string
): HldDocSection | undefined {
  const normalized = heading.replace(/`/g, "").replace(/\*\*/g, "").trim();
  const byExact = sections.find(
    (s) => s.heading === heading.trim() || s.heading === normalized
  );
  if (byExact) return byExact;
  const slug = slugify(normalized);
  return sections.find((s) => s.id === slug || slugify(s.heading) === slug);
}

/**
 * Build picker groups: Overview (pre-layer) → layers → other topics.
 */
export function buildHldPickerGroups(sections: HldDocSection[]): {
  overview: HldDocSection | null;
  layers: HldDocSection[];
  other: HldDocSection[];
} {
  const firstLayerIdx = sections.findIndex((s) => s.isLayer);
  if (firstLayerIdx === -1) {
    return {
      overview: sections[0] ?? null,
      layers: [],
      other: sections.slice(1),
    };
  }

  const before = sections.slice(0, firstLayerIdx);
  const overviewMarkdown = before.map((s) => s.markdown.trim()).join("\n\n");
  const overview: HldDocSection | null =
    overviewMarkdown.trim().length > 0
      ? {
          id: "overview",
          heading: "Overview",
          markdown: `${overviewMarkdown.trim()}\n`,
          isLayer: false,
        }
      : null;

  const rest = sections.slice(firstLayerIdx);
  return {
    overview,
    layers: rest.filter((s) => s.isLayer),
    other: rest.filter((s) => !s.isLayer),
  };
}
