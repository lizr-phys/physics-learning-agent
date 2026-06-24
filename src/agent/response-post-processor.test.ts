import { describe, expect, it } from "vitest";

import {
  appendResponseSuffix,
  generalQuestionReminder,
} from "@/agent/response-post-processor";

describe("response post processor", () => {
  it("adds exactly one gentle reminder to general answers", () => {
    const once = appendResponseSuffix("这里是 Python 示例。", "general_question");
    const twice = appendResponseSuffix(once, "general_question");

    expect(once).toContain(generalQuestionReminder);
    expect(twice.match(new RegExp(generalQuestionReminder, "g"))).toHaveLength(1);
  });

  it("does not append a reminder to physics or meta answers", () => {
    expect(appendResponseSuffix("物理回答", "physics_learning")).toBe("物理回答");
    expect(appendResponseSuffix("使用说明", "meta_question")).toBe("使用说明");
  });
});
