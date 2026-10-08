import type { RagSearchResult } from "@/rag/types";

export type RetrievalEvaluationCase = {
  id: string;
  query: string;
  relevantChunkIds: string[];
  course?: string;
  sourceLanguage?: "zh" | "en";
};

export type RetrievalEvaluationReport = {
  caseCount: number;
  hitRateAtK: number;
  meanReciprocalRank: number;
  misses: string[];
  positiveCaseCount: number;
  recallAtK: number;
  noAnswerCaseCount: number;
  noAnswerFalsePositiveRate: number;
  falsePositives: string[];
};

export async function evaluateRetriever(
  cases: RetrievalEvaluationCase[],
  retrieve: (query: string, limit: number, evaluationCase: RetrievalEvaluationCase) => Promise<RagSearchResult[]> | RagSearchResult[],
  limit = 4,
): Promise<RetrievalEvaluationReport> {
  if (!cases.length) {
    return {
      caseCount: 0,
      hitRateAtK: 0,
      meanReciprocalRank: 0,
      misses: [],
      positiveCaseCount: 0, recallAtK: 0, noAnswerCaseCount: 0, noAnswerFalsePositiveRate: 0, falsePositives: [],
    };
  }

  let hits = 0;
  let reciprocalRankTotal = 0;
  const misses: string[] = [];
  const falsePositives: string[] = [];
  let positiveCaseCount = 0;
  let noAnswerCaseCount = 0;
  let recallTotal = 0;

  for (const evaluationCase of cases) {
    const results = (await retrieve(evaluationCase.query, limit, evaluationCase)).slice(0, limit);
    const relevantIds = new Set(evaluationCase.relevantChunkIds);
    if (!relevantIds.size) {
      noAnswerCaseCount += 1;
      if (results.length) falsePositives.push(evaluationCase.id);
      continue;
    }
    positiveCaseCount += 1;
    recallTotal += new Set(results.filter((result) => relevantIds.has(result.id)).map((result) => result.id)).size / relevantIds.size;
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
    hitRateAtK: positiveCaseCount ? hits / positiveCaseCount : 0,
    meanReciprocalRank: positiveCaseCount ? reciprocalRankTotal / positiveCaseCount : 0,
    misses,
    positiveCaseCount, recallAtK: positiveCaseCount ? recallTotal / positiveCaseCount : 0,
    noAnswerCaseCount, noAnswerFalsePositiveRate: noAnswerCaseCount ? falsePositives.length / noAnswerCaseCount : 0,
    falsePositives,
  };
}
