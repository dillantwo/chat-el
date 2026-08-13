"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export const REMARK_PLUGINS = [remarkGfm, remarkMath];
export const REHYPE_PLUGINS = [[rehypeKatex, { strict: false }]] as never;

// Keeps short strings (chat titles) on one line while still rendering inline
// LaTeX, by dropping the block <p> wrapper react-markdown would add.
const INLINE_MARKDOWN_COMPONENTS = {
  p: ({ children }: { children?: ReactNode }) => <>{children}</>,
} as never;

/** A short piece of text (e.g. a record title) with inline LaTeX support. */
export function MathText({ children, className }: { children: string; className?: string }) {
  return (
    <span className={className}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={INLINE_MARKDOWN_COMPONENTS}
      >
        {children}
      </ReactMarkdown>
    </span>
  );
}

/** A full markdown block: paragraphs, tables and display LaTeX. */
export function MarkdownBlock({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>
      {children}
    </ReactMarkdown>
  );
}
