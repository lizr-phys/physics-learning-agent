import { describe, expect, it } from "vitest";

import { emptyWorkspaceTombstones, mergeWorkspaceSnapshots } from "@/lib/workspace-sync";

type TestMessage = { id: string; role: string; content: string; createdAt: number; requestId?: string; feedback?: {verdict:string;updatedAt:number}; feedbackDeletedAt?: number; generationAttempts?: import("@/types/learning").GenerationDiagnostics[]; generation?: import("@/types/learning").GenerationDiagnostics };
type TestPractice = { id: string; title: string; content: string; updatedAt: number; assessmentTombstones?: Record<string, number>; problemAssessments?: Record<string, { status: string; updatedAt: number }>; generationAttempts?: import("@/types/learning").GenerationDiagnostics[]; generation?: import("@/types/learning").GenerationDiagnostics };
const session = (id: string, updatedAt = 1): {id:string;title:string;updatedAt:number;messages:TestMessage[]} => ({
  id, title: id, updatedAt,
  messages: [{ id: `${id}-message`, role: "user", content: id, createdAt: 1 }],
});
const snapshot = (sessions = [session("one")]) => ({
  version: 1 as const, revision: 0, sessions, practiceHistory: [], updatedAt: 1,
  preferences: { answerDepth: "standard", knowledgeMode: "auto" },
  tombstones: emptyWorkspaceTombstones(),
});

