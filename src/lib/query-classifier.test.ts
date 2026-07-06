import { describe, expect, it } from "vitest";

import { classifyQuery } from "@/lib/query-classifier";

describe("classifyQuery", () => {
  it.each([
    ["我想复习哈密顿力学", "physics_core"],
    ["梳理哈密顿正则方程和正则变量", "physics_core"],
    ["电动力学学习建议", "physics_core"],
    ["Explain Hamilton-Jacobi theory", "physics_core"],
    ["Green 函数和边界条件有什么关系", "math_physics_support"],
  ] as const)("classifies physics learning input %s as %s", (message, expected) => {
    expect(classifyQuery({ message })).toBe(expected);
  });

  it.each([
    ["学习建议", "daily_life"],
    ["帮我生成英语语法练习题", "other"],
    ["帮我写一个 Python 爬虫", "coding"],
    ["Help me polish this email", "writing"],
  ] as const)("keeps non-physics input %s out of physics routing", (message, expected) => {
    expect(classifyQuery({ message })).toBe(expected);
  });
});
