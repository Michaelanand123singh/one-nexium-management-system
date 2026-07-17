"use client";

import { useMemo, forwardRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

type TocEntry = { id: string; text: string; depth: number };

function extractToc(markdown: string): TocEntry[] {
  const lines = markdown.split("\n");
  const entries: TocEntry[] = [];
  for (const line of lines) {
    const match = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (!match) continue;
    const depth = match[1].length;
    const text = match[2].replace(/[`*_]/g, "").trim();
    entries.push({ id: slugify(text), text, depth });
  }
  return entries;
}

export const MarkdownDocViewer = forwardRef<
  HTMLDivElement,
  { markdown: string; /** Hide side TOC (useful for short per-layer sections). */ hideToc?: boolean }
>(function MarkdownDocViewer({ markdown, hideToc = false }, contentRef) {
    const toc = useMemo(() => extractToc(markdown), [markdown]);
    const showToc = !hideToc && toc.length > 1;

    return (
      <div className="flex gap-6 items-start">
        {showToc && (
          <nav className="hidden lg:block w-64 shrink-0 sticky top-4 max-h-[calc(100vh-8rem)] overflow-y-auto text-sm">
            <p className="font-medium text-muted-foreground mb-2">On this page</p>
            <ul className="space-y-1">
              {toc.map((entry, i) => (
                <li
                  key={`${entry.id}-${i}`}
                  style={{ paddingLeft: (entry.depth - 1) * 12 }}
                >
                  <a
                    href={`#${entry.id}`}
                    className="text-muted-foreground hover:text-foreground hover:underline block truncate"
                  >
                    {entry.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <div
          ref={contentRef}
          className="min-w-0 flex-1 prose prose-sm dark:prose-invert max-w-none prose-pre:bg-muted prose-pre:text-foreground prose-table:text-sm"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: (props) => <h1 id={slugify(String(props.children))} {...props} />,
              h2: (props) => <h2 id={slugify(String(props.children))} {...props} />,
              h3: (props) => <h3 id={slugify(String(props.children))} {...props} />,
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      </div>
    );
});