describe("workspace conflict rebasing", () => {
  it("keeps independent additions from both devices without trimming 80 sessions", () => {
    const base = snapshot([]);
    const local = snapshot(Array.from({ length: 40 }, (_, index) => session(`a-${index}`)));
    const remote = { ...snapshot(Array.from({ length: 40 }, (_, index) => session(`b-${index}`))), revision: 1 };
    const merged = mergeWorkspaceSnapshots(local, remote, base);
    expect(merged.sessions).toHaveLength(80);
    expect(merged.revision).toBe(1);
  });

  it("keeps both devices' new messages in the same conversation", () => {
    const base = snapshot();
    const local = snapshot([{ ...session("one", 2), messages: [...session("one").messages, { id: "local", role: "user", content: "Local question", createdAt: 2 }] }]);
    const remote = snapshot([{ ...session("one", 3), messages: [...session("one").messages, { id: "remote", role: "assistant", content: "Remote answer", createdAt: 3 }] }]);
    expect(mergeWorkspaceSnapshots(local, remote, base).sessions[0].messages.map((message) => message.id))
      .toEqual(["one-message", "local", "remote"]);
  });

  it("preserves divergent same-message versions in stable conflict copies", () => {
    const base = snapshot();
    const local = snapshot([{ ...session("one", 2), messages: [{ id: "one-message", role: "user", content: "Changed locally", createdAt: 1 }] }]);
    const remote = snapshot([{ ...session("one", 3), messages: [{ id: "one-message", role: "user", content: "Changed remotely", createdAt: 1 }] }]);
    const merged = mergeWorkspaceSnapshots(local, remote, base);
    expect(merged.sessions[0].messages.map((message) => message.content).sort()).toEqual(["Changed locally", "Changed remotely"]);
    expect(merged).toMatchObject({ conflicts: [{ entity: "message", id: "one-message", field: "content" }] });
    expect(mergeWorkspaceSnapshots(merged, remote, base).sessions[0].messages).toHaveLength(2);
  });

  it("merges latest feedback without creating duplicate content copies", () => {
    const base = snapshot();
    const local = snapshot([{ ...session("one", 2), messages: [{ ...session("one").messages[0], feedback: { verdict: "helpful", updatedAt: 4 } }] }]);
    const remote = snapshot([{ ...session("one", 3), messages: [{ ...session("one").messages[0], feedback: { verdict: "needs-improvement", updatedAt: 5 } }] }]);
    const merged = mergeWorkspaceSnapshots(local, remote, base);
    expect(merged.sessions[0].messages).toHaveLength(1);
    expect(merged.sessions[0].messages[0]).toMatchObject({ feedback: { verdict: "needs-improvement" } });
  });

  it("merges independent preference edits using the common base", () => {
    const base = snapshot();
    const local = { ...snapshot(), preferences: { answerDepth: "detailed", knowledgeMode: "auto" } };
    const remote = { ...snapshot(), preferences: { answerDepth: "standard", knowledgeMode: "always" }, updatedAt: 2 };
    expect(mergeWorkspaceSnapshots(local, remote, base).preferences).toEqual({ answerDepth: "detailed", knowledgeMode: "always" });
  });

  it("suppresses a deleted ID even if the replayed entity has a newer timestamp", () => {
    const local = snapshot([]);
    local.tombstones.sessions.one = { deletedAt: 2, operationId: "delete-one" };
    const remote = snapshot([session("one", 99)]);
    expect(mergeWorkspaceSnapshots(local, remote).sessions).toEqual([]);
  });

  it("does not create a conflict copy from a deleted practice set", () => {
    const local = { ...snapshot([]), practiceHistory: [{ id: "practice", title: "Practice", content: "Local version", updatedAt: 2 }] };
    local.tombstones.practiceHistory.practice = { deletedAt: 3, operationId: "delete-practice" };
    const remote = { ...snapshot([]), practiceHistory: [{ id: "practice", title: "Practice", content: "Remote version", updatedAt: 4 }] };
    expect(mergeWorkspaceSnapshots(local, remote).practiceHistory).toEqual([]);
  });

  it("does not restore cleared feedback from a newer session snapshot", () => {
    const local = snapshot([{ ...session("one", 2), messages: [{ ...session("one").messages[0], feedbackDeletedAt: 5 }] }]);
    const remote = snapshot([{ ...session("one", 99), messages: [{ ...session("one").messages[0], feedback: { verdict: "helpful", updatedAt: 4 } }] }]);
    const merged = mergeWorkspaceSnapshots(local, remote);
    expect(merged.sessions[0].messages[0]).toMatchObject({ feedbackDeletedAt: 5 });
    expect((merged.sessions[0].messages[0] as { feedback?: unknown }).feedback).toBeUndefined();
  });

  it("allows new feedback after the clear operation", () => {
    const local = snapshot([{ ...session("one", 2), messages: [{ ...session("one").messages[0], feedbackDeletedAt: 5 }] }]);
    const remote = snapshot([{ ...session("one", 3), messages: [{ ...session("one").messages[0], feedback: { verdict: "needs-improvement", updatedAt: 6 } }] }]);
    expect(mergeWorkspaceSnapshots(local, remote).sessions[0].messages[0]).toMatchObject({ feedbackDeletedAt: 5, feedback: { updatedAt: 6 } });
  });

  it("keeps cleared stable-ID assessments deleted while preserving later reassessment", () => {
    const localSet: TestPractice = { id: "set", title: "Set", content: "Problems", updatedAt: 2, assessmentTombstones: { "set.problem.1": 5, "set.problem.2": 5 } };
    const remoteSet: TestPractice = { id: "set", title: "Set", content: "Problems", updatedAt: 99, problemAssessments: {
      "set.problem.1": { status: "solved", updatedAt: 4 }, "set.problem.2": { status: "needs-work", updatedAt: 6 },
    } };
    const local = { ...snapshot([]), practiceHistory: [localSet] };
    const remote = { ...snapshot([]), practiceHistory: [remoteSet] };
    const merged = mergeWorkspaceSnapshots(local, remote);
    expect(merged.practiceHistory[0]).toMatchObject({ assessmentTombstones: { "set.problem.1": 5, "set.problem.2": 5 }, problemAssessments: { "set.problem.2": { updatedAt: 6 } } });
    expect(merged.practiceHistory[0].problemAssessments?.["set.problem.1"]).toBeUndefined();
  });

  it("lets a new request replace a longer old answer, and rejects its stale replay", () => {
    const first: TestMessage = { id: "one-message", role: "assistant", content: "Answer long", createdAt: 2, requestId: "a", generation: { requestId: "a", terminal: "complete", startedAt: 1 } };
    const second: TestMessage = { ...first, content: "Answer", requestId: "b", generation: { requestId: "b", terminal: "interrupted", startedAt: 3 } };
    const old = snapshot([{ ...session("one", 2), messages: [first] }]);
    const retry = snapshot([{ ...session("one", 4), messages: [second] }]);
    const merged = mergeWorkspaceSnapshots(old, retry);
    expect(merged.sessions[0].messages.find(message => message.id === "one-message")).toMatchObject({ requestId: "b", content: "Answer" });
    const complete = snapshot([{ ...session("one", 5), messages: [{ ...second, generation: { requestId: "b", terminal: "complete", startedAt: 3 } }] }]);
    const finalized = mergeWorkspaceSnapshots(merged, complete, retry);
    expect(finalized.sessions[0].messages.at(-1)).toMatchObject({ requestId: "b", content: "Answer", generation: { terminal: "complete" } });
    const replay = mergeWorkspaceSnapshots(finalized, { ...old, updatedAt: 99, sessions: [{ ...old.sessions[0], updatedAt: 99 }] }, old);
    expect(replay.sessions[0].messages.find(message => message.id === "one-message")).toMatchObject({ requestId: "b", content: "Answer" });
  });

  it("unions attempt history by request ID and keeps the later terminal metadata", () => {
    const message = session("one").messages[0];
    const local = snapshot([{ ...session("one", 2), messages: [{ ...message, generationAttempts: [{ requestId: "a", terminal: "interrupted", durationMs: 2 }, { requestId: "b", terminal: "complete", durationMs: 10, usage: { outputTokens: 5 } }] }] }]);
    const remote = snapshot([{ ...session("one", 3), messages: [{ ...message, generationAttempts: [{ requestId: "a", terminal: "error", durationMs: 3 }, { requestId: "b", terminal: "interrupted", durationMs: 2 }, { requestId: "c", terminal: "error", durationMs: 1 }] }] }]);
    expect(mergeWorkspaceSnapshots(local, remote).sessions[0].messages[0].generationAttempts).toMatchObject([
      { requestId: "a", terminal: "error", durationMs: 3 }, { requestId: "b", terminal: "complete", usage: { outputTokens: 5 } }, { requestId: "c", terminal: "error" },
    ]);
  });

  it("retains practice retry attempts from independent devices without inventing missing usage", () => {
    const localSet: TestPractice = { id: "set", title: "Set", content: "Problems", updatedAt: 2,
      generationAttempts: [{ requestId: "first", terminal: "interrupted", durationMs: 3 }],
      generation: { requestId: "retry", terminal: "complete", durationMs: 10, usage: { outputTokens: 5 } } };
    const remoteSet: TestPractice = { ...localSet, updatedAt: 3, generation: undefined,
      generationAttempts: [{ requestId: "retry", terminal: "interrupted", durationMs: 2 }, { requestId: "other-device", terminal: "error", durationMs: 1 }] };
    const merged = mergeWorkspaceSnapshots({ ...snapshot([]), practiceHistory: [localSet] }, { ...snapshot([]), practiceHistory: [remoteSet] });
    expect(merged.practiceHistory[0].generationAttempts).toMatchObject([
      { requestId: "first", terminal: "interrupted" }, { requestId: "retry", terminal: "complete", usage: { outputTokens: 5 } }, { requestId: "other-device", terminal: "error" },
    ]);
    expect(merged.practiceHistory[0].generationAttempts?.[0].usage).toBeUndefined();
  });
});
