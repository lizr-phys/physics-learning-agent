import { describe, expect, it } from "vitest";

import { buildUserPrompt } from "@/lib/prompt-builder";

describe("prompt builder", () => {
  it("uses the physics teaching workflow for a derivation", () => {
    const prompt = buildUserPrompt({
      message: "推导一维谐振子的能级量子化",
      course: "quantum-mechanics",
      taskType: "derivation",
    });

    expect(prompt).toContain("物理学习");
    expect(prompt).toContain("前提条件");
    expect(prompt).toContain("严谨审稿者");
    expect(prompt).toContain("归一化");
  });

  it("keeps coding questions out of the physics task template", () => {
    const prompt = buildUserPrompt({
      message: "帮我写一个 Python CSV 清洗脚本",
      course: "math-physics",
      taskType: "qa",
    });

    expect(prompt).toContain("通用问题");
    expect(prompt).toContain("直接给可用代码");
    expect(prompt).not.toContain("输出模板");
  });
});
