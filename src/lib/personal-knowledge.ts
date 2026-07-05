import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";

import { chunkMarkdownDocument, tokenize } from "@/rag/chunk";
import type { RagSearchResult } from "@/rag/types";

export type PersonalDocument = {
  id: string;
  userId: string;
  fileName: string;
  storedFileName: string;
  mimeType: string;
  size: number;
  description?: string;
  indexStatus: "indexed" | "stored-only" | "failed";
  statusMessage: string;
  chunkCount: number;
  createdAt: number;
};

type PersonalChunk = {
  id: string;
  userId: string;
  documentId: string;
  source: string;
  heading: string;
  content: string;
  tokens: string[];
};

const indexedExtensions = new Set([".md", ".markdown", ".txt", ".tex", ".csv"]);
const maxUploadBytes = 12 * 1024 * 1024;

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

function isProbablyText(buffer: Buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  if (!sample.length) {
    return false;
  }

  const controlBytes = sample.filter((byte) => byte === 0 || (byte < 9 && byte !== 10 && byte !== 13));
  return controlBytes.length / sample.length < 0.01;
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
    indexStatus: document.indexStatus,
    statusMessage: document.statusMessage,
    chunkCount: document.chunkCount,
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
  data: Buffer;
}) {
  if (input.data.byteLength > maxUploadBytes) {
    throw new Error("File is too large. The current local prototype accepts files up to 12 MB.");
  }

  await ensureUserDir(input.userId);

  const id = createId("doc");
  const fileName = sanitizeFileName(input.fileName);
  const extension = path.extname(fileName).toLowerCase();
  const storedFileName = `${id}-${fileName}`;
  const filePath = path.join(uploadsDir(input.userId), storedFileName);

  await fs.writeFile(filePath, input.data);

  let indexStatus: PersonalDocument["indexStatus"] = "stored-only";
  let statusMessage =
    "Stored in your personal library. Text extraction is not available for this file type yet.";
  let documentChunks: PersonalChunk[] = [];

  if (indexedExtensions.has(extension) && isProbablyText(input.data)) {
    const content = input.data.toString("utf8").replace(/\u0000/g, "").trim();

    if (content) {
      const chunks = await chunkMarkdownDocument(
        {
          source: fileName,
          content: `# ${fileName}\n\n${input.description ? `${input.description}\n\n` : ""}${content}`,
        },
        1000,
      );

      documentChunks = chunks.map((chunk) => ({
        ...chunk,
        id: `${id}:${chunk.id}`,
        userId: input.userId,
        documentId: id,
        source: fileName,
      }));
      indexStatus = documentChunks.length ? "indexed" : "failed";
      statusMessage = documentChunks.length
        ? `Indexed ${documentChunks.length} searchable text chunks.`
        : "The file was stored, but no searchable text could be extracted.";
    } else {
      indexStatus = "failed";
      statusMessage = "The file was stored, but it did not contain readable text.";
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
    indexStatus,
    statusMessage,
    chunkCount: documentChunks.length,
    createdAt: Date.now(),
  };
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

  return toSafeDocument(document);
}

export async function deletePersonalDocument(userId: string, documentId: string) {
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
}

function scoreChunk(queryTokens: string[], chunk: PersonalChunk) {
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

export async function retrievePersonalKnowledge(
  userId: string,
  query: string,
  limit = 4,
): Promise<RagSearchResult[]> {
  const chunks = await readChunks(userId);
  const queryTokens = tokenize(query);

  return chunks
    .map((chunk) => ({
      id: chunk.id,
      source: `Personal Library / ${chunk.source}`,
      heading: chunk.heading,
      content: chunk.content,
      tokens: chunk.tokens,
      score: scoreChunk(queryTokens, chunk),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
