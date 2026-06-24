import { describe, expect, it } from "vitest";

import {
  createLearningMemory,
  updateLearningMemory,
  updateLearningProfile,
} from "@/agent/memory-manager";

describe("learning memory", () => {
  it("tracks course, knowledge point, confusion and explanation preference", () => {
    const memory = updateLearningMemory(
      createLearningMemory(),
      {
        message: "请一步一步解释 Green 函数为什么依赖边界条件",
        course: "math-physics",
        knowledgePoint: "green-function",
      },
      "physics_learning",
    );

    expect(memory.currentCourse).toBe("math-physics");
    expect(memory.currentKnowledgePoint).toBe("Green 函数");
    expect(memory.recentConfusions).toHaveLength(1);
    expect(memory.preferredStyle).toBe("step-by-step");
  });

  it("updates the long-term course frequency without storing full chats", () => {
    const memory = {
      ...createLearningMemory(),
      currentCourse: "electrodynamics" as const,
      currentKnowledgePoint: "Maxwell 方程组",
    };
    const profile = updateLearningProfile(undefined, memory);

    expect(profile.courseFrequency.electrodynamics).toBe(1);
    expect(profile.recentTopics).toContain("Maxwell 方程组");
    expect(JSON.stringify(profile)).not.toContain("messages");
  });
});
