import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyClientUserDataSnapshot, collectClientUserDataSnapshot } from "@/lib/user-data-client";
import { getStoredAnswerDepth, saveStoredAnswerDepth } from "@/lib/preferences";
import { createEmptySession, deleteStoredSession, getStoredLearningProfile, getStoredSessions, saveStoredSessions } from "@/lib/storage";
import { getWorkspaceMetadata } from "@/lib/workspace-metadata";
import { getWorkspaceIdentity, getWorkspacePreferenceChanges, runWorkspaceTransaction, saveWorkspacePreferenceChanges, switchWorkspace, workspaceKey, workspaceStorage } from "@/lib/workspace-storage";

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() { return values.size; }, values };
}

let local: ReturnType<typeof memoryStorage>;
beforeEach(() => {
  local = memoryStorage();
  vi.stubGlobal("window", { localStorage: local, sessionStorage: memoryStorage(), dispatchEvent: vi.fn(() => true) });
});
afterEach(() => vi.unstubAllGlobals());
const session = (id: string) => ({ ...createEmptySession(), id, title: id, updatedAt: 1,
  messages: [{ id: `${id}-user`, role: "user" as const, content: "A synthetic question." }] });

describe("workspace application regression", () => {
  it("keeps independent same-session messages through forced tab interleaving and stale base writes", async () => {
    vi.resetModules();
    const tabA = await import("@/lib/storage");
    vi.resetModules();
    const tabB = await import("@/lib/storage");
    const base = session("shared");
    const questionA = { id: "tab-a-message", role: "user" as const, content: "Question A", createdAt: 2 };
    const questionB = { id: "tab-b-message", role: "user" as const, content: "Question B", createdAt: 3 };
    saveStoredSessions([base]);
    const read = local.getItem;
    let interleaved = false;
    local.getItem = (key) => {
      const captured = read(key);
      if (key === workspaceKey("pla.chat.sessions.v1") && !interleaved) {
        interleaved = true;
        tabB.upsertStoredSession({ ...base, updatedAt: 3, messages: [...base.messages, questionB] });
      }
      return captured;
    };
    tabA.upsertStoredSession({ ...base, updatedAt: 2, messages: [...base.messages, questionA] });
    expect(tabA.getStoredSessions()[0].messages.map((message) => message.id)).toEqual(["shared-user", "tab-a-message", "tab-b-message"]);
    local.setItem(workspaceKey("pla.chat.sessions.v1"), JSON.stringify([{ ...base, messages: [...base.messages, questionA] }]));
    expect(tabB.getStoredSessions()[0].messages.some((message) => message.id === "tab-b-message")).toBe(true);
    const merged = tabA.getStoredSessions();
    applyClientUserDataSnapshot({ revision: 5, sessions: merged, practiceHistory: [], updatedAt: 3 });
    local.setItem(workspaceKey("pla.chat.sessions.v1"), JSON.stringify([base]));
    expect(tabA.getStoredSessions()[0].messages).toHaveLength(3);
    deleteStoredSession("shared");
    local.setItem(workspaceKey("pla.chat.sessions.v1"), JSON.stringify(merged));
    expect(tabA.getStoredSessions()).toEqual([]);
  });

  it("reads merged guest journals for explicit import without changing the current identity", async () => {
    const { upsertStoredSession } = await import("@/lib/storage");
    upsertStoredSession(session("guest-journal"));
    local.setItem(workspaceKey("pla.chat.sessions.v1"), "[]");
    switchWorkspace("signed-in-account");
    const identity = getWorkspaceIdentity();
    expect(getStoredSessions(null).map((item) => item.id)).toEqual(["guest-journal"]);
    expect(getStoredSessions()).toEqual([]);
    expect(getWorkspaceIdentity()).toEqual(identity);
  });

  it("isolates one malformed journal and keeps the raw value for recovery", () => {
    saveStoredSessions([session("valid")]);
    const key = workspaceKey("journal.sessions.writer.broken.synthetic");
    local.setItem(key, "{malformed");
    expect(getStoredSessions().map((item) => item.id)).toEqual(["valid"]);
    expect(local.getItem(key)).toBe("{malformed");
    expect(() => applyClientUserDataSnapshot({ revision: 2, sessions: [session("valid")], practiceHistory: [], updatedAt: 2 })).not.toThrow();
    expect(local.getItem(key)).toBe("{malformed");
  });

  it("keeps newer acknowledged entity revisions even after a stale acknowledgement arrives", () => {
    const newest = { ...session("one"), title: "Latest title", updatedAt: 9,
      messages: [{ id: "latest", role: "user" as const, content: "Latest message" }] };
    applyClientUserDataSnapshot({ revision: 9, sessions: [newest], practiceHistory: [], updatedAt: 9 });
    applyClientUserDataSnapshot({ revision: 4, sessions: [session("one")], practiceHistory: [], updatedAt: 4 });
    local.setItem(workspaceKey("pla.chat.sessions.v1"), JSON.stringify([session("one")]));
    expect(getStoredSessions()[0].messages.some((message) => message.id === "latest")).toBe(true);
    expect(getWorkspaceMetadata().revision).toBe(9);
    const key = "journal.sessions.acknowledged.one.9";
    runWorkspaceTransaction(() => workspaceStorage().setItem(key, JSON.stringify({ kind: "acknowledged", revision: 3, session: session("one") })));
    expect(JSON.parse(workspaceStorage().getItem(key)!).revision).toBe(9);
  });

  it("keeps a concurrent replacement of a journal row during conditional acknowledgement cleanup", () => {
    const key = "journal.sessions.writer.synthetic.concurrent";
    workspaceStorage().setItem(key, "old version");
    runWorkspaceTransaction(() => {
      workspaceStorage().removeItemIfUnchanged(key, "old version");
      local.setItem(workspaceKey(key), "new concurrent version");
    });
    expect(workspaceStorage().getItem(key)).toBe("new concurrent version");
  });

  it("keeps a newer preference operation while cleaning an earlier acknowledgement", () => {
    saveStoredAnswerDepth("concise");
    const captured = getWorkspacePreferenceChanges();
    saveStoredAnswerDepth("detailed");
    const current = getWorkspacePreferenceChanges();
    runWorkspaceTransaction(() => saveWorkspacePreferenceChanges({ preferences: {}, providerPreferences: {} }, captured), { applyingSnapshot: true });
    expect(getWorkspacePreferenceChanges().preferences.answerDepth.operationId).toBe(current.preferences.answerDepth.operationId);
    local.setItem(workspaceKey("pla.preferences.answerDepth.v1"), "standard");
    expect(getStoredAnswerDepth()).toBe("detailed");
  });

  it("does not clean a writer whose nontext fields were not acknowledged", async () => {
    const { upsertStoredSession } = await import("@/lib/storage");
    const original = session("metadata-edit");
    const edited = { ...original, context: { ...original.context, course: "quantum-mechanics" as const },
      memory: { ...original.memory, currentGoal: "Unacknowledged goal" }, updatedAt: 2 };
    upsertStoredSession(edited);
    applyClientUserDataSnapshot({ revision: 4, sessions: [{ ...original, updatedAt: 9 }], practiceHistory: [], updatedAt: 9 });
    expect(Array.from(local.values).some(([key, value]) => key.includes("journal.sessions.writer.") && value.includes("Unacknowledged goal"))).toBe(true);
    local.setItem(workspaceKey("pla.chat.sessions.v1"), JSON.stringify([original]));
    expect(Array.from(local.values).some(([, value]) => value.includes("Unacknowledged goal"))).toBe(true);
  });
  it("preserves an offline preference edit against an old bootstrap snapshot", () => {
    saveStoredAnswerDepth("concise");
    applyClientUserDataSnapshot({ preferences: { answerDepth: "standard" }, sessions: [], practiceHistory: [], updatedAt: 1 });
    expect(getStoredAnswerDepth()).toBe("concise");
  });

  it("lets a clean default restore remote preferences and the actual profile", () => {
    applyClientUserDataSnapshot({ preferences: { answerDepth: "detailed" },
      learningProfile: { courseFrequency: { "quantum-mechanics": 4 }, recentTopics: ["spin"], preferredStyle: "balanced", updatedAt: 1 },
      sessions: [], practiceHistory: [], updatedAt: 1 });
    expect(getStoredAnswerDepth()).toBe("detailed");
    expect(getStoredLearningProfile().courseFrequency).toEqual({ "quantum-mechanics": 4 });
  });

  it("applies a replacement at capacity after filtering tombstones", () => {
    saveStoredSessions(Array.from({ length: 80 }, (_, index) => session(`s${index}`)));
    expect(() => applyClientUserDataSnapshot({ revision: 7, tombstones: { sessions: { s0: { deletedAt: 2, operationId: "delete-s0" } }, practiceHistory: {} },
      sessions: [session("new")], practiceHistory: [], updatedAt: 2 })).not.toThrow();
    expect(getStoredSessions()).toHaveLength(80);
    expect(getStoredSessions().some((item) => item.id === "s0")).toBe(false);
    expect(getStoredSessions().some((item) => item.id === "new")).toBe(true);
    expect(getWorkspaceMetadata().revision).toBe(7);
  });

  it("rolls back every field and revision when a storage write fails", () => {
    saveStoredSessions([session("original")]);
    const before = new Map(local.values);
    const write = local.setItem;
    local.setItem = (key, value) => { if (key === workspaceKey("pla.practice.history.v1")) throw new DOMException("Synthetic quota", "QuotaExceededError"); write(key, value); };
    expect(() => applyClientUserDataSnapshot({ revision: 9, sessions: [session("remote")], practiceHistory: [], updatedAt: 2 })).toThrow();
    expect(getWorkspaceMetadata().revision).toBe(0);
    expect(getStoredSessions().map((item) => item.id)).toEqual(["original"]);
    expect(local.values).toEqual(before);
  });

  it("does not acknowledge an over-capacity snapshot or change its preferences", () => {
    saveStoredSessions(Array.from({ length: 80 }, (_, index) => session(`s${index}`)));
    const before = collectClientUserDataSnapshot();
    expect(() => applyClientUserDataSnapshot({ revision: 9, preferences: { answerDepth: "detailed" }, sessions: [session("overflow")], practiceHistory: [], updatedAt: 2 })).toThrow();
    expect(collectClientUserDataSnapshot().sessions).toEqual(before.sessions);
    expect(getWorkspaceMetadata().revision).toBe(0);
    expect(getStoredAnswerDepth()).toBe("standard");
  });
});
