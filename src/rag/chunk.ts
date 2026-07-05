import path from "path";

import {
  LatexTextSplitter,
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
  type TextSplitter,
} from "@langchain/textsplitters";

import type { RagChunk, RagDocument } from "@/rag/types";

const tokenPattern = /[\p{Script=Han}A-Za-z0-9_\-]+/gu;

export function tokenize(text: string) {
  return Array.from(text.toLowerCase().matchAll(tokenPattern), (match) => match[0]).filter(
    (token) => token.length > 1,
  );
}

function createSplitter(source: string, maxChars: number): TextSplitter {
  const extension = path.extname(source).toLowerCase();
  const chunkOverlap = Math.min(160, Math.max(40, Math.floor(maxChars * 0.15)));
  const config = {
    chunkSize: maxChars,
    chunkOverlap,
  };

  if (extension === ".md" || extension === ".markdown") {
    return new MarkdownTextSplitter(config);
  }

  if (extension === ".tex") {
    return new LatexTextSplitter(config);
  }

  return new RecursiveCharacterTextSplitter({
    ...config,
    separators: ["\n\n", "\n", "。", ". ", " ", ""],
  });
}

function extractHeading(content: string, fallback: string) {
  const markdownHeading = content.match(/^\s{0,3}#{1,6}\s+(.+)$/m)?.[1]?.trim();
  const latexSection = content.match(/\\(?:section|subsection|subsubsection)\*?\{([^}]+)\}/)?.[1]?.trim();

  return markdownHeading || latexSection || fallback;
}

export async function chunkMarkdownDocument(
  document: RagDocument,
  maxChars = 900,
): Promise<RagChunk[]> {
  const splitter = createSplitter(document.source, maxChars);
  const langChainDocuments = await splitter.createDocuments([document.content], [
    { source: document.source },
  ]);

  return langChainDocuments
    .map((langChainDocument, index) => {
      const content = langChainDocument.pageContent.trim();
      const heading = extractHeading(content, path.basename(document.source));

      return {
        id: `${document.source}:${index}`,
        source: document.source,
        heading,
        content,
        tokens: tokenize(`${heading}\n${content}`),
      };
    })
    .filter((chunk) => chunk.content.length > 0);
}
