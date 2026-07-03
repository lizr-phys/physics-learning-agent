import { describe, expect, it } from "vitest";

import { buildLatexDocument, createTexFileName } from "@/lib/latex-export";

describe("LaTeX export", () => {
  it("builds a complete ctex LaTeX document from practice Markdown", () => {
    const tex = buildLatexDocument(
      [
        "### Problem 1",
        "**Training goal**: Practice boundary conditions.",
        "**Problem**: Solve $E_n=\\frac{n^2\\pi^2\\hbar^2}{2ma^2}$ for an infinite well.",
        "$$",
        "\\psi(0)=\\psi(a)=0",
        "$$",
        "- Check normalization",
        "**Answer**: $n=1,2,\\ldots$",
      ].join("\n"),
      {
        title: "Practice Export",
        subtitle: "Topic: one-dimensional stationary states",
        generatedAt: new Date("2026-07-03T00:00:00"),
      },
    );

    expect(tex).toContain("\\documentclass[11pt]{ctexart}");
    expect(tex).toContain("\\title{Practice Export}");
    expect(tex).toContain("\\subsection*{Problem 1}");
    expect(tex).toContain("\\paragraph{Training goal.} Practice boundary conditions.");
    expect(tex).toContain("$E_n=\\frac{n^2\\pi^2\\hbar^2}{2ma^2}$");
    expect(tex).toContain("\\[");
    expect(tex).toContain("\\psi(0)=\\psi(a)=0");
    expect(tex).toContain("\\begin{itemize}");
    expect(tex).toContain("\\item Check normalization");
    expect(tex).toContain("\\end{document}");
  });

  it("creates a stable tex file name", () => {
    expect(createTexFileName("Green's functions / boundary-value problems")).toBe(
      "green-s-functions-boundary-value-problems.tex",
    );
  });
});
