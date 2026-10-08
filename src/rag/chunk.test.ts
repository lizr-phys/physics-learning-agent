import { describe, expect, it } from "vitest";

import { chunkMarkdownDocument, withStableChunkIdentity } from "@/rag/chunk";

describe("LangChain document chunking", () => {
  it("keeps an unchanged excerpt identity when earlier chunks are added", () => {
    const original = { id: "legacy:0", source: "notes.md", heading: "Original section", content: "An unchanged formula $a=b$.", tokens: [] };
    const first = withStableChunkIdentity([original], { documentId: "doc-stable", version: 1 });
    const next = withStableChunkIdentity([{ ...original, content: "An inserted earlier section." }, original], { documentId: "doc-stable", version: 2 });
    expect(next[1].id).toBe(first[0].id);
    expect(next[1].metadata?.contentHash).toBe(first[0].metadata?.contentHash);
    expect(next[1].metadata?.version).toBe(2);
    expect(next[0].id).not.toBe(first[0].id);
  });
  it("chunks Markdown notes and keeps searchable headings", async () => {
    const chunks = await chunkMarkdownDocument(
      {
        source: "green-functions.md",
        content: [
          "# Green functions",
          "",
          "A Green function is determined by a linear operator and boundary conditions.",
          "",
          "## Boundary-value problems",
          "",
          "Boundary conditions select the admissible response of the operator.",
        ].join("\n"),
      },
      120,
    );

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]?.source).toBe("green-functions.md");
    expect(chunks.some((chunk) => chunk.tokens.includes("boundary"))).toBe(true);
  });

  it("chunks LaTeX notes with section metadata", async () => {
    const chunks = await chunkMarkdownDocument(
      {
        source: "oscillator.tex",
        content: [
          "\\section{Harmonic oscillator}",
          "The Hamiltonian is $H=p^2/2m + m\\omega^2 x^2/2$.",
          "\\subsection{Ladder operators}",
          "The operators $a$ and $a^\\dagger$ generate adjacent eigenstates.",
        ].join("\n"),
      },
      120,
    );

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some((chunk) => chunk.heading.includes("Harmonic oscillator"))).toBe(true);
    expect(chunks.some((chunk) => chunk.content.includes("dagger"))).toBe(true);
  });
});
