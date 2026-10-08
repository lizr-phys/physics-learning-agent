import { describe, expect, it } from "vitest";

import { buildRagContext, buildUserPrompt } from "@/lib/prompt-builder";
import { allocateRequestContext, resolveLearningContext } from "@/agent/context-manager";

describe("prompt builder", () => {
  it("preserves the prepared batch count instead of re-parsing the original total", () => {
    const prepared = allocateRequestContext({ ...resolveLearningContext({
      message: "Generate 10 original problems on quantum mechanics.", taskType: "practice",
    }), exerciseCount: 2 });
    expect(buildUserPrompt(prepared)).toContain("Practice count: 2");
    expect(buildUserPrompt(prepared)).not.toContain("Practice count: 10");
  });
  it("keeps no-match and retrieval faults distinct", () => {
    const failed = buildRagContext({ message: "Explain my notes.", ragContext: { snippets: [], status: "failed" } });
    const noMatch = buildRagContext({ message: "Explain my notes.", ragContext: { snippets: [], status: "no_match" } });
    expect(failed).toContain("retrieval failed");
    expect(failed).not.toContain("No sufficiently relevant personal snippets were found");
    expect(noMatch).toContain("completed without relevant evidence");
    for (const status of ["disabled", "unauthenticated", "retrieved"] as const) {
      expect(buildRagContext({ message: "Explain my notes.", ragContext: { snippets: [], status } })).toContain(`status: ${status}`);
    }
  });
  it("uses the physics tutoring workflow for a derivation", () => {
    const prompt = buildUserPrompt({
      message: "推导一维谐振子的能级量子化",
      course: "quantum-mechanics",
      taskType: "derivation",
    });

    expect(prompt).toContain("Physics learning");
    expect(prompt).toContain("Assumptions and conditions");
    expect(prompt).toContain("Technical reviewer");
    expect(prompt).toContain("normalization");
    expect(prompt).toContain("Detected language: Chinese");
  });

  it("keeps coding questions out of the physics task template", () => {
    const prompt = buildUserPrompt({
      message: "帮我写一个 Python CSV 清洗脚本",
      course: "math-physics",
      taskType: "qa",
    });

    expect(prompt).toContain("General question");
    expect(prompt).toContain("give usable code");
    expect(prompt).not.toContain("Practice problem output structure");
  });

  it("applies answer depth, language, reference profile, and practice mode instructions", () => {
    const prompt = buildUserPrompt({
      message: "Generate 3 open-course problem-set style problems on electrostatic boundary-value problems.",
      course: "electrodynamics",
      taskType: "practice",
      exerciseCount: 3,
      answerDepth: "derivation-first",
      practiceOutputMode: "questions-hints",
      practiceStyle: "open-course",
      detectedLanguage: "en",
    });

    expect(prompt).toContain("Detected language: English");
    expect(prompt).toContain("English textbook and open-course tradition");
    expect(prompt).toContain("Open-course problem-set style");
    expect(prompt).toContain("Derivation first");
    expect(prompt).toContain("Do not give full solutions or final answers");
  });

  it("includes personal knowledge retrieval decisions in the prompt context", () => {
    const prompt = buildUserPrompt({
      message: "Explain this PDF according to my uploaded notes.",
      course: "quantum-mechanics",
      taskType: "explain",
      intent: "physics_learning",
      queryType: "physics_core",
      knowledgeMode: "auto",
      personalKnowledgeDecision: {
        mode: "auto",
        shouldUse: true,
        confidence: "high",
        reason: "The message explicitly refers to uploaded notes.",
      },
      ragContext: {
        snippets: [
          {
            source: "Personal Library / oscillator-notes.md",
            heading: "Harmonic oscillator",
            kind: "personal",
            locator: "page 4",
            content: "The oscillator boundary condition selects normalizable states.",
          },
        ],
      },
    });

    expect(prompt).toContain("Personal knowledge mode: auto");
    expect(prompt).toContain("Personal snippets found: 1");
    expect(prompt).toContain("personal knowledge base");
    expect(prompt).toContain("oscillator-notes.md");
    expect(prompt).toContain("locator: page 4");
    expect(prompt).toContain("cite it inline as [1]");
  });
});
