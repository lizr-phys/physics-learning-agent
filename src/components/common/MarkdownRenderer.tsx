"use client";

import { Component, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import { createContentScope, createHeadingId } from "@/lib/content-outline";

type MarkdownRendererProps = {
  content: string;
  streaming?: boolean;
};

type MarkdownBoundaryProps = {
  content: string;
  children: ReactNode;
};

const protectedMarkdownPattern = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;

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
          <p className="mb-2 text-xs text-zinc-500">公式排版失败，已保留原始内容。</p>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-zinc-800">
            {this.props.content}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ensureBlockMath(input: string) {
  const text = input.trim();

  if (text.startsWith("$$") || text.startsWith("\\[")) {
    return text;
  }

  if (text.startsWith("$") && text.endsWith("$") && text.length > 2) {
    return `$$\n${text.slice(1, -1).trim()}\n$$`;
  }

  if (text.startsWith("\\(") && text.endsWith("\\)")) {
    return `$$\n${text.slice(2, -2).trim()}\n$$`;
  }

  return `$$\n${text}\n$$`;
}

function normalizeMathEnvironments(content: string) {
  return content
    .replace(
      /\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g,
      (_, body: string) => `$$\n${body.trim()}\n$$`,
    )
    .replace(
      /\\begin\{(?:align|align\*|gather|gather\*|multline|multline\*)\}([\s\S]*?)\\end\{(?:align|align\*|gather|gather\*|multline|multline\*)\}/g,
      (_, body: string) => `$$\n\\begin{aligned}\n${body.trim()}\n\\end{aligned}\n$$`,
    );
}

function normalizeTextSegment(content: string) {
  return normalizeMathEnvironments(content)
    .replace(/\\\[/g, () => "$$")
    .replace(/\\\]/g, () => "$$")
    .replace(/\\\(/g, () => "$")
    .replace(/\\\)/g, () => "$")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      const hasNakedTag = /\\tag\{[^}]+\}/.test(trimmed);
      const alreadyMath = trimmed.startsWith("$");

      if (hasNakedTag && !alreadyMath) {
        return `$$\n${trimmed}\n$$`;
      }

      return line;
    })
    .join("\n");
}

function countMathDelimiters(content: string) {
  let block = 0;
  let inline = 0;

  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== "$" || content[index - 1] === "\\") {
      continue;
    }

    if (content[index + 1] === "$") {
      block += 1;
      index += 1;
    } else {
      inline += 1;
    }
  }

  return { block, inline };
}

function closeStreamingMath(content: string) {
  const counts = content
    .split(protectedMarkdownPattern)
    .filter((part) => !part.startsWith("```") && !part.startsWith("~~~") && !part.startsWith("`"))
    .reduce(
      (total, part) => {
        const next = countMathDelimiters(part);
        return {
          block: total.block + next.block,
          inline: total.inline + next.inline,
        };
      },
      { block: 0, inline: 0 },
    );

  if (counts.block % 2 === 1) {
    return `${content}\n$$`;
  }

  if (counts.inline % 2 === 1) {
    return `${content}$`;
  }

  return content;
}

export function normalizeMarkdownMath(content: string, streaming = false) {
  const normalized = content
    .replace(/\r\n?/g, "\n")
    .split(protectedMarkdownPattern)
    .map((part) => {
      if (part.startsWith("```") || part.startsWith("~~~") || part.startsWith("`")) {
        return part;
      }

      return normalizeTextSegment(part);
    })
    .join("");

  return streaming ? closeStreamingMath(normalized) : normalized;
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

export function MarkdownRenderer({
  content,
  streaming = false,
}: MarkdownRendererProps) {
  const normalizedContent = normalizeMarkdownMath(content, streaming);
  const headingScope = createContentScope(content);
  const headingLineIndex = buildHeadingLineIndex(normalizedContent);

  return (
    <MarkdownBoundary content={normalizedContent}>
      <div className="markdown min-w-0 max-w-full" data-testid="markdown-content">
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
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
}
