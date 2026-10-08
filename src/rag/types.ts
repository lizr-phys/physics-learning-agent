export type RagDocument = {
  source: string;
  content: string;
  metadata?: RagDocumentMetadata;
};

export type RagDocumentMetadata = {
  documentId?: string;
  userId?: string;
  sourceType?: string;
  course?: string;
  topic?: string;
  language?: "zh" | "en";
  description?: string;
  contentHash?: string;
  documentHash?: string;
  version?: number;
  splitterVersion?: string;
};

export type RagChunkMetadata = RagDocumentMetadata & {
  chunkIndex?: number;
  totalChunks?: number;
  pageNumber?: number;
  slideNumber?: number;
  sheetName?: string;
  section?: string;
  startIndex?: number;
  endIndex?: number;
  isTableChunk?: boolean;
  tokenVersion?: number;
  sectionPath?: string[];
};

export type RagChunk = {
  id: string;
  source: string;
  heading: string;
  content: string;
  tokens: string[];
  metadata?: RagChunkMetadata;
};

export type RagSearchResult = RagChunk & {
  sourceId: string;
  score: number;
  locator?: string;
  scoreBreakdown?: {
    lexical: number;
    phrase: number;
    heading: number;
    metadata: number;
    vector: number;
  };
};
