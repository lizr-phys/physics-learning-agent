import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLearningMemory, createLearningProfile } from "@/agent/memory-manager";
import { saveStoredPracticeGenerations } from "@/lib/practice-history";
import { saveStoredAnswerDepth, saveStoredKnowledgeMode } from "@/lib/preferences";
import { saveStoredSessions, setActiveSessionId, type StoredChatSession } from "@/lib/storage";
import {
  applyClientUserDataSnapshot,
  collectClientUserDataSnapshot,
} from "@/lib/user-data-client";

function createStorageMock() {
  const store = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
  };
}

function session(id: string, updatedAt: number, title = id): StoredChatSession {
  return {
    id,
    title,
    source: "manual",
    createdAt: updatedAt,
    updatedAt,
    messages: [{ id: `${id}-m`, role: "user", content: title, createdAt: updatedAt }],
    context: { course: "general", taskType: "qa" },
    memory: createLearningMemory(),
  };
}

describe("client user data sync", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: createStorageMock(),
      sessionStorage: createStorageMock(),
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("collects conversations, active session, preferences, and practice history", () => {
    saveStoredSessions([session("local-1", 1, "Local conversation")]);
    setActiveSessionId("local-1");
    saveStoredAnswerDepth("detailed");
    saveStoredKnowledgeMode("always");
    saveStoredPracticeGenerations([
      {
        id: "practice-1",
        title: "Oscillator set",
        course: "quantum-mechanics",
        prompt: "Generate oscillator problems.",
        content: "### Problem 1",
        status: "complete",
        createdAt: 2,
        updatedAt: 2,
      },
    ]);

    const snapshot = collectClientUserDataSnapshot();

    expect(snapshot.sessions).toHaveLength(1);
    expect(snapshot.activeSessionId).toBe("local-1");
    expect(snapshot.preferences?.answerDepth).toBe("detailed");
    expect(snapshot.preferences?.knowledgeMode).toBe("always");
    expect(snapshot.practiceHistory).toHaveLength(1);
  });

  it("merges remote workspace data without dropping newer local data", () => {
    saveStoredSessions([session("same", 10, "Newer local"), session("local-only", 3)]);
    setActiveSessionId("local-only");
    saveStoredPracticeGenerations([
      {
        id: "practice-same",
        title: "Local practice",
        prompt: "Local prompt",
        content: "local content",
        status: "complete",
        createdAt: 5,
        updatedAt: 10,
      },
    ]);

    applyClientUserDataSnapshot({
      version: 1,
      sessions: [session("same", 4, "Older remote"), session("remote-only", 7)],
      activeSessionId: "remote-only",
      learningProfile: createLearningProfile(),
      preferences: { answerDepth: "concise", onboardingDismissed: true, knowledgeMode: "never" },
      practiceHistory: [
        {
          id: "practice-same",
          title: "Remote practice",
          prompt: "Remote prompt",
          content: "remote content",
          status: "complete",
          createdAt: 4,
          updatedAt: 4,
        },
        {
          id: "practice-remote",
          title: "Remote only",
          prompt: "Remote",
          content: "remote only",
          status: "complete",
          createdAt: 6,
          updatedAt: 6,
        },
      ],
      updatedAt: 11,
    });

    const snapshot = collectClientUserDataSnapshot();

    expect(snapshot.sessions.map((item) => item.id)).toEqual([
      "same",
      "remote-only",
      "local-only",
    ]);
    expect(snapshot.sessions.find((item) => item.id === "same")?.title).toBe("Newer local");
    expect(snapshot.activeSessionId).toBe("remote-only");
    expect(snapshot.practiceHistory.map((item) => item.id)).toEqual([
      "practice-same",
      "practice-remote",
    ]);
    expect(snapshot.practiceHistory.find((item) => item.id === "practice-same")?.content).toBe(
      "local content",
    );
    expect(snapshot.preferences?.answerDepth).toBe("concise");
    expect(snapshot.preferences?.knowledgeMode).toBe("never");
  });
});
