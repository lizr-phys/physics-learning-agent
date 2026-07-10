import "server-only";

import { promises as fs } from "fs";
import path from "path";

import { chunkMarkdownDocument } from "@/rag/chunk";
import { searchRagChunks, type RagSearchOptions } from "@/rag/search";
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

export async function retrieveRagSnippets(
  query: string,
  options: number | RagSearchOptions = 4,
): Promise<RagSearchResult[]> {
  const chunks = await getRagChunks();
  return searchRagChunks(
    chunks,
    query,
    typeof options === "number" ? { limit: options } : options,
  );
}
