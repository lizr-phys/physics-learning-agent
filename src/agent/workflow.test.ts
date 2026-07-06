import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("LangGraph agent workflow", () => {
  it("prepares a course-aware physics request through the graph", async () => {
    const { prepareAgentRequest } = await import("@/agent/workflow");

    const prepared = await prepareAgentRequest({
      message:
        "In mathematical methods for physics, explain the role of boundary conditions in Green's function methods.",
      module: "chat",
      history: [
        {
          role: "user",
          content: "I am reviewing mathematical methods for physics.",
        },
      ],
    });

    expect(prepared.stages).toEqual([
      "understand-input",
      "resolve-context",
      "update-memory",
      "plan-retrieval",
      "retrieve-knowledge",
      "prepare-generation",
    ]);
    expect(prepared.input.intent).toBe("physics_learning");
    expect(prepared.input.course).toBe("math-physics");
    expect(prepared.input.detectedLanguage).toBe("en");
    expect(prepared.input.history).toHaveLength(1);
    expect(prepared.input.memory?.currentCourse).toBe("math-physics");
  }, 20000);

  it("keeps general questions out of the physics template path", async () => {
    const { prepareAgentRequest } = await import("@/agent/workflow");

    const prepared = await prepareAgentRequest({
      message: "Help me write a short email to reschedule a meeting.",
      course: "quantum-mechanics",
      knowledgePoint: "harmonic oscillator",
      module: "chat",
    });

    expect(prepared.input.intent).toBe("general_question");
    expect(prepared.input.queryType).toBe("writing");
    expect(prepared.input.personalKnowledgeDecision?.shouldUse).toBe(false);
  });

  it("routes Chinese Hamiltonian mechanics review requests into the physics workflow", async () => {
    const { prepareAgentRequest } = await import("@/agent/workflow");

    const prepared = await prepareAgentRequest({
      message: "我想复习哈密顿力学",
      module: "chat",
    });

    expect(prepared.input.intent).toBe("study_planning");
    expect(prepared.input.queryType).toBe("physics_core");
    expect(prepared.input.course).toBe("theoretical-mechanics");
    expect(prepared.input.knowledgePoint).toBe("hamilton-equations");
    expect(prepared.input.detectedLanguage).toBe("zh");
    expect(prepared.input.memory?.currentCourse).toBe("theoretical-mechanics");
  });
});
