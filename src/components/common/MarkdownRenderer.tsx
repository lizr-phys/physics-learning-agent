"use client";

import { Component, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import { createContentScope, createHeadingId } from "@/lib/content-outline";

type MarkdownRendererProps = {
  content: string;
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
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-zinc-800">
          {this.props.content}
        </pre>
      );
    }

    return this.props.children;
  }
}

export function ensureBlockMath(input: string) {
  const text = input.trim();

  if (
    text.startsWith("$$") ||
    text.startsWith("$") ||
    text.startsWith("\\[") ||
    text.startsWith("\\(")
  ) {
    return text;
  }

  return `$$\n${text}\n$$`;
}

function normalizeMathDelimitersOutsideCode(content: string) {
  return content
    .split(/(```[\s\S]*?```)/g)
    .map((part) => {
      if (part.startsWith("```")) {
        return part;
      }

      return part
        .replace(/\\\[/g, "$$")
        .replace(/\\\]/g, "$$")
        .replace(/\\\(/g, "$")
        .replace(/\\\)/g, "$")
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          const hasNakedTag = /\\tag\{[^}]+\}/.test(trimmed);
          const alreadyMath =
            trimmed.startsWith("$") ||
            trimmed.startsWith("$$") ||
            trimmed.startsWith("\\[") ||
            trimmed.startsWith("\\(");

          if (hasNakedTag && !alreadyMath) {
            return `$$\n${trimmed}\n$$`;
          }

          return line;
        })
        .join("\n");
    })
    .join("");
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const normalizedContent = normalizeMathDelimitersOutsideCode(content);
  const headingScope = createContentScope(content);
  let headingIndex = 0;

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

  return (
    <MarkdownBoundary content={content}>
      <div className="markdown min-w-0 max-w-full" data-testid="markdown-content">
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
          components={{
            h2: ({ children }) => {
              const id = createHeadingId(headingText(children), headingIndex, headingScope);
              headingIndex += 1;
              return <h2 id={id} className="scroll-mt-6">{children}</h2>;
            },
            h3: ({ children }) => {
              const id = createHeadingId(headingText(children), headingIndex, headingScope);
              headingIndex += 1;
              return <h3 id={id} className="scroll-mt-6">{children}</h3>;
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
}
