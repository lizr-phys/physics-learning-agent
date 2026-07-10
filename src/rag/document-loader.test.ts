import { describe, expect, it } from "vitest";

import { extractDocumentChunks } from "@/rag/document-loader";

describe("document extraction", () => {
  it("uses LangChain splitters for bilingual text notes", async () => {
    const result = await extractDocumentChunks({
      fileName: "hamilton-notes.md",
      data: Buffer.from("# 哈密顿力学\n\n正则方程由哈密顿量和正则变量确定。", "utf8"),
      metadata: {
        documentId: "doc-1",
        userId: "user-1",
        course: "theoretical-mechanics",
        topic: "哈密顿力学",
      },
    });

    expect(result.extractionMethod).toBe("langchain-text");
    expect(result.chunks[0]?.metadata?.course).toBe("theoretical-mechanics");
    expect(result.chunks[0]?.tokens).toContain("哈密顿");
  });

  it("uses structured Office parsing for RTF materials", async () => {
    const result = await extractDocumentChunks({
      fileName: "oscillator.rtf",
      data: Buffer.from(
        String.raw`{\rtf1\ansi\deff0 {\fonttbl {\f0 Times New Roman;}}\f0\fs24 Harmonic oscillator boundary conditions select normalizable states.}`,
        "utf8",
      ),
      metadata: {
        documentId: "doc-2",
        userId: "user-1",
        course: "quantum-mechanics",
        topic: "harmonic oscillator",
      },
    });

    expect(result.extractionMethod).toBe("officeparser-structure");
    expect(result.chunks.some((item) => item.content.includes("Harmonic oscillator"))).toBe(true);
  });
});
