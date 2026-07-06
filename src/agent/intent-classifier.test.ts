import { describe, expect, it } from "vitest";

import { classifyAgentIntent } from "@/agent/intent-classifier";

describe("classifyAgentIntent", () => {
  it.each([
    ["解释 Green 函数与边界条件的关系", "physics_learning"],
    ["用一句话说明牛顿第二定律", "physics_learning"],
    ["Generate 3 open-course problem-set style problems on electrostatic boundary-value problems.", "exercise_generation"],
    ["生成 5 道量子力学练习题并给出解析", "exercise_generation"],
    ["Give me a two-week electrodynamics study plan", "study_planning"],
    ["我想复习哈密顿力学", "study_planning"],
    ["梳理一下哈密顿正则方程的学习路线", "study_planning"],
    ["帮我写一个 Python 爬虫", "general_question"],
    ["帮我生成英语语法练习题", "general_question"],
    ["How do I use this assistant?", "meta_question"],
  ] as const)("classifies %s as %s", (message, expected) => {
    expect(classifyAgentIntent({ message })).toBe(expected);
  });

  it("does not force a general question into stale physics context", () => {
    expect(
      classifyAgentIntent({
        message: "帮我修改简历",
        course: "quantum-mechanics",
        knowledgePoint: "一维定态问题",
      }),
    ).toBe("general_question");
  });
});
