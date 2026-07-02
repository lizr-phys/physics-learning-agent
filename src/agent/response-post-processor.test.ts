import { describe, expect, it } from "vitest";

import {
  appendResponseSuffix,
  generalQuestionReminderEn,
  generalQuestionReminderZh,
} from "@/agent/response-post-processor";

describe("response post processor", () => {
  it("adds exactly one English gentle reminder to general answers", () => {
    const once = appendResponseSuffix("Here is a Python example.", "general_question", "en");
    const twice = appendResponseSuffix(once, "general_question", "en");

    expect(once).toContain(generalQuestionReminderEn);
    expect(twice.match(new RegExp(generalQuestionReminderEn, "g"))).toHaveLength(1);
  });

  it("adds a Chinese reminder for Chinese general answers", () => {
    const result = appendResponseSuffix("这里是 Python 示例。", "general_question", "zh");

    expect(result).toContain(generalQuestionReminderZh);
  });

  it("does not append a reminder to physics or meta answers", () => {
    expect(appendResponseSuffix("Physics answer", "physics_learning", "en")).toBe(
      "Physics answer",
    );
    expect(appendResponseSuffix("Usage notes", "meta_question", "en")).toBe("Usage notes");
  });
});
