import type { RagSearchResult } from "@/rag/types";

export type RetrievalEvaluationCase = {
  id: string;
  query: string;
  relevantChunkIds: string[];
};

export type RetrievalEvaluationReport = {
  caseCount: number;
  hitRateAtK: number;
  meanReciprocalRank: number;
  misses: string[];
};

export async function evaluateRetriever(
  cases: RetrievalEvaluationCase[],
  retrieve: (query: string, limit: number) => Promise<RagSearchResult[]> | RagSearchResult[],
  limit = 4,
): Promise<RetrievalEvaluationReport> {
  if (!cases.length) {
    return {
      caseCount: 0,
      hitRateAtK: 0,
      meanReciprocalRank: 0,
      misses: [],
    };
  }

  let hits = 0;
  let reciprocalRankTotal = 0;
  const misses: string[] = [];

  for (const evaluationCase of cases) {
    const results = await retrieve(evaluationCase.query, limit);
    const relevantIds = new Set(evaluationCase.relevantChunkIds);
    const firstRelevantIndex = results.findIndex((result) => relevantIds.has(result.id));

    if (firstRelevantIndex >= 0) {
      hits += 1;
      reciprocalRankTotal += 1 / (firstRelevantIndex + 1);
    } else {
      misses.push(evaluationCase.id);
    }
  }

  return {
    caseCount: cases.length,
    hitRateAtK: hits / cases.length,
    meanReciprocalRank: reciprocalRankTotal / cases.length,
    misses,
  };
}
