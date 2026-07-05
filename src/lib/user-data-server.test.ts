import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readUserData, writeUserData } from "@/lib/user-data-server";

let tempDir = "";
let previousDataDir: string | undefined;

beforeEach(async () => {
  previousDataDir = process.env.PLA_DATA_DIR;
  tempDir = await mkdtemp(path.join(os.tmpdir(), "pla-user-data-"));
  process.env.PLA_DATA_DIR = tempDir;
});

afterEach(async () => {
  process.env.PLA_DATA_DIR = previousDataDir;
  await rm(tempDir, { recursive: true, force: true });
});

describe("user data server persistence", () => {
  it("persists account-scoped chat sessions and practice history", async () => {
    const saved = await writeUserData("user-1", {
      sessions: [
        {
          id: "session-1",
          title: "Green function discussion",
          createdAt: 1,
          updatedAt: 2,
          messages: [
            {
              id: "m1",
              role: "user",
              content: "Explain Green functions.",
              createdAt: 1,
            },
            {
              id: "m2",
              role: "assistant",
              content: "A Green function represents the response to a point source.",
              createdAt: 2,
              status: "complete",
            },
          ],
          context: {
            course: "math-physics",
            taskType: "explain",
          },
          memory: {
            currentCourse: "math-physics",
            recentConfusions: [],
            coveredConcepts: ["Green functions"],
            exerciseTopics: [],
            preferredStyle: "balanced",
            updatedAt: 2,
          },
        },
      ],
      activeSessionId: "session-1",
      practiceHistory: [
        {
          id: "practice-1",
          title: "Boundary-value problems",
          course: "electrodynamics",
          prompt: "Generate practice problems.",
          content: "### Problem 1\n\nSolve a grounded-plane boundary-value problem.",
          status: "complete",
          createdAt: 3,
          updatedAt: 4,
        },
      ],
      preferences: {
        answerDepth: "detailed",
        onboardingDismissed: true,
        selectedModel: "deepseek-chat",
      },
    });

    expect(saved.sessions).toHaveLength(1);
    expect(saved.practiceHistory).toHaveLength(1);
    expect(saved.preferences?.answerDepth).toBe("detailed");

    const loaded = await readUserData("user-1");

    expect(loaded.activeSessionId).toBe("session-1");
    expect(loaded.sessions[0]).toMatchObject({
      id: "session-1",
      title: "Green function discussion",
    });
    expect(loaded.practiceHistory[0]).toMatchObject({
      id: "practice-1",
      status: "complete",
    });
  });
});
