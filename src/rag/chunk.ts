import path from "path";
import { createHash } from "crypto";

import {
  LatexTextSplitter,
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
  type TextSplitter,
} from "@langchain/textsplitters";

import type { RagChunk, RagDocument } from "@/rag/types";
import { expandPhysicsTerms } from "@/rag/terms";

export const chunkSplitterVersion = "pla-structured-chunks-v3";

export function hashContent(content: string | Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

/** Content-addressed IDs remain stable when an unchanged document is reindexed. */
export function withStableChunkIdentity(chunks: RagChunk[], options: {
  documentId: string; version?: number; documentHash?: string;
}): RagChunk[] {
  const occurrences = new Map<string, number>();
  return chunks.map((chunk) => {
    const contentHash = hashContent(chunk.content);
    const occurrence = occurrences.get(contentHash) ?? 0;
    occurrences.set(contentHash, occurrence + 1);
    return {
      ...chunk,
      id: `${options.documentId}:${contentHash.slice(0, 32)}:${occurrence}`,
      tokens: tokenize(expandPhysicsTerms(`${chunk.heading}\n${chunk.content}`)),
      metadata: { ...chunk.metadata, contentHash, version: options.version ?? 1,
        documentHash: options.documentHash, splitterVersion: chunkSplitterVersion,
        sectionPath: chunk.metadata?.sectionPath ?? (chunk.metadata?.section ? [chunk.metadata.section] : [chunk.heading]),
        tokenVersion: 3 },
    };
  });
}

const searchSegmentPattern = /\\[A-Za-z]+|\p{Script=Han}+|[A-Za-z][A-Za-z0-9_+\-]*|\d+(?:\.\d+)?/gu;
const ignoredTokens = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "does",
  "for",
  "from",
  "how",
  "into",
  "that",
  "the",
  "this",
  "what",
  "when",
  "where",
  "which",
  "why",
  "with",
  "一个",
  "一下",
  "什么",
  "以及",
  "可以",
  "如何",
  "怎么",
  "我们",
  "这个",
  "那个",
  "需要",
]);

function tokenizeHanSegment(segment: string) {
  if (segment.length < 2) {
    return [];
  }

  const tokens: string[] = [];

  if (segment.length <= 12) {
    tokens.push(segment);
  }

  for (const width of [2, 3]) {
    if (segment.length < width) {
      continue;
    }

    for (let index = 0; index <= segment.length - width; index += 1) {
      tokens.push(segment.slice(index, index + width));
    }
  }

  return tokens;
}

export function tokenize(text: string) {
  const normalized = text.normalize("NFKC").toLowerCase();
  const tokens: string[] = [];

  for (const match of normalized.matchAll(searchSegmentPattern)) {
    const segment = match[0];

    if (/^\p{Script=Han}+$/u.test(segment)) {
      tokens.push(...tokenizeHanSegment(segment));
      continue;
    }

    const token = segment.startsWith("\\") ? segment.slice(1) : segment;

    if (token.length > 1 && !ignoredTokens.has(token)) {
      tokens.push(token);
    }
  }

  return tokens.filter((token) => !ignoredTokens.has(token));
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
    separators: ["\n\n", "\n", "。", "！", "？", ". ", " ", ""],
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

  const chunks = langChainDocuments
    .map((langChainDocument, index) => {
      const content = langChainDocument.pageContent.trim();
      const heading = extractHeading(content, path.basename(document.source));

      return {
        id: `${document.metadata?.documentId ?? document.source}:${index}`,
        source: document.source,
        heading,
        content,
        tokens: tokenize(expandPhysicsTerms(`${heading}\n${content}`)),
        metadata: {
          ...document.metadata,
          chunkIndex: index,
          section: heading,
          tokenVersion: 3,
          splitterVersion: chunkSplitterVersion,
          sectionPath: [heading],
        },
      } satisfies RagChunk;
    })
    .filter((chunk) => chunk.content.length > 0);

  return withStableChunkIdentity(chunks.map((chunk) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      totalChunks: chunks.length,
    },
  })), { documentId: document.metadata?.documentId ?? document.source,
    version: document.metadata?.version, documentHash: document.metadata?.contentHash ?? hashContent(document.content) });
}
