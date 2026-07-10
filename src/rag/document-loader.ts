import path from "path";
import type { OfficeChunk, SupportedFileType } from "officeparser";

import { chunkMarkdownDocument, tokenize } from "@/rag/chunk";
import type { RagChunk, RagDocumentMetadata } from "@/rag/types";

export type DocumentExtractionResult = {
  chunks: RagChunk[];
  sourceType: string;
  extractionMethod: "langchain-text" | "officeparser-structure";
  warnings: string[];
};

export type DocumentExtractionInput = {
  fileName: string;
  data: Buffer;
  metadata: RagDocumentMetadata;
};

const textExtensions = new Set([".md", ".markdown", ".txt", ".tex", ".csv"]);
const officeTypeByExtension = new Map<string, SupportedFileType>([
  [".pdf", "pdf"],
  [".docx", "docx"],
  [".pptx", "pptx"],
  [".xlsx", "xlsx"],
  [".rtf", "rtf"],
  [".odt", "odt"],
  [".odp", "odp"],
  [".ods", "ods"],
]);

export const immediatelyIndexedExtensions = new Set([
  ...textExtensions,
  ...officeTypeByExtension.keys(),
]);

export function supportsDocumentExtraction(fileName: string) {
  return immediatelyIndexedExtensions.has(path.extname(fileName).toLowerCase());
}

function isProbablyText(buffer: Buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));

  if (!sample.length) {
    return false;
  }

  const controlBytes = sample.filter(
    (byte) => byte === 0 || (byte < 9 && byte !== 10 && byte !== 13),
  );
  return controlBytes.length / sample.length < 0.01;
}

function decodeTextBuffer(buffer: Buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer.subarray(2));
  }

  if (buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buffer.subarray(2));
  }

  return new TextDecoder("utf-8").decode(
    buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf
      ? buffer.subarray(3)
      : buffer,
  );
}

function officeSplitBy(sourceType: SupportedFileType) {
  if (sourceType === "pdf") {
    return "page" as const;
  }

  if (sourceType === "pptx" || sourceType === "odp") {
    return "slide" as const;
  }

  if (sourceType === "xlsx" || sourceType === "ods") {
    return "sheet" as const;
  }

  return "heading" as const;
}

function officeChunkHeading(chunk: OfficeChunk, fallback: string) {
  if (chunk.metadata.closestHeading?.trim()) {
    return chunk.metadata.closestHeading.trim();
  }

  if (chunk.metadata.pageNumber) {
    return `Page ${chunk.metadata.pageNumber}`;
  }

  if (chunk.metadata.slideNumber) {
    return `Slide ${chunk.metadata.slideNumber}`;
  }

  if (chunk.metadata.sheetName) {
    return `Sheet ${chunk.metadata.sheetName}`;
  }

  return fallback;
}

async function extractOfficeChunks(input: DocumentExtractionInput, sourceType: SupportedFileType) {
  const warnings: string[] = [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const { OfficeParser } = await import("officeparser");
    const ast = await OfficeParser.parseOffice(input.data, {
      fileType: sourceType,
      abortSignal: controller.signal,
      ignoreComments: true,
      ignoreHeadersAndFooters: true,
      ignoreSlideMasters: true,
      extractAttachments: false,
      ocr: false,
      decompressionLimits: {
        maxUncompressedBytes: 96 * 1024 * 1024,
        maxZipEntries: 4_000,
      },
      onWarning: (warning) => {
        warnings.push(warning.message);
      },
    });
    const conversion = await ast.to("chunks", {
      abortSignal: controller.signal,
      chunksConfig: {
        strategy: "document-structure",
        splitBy: officeSplitBy(sourceType),
        maxChunkSize: 1_200,
        tableSplitStrategy: "row",
        includeMetadata: true,
        addStartIndex: true,
      },
    });
    const officeChunks = conversion.value as OfficeChunk[];
    const fallbackHeading = path.basename(input.fileName);
    const chunks = officeChunks
      .map((chunk, index): RagChunk => {
        const content = chunk.text.replace(/\u0000/g, "").trim();
        const heading = officeChunkHeading(chunk, fallbackHeading);

        return {
          id: `${input.metadata.documentId ?? input.fileName}:${index}`,
          source: input.fileName,
          heading,
          content,
          tokens: tokenize(
            [
              heading,
              input.metadata.course,
              input.metadata.topic,
              input.metadata.description,
              content,
            ]
              .filter(Boolean)
              .join("\n"),
          ),
          metadata: {
            ...input.metadata,
            sourceType,
            chunkIndex: index,
            pageNumber: chunk.metadata.pageNumber,
            slideNumber: chunk.metadata.slideNumber,
            sheetName: chunk.metadata.sheetName,
            section: chunk.metadata.closestHeading,
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
            isTableChunk: chunk.metadata.isTableChunk,
            tokenVersion: 2,
          },
        };
      })
      .filter((chunk) => chunk.content.length > 4);

    return {
      chunks: chunks.map((chunk) => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          totalChunks: chunks.length,
        },
      })),
      sourceType,
      extractionMethod: "officeparser-structure" as const,
      warnings: [...warnings, ...conversion.messages.map((message) => message.message)],
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractDocumentChunks(
  input: DocumentExtractionInput,
): Promise<DocumentExtractionResult> {
  const extension = path.extname(input.fileName).toLowerCase();

  if (textExtensions.has(extension)) {
    if (!isProbablyText(input.data)) {
      throw new Error("The file does not contain readable text in a supported encoding.");
    }

    const content = decodeTextBuffer(input.data).replace(/\u0000/g, "").trim();

    if (!content) {
      throw new Error("The file does not contain readable text.");
    }

    return {
      chunks: await chunkMarkdownDocument(
        {
          source: input.fileName,
          content,
          metadata: input.metadata,
        },
        1_000,
      ),
      sourceType: extension.slice(1) || "text",
      extractionMethod: "langchain-text",
      warnings: [],
    };
  }

  const sourceType = officeTypeByExtension.get(extension);

  if (!sourceType) {
    throw new Error("Text extraction is not available for this file type.");
  }

  return extractOfficeChunks(input, sourceType);
}
