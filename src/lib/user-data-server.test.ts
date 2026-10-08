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
      revision: 0,
      operationId: "initial-save",
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
              feedback: {
                verdict: "needs-improvement",
                issue: "formula-error",
                updatedAt: 5,
              },
            },
          ],
          context: {
            course: "math-physics",
            taskType: "explain",
            knowledgeMode: "always",
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
          problemAssessments: {
            "1": { status: "solved", updatedAt: 5 },
          },
          createdAt: 3,
          updatedAt: 4,
        },
      ],
      preferences: {
        answerDepth: "detailed",
        onboardingDismissed: true,
        selectedModel: "deepseek-chat",
        knowledgeMode: "never",
      },
    });

    expect(saved.sessions).toHaveLength(1);
    expect(saved.practiceHistory).toHaveLength(1);
    expect(saved.preferences?.answerDepth).toBe("detailed");
    expect(saved.preferences?.knowledgeMode).toBe("never");

    const loaded = await readUserData("user-1");

    expect(loaded.activeSessionId).toBe("session-1");
    expect(loaded.sessions[0]).toMatchObject({
      id: "session-1",
      title: "Green function discussion",
      context: expect.objectContaining({ knowledgeMode: "always" }),
    });
    expect(loaded.practiceHistory[0]).toMatchObject({
      id: "practice-1",
      status: "complete",
      problemAssessments: {
        "1": { status: "solved", updatedAt: 5 },
      },
    });
    expect(
      (
        loaded.sessions[0] as {
          messages: Array<{ feedback?: { verdict: string; issue?: string } }>;
        }
      ).messages[1].feedback,
    ).toEqual({
      verdict: "needs-improvement",
      issue: "formula-error",
      updatedAt: 5,
    });
  });

  it("rejects stale revisions rather than overwriting a concurrent device", async () => {
    const first = await writeUserData("user-1", {
      revision: 0,
      operationId: "device-a-1",
      sessions: [{ id: "a", title: "A", updatedAt: 1, messages: [] }],
    });
    await expect(writeUserData("user-1", {
      revision: 0,
      operationId: "device-b-1",
      sessions: [{ id: "b", title: "B", updatedAt: 2, messages: [] }],
    })).rejects.toMatchObject({ code: "WORKSPACE_CONFLICT", data: { revision: 1 } });
    expect(first).toMatchObject({ revision: 1 });
    expect((await readUserData("user-1")).sessions).toMatchObject([{ id: "a" }]);
  });

  it("retains deletion tombstones when a rebased old snapshot replays a deleted session", async () => {
    const initial = await writeUserData("user-1", {
      revision: 0, operationId: "initial",
      sessions: [{ id: "deleted", title: "Delete me", updatedAt: 1, messages: [] }],
    });
    const deleted = await writeUserData("user-1", {
      revision: initial.revision, operationId: "delete-session", sessions: [],
      tombstones: { sessions: { deleted: { deletedAt: 2, operationId: "delete-session" } } },
    });
    const replayed = await writeUserData("user-1", {
      revision: deleted.revision, operationId: "old-device-rebased",
      sessions: initial.sessions,
    });
    expect(replayed.sessions).toEqual([]);
    expect(replayed).toMatchObject({ tombstones: { sessions: { deleted: { operationId: "delete-session" } } } });
  });

  it("preserves 80 sessions and rejects quota overflow without modifying the saved workspace", async () => {
    const sessions = Array.from({ length: 80 }, (_, index) => ({
      id: `session-${index}`, title: `Session ${index}`, updatedAt: index, messages: [],
    }));
    const saved = await writeUserData("user-1", { revision: 0, operationId: "eighty", sessions });
    expect(saved.sessions).toHaveLength(80);
    await expect(writeUserData("user-1", {
      revision: saved.revision, operationId: "overflow",
      sessions: [...sessions, { id: "extra", title: "Extra", updatedAt: 99, messages: [] }],
    })).rejects.toMatchObject({ code: "WORKSPACE_QUOTA_EXCEEDED" });
    expect((await readUserData("user-1")).sessions).toHaveLength(80);
  });

  it("rejects excess messages instead of dropping the oldest messages", async () => {
    await expect(writeUserData("user-1", {
      revision: 0, operationId: "message-overflow",
      sessions: [{ id: "a", title: "A", messages: Array.from({ length: 241 }, (_, index) => ({
        id: `m-${index}`, role: "user", content: `Message ${index}`,
      })) }],
    })).rejects.toMatchObject({ code: "WORKSPACE_QUOTA_EXCEEDED" });
    expect((await readUserData("user-1")).sessions).toEqual([]);
  });

  it("makes operation retries idempotent even after another write", async () => {
    const input = { revision: 0, operationId: "retry-me", sessions: [] };
    const first = await writeUserData("user-1", input);
    const second = await writeUserData("user-1", { revision: first.revision, operationId: "later", sessions: [] });
    const retried = await writeUserData("user-1", input);
    expect(retried.revision).toBe(second.revision);
  });

  it("requires a base revision for an existing workspace", async () => {
    await writeUserData("user-1", { revision: 0, operationId: "initial", sessions: [] });
    await expect(writeUserData("user-1", { operationId: "legacy-overwrite", sessions: [] }))
      .rejects.toMatchObject({ code: "WORKSPACE_CONFLICT" });
  });

  it("retains omitted records unless an explicit deletion marker is supplied", async () => {
    const initial = await writeUserData("user-1", {
      revision: 0, operationId: "initial",
      sessions: [{ id: "existing", title: "Existing", updatedAt: 1, messages: [] }],
    });
    const saved = await writeUserData("user-1", {
      revision: initial.revision, operationId: "partial-device",
      sessions: [{ id: "new", title: "New", updatedAt: 2, messages: [] }],
    });
    expect(saved.sessions).toHaveLength(2);
  });

  it("serializes competing writes so exactly one revision update succeeds", async () => {
    const writes = await Promise.allSettled(["a", "b"].map((id) => writeUserData("user-1", {
      revision: 0, operationId: `device-${id}`,
      sessions: [{ id, title: id, updatedAt: 1, messages: [] }],
    })));
    expect(writes.map((write) => write.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect((await readUserData("user-1")).revision).toBe(1);
  });

  it("preserves a feedback clear marker across a rebased stale message replay", async () => {
    const message = { id: "answer", role: "assistant", content: "Answer", feedback: { verdict: "helpful", updatedAt: 4 } };
    const session = { id: "session", title: "Session", updatedAt: 1, messages: [message] };
    const initial = await writeUserData("user-1", { revision: 0, operationId: "first", sessions: [session] });
    const cleared = await writeUserData("user-1", { revision: initial.revision, operationId: "clear", sessions: [{ ...session, messages: [{ ...message, feedback: undefined, feedbackDeletedAt: 5 }] }] });
    const replayed = await writeUserData("user-1", { revision: cleared.revision, operationId: "replay", sessions: [session] });
    expect(replayed.sessions[0]).toMatchObject({ messages: [{ feedbackDeletedAt: 5, feedback: undefined }] });
  });

  it("preserves cleared stable-ID assessments across an old practice replay", async () => {
    const practice = { id: "set", title: "Set", content: "Problem", prompt: "Generate", updatedAt: 1,
      problemAssessments: { "set.problem.1": { status: "solved", updatedAt: 4 } } };
    const initial = await writeUserData("user-1", { revision: 0, operationId: "first", practiceHistory: [practice] });
    const cleared = await writeUserData("user-1", { revision: initial.revision, operationId: "clear", practiceHistory: [{ ...practice, problemAssessments: undefined, assessmentTombstones: { "set.problem.1": 5 } }] });
    const replayed = await writeUserData("user-1", { revision: cleared.revision, operationId: "replay", practiceHistory: [practice] });
    expect(replayed.practiceHistory[0].problemAssessments?.["set.problem.1"]).toBeUndefined();
    expect(replayed.practiceHistory[0].assessmentTombstones).toEqual({ "set.problem.1": 5 });
  });

  it("round-trips exact sources, provenance, generation diagnostics and scope without secrets", async () => {
    const source = { sourceId: "source-1", documentId: "doc-1", source: "Notes.pdf", heading: "Boundary conditions", content: "The exact cited condition: $$\\psi(0)=0$$", locator: "page 3", kind: "personal", contentHash: "hash", version: 2 };
    const provenance = { course: { source: "current-input", updatedAt: 2 } };
    const budget = { charBudget: 24000, usedChars: 15000, estimatedTokens: 7000, omittedMessages: 5 };
    const summary = "Preserved evidence. ".repeat(220) + "$$\\psi(0)=0\\tag{3}$$";
    const saved = await writeUserData("user-1", { revision: 0, operationId: "metadata", sessions: [{ id: "s", title: "S", updatedAt: 2,
      messages: [{ id: "a", role: "assistant", content: "Answer", sources: [source], retrievalStatus: "retrieved",
        generation: { requestId: "request", model: "mock-model", terminal: "complete", finishReason: "stop", outputChars: 6, usage: { inputTokens: 10, outputTokens: 2 }, apiKey: "hidden-secret", upstreamRaw: "private raw error" } }],
      context: { course: "quantum-mechanics", taskType: "qa", knowledgeDocumentIds: ["doc-1"], knowledgeCourseOnly: true, contextProvenance: provenance, contextBudget: budget },
      memory: { contextProvenance: provenance, contextBudget: budget, conversationSummary: summary },
    }], providerPreferences: { baseUrl: "https://name:password@example.com/v1?api_key=hidden-secret#token" },
      conflicts: [{ entity: "preference", id: "provider", field: "apiKey", localValue: "hidden-secret" }] });
    const loaded = await readUserData("user-1");
    expect(loaded.sessions[0]).toMatchObject({ messages: [{ sources: [source], retrievalStatus: "retrieved", generation: { requestId: "request", terminal: "complete", usage: { inputTokens: 10 } } }],
      context: { knowledgeDocumentIds: ["doc-1"], knowledgeCourseOnly: true, contextProvenance: provenance, contextBudget: budget }, memory: { conversationSummary: summary, contextProvenance: provenance, contextBudget: budget } });
    expect(saved.providerPreferences?.baseUrl).toBe("https://example.com/v1");
    expect(JSON.stringify(loaded)).not.toContain("hidden-secret");
    expect(JSON.stringify(loaded)).not.toContain("private raw error");
  });

  it("round-trips resumable practice state, safe parameters, drafts and notes", async () => {
    const task = { version: 1, setId: "set", targetCount: 10, outputMode: "full-solution", completedProblemIds: ["set.problem.1", "set.problem.2"] };
    const originalRequest = { message: "Generate ten problems", module: "practice", course: "electrodynamics", exerciseCount: 10, includeSolution: true,
      knowledgeDocumentIds: ["doc-1"], knowledgeCourseOnly: true, clientProvider: { apiKey: "secret-key" }, history: [{ content: "Private transcript" }], memory: { currentGoal: "Private goal" } };
    await writeUserData("user-1", { revision: 0, operationId: "practice-progress", practiceHistory: [{ id: "set", title: "Set", content: "Partial problem set", prompt: "Generate", status: "interrupted", exerciseCount: 2,
      task, originalRequest, problemAssessments: { "set.problem.1": { status: "needs-work", updatedAt: 3, attemptDraft: "My attempt", stuckNote: "Boundary term" } } }] });
    const loaded = await readUserData("user-1");
    expect(loaded.practiceHistory[0]).toMatchObject({ task, exerciseCount: 2, originalRequest: { message: "Generate ten problems", knowledgeDocumentIds: ["doc-1"], knowledgeCourseOnly: true }, problemAssessments: { "set.problem.1": { attemptDraft: "My attempt", stuckNote: "Boundary term" } } });
    expect(JSON.stringify(loaded)).not.toContain("secret-key");
    expect(JSON.stringify(loaded)).not.toContain("Private transcript");
    expect(JSON.stringify(loaded)).not.toContain("Private goal");
  });

  it("retains practice failures before the first token and unions safe retry diagnostics", async () => {
    const practice = { id: "empty-practice", title: "Synthetic set", content: "", prompt: "Generate", status: "error", originalRequest: { message: "Generate two problems", exerciseCount: 2 },
      generation: { requestId: "first", terminal: "interrupted", durationMs: 3, apiKey: "must-not-retain", upstreamRaw: "private payload" },
      generationAttempts: [{ requestId: "first", terminal: "interrupted", durationMs: 3 }] };
    const failed = await writeUserData("user-1", { revision: 0, operationId: "failed-practice", practiceHistory: [practice] });
    expect(failed.practiceHistory[0]).toMatchObject({ content: "", generation: { requestId: "first", terminal: "interrupted" } });
    const retried = await writeUserData("user-1", { revision: failed.revision, operationId: "retry-practice", practiceHistory: [{ ...practice, content: "Partial problems", status: "interrupted", generationAttempts: undefined,
      generation: { requestId: "retry", terminal: "truncated", durationMs: 4, usage: { outputTokens: 3 } } }] });
    expect(retried.practiceHistory[0].generationAttempts).toMatchObject([{ requestId: "first", terminal: "interrupted" }, { requestId: "retry", terminal: "truncated", usage: { outputTokens: 3 } }]);
    expect(retried.practiceHistory[0].generationAttempts?.[0].usage).toBeUndefined();
    expect(JSON.stringify(await readUserData("user-1"))).not.toMatch(/must-not-retain|private payload/);
  });

  it("keeps messages omitted by a partial current-revision snapshot", async () => {
    const session = { id: "s", title: "S", updatedAt: 1, messages: [
      { id: "question", role: "user", content: "Question", createdAt: 1 },
      { id: "answer", role: "assistant", content: "Original answer", createdAt: 2 },
    ] };
    const initial = await writeUserData("user-1", { revision: 0, operationId: "original", sessions: [session] });
    const updated = await writeUserData("user-1", { revision: initial.revision, operationId: "partial-edit", sessions: [{ ...session, messages: [{ id: "followup", role: "user", content: "Follow-up", createdAt: 3 }] }] });
    expect(updated.sessions[0]).toMatchObject({ messages: [ { id: "question" }, { id: "answer" }, { id: "followup" } ] });
  });

  it("preserves failed-before-first-token diagnostics and distinct generation attempts", async () => {
    const attempts = [{ requestId: "first", terminal: "error", reason: "http", durationMs: 20 }, { requestId: "second", terminal: "interrupted", reason: "timeout", durationMs: 30 }];
    await writeUserData("user-1", { revision: 0, operationId: "empty-failure", sessions: [{ id: "s", title: "S", messages: [
      { id: "failed", role: "assistant", content: "", status: "error", generation: attempts[1], generationAttempts: [...attempts, attempts[1]] },
      { id: "empty-user", role: "user", content: "" },
      { id: "empty-complete", role: "assistant", content: "", status: "complete" },
    ] }] });
    const loaded = await readUserData("user-1");
    expect(loaded.sessions[0]).toMatchObject({ messages: [{ id: "failed", content: "", generationAttempts: attempts }] });
    expect((loaded.sessions[0] as { messages: unknown[] }).messages).toHaveLength(1);
  });

  it("bounds retained operational attempts at 100 without truncating learning messages", async () => {
    const attempts = Array.from({ length: 101 }, (_, index) => ({ requestId: `r-${index}`, terminal: "complete", durationMs: index }));
    await writeUserData("user-1", { revision: 0, operationId: "attempt-limit", sessions: [{ id: "s", title: "S", messages: [{ id: "a", role: "assistant", content: "Full answer retained", generation: attempts[100], generationAttempts: attempts }] }] });
    const message = (await readUserData("user-1")).sessions[0] as { messages: Array<{ content: string; generationAttempts: Array<{ requestId: string }> }> };
    expect(message.messages[0].content).toBe("Full answer retained");
    expect(message.messages[0].generationAttempts).toHaveLength(100);
    expect(message.messages[0].generationAttempts[0].requestId).toBe("r-1");
  });
});
