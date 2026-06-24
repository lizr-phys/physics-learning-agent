import { describe, expect, it } from "vitest";

import {
  canApplyGenerationUpdate,
  matchesGeneration,
} from "@/agent/generation-guard";

const active = {
  sessionId: "session-a",
  assistantMessageId: "message-a",
  requestId: "request-a",
};

describe("generation guard", () => {
  it("requires session, assistant message and request ids to match", () => {
    expect(matchesGeneration(active, active)).toBe(true);
    expect(
      matchesGeneration(active, { ...active, sessionId: "session-b" }),
    ).toBe(false);
    expect(
      matchesGeneration(active, { ...active, requestId: "request-b" }),
    ).toBe(false);
    expect(
      matchesGeneration(active, {
        ...active,
        assistantMessageId: "message-b",
      }),
    ).toBe(false);
  });

  it("rejects late chunks after the target session was deleted", () => {
    expect(
      canApplyGenerationUpdate({
        active,
        target: active,
        sessionExists: false,
      }),
    ).toBe(false);
  });
});
