import { describe, expect, it } from "vitest";

import * as context from "@/agent/context-manager";
import { detectPracticeStyleFromText, parseExerciseRequest } from "@/agent/exercise-parser";
import { commitLearningMemory, createLearningMemory, updateLearningMemory } from "@/agent/memory-manager";
import { buildUserPrompt } from "@/lib/prompt-builder";

describe("context reliability regressions", () => {
  it("uses Chinese references on the first Chinese question", () => {
    const memory = updateLearningMemory(createLearningMemory(), {
      message: "解释 Green 函数为什么依赖边界条件",
    }, "physics_learning");
    expect(memory.recentLanguage).toBe("zh");
    expect(memory.referenceProfile).toBe("chinese");
  });

  it("honors current language directives over stale memory and inferred fields", () => {
    const prompt = buildUserPrompt({
      message: "Explain the harmonic oscillator, 请用中文回答。",
      detectedLanguage: "en",
      referenceProfile: "english",
      memory: { ...createLearningMemory(), recentLanguage: "en" },
    });
    expect(prompt).toContain("Detected language: Chinese");
    expect(prompt).toContain("Chinese undergraduate physics tradition");
  });

  it("changes course and invalidates the prior topic", () => {
    const resolved = context.resolveLearningContext({
      message: "现在切换到量子力学，解释自旋。",
      course: "math-physics",
      knowledgePoint: "green-function",
      memory: {
        ...createLearningMemory(),
        currentCourse: "math-physics",
        currentKnowledgePoint: "Green's Functions",
      },
    });
    expect(resolved.course).toBe("quantum-mechanics");
    expect(resolved.knowledgePoint).not.toBe("green-function");
    expect(resolved.knowledgePoint).not.toBe("Green's Functions");
    expect(resolved.contextProvenance?.course?.source).toBe("current-input");
  });

  it("keeps short follow-ups in the prior language and practice style", () => {
    const resolved = context.resolveLearningContext({
      message: "Make the next one harder.",
      memory: {
        ...createLearningMemory(), recentLanguage: "zh",
        currentCourse: "quantum-mechanics",
        practiceStyle: "chinese-postgraduate-exam",
      },
    });
    expect(resolved.detectedLanguage).toBe("zh");
    expect(resolved.practiceStyle).toBe("chinese-postgraduate-exam");
  });

  it("understands bounded natural counts without short-word style false positives", () => {
    expect(parseExerciseRequest("再来两道").count).toBe(2);
    expect(parseExerciseRequest("Give me seven more problems.").count).toBe(7);
    expect(parseExerciseRequest("Generate 99 problems.").count).toBeUndefined();
    expect(detectPracticeStyleFromText("Find the limit of this expression.")).toBeUndefined();
    expect(detectPracticeStyleFromText("Generate MIT OCW problems.")).toBe("open-course");
    expect(detectPracticeStyleFromText("Generate final exam problems in English.")).toBe("english-textbook");
    expect(detectPracticeStyleFromText("不要考研风格，用英文教材风格")).toBe("english-textbook");
  });

  it("summarizes completed explanations and conditions with message provenance", () => {
    const summary = context.buildConversationSummary([
      { id: "q1", role: "user", content: "Why does the boundary term vanish?" },
      { id: "a1", role: "assistant", status: "complete", content: "Assume Dirichlet boundary conditions: $u(0)=u(L)=0$.\n\nThus the boundary term vanishes." },
      { id: "partial", role: "assistant", status: "interrupted", content: "The eigenvalue is definitely wrong." },
    ]);
    expect(summary).toContain("a1");
    expect(summary).toContain("Dirichlet");
    expect(summary).toContain("u(0)=u(L)=0");
    expect(summary).toContain("boundary term vanishes");
    expect(summary).not.toContain("definitely wrong");
    expect(summary).toContain("unverified");
  });

  it("allocates complete math blocks and selected problem before older history", () => {
    const formula = "$$\n\\int_0^L u(x)\\,dx=0 \\tag{1}\n$$";
    const allocated = context.allocateRequestContext({
      message: "Why is that integral zero?",
      toolContext: {
        source: "practice", generatedContent: "Older material. ".repeat(100), createdAt: 1,
        selectedItem: { type: "problem", title: "Boundary problem", content: `Assume $u(0)=u(L)=0$.\n\n${formula}` },
      },
      history: [{ id: "old", role: "assistant", content: "old derivation ".repeat(100) }],
    }, { charBudget: 260 });
    expect(allocated.message).toBe("Why is that integral zero?");
    expect(allocated.toolContext?.selectedItem?.content).toContain(formula);
    expect(allocated.contextBudget?.usedChars).toBeLessThanOrEqual(260);
    expect(allocated.history).toEqual([]);
  });

  it("does not inject recent history into the user prompt a second time", () => {
    const prompt = buildUserPrompt({
      message: "Why does the boundary term vanish?",
      course: "math-physics",
      history: [{ id: "a1", role: "assistant", content: "HISTORY_SENTINEL $u(0)=0$." }],
    });
    expect(prompt).not.toContain("HISTORY_SENTINEL");
  });

  it("retains assumptions and the final complete formula of a long interrupted derivation", () => {
    const finalFormula = "$$\n\\lambda_n=(n\\pi/L)^2\n$$";
    const allocated = context.allocateRequestContext({
      message: "Continue without repeating.",
      history: [{ id: "partial", role: "assistant", status: "interrupted", content: [
        "Assume Dirichlet conditions: $u(0)=u(L)=0$.",
        ...Array.from({ length: 20 }, (_, i) => `Unrelated explanatory prose ${i}. `.repeat(15)),
        finalFormula, "The next step is normalization.",
      ].join("\n\n") }],
    }, { charBudget: 340 });
    expect(allocated.history?.[0]?.content).toContain(finalFormula);
    expect(allocated.history?.[0]?.content).toContain("Dirichlet");
    expect(allocated.history?.[0]?.content).toContain("normalization");
    expect(allocated.contextBudget?.usedChars).toBeLessThanOrEqual(340);
  });

  it("protects intact code and math while allocating evidence once", () => {
    const formula = "$$\nx^2+y^2=1\n\n\\tag{2}\n$$";
    const code = "```tex\n$$ do not split $$\n```";
    const blocks = context.splitContextBlocks(`Assumptions.\n\n${formula}\n\n${code}`);
    expect(blocks).toEqual(["Assumptions.", formula, code]);
    const allocated = context.allocateRequestContext({ message: "Explain this formula.",
      memory: { ...createLearningMemory(), conversationSummary: "[kept] Prior explanation (unverified): duplicated." },
      history: [{ id: "kept", role: "assistant", content: "duplicated." }],
    });
    expect(allocated.memory?.conversationSummary ?? "").not.toContain("duplicated");
    expect(context.allocateRequestContext(allocated)).toBe(allocated);
    expect(context.estimateContextTokens("边界条件")).toBe(4);
    expect(context.allocateRequestContext({ message: "Explain my notes.", ragContext: { status: "failed", snippets: [] } }).ragContext?.status).toBe("failed");
  });

  it("commits assistant evidence only through the final memory helper", () => {
    const input = { message: "解释波函数归一化", requestId: "r1", assistantMessageId: "a-final",
      memory: createLearningMemory() };
    const candidate = updateLearningMemory(input.memory, input, "physics_learning");
    expect(candidate.conversationSummary).toBeUndefined();
    const final = commitLearningMemory({ ...input, intent: "physics_learning" },
      "Assume a normalizable state.\n\n$$\\int |\\psi|^2 dx=1$$\n\nThus probability sums to one.");
    expect(final.conversationSummary).toContain("a-final");
    expect(final.conversationSummary).toContain("normalizable");
    expect(final.conversationSummary).toContain("probability sums");
    expect(final.conversationSummary).toContain("unverified");
  });

  it("handles language switches, nonphysics interludes and explicit course selections", () => {
    const previous = { ...createLearningMemory(), currentCourse: "math-physics" as const,
      currentKnowledgePoint: "Green's Functions", recentLanguage: "zh" as const,
      practiceStyle: "chinese-postgraduate-exam" as const, referenceProfile: "chinese" as const };
    const switched = context.resolveLearningContext({ message: "Now explain Green functions in English.", memory: previous });
    expect(switched.detectedLanguage).toBe("en");
    expect(switched.referenceProfile).toBe("english");
    const aside = updateLearningMemory(previous, { message: "Help me revise this email.", memory: previous }, "general_question");
    expect(aside.currentKnowledgePoint).toBe("Green's Functions");
    const followUp = context.resolveLearningContext({ message: "Why does this step follow?", memory: aside });
    expect(followUp.course).toBe("math-physics");
    expect(followUp.knowledgePoint).toBe("Green's Functions");
    expect(context.resolveLearningContext({ message: "Explain the harmonic oscillator.", course: "general-physics" }).course).toBe("general-physics");
    expect(context.resolveLearningContext({ message: "Not quantum mechanics, but electrodynamics.", memory: previous }).course).toBe("electrodynamics");
  });
});
