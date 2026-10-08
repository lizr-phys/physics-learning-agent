import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";

import { detectCourseFromText, detectKnowledgeFromText } from "@/agent/exercise-parser";
import { withKeyedLock } from "@/lib/async-lock";
import { detectLanguage } from "@/lib/language";
import {
  extractDocumentChunks,
  supportsDocumentExtraction,
  type DocumentExtractionResult,
} from "@/rag/document-loader";
import { searchRagChunks } from "@/rag/search";
import { formatRagLocator } from "@/rag/search";
import { chunkSplitterVersion, hashContent, withStableChunkIdentity } from "@/rag/chunk";
import type { RagChunk, RagSearchResult } from "@/rag/types";
import type { CourseId, DetectedLanguage, RagContext } from "@/types/learning";
import type { PhotoProblemMetadata } from "@/lib/photo-problem";

export type PersonalDocument = {
  id: string;
  userId: string;
  fileName: string;
  storedFileName: string;
  mimeType: string;
  size: number;
  description?: string;
  course?: CourseId;
  topic?: string;
  language?: DetectedLanguage;
  sourceType?: string;
  extractionMethod?: DocumentExtractionResult["extractionMethod"];
  indexStatus: "indexed" | "stored-only" | "failed";
  statusMessage: string;
  chunkCount: number;
  indexedAt?: number;
  createdAt: number;
  contentHash?: string;
  version?: number;
  splitterVersion?: string;
  problem?: PhotoProblemMetadata;
};

type PersonalChunk = RagChunk & {
  userId: string;
  documentId: string;
};

export const maxPersonalUploadBytes = 12 * 1024 * 1024;
const chunkCache = new Map<string, { revision: string; chunks: PersonalChunk[] }>();

function dataRoot() {
  return process.env.PLA_DATA_DIR || path.join(process.cwd(), ".pla-data");
}

function safeUserDir(userId: string) {
  return path.join(dataRoot(), "users", userId);
}

function uploadsDir(userId: string) {
  return path.join(safeUserDir(userId), "uploads");
}

function documentsPath(userId: string) {
  return path.join(safeUserDir(userId), "documents.json");
}

function chunksPath(userId: string) {
  return path.join(safeUserDir(userId), "chunks.json");
}

