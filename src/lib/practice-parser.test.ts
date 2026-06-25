import { describe, expect, it } from "vitest";

import { parsePracticeProblems } from "@/lib/practice-parser";

describe("practice parser", () => {
  it("splits structured exercise markdown into independent problems", () => {
    const problems = parsePracticeProblems(`### 题目 1：有限深势阱

**训练目标**：判断束缚态条件。

**题目**：求允许能级满足的超越方程。

**涉及知识点**：一维定态问题

**难度**：中等

**提示**：先利用波函数连续性。

**解析**：分别写出阱内外解并匹配。

**答案**：得到偶宇称与奇宇称两组方程。

### 题目 2：谐振子

**题目**：用升降算符求能级。
`);

    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatchObject({
      index: 1,
      trainingGoal: "判断束缚态条件。",
      knowledge: "一维定态问题",
      difficulty: "中等",
    });
    expect(problems[0].hint).toContain("连续性");
    expect(problems[0].solution).toContain("匹配");
    expect(problems[0].answer).toContain("偶宇称");
    expect(problems[1].problem).toContain("升降算符");
  });
});
