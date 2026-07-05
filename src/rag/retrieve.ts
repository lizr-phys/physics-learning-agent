import "server-only";

import { promises as fs } from "fs";
import path from "path";

import { chunkMarkdownDocument, tokenize } from "@/rag/chunk";
import type { RagChunk, RagDocument, RagSearchResult } from "@/rag/types";

let cachedChunks: RagChunk[] | null = null;

async function loadSampleDocuments(): Promise<RagDocument[]> {
  const docsDir = path.join(process.cwd(), "src", "rag", "sample-docs");
  const files = await fs.readdir(docsDir);
  const markdownFiles = files.filter((file) => file.endsWith(".md"));

  return Promise.all(
    markdownFiles.map(async (file) => ({
      source: file,
      content: await fs.readFile(path.join(docsDir, file), "utf8"),
    })),
  );
}

export async function getRagChunks() {
  if (cachedChunks) {
    return cachedChunks;
  }

  const documents = await loadSampleDocuments();
  cachedChunks = (await Promise.all(documents.map((document) => chunkMarkdownDocument(document)))).flat();
  return cachedChunks;
}

function scoreChunk(queryTokens: string[], chunk: RagChunk) {
  if (!queryTokens.length) {
    return 0;
  }

  const tokenSet = new Set(chunk.tokens);
  const headingTokens = new Set(tokenize(chunk.heading));
  let score = 0;

  for (const token of queryTokens) {
    if (tokenSet.has(token)) {
      score += 1;
    }

    if (headingTokens.has(token)) {
      score += 2;
    }
  }

  return score / Math.sqrt(chunk.tokens.length + 1);
}

export async function retrieveRagSnippets(query: string, limit = 4): Promise<RagSearchResult[]> {
  const chunks = await getRagChunks();
  const queryTokens = tokenize(query);

  return chunks
    .map((chunk) => ({ ...chunk, score: scoreChunk(queryTokens, chunk) }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
