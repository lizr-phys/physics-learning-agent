import { describe, expect, it } from "vitest";

import {
  buildConversationSummary,
  selectConversationHistory,
} from "@/agent/context-manager";
import { createLearningMemory } from "@/agent/memory-manager";

describe("context manager", () => {
  it("keeps the newest messages within a character budget", () => {
    const history = [
      { role: "user" as const, content: "旧问题".repeat(100) },
      { role: "assistant" as const, content: "旧回答".repeat(100) },
      { role: "user" as const, content: "为什么边界条件决定本征值？" },
    ];

    const selected = selectConversationHistory(history, {
      charBudget: 80,
      messageLimit: 2,
    });

    expect(selected.at(-1)?.content).toContain("边界条件");
    expect(selected.length).toBeLessThanOrEqual(2);
  });

  it("builds a compact summary with the current goal and confusion", () => {
    const memory = {
      ...createLearningMemory(),
      currentGoal: "理解 Green 函数",
      currentKnowledgePoint: "Green 函数",
      recentConfusions: ["为什么边界条件会进入 Green 函数定义"],
    };
    const summary = buildConversationSummary(
      [{ role: "user", content: "这个边界项从哪里来？" }],
      memory,
    );

    expect(summary).toContain("理解 Green 函数");
    expect(summary).toContain("边界条件");
    expect(summary.length).toBeLessThanOrEqual(1800);
  });
});
