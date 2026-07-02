import { describe, expect, it } from "vitest";

import { buildUserPrompt } from "@/lib/prompt-builder";

describe("prompt builder", () => {
  it("uses the physics teaching workflow for a derivation", () => {
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
});
