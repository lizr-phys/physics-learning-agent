import { describe, expect, it } from "vitest";

import { getModelConfig } from "@/agent/model-config";

describe("model config", () => {
  it("allocates more output tokens as exercise count grows", () => {
    const three = getModelConfig({
      message: "生成练习题",
      intent: "exercise_generation",
      taskType: "practice",
      exerciseCount: 3,
    });
    const ten = getModelConfig({
      message: "生成练习题",
      intent: "exercise_generation",
      taskType: "practice",
      exerciseCount: 10,
    });

    expect(three.max_tokens).toBe(3000);
    expect(ten.max_tokens).toBe(8000);
  });

  it("uses a lower temperature for derivations than exercise generation", () => {
    const derivation = getModelConfig({
      message: "推导一维谐振子能级",
      intent: "physics_learning",
      taskType: "derivation",
    });
    const exercise = getModelConfig({
      message: "生成练习题",
      intent: "exercise_generation",
      taskType: "practice",
      exerciseCount: 5,
    });

    expect(derivation.temperature).toBeLessThan(exercise.temperature);
  });
});