async function ensureUserDir(userId: string) {
  await fs.mkdir(uploadsDir(userId), { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

function createId(prefix: string) {
  return `${prefix}_${randomBytes(10).toString("hex")}`;
}

function sanitizeFileName(fileName: string) {
  const baseName = path.basename(fileName.replace(/\\/g, "/")).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 240);
  return baseName || "document.txt";
}

async function readDocuments(userId: string) {
  return readJsonFile<PersonalDocument[]>(documentsPath(userId), []);
}

async function writeDocuments(userId: string, documents: PersonalDocument[]) {
  await writeJsonFile(documentsPath(userId), documents);
}

async function readChunks(userId: string) {
  const filePath = chunksPath(userId);
  try {
    const stat = await fs.stat(filePath);
    const revision = `${stat.mtimeMs}:${stat.size}:${stat.ino}`;
    const cached = chunkCache.get(filePath);
    if (cached?.revision === revision) return cached.chunks;
    const chunks = await readJsonFile<PersonalChunk[]>(filePath, []);
    if (chunkCache.size >= 64) chunkCache.delete(chunkCache.keys().next().value!);
    chunkCache.set(filePath, { revision, chunks });
    return chunks;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") { chunkCache.delete(filePath); return []; }
    throw error;
  }
}

async function writeChunks(userId: string, chunks: PersonalChunk[]) {
  await writeJsonFile(chunksPath(userId), chunks);
  chunkCache.delete(chunksPath(userId));
}

function toSafeDocument(document: PersonalDocument) {
  return {
    id: document.id,
    userId: document.userId,
    fileName: document.fileName,
    mimeType: document.mimeType,
    size: document.size,
    description: document.description,
    course: document.course,
    topic: document.topic,
    language: document.language,
    sourceType: document.sourceType,
    extractionMethod: document.extractionMethod,
    indexStatus: document.indexStatus,
    statusMessage: document.statusMessage,
    chunkCount: document.chunkCount,
    indexedAt: document.indexedAt,
    createdAt: document.createdAt,
    contentHash: document.contentHash,
    version: document.version,
    splitterVersion: document.splitterVersion,
    problem: document.problem,
  };
}

export async function listPersonalDocuments(userId: string) {
  const documents = await readDocuments(userId);
  return documents
    .map(toSafeDocument)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function addPersonalDocument(input: {
  userId: string;
  fileName: string;
  mimeType: string;
  description?: string;
  course?: CourseId;
  topic?: string;
  data: Buffer;
  problem?: PhotoProblemMetadata;
}) {
  if (input.data.byteLength > maxPersonalUploadBytes) {
    throw new Error("File is too large. The current local prototype accepts files up to 12 MB.");
  }

  await ensureUserDir(input.userId);

  const id = createId("doc");
  const fileName = sanitizeFileName(input.fileName);
  const extension = path.extname(fileName).toLowerCase();
  const storedFileName = `${id}${extension}`;
  const filePath = path.join(uploadsDir(input.userId), storedFileName);
  const metadataText = [fileName, input.description, input.topic].filter(Boolean).join("\n");
  const course =
    input.course && input.course !== "general"
      ? input.course
      : detectCourseFromText(metadataText);
  const topic =
    input.topic?.trim().slice(0, 240) ||
    (course ? detectKnowledgeFromText(metadataText, course) : undefined);
  const language = detectLanguage(metadataText || fileName);
  const contentHash = hashContent(input.data);

  await fs.writeFile(filePath, input.data);

  let indexStatus: PersonalDocument["indexStatus"] = "stored-only";
  let statusMessage =
    "Stored in your personal library. Text extraction is not available for this file type yet.";
  let documentChunks: PersonalChunk[] = [];
  let extractionMethod: PersonalDocument["extractionMethod"];
  let sourceType = extension.slice(1) || "unknown";
  let indexedAt: number | undefined;

  if (supportsDocumentExtraction(fileName)) {
    try {
      const extraction = await extractDocumentChunks({
        fileName,
        data: input.data,
        metadata: {
          documentId: id,
          userId: input.userId,
          sourceType,
          course,
          topic,
          language,
          description: input.description?.trim().slice(0, 500) || undefined,
          contentHash, version: 1, splitterVersion: chunkSplitterVersion,
        },
      });
      extractionMethod = extraction.extractionMethod;
      sourceType = extraction.sourceType;
      documentChunks = withStableChunkIdentity(extraction.chunks, { documentId: id, version: 1, documentHash: contentHash }).map((chunk) => ({
        ...chunk,
        userId: input.userId,
        documentId: id,
      }));
      indexStatus = documentChunks.length ? "indexed" : "failed";
      indexedAt = documentChunks.length ? Date.now() : undefined;
      statusMessage = documentChunks.length
        ? `Indexed ${documentChunks.length} structured chunks from ${sourceType.toUpperCase()}.`
        : "The file was stored, but no searchable text could be extracted.";

      if (extraction.warnings.length) {
        statusMessage += " Some document elements could not be extracted.";
      }
    } catch (error) {
      indexStatus = "failed";
      statusMessage = `The file was stored, but indexing failed: ${
        error instanceof Error ? error.message : "unknown extraction error"
      }`;
    }
  }

  const document: PersonalDocument = {
    id,
    userId: input.userId,
    fileName,
    storedFileName,
    mimeType: input.mimeType || "application/octet-stream",
    size: input.data.byteLength,
    description: input.description?.trim().slice(0, 500) || undefined,
    course,
    topic,
    language,
    sourceType,
    extractionMethod,
    indexStatus,
    statusMessage,
    chunkCount: documentChunks.length,
    indexedAt,
    createdAt: Date.now(),
    contentHash, version: 1, splitterVersion: chunkSplitterVersion,
    problem: input.problem,
  };
  await withKeyedLock(`personal-knowledge:${input.userId}`, async () => {
    const [documents, existingChunks] = await Promise.all([
      readDocuments(input.userId),
      readChunks(input.userId),
    ]);

    await Promise.all([
      writeDocuments(input.userId, [document, ...documents]),
      writeChunks(input.userId, [
        ...existingChunks.filter((chunk) => chunk.documentId !== id),
        ...documentChunks,
      ]),
    ]);
  });

  return toSafeDocument(document);
}

export async function deletePersonalDocument(userId: string, documentId: string) {
  return withKeyedLock(`personal-knowledge:${userId}`, async () => {
    const documents = await readDocuments(userId);
    const document = documents.find((item) => item.id === documentId);

    if (!document) {
      return false;
    }

    const chunks = await readChunks(userId);

    await Promise.all([
      writeDocuments(
        userId,
        documents.filter((item) => item.id !== documentId),
      ),
      writeChunks(
        userId,
        chunks.filter((chunk) => chunk.documentId !== documentId),
      ),
      fs.rm(path.join(uploadsDir(userId), document.storedFileName), { force: true }),
    ]);

    return true;
  });
}

export async function reindexPersonalDocument(userId: string, documentId: string) {
  return withKeyedLock(`personal-knowledge:${userId}`, async () => {
    const documents = await readDocuments(userId);
    const document = documents.find((item) => item.id === documentId);

    if (!document) {
      return null;
    }

    if (!supportsDocumentExtraction(document.fileName)) {
      const unsupportedDocument: PersonalDocument = {
        ...document,
        indexStatus: "stored-only",
        statusMessage: "Text extraction is not available for this file type.",
        chunkCount: 0,
        indexedAt: undefined,
      };
      await writeDocuments(
        userId,
        documents.map((item) => (item.id === documentId ? unsupportedDocument : item)),
      );
      await writeChunks(userId, (await readChunks(userId)).filter((chunk) => chunk.documentId !== documentId));
      return toSafeDocument(unsupportedDocument);
    }

    const data = await fs.readFile(path.join(uploadsDir(userId), document.storedFileName));
    const contentHash = hashContent(data);
    const version = (document.version ?? 0) + 1;
    let nextDocument: PersonalDocument;
    let nextChunks: PersonalChunk[] = [];

    try {
      const extraction = await extractDocumentChunks({
        fileName: document.fileName,
        data,
        metadata: {
          documentId,
          userId,
          sourceType: document.sourceType,
          course: document.course,
          topic: document.topic,
          language: document.language,
          description: document.description,
          contentHash, version, splitterVersion: chunkSplitterVersion,
        },
      });
      nextChunks = withStableChunkIdentity(extraction.chunks, { documentId, version, documentHash: contentHash }).map((chunk) => ({
        ...chunk,
        userId,
        documentId,
      }));
      nextDocument = {
        ...document,
        sourceType: extraction.sourceType,
        extractionMethod: extraction.extractionMethod,
        indexStatus: nextChunks.length ? "indexed" : "failed",
        statusMessage: nextChunks.length
          ? `Indexed ${nextChunks.length} structured chunks from ${extraction.sourceType.toUpperCase()}.`
          : "No searchable text could be extracted from this file.",
        chunkCount: nextChunks.length,
        indexedAt: nextChunks.length ? Date.now() : undefined,
        contentHash, version, splitterVersion: chunkSplitterVersion,
      };

      if (extraction.warnings.length) {
        nextDocument.statusMessage += " Some document elements could not be extracted.";
      }
    } catch (error) {
      nextDocument = {
        ...document,
        indexStatus: "failed",
        statusMessage: `Indexing failed: ${
          error instanceof Error ? error.message : "unknown extraction error"
        }`,
        chunkCount: 0,
        indexedAt: undefined,
        contentHash, version, splitterVersion: chunkSplitterVersion,
      };
    }

    const existingChunks = await readChunks(userId);
    await Promise.all([
      writeDocuments(
        userId,
        documents.map((item) => (item.id === documentId ? nextDocument : item)),
      ),
      writeChunks(userId, [
        ...existingChunks.filter((chunk) => chunk.documentId !== documentId),
        ...nextChunks,
      ]),
    ]);

    return toSafeDocument(nextDocument);
  });
}

export type PersonalRetrievalOptions = {
  limit?: number;
  course?: string;
  topic?: string;
  documentIds?: string[];
  courseOnly?: boolean;
  signal?: AbortSignal;
};

async function authorizedChunks(userId: string, options: PersonalRetrievalOptions = {}) {
  options.signal?.throwIfAborted();
  const [chunks, documents] = await Promise.all([readChunks(userId), readDocuments(userId)]);
  options.signal?.throwIfAborted();
  const ownedDocuments = new Map(documents.filter((document) => document.userId === userId
    && document.indexStatus === "indexed").map((document) => [document.id, document]));
  const selectedDocuments = options.documentIds?.length ? new Set(options.documentIds) : undefined;
  const allowed = (chunk: PersonalChunk) => {
    const document = ownedDocuments.get(chunk.documentId);
    return chunk.userId === userId && Boolean(document)
      && (!selectedDocuments || selectedDocuments.has(chunk.documentId))
      && (!options.courseOnly || Boolean(options.course && options.course !== "general" && document?.course === options.course))
      && (!document?.version || !chunk.metadata?.version || document.version === chunk.metadata.version);
  };
  // Preserve the cached array identity for corpus-statistics reuse in the common all-documents case.
  return chunks.every(allowed) ? chunks : chunks.filter(allowed);
}

export async function readPersonalProblem(userId: string, documentId: string) {
  const document = (await readDocuments(userId)).find(item => item.id === documentId && item.userId === userId && item.problem);
  if (!document || !/^doc_[0-9a-f]{20}\.md$/.test(document.storedFileName)) return null;
  const content = await fs.readFile(path.join(uploadsDir(userId), document.storedFileName), "utf8");
  return { document: toSafeDocument(document), content };
}

export async function retrievePersonalKnowledge(
  userId: string,
  query: string,
  options: number | PersonalRetrievalOptions = 4,
): Promise<RagSearchResult[]> {
  const normalizedOptions = typeof options === "number" ? { limit: options } : options;
  const chunks = await authorizedChunks(userId, normalizedOptions);
  const documentIds = new Map(chunks.map((chunk) => [chunk.id, chunk.documentId]));
  const results = searchRagChunks(chunks, query, normalizedOptions).map((chunk) => ({
    ...chunk, source: `Personal Library / ${chunk.source}`,
    metadata: { ...chunk.metadata, documentId: documentIds.get(chunk.id), userId },
  }));
  normalizedOptions.signal?.throwIfAborted();
  return results;
}

export async function getPersonalKnowledgeSource(userId: string, sourceId: string): Promise<RagContext["snippets"][number] | null> {
  const chunks = await authorizedChunks(userId);
  const chunk = chunks.find((item) => item.id === sourceId);
  if (!chunk) return null;
  return { sourceId: chunk.id, documentId: chunk.documentId,
    source: `Personal Library / ${chunk.source}`, heading: chunk.heading, content: chunk.content,
    kind: "personal", locator: formatRagLocator(chunk),
    contentHash: chunk.metadata?.contentHash ?? hashContent(chunk.content), version: chunk.metadata?.version ?? 1 };
}
