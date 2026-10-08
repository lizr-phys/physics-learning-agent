import { describe, expect, it } from "vitest";

import { canonicalPracticeProblem, parsePracticeProblems, validatePracticeProblem } from "@/lib/practice-parser";

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

const complete = (index: number) => `### Problem ${index}\n**Training goal**: Practice a calculation.\n**Conditions**: Let the real parameter a equal 2.\n**Problem**: Determine the value of the expression $2a$.\n**Topics**: Algebra\n**Difficulty**: Basic\n**Hint**: Substitute the supplied value.\n**Solution**: Twice two is four.\n**Answer**: $4$`;

describe("structured practice contract", () => {
  it.each([3, 5, 10])("keeps stable IDs for an appended %i-problem set", count => {
    const first = parsePracticeProblems(complete(1), { setId: "set" })[0];
    const blocks = Array.from({ length: count }, (_, i) => canonicalPracticeProblem(parsePracticeProblems(complete(i + 1))[0], `set:problem:${i + 1}`, i + 1));
    const problems = parsePracticeProblems(blocks.join("\n\n"));
    expect(problems).toHaveLength(count);
    expect(problems[0].id).toBe(first.id);
    expect(problems.every(problem => validatePracticeProblem(problem).valid)).toBe(true);
  });
  it("accepts colons inside bold bilingual field labels", () => {
    const problem = parsePracticeProblems(complete(1).replace("**Answer**:", "**答案：**"))[0];
    expect(problem.answer).toBe("$4$");
  });
  it("rejects missing answers, conditions and unclosed formulas", () => {
    const problem = parsePracticeProblems(complete(1).replace(/\*\*Conditions\*\*:[^\n]+\n/, "").replace("**Answer**: $4$", "**Answer**: $4"))[0];
    expect(validatePracticeProblem(problem).issues).toEqual(expect.arrayContaining(["missing_conditions", "unclosed_markup"]));
    expect(validatePracticeProblem(parsePracticeProblems(complete(1).replace("**Answer**: $4$", "**Answer**:"))[0]).issues).toContain("missing_answer");
  });
  it("validates the requested output mode without forcing answers into questions-only", () => {
    const problem = parsePracticeProblems(complete(1).split("**Hint**:")[0])[0];
    expect(validatePracticeProblem(problem, "questions-only").valid).toBe(true);
    expect(validatePracticeProblem(problem, "hidden-answer").valid).toBe(false);
  });
  it("keeps a legacy content identity when its heading is renumbered", () => {
    expect(parsePracticeProblems(complete(1))[0].id).toBe(parsePracticeProblems(complete(9))[0].id);
  });
  it("retains unknown bold text and ignores example problem headings inside code", () => {
    const content = complete(1) + "\n**Output complete**\n\n```text\n### Problem 99\nexample only\n```";
    const parsed = parsePracticeProblems(content);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].answer).toContain("Output complete");
  });
});
