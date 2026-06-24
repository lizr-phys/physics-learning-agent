export type RagDocument = {
  source: string;
  content: string;
};

export type RagChunk = {
  id: string;
  source: string;
  heading: string;
  content: string;
  tokens: string[];
};

export type RagSearchResult = RagChunk & {
  score: number;
};
