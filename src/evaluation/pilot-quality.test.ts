import { readFile } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { classifyAgentIntent } from "@/agent/intent-classifier";
import { detectCourseFromText } from "@/agent/exercise-parser";
import {
  courseEvaluationCases,
  intentEvaluationCases,
  retrievalEvaluationCases,
} from "@/evaluation/pilot-cases";
import { chunkMarkdownDocument } from "@/rag/chunk";
import { searchRagChunks } from "@/rag/search";
import type { RagChunk } from "@/rag/types";
import { syntheticRetrievalCases, syntheticRetrievalChunks, syntheticRetrievalProvenance } from "@/evaluation/synthetic-retrieval";
import { evaluateRetriever } from "@/rag/evaluation";

describe("pilot quality baseline", () => {
  describe.each(intentEvaluationCases)("intent: $id", ({ request, expected }) => {
    it(`classifies as ${expected}`, () => {
      expect(classifyAgentIntent(request)).toBe(expected);
    });
  });

  describe.each(courseEvaluationCases)("course: $id", ({ query, expected }) => {
    it(`resolves to ${expected}`, () => {
      expect(detectCourseFromText(query)).toBe(expected);
    });
  });

  describe("bundled retrieval", () => {
    let chunks: RagChunk[] = [];

    beforeAll(async () => {
      const sampleDirectory = path.join(process.cwd(), "src", "rag", "sample-docs");
      const sources = ["math-physics.md", "electrodynamics.md"];

      chunks = (
        await Promise.all(
          sources.map(async (source) =>
            chunkMarkdownDocument({
              source,
              content: await readFile(path.join(sampleDirectory, source), "utf8"),
            }),
          ),
        )
      ).flat();
    });

    it.each(retrievalEvaluationCases)(
      "$id retrieves $expectedSource at rank 1",
      ({ query, expectedSource }) => {
        const [topResult] = searchRagChunks(chunks, query, { limit: 4 });

        expect(topResult?.source).toBe(expectedSource);
      },
    );
  });

  describe("synthetic bilingual retrieval contract", () => {
    const corpora = { zh: syntheticRetrievalChunks.filter((chunk) => chunk.metadata?.language === "zh"),
      en: syntheticRetrievalChunks.filter((chunk) => chunk.metadata?.language === "en") };
    it("contains 120 explicitly synthetic cases across six courses", () => {
      expect(syntheticRetrievalProvenance).toMatchObject({ kind: "synthetic", humanReviewed: false });
      expect(syntheticRetrievalCases).toHaveLength(120);
      expect(new Set(syntheticRetrievalCases.map((evaluationCase) => evaluationCase.course))).toHaveLength(6);
      expect(syntheticRetrievalCases.filter((evaluationCase) => evaluationCase.kind === "no-answer")).toHaveLength(24);
    });
    it.each(syntheticRetrievalCases)("$id", (evaluationCase) => {
      const results = searchRagChunks(evaluationCase.sourceLanguage ? corpora[evaluationCase.sourceLanguage] : syntheticRetrievalChunks,
        evaluationCase.query, { course: evaluationCase.course, limit: 3 });
      if (!evaluationCase.relevantChunkIds.length) expect(results).toEqual([]);
      else expect(results[0]?.id).toBe(evaluationCase.relevantChunkIds[0]);
    });
    it("reports positive recall and no-answer false positives with their denominators", async () => {
      const report = await evaluateRetriever(syntheticRetrievalCases, (query, limit, evaluationCase) =>
        searchRagChunks(evaluationCase.sourceLanguage ? corpora[evaluationCase.sourceLanguage] : syntheticRetrievalChunks,
          query, { course: evaluationCase.course, limit }), 3);
      expect(report).toMatchObject({ caseCount: 120, positiveCaseCount: 96, noAnswerCaseCount: 24,
        recallAtK: 1, hitRateAtK: 1, meanReciprocalRank: 1, noAnswerFalsePositiveRate: 0, falsePositives: [] });
    });
  });
});
