import { describe, expect, it } from "vitest";

import { decidePersonalKnowledgeUse } from "@/agent/knowledge-mode";

describe("personal knowledge mode decisions", () => {
  it("uses personal knowledge when Auto sees an explicit uploaded-material request", () => {
    const decision = decidePersonalKnowledgeUse({
      request: {
        message: "Explain this PDF according to my uploaded lecture notes.",
        course: "quantum-mechanics",
      },
      mode: "auto",
      intent: "physics_learning",
      queryType: "physics_core",
      hasUser: true,
    });

    expect(decision.shouldUse).toBe(true);
    expect(decision.confidence).toBe("high");
    expect(decision.retrievalQuery).toContain("uploaded lecture notes");
  });

  it("does not retrieve for unrelated general questions in Auto mode", () => {
    const decision = decidePersonalKnowledgeUse({
      request: {
        message: "Help me write a resume summary.",
        course: "math-physics",
      },
      mode: "auto",
      intent: "general_question",
      queryType: "writing",
      hasUser: true,
    });

    expect(decision.shouldUse).toBe(false);
    expect(decision.reason).toContain("general non-physics");
  });

  it("honors Always and Never before automatic rules", () => {
    const always = decidePersonalKnowledgeUse({
      request: { message: "What is the weather like?" },
      mode: "always",
      intent: "general_question",
      queryType: "daily_life",
      hasUser: true,
    });
    const never = decidePersonalKnowledgeUse({
      request: { message: "According to my uploaded notes, explain Green functions." },
      mode: "never",
      intent: "physics_learning",
      queryType: "physics_core",
      hasUser: true,
    });

    expect(always.shouldUse).toBe(true);
    expect(never.shouldUse).toBe(false);
  });

  it("does not retrieve if no signed-in user exists", () => {
    const decision = decidePersonalKnowledgeUse({
      request: { message: "Use my uploaded notes to explain this formula." },
      mode: "always",
      intent: "physics_learning",
      queryType: "physics_core",
      hasUser: false,
    });

    expect(decision.shouldUse).toBe(false);
    expect(decision.reason).toContain("No signed-in user");
  });
});
