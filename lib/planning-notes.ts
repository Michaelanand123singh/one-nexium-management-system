/**
 * Planning card rich notes: TipTap JSON shape + plain-text excerpt for lists/DB.
 * Safe on server (no TipTap runtime).
 */

export type TipTapDoc = { type: "doc"; content?: unknown[] };

export function emptyPlanningNotesDoc(): TipTapDoc {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

export function isValidTipTapDoc(v: unknown): v is TipTapDoc {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return o.type === "doc" && (o.content === undefined || Array.isArray(o.content));
}

export function plainTextToTipTapDoc(text: string): TipTapDoc {
  const t = text.trim();
  if (!t) return emptyPlanningNotesDoc();
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: t }],
      },
    ],
  };
}

function walkText(node: unknown, parts: string[]): void {
  if (!node || typeof node !== "object") return;
  const n = node as Record<string, unknown>;
  if (n.type === "text" && typeof n.text === "string") {
    parts.push(n.text);
  }
  if (Array.isArray(n.content)) {
    for (const c of n.content) walkText(c, parts);
  }
}

/** Flatten TipTap JSON to plain text (newlines between block-level gaps approximated by spaces). */
export function extractPlainTextFromNotesJson(notesJson: unknown, maxLen = 8000): string {
  if (!isValidTipTapDoc(notesJson)) return "";
  const parts: string[] = [];
  if (Array.isArray(notesJson.content)) {
    for (const block of notesJson.content) {
      walkText(block, parts);
      parts.push(" ");
    }
  }
  const s = parts.join("").replace(/\s+/g, " ").trim();
  if (maxLen > 0 && s.length > maxLen) return s.slice(0, maxLen);
  return s;
}

/** One-line preview for board / day lists. */
export function planningNotesExcerpt(
  notesJson: unknown,
  legacyDescription: string | null | undefined,
  max = 120
): string {
  const fromJson = extractPlainTextFromNotesJson(notesJson, max + 40);
  const base = fromJson || (legacyDescription?.trim() ?? "");
  if (base.length <= max) return base;
  return `${base.slice(0, max - 1)}…`;
}
