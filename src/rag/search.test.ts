import { describe, expect, it } from "vitest";

import { tokenize } from "@/rag/chunk";
import { evaluateRetriever } from "@/rag/evaluation";
import { searchRagChunks } from "@/rag/search";
import type { RagChunk } from "@/rag/types";

function chunk(
  id: string,
  heading: string,
  content: string,
  metadata: RagChunk["metadata"] = {},
): RagChunk {
  return {
    id,
    source: `${id}.md`,
    heading,
    content,
    tokens: tokenize(`${heading}\n${content}`),
    metadata: { ...metadata, tokenVersion: 2 },
  };
}

const corpus = [
  chunk(
    "hamilton",
    "哈密顿正则方程",
    "哈密顿力学使用正则坐标和正则动量描述系统，正则方程由哈密顿量生成。",
    { course: "theoretical-mechanics", topic: "哈密顿力学" },
  ),
  chunk(
    "green",
    "Green functions",
    "A Green function depends on the differential operator and its boundary conditions.",
    { course: "math-physics", topic: "green-functions" },
  ),
  chunk(
    "ensemble",
    "Canonical ensemble",
    "The canonical partition function determines equilibrium averages at fixed temperature.",
    { course: "thermo-stat", topic: "canonical-ensemble" },
  ),
];

describe("hybrid RAG search", () => {
  it("tokenizes Chinese physics queries into searchable terms", () => {
    const tokens = tokenize("我想复习哈密顿力学和正则方程");

    expect(tokens).toContain("哈密顿");
    expect(tokens).toContain("正则");
  });

  it("retrieves Chinese and English physics concepts", () => {
    expect(searchRagChunks(corpus, "哈密顿力学中的正则方程", { limit: 2 })[0]?.id).toBe(
      "hamilton",
    );
    expect(
      searchRagChunks(corpus, "How do boundary conditions enter a Green function?", {
        limit: 2,
      })[0]?.id,
    ).toBe("green");
  });

  it("uses course and topic metadata to resolve otherwise similar chunks", () => {
    const similar = [
      chunk("mechanics", "Boundary conditions", "Boundary conditions select allowed solutions.", {
        course: "theoretical-mechanics",
      }),
      chunk("quantum", "Boundary conditions", "Boundary conditions select allowed solutions.", {
        course: "quantum-mechanics",
      }),
    ];

    expect(
      searchRagChunks(similar, "boundary conditions", {
        limit: 1,
        course: "quantum-mechanics",
      })[0]?.id,
    ).toBe("quantum");
  });

  it("reports retrieval hit rate and reciprocal rank", async () => {
    const report = await evaluateRetriever(
      [
        { id: "zh-hamilton", query: "哈密顿正则方程", relevantChunkIds: ["hamilton"] },
        { id: "en-green", query: "Green function boundary conditions", relevantChunkIds: ["green"] },
        { id: "en-ensemble", query: "canonical partition function", relevantChunkIds: ["ensemble"] },
      ],
      (query, limit) => searchRagChunks(corpus, query, { limit }),
      2,
    );

    expect(report.hitRateAtK).toBe(1);
    expect(report.meanReciprocalRank).toBe(1);
    expect(report.misses).toEqual([]);
  });
});
