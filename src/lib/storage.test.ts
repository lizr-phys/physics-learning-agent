import { describe, expect, it } from "vitest";

import { createLearningMemory } from "@/agent/memory-manager";
import {
  compactEmptyManualSessionList,
  removeSessionFromList,
  type StoredChatSession,
} from "@/lib/storage";

function session(
  id: string,
  messages: StoredChatSession["messages"] = [],
): StoredChatSession {
  return {
    id,
    title: "新学习会话",
    source: "manual",
    createdAt: 1,
    updatedAt: Number(id.slice(-1)) || 1,
    messages,
    context: { course: "general", taskType: "qa" },
    memory: createLearningMemory(),
  };
}

describe("session state helpers", () => {
  it("keeps only the preferred blank manual session", () => {
    const compacted = compactEmptyManualSessionList(
      [session("empty-1"), session("empty-2"), session("filled-3", [{ role: "user", content: "问题" }])],
      "empty-1",
    );

    expect(compacted.map((item) => item.id)).toEqual(["empty-1", "filled-3"]);
  });

  it("removes a deleted session without recreating it", () => {
    const remaining = removeSessionFromList(
      [session("session-1"), session("session-2")],
      "session-1",
    );

    expect(remaining.map((item) => item.id)).toEqual(["session-2"]);
  });
});
