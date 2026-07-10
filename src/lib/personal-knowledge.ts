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
import type { RagChunk, RagSearchResult } from "@/rag/types";
import type { CourseId, DetectedLanguage } from "@/types/learning";

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
};

type PersonalChunk = RagChunk & {
  userId: string;
  documentId: string;
};

export const maxPersonalUploadBytes = 12 * 1024 * 1024;

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
  const baseName = path.basename(fileName).replace(/[^\w.\- ]+/g, "_").trim();
  return baseName || "document.txt";
}

async function readDocuments(userId: string) {
  return readJsonFile<PersonalDocument[]>(documentsPath(userId), []);
}

async function writeDocuments(userId: string, documents: PersonalDocument[]) {
  await writeJsonFile(documentsPath(userId), documents);
}

async function readChunks(userId: string) {
  return readJsonFile<PersonalChunk[]>(chunksPath(userId), []);
}

async function writeChunks(userId: string, chunks: PersonalChunk[]) {
  await writeJsonFile(chunksPath(userId), chunks);
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
}) {
  if (input.data.byteLength > maxPersonalUploadBytes) {
    throw new Error("File is too large. The current local prototype accepts files up to 12 MB.");
  }

  await ensureUserDir(input.userId);

  const id = createId("doc");
  const fileName = sanitizeFileName(input.fileName);
  const extension = path.extname(fileName).toLowerCase();
  const storedFileName = `${id}-${fileName}`;
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
        },
      });
      extractionMethod = extraction.extractionMethod;
      sourceType = extraction.sourceType;
      documentChunks = extraction.chunks.map((chunk) => ({
        ...chunk,
        id: `${id}:${chunk.metadata?.chunkIndex ?? chunk.id}`,
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
      return toSafeDocument(unsupportedDocument);
    }

    const data = await fs.readFile(path.join(uploadsDir(userId), document.storedFileName));
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
        },
      });
      nextChunks = extraction.chunks.map((chunk) => ({
        ...chunk,
        id: `${documentId}:${chunk.metadata?.chunkIndex ?? chunk.id}`,
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

export async function retrievePersonalKnowledge(
  userId: string,
  query: string,
  options: number | { limit?: number; course?: string; topic?: string } = 4,
): Promise<RagSearchResult[]> {
  const chunks = await readChunks(userId);
  const normalizedOptions = typeof options === "number" ? { limit: options } : options;

  return searchRagChunks(
    chunks.map((chunk) => ({
      ...chunk,
      source: `Personal Library / ${chunk.source}`,
      metadata: {
        ...chunk.metadata,
        documentId: chunk.documentId,
        userId: chunk.userId,
      },
    })),
    query,
    normalizedOptions,
  );
}
