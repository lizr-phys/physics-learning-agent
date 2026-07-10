import { tokenize } from "@/rag/chunk";
import type { RagChunk, RagSearchResult } from "@/rag/types";

export type RagSearchOptions = {
  limit?: number;
  candidateLimit?: number;
  course?: string;
  topic?: string;
  minScore?: number;
  vectorScores?: ReadonlyMap<string, number>;
};

const bm25K1 = 1.35;
const bm25B = 0.72;

function normalizedText(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function searchableTokens(chunk: RagChunk) {
  return chunk.metadata?.tokenVersion === 2 && chunk.tokens.length
    ? chunk.tokens
    : tokenize(
        [
          chunk.heading,
          chunk.metadata?.course,
          chunk.metadata?.topic,
          chunk.metadata?.description,
          chunk.content,
        ]
          .filter(Boolean)
          .join("\n"),
      );
}

function termFrequency(tokens: string[]) {
  const frequencies = new Map<string, number>();

  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }

  return frequencies;
}

function metadataScore(chunk: RagChunk, options: RagSearchOptions) {
  let score = 0;
  const course = normalizedText(options.course ?? "");
  const topic = normalizedText(options.topic ?? "");
  const chunkCourse = normalizedText(chunk.metadata?.course ?? "");
  const chunkTopic = normalizedText(chunk.metadata?.topic ?? "");

  if (course && chunkCourse && course === chunkCourse) {
    score += 1.25;
  }

  if (topic && chunkTopic) {
    if (topic === chunkTopic) {
      score += 1.5;
    } else if (topic.includes(chunkTopic) || chunkTopic.includes(topic)) {
      score += 0.75;
    }
  }

  return score;
}

function phraseScore(query: string, chunk: RagChunk) {
  const normalizedQuery = normalizedText(query);

  if (normalizedQuery.length < 2) {
    return 0;
  }

  const normalizedContent = normalizedText(chunk.content);
  const normalizedHeading = normalizedText(chunk.heading);
  let score = 0;

  if (normalizedContent.includes(normalizedQuery)) {
    score += 2.5;
  }

  if (normalizedHeading.includes(normalizedQuery) || normalizedQuery.includes(normalizedHeading)) {
    score += 2;
  }

  return score;
}

function headingScore(queryTokens: string[], chunk: RagChunk) {
  const headingTokens = new Set(tokenize(chunk.heading));

  if (!headingTokens.size) {
    return 0;
  }

  const matches = queryTokens.filter((token) => headingTokens.has(token)).length;
  return matches ? (matches / Math.max(1, new Set(queryTokens).size)) * 2.25 : 0;
}

function jaccardSimilarity(left: string[], right: string[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }

  const union = leftSet.size + rightSet.size - intersection;
  return union ? intersection / union : 0;
}

function formatLocator(chunk: RagChunk) {
  const parts: string[] = [];

  if (chunk.metadata?.pageNumber) {
    parts.push(`page ${chunk.metadata.pageNumber}`);
  }

  if (chunk.metadata?.slideNumber) {
    parts.push(`slide ${chunk.metadata.slideNumber}`);
  }

  if (chunk.metadata?.sheetName) {
    parts.push(`sheet ${chunk.metadata.sheetName}`);
  }

  if (chunk.metadata?.section && chunk.metadata.section !== chunk.heading) {
    parts.push(chunk.metadata.section);
  }

  return parts.join(" · ") || undefined;
}

function selectDiverseResults(results: RagSearchResult[], limit: number) {
  const selected: RagSearchResult[] = [];
  const remaining = [...results];

  while (selected.length < limit && remaining.length) {
    let bestIndex = 0;
    let bestAdjustedScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const candidateTokens = searchableTokens(candidate);
      const maximumOverlap = selected.reduce(
        (current, item) =>
          Math.max(current, jaccardSimilarity(candidateTokens, searchableTokens(item))),
        0,
      );
      const duplicateSourcePenalty = selected.some(
        (item) => item.source === candidate.source && item.heading === candidate.heading,
      )
        ? 0.35
        : 0;
      const adjustedScore = candidate.score - maximumOverlap * 1.4 - duplicateSourcePenalty;

      if (adjustedScore > bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
        bestIndex = index;
      }
    }

    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return selected;
}

export function searchRagChunks(
  chunks: RagChunk[],
  query: string,
  options: RagSearchOptions = {},
): RagSearchResult[] {
  const queryTokens = tokenize(query);

  if (!chunks.length || !queryTokens.length) {
    return [];
  }

  const documentTokens = chunks.map(searchableTokens);
  const documentFrequencies = new Map<string, number>();

  for (const tokens of documentTokens) {
    for (const token of new Set(tokens)) {
      documentFrequencies.set(token, (documentFrequencies.get(token) ?? 0) + 1);
    }
  }

  const averageLength =
    documentTokens.reduce((sum, tokens) => sum + tokens.length, 0) / Math.max(1, chunks.length);
  const queryFrequencies = termFrequency(queryTokens);

  const results = chunks
    .map((chunk, chunkIndex): RagSearchResult => {
      const tokens = documentTokens[chunkIndex];
      const frequencies = termFrequency(tokens);
      let lexical = 0;

      for (const [token, queryFrequency] of queryFrequencies) {
        const frequency = frequencies.get(token) ?? 0;

        if (!frequency) {
          continue;
        }

        const documentFrequency = documentFrequencies.get(token) ?? 0;
        const inverseDocumentFrequency = Math.log(
          1 + (chunks.length - documentFrequency + 0.5) / (documentFrequency + 0.5),
        );
        const lengthNormalization =
          frequency +
          bm25K1 * (1 - bm25B + bm25B * (tokens.length / Math.max(1, averageLength)));

        lexical +=
          inverseDocumentFrequency *
          ((frequency * (bm25K1 + 1)) / lengthNormalization) *
          Math.min(2, queryFrequency);
      }

      const phrase = phraseScore(query, chunk);
      const heading = headingScore(queryTokens, chunk);
      const metadata = metadataScore(chunk, options);
      const vector = Math.max(0, options.vectorScores?.get(chunk.id) ?? 0) * 2.5;

      return {
        ...chunk,
        score: lexical + phrase + heading + metadata + vector,
        locator: formatLocator(chunk),
        scoreBreakdown: {
          lexical,
          phrase,
          heading,
          metadata,
          vector,
        },
      };
    })
    .filter((result) => result.score >= (options.minScore ?? 0.05))
    .sort((left, right) => right.score - left.score)
    .slice(0, options.candidateLimit ?? Math.max(12, (options.limit ?? 4) * 4));

  return selectDiverseResults(results, options.limit ?? 4);
}
