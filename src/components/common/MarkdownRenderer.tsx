"use client";

import { Component, memo, useDeferredValue, useMemo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";

import { createContentScope, createHeadingId } from "@/lib/content-outline";
import { normalizeMarkdownMath } from "@/lib/markdown-math";
import { remarkCitations } from "@/lib/remark-citations";
export { ensureBlockMath, normalizeMarkdownMath } from "@/lib/markdown-math";

export type MarkdownRendererProps = {
  content: string;
  streaming?: boolean;
  sourceCount?: number;
  onSourceSelect?: (index: number) => void;
};

type MarkdownBoundaryProps = {
  content: string;
  children: ReactNode;
};



class MarkdownBoundary extends Component<
  MarkdownBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: MarkdownBoundaryProps) {
    if (this.state.failed && previous.content !== this.props.content) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <p className="mb-2 text-xs text-zinc-500">
            Formula rendering failed. The original content is preserved below.
          </p>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-zinc-800">
            {this.props.content}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

function headingText(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(headingText).join("");
  }

  if (children && typeof children === "object" && "props" in children) {
    return headingText((children as { props: { children?: ReactNode } }).props.children);
  }

  return "";
}

function buildHeadingLineIndex(content: string) {
  const indexByLine = new Map<number, number>();
  let headingIndex = 0;
  let fence = "";

  content.split(/\r?\n/).forEach((line, lineIndex) => {
    const fenceMatch = line.match(/^\s*(```|~~~)/);

    if (fenceMatch) {
      fence = fence ? "" : fenceMatch[1];
      return;
    }

    if (fence) {
      return;
    }

    if (/^#{2,3}\s+/.test(line)) {
      indexByLine.set(lineIndex + 1, headingIndex);
      headingIndex += 1;
    }
  });

  return indexByLine;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  streaming = false,
  sourceCount = 0,
  onSourceSelect,
}: MarkdownRendererProps) {
  const deferredContent = useDeferredValue(content);
  const renderedContent = streaming ? deferredContent : content;
  const normalizedContent = useMemo(() => normalizeMarkdownMath(renderedContent, streaming), [renderedContent, streaming]);
  const headingScope = useMemo(() => createContentScope(renderedContent), [renderedContent]);
  const headingLineIndex = useMemo(() => buildHeadingLineIndex(normalizedContent), [normalizedContent]);

  return (
    <MarkdownBoundary content={normalizedContent}>
      <div className="markdown min-w-0 max-w-full" data-testid="markdown-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath, [remarkCitations, {count: sourceCount}]]}
          rehypePlugins={[
            [
              rehypeKatex,
              {
                throwOnError: false,
                strict: "ignore",
                errorColor: "#52525b",
                output: "htmlAndMathml",
              },
            ],
          ]}
          components={{
            a: ({href, children}) => {
              const citation = href?.match(/^#pla-source-(\d+)$/);
              return citation && onSourceSelect ? <button type="button" className="underline underline-offset-2" onClick={() => onSourceSelect(Number(citation[1]))} aria-label={`View source ${citation[1]}`}>{children}</button> : <a href={href}>{children}</a>;
            },
            h2: ({ children, node }) => {
              const headingIndex = headingLineIndex.get(node?.position?.start.line ?? -1) ?? 0;
              const id = createHeadingId(headingText(children), headingIndex, headingScope);
              return (
                <h2 id={id} className="scroll-mt-6">
                  {children}
                </h2>
              );
            },
            h3: ({ children, node }) => {
              const headingIndex = headingLineIndex.get(node?.position?.start.line ?? -1) ?? 0;
              const id = createHeadingId(headingText(children), headingIndex, headingScope);
              return (
                <h3 id={id} className="scroll-mt-6">
                  {children}
                </h3>
              );
            },
            table: ({ children }) => (
              <div className="w-full overflow-x-auto">
                <table>{children}</table>
              </div>
            ),
            pre: ({ children }) => (
              <pre className="max-w-full overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50 p-3">
                {children}
              </pre>
            ),
          }}
        >
          {normalizedContent}
        </ReactMarkdown>
      </div>
    </MarkdownBoundary>
  );
});
