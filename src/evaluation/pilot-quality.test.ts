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
});
