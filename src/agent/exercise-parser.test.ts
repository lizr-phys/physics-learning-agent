import { describe, expect, it } from "vitest";

import { parseExerciseRequest } from "@/agent/exercise-parser";

describe("exercise request parser", () => {
  it("infers course, knowledge, count and difficulty from natural language", () => {
    const parsed = parseExerciseRequest(
      "生成 10 道量子力学一维定态问题的提高练习题",
    );

    expect(parsed.detectedCourse).toBe("quantum-mechanics");
    expect(parsed.detectedKnowledgeId).toBe("one-dimensional-stationary");
    expect(parsed.count).toBe(10);
    expect(parsed.difficulty).toBe("advanced");
  });

  it("reports a selected-course conflict", () => {
    const parsed = parseExerciseRequest(
      "生成电动力学静电边值问题练习题",
      "quantum-mechanics",
    );

    expect(parsed.conflict).toEqual({
      selectedCourse: "quantum-mechanics",
      detectedCourse: "electrodynamics",
    });
  });
});
