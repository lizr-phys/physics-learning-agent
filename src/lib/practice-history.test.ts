import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getStoredPracticeGenerations,
  saveStoredPracticeGenerations,
  updateStoredPracticeAssessment,
  upsertStoredPracticeGeneration,
} from "@/lib/practice-history";
import { workspaceKey, workspaceIdentityKey, workspaceStorageKeys } from "@/lib/workspace-storage";
import { readPracticeJournal } from "@/lib/practice-journal";
import type { StoredPracticeGeneration } from "@/lib/practice-history";

function createLocalStorageMock() {
  const store = new Map<string, string>();

  return {
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
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

describe("practice history", () => {
  const practice = (id: string, overrides: Partial<StoredPracticeGeneration> = {}): StoredPracticeGeneration => ({
    id, title: id, prompt: "Synthetic request", content: "### Problem 1\nSynthetic content", status: "complete", createdAt: 1, updatedAt: 1, ...overrides,
  });
  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: createLocalStorageMock(),
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("upserts generated practice sets by id", () => {
    saveStoredPracticeGenerations([]);
    upsertStoredPracticeGeneration({
      id: "practice-1",
      title: "Harmonic oscillator",
      course: "quantum-mechanics",
      prompt: "Generate problems.",
      content: "### Problem 1\n\nFind the energy levels.",
      status: "complete",
      createdAt: 1,
      updatedAt: 1,
    });
    upsertStoredPracticeGeneration({
      id: "practice-1",
      title: "Harmonic oscillator",
      course: "quantum-mechanics",
      prompt: "Generate problems.",
      content: "### Problem 1\n\nFind the normalized eigenstates.",
      status: "complete",
      createdAt: 1,
      updatedAt: 2,
    });

    const history = getStoredPracticeGenerations();

    expect(history).toHaveLength(1);
    expect(history[0].content).toContain("normalized eigenstates");
  });

  it("persists and clears per-problem self-assessments", () => {
    upsertStoredPracticeGeneration({
      id: "practice-2",
      title: "Electrostatic boundary values",
      prompt: "Generate problems.",
      content: "### Problem 1\n\nSolve the boundary-value problem.",
      status: "complete",
      createdAt: 1,
      updatedAt: 1,
    });

    updateStoredPracticeAssessment("practice-2", 1, "needs-work");
    expect(getStoredPracticeGenerations()[0].problemAssessments?.["1"].status).toBe(
      "needs-work",
    );

    updateStoredPracticeAssessment("practice-2", 1);
    expect(getStoredPracticeGenerations()[0].problemAssessments).toBeUndefined();
  });
  it("restores safe task parameters and completed IDs without retaining a BYOK secret", () => {
    upsertStoredPracticeGeneration({
      id: "resume", title: "Synthetic set", prompt: "Generate problems.", content: "### Problem 1\n<!-- pla:problem-id resume:problem:1 -->\n**Problem**: A complete supplied problem.", status: "interrupted", createdAt: 1, updatedAt: 2,
      task: { version: 1, setId: "resume", targetCount: 10, outputMode: "hidden-answer", completedProblemIds: ["resume:problem:1"] },
      originalRequest: { message: "Generate 10 problems", exerciseCount: 10, clientProvider: { apiKey: "must-not-persist" } } as unknown as import("@/lib/practice-task").PracticeRequestParameters,
    });
    const saved = getStoredPracticeGenerations()[0];
    expect(saved.task?.completedProblemIds).toEqual(["resume:problem:1"]);
    expect(saved.originalRequest?.exerciseCount).toBe(10);
    expect(JSON.stringify(saved)).not.toContain("must-not-persist");
    updateStoredPracticeAssessment("resume", "resume:problem:1", "needs-work", { attemptDraft: "My draft", stuckNote: "Boundary condition" });
    expect(getStoredPracticeGenerations()[0].problemAssessments?.["resume:problem:1"]).toMatchObject({ attemptDraft: "My draft", stuckNote: "Boundary condition" });
    updateStoredPracticeAssessment("resume", "resume:problem:1");
    expect(getStoredPracticeGenerations()[0].assessmentTombstones?.["resume:problem:1"]).toBeGreaterThan(0);
    expect(getStoredPracticeGenerations()[0].problemAssessments).toBeUndefined();
  });

  it("journals only the edited record and rebuilds the index without replacing other writers", () => {
    const untouched = practice("untouched");
    saveStoredPracticeGenerations([practice("edited"), untouched], { journal: false });
    const otherWriter = practice("edited", { updatedAt: 2, problemAssessments: { "edited:problem:1": { status: "solved", updatedAt: 2 } } });
    window.localStorage.setItem(workspaceKey("journal.practice.writer.edited.other-tab"), JSON.stringify({ kind: "writer", record: otherWriter }));
    upsertStoredPracticeGeneration(practice("edited", { content: "### Problem 1\nSynthetic content\nNew draft", updatedAt: 3 }));
    const rows = readPracticeJournal();
    expect(rows).toHaveLength(2);
    expect(rows.every(row => row.record.id === "edited")).toBe(true);
    expect(getStoredPracticeGenerations()).toHaveLength(2);
    expect(getStoredPracticeGenerations().find(record => record.id === "edited")).toMatchObject({ content: "### Problem 1\nSynthetic content\nNew draft", problemAssessments: { "edited:problem:1": { status: "solved" } } });
    window.localStorage.setItem(workspaceKey("pla.practice.history.v1"), JSON.stringify([untouched]));
    expect(getStoredPracticeGenerations().some(record => record.id === "edited")).toBe(true);
  });

  it("reads Guest journals while signed in without switching the active identity", () => {
    upsertStoredPracticeGeneration(practice("guest"));
    const identity = { ownerId: "synthetic-account", authEpoch: "account-epoch" };
    window.localStorage.setItem(workspaceIdentityKey, JSON.stringify(identity));
    upsertStoredPracticeGeneration(practice("account"));
    expect(getStoredPracticeGenerations().map(record => record.id)).toEqual(["account"]);
    expect(getStoredPracticeGenerations(null).map(record => record.id)).toEqual(["guest"]);
    expect(JSON.parse(window.localStorage.getItem(workspaceIdentityKey)!)).toEqual(identity);
  });

  it("refuses a delayed save after a practice deletion tombstone", () => {
    window.localStorage.setItem(workspaceKey("sync.v2"), JSON.stringify({ revision: 1, tombstones: { sessions: {}, practiceHistory: { deleted: { deletedAt: 3, operationId: "delete" } } } }));
    upsertStoredPracticeGeneration(practice("deleted", { updatedAt: 99 }));
    expect(getStoredPracticeGenerations()).toEqual([]);
    expect(workspaceStorageKeys("journal.practice.")).toEqual([]);
  });

  it("rolls back a target writer if the compatible index cannot be saved", () => {
    upsertStoredPracticeGeneration(practice("old"));
    const before = getStoredPracticeGenerations();
    const original = vi.mocked(window.localStorage.setItem).getMockImplementation()!;
    vi.mocked(window.localStorage.setItem).mockImplementation((key, value) => {
      if (key.endsWith("pla.practice.history.v1") && value.includes("new")) throw new DOMException("Synthetic quota", "QuotaExceededError");
      original(key, value);
    });
    expect(() => upsertStoredPracticeGeneration(practice("new"))).toThrow("Synthetic quota");
    expect(getStoredPracticeGenerations()).toEqual(before);
    expect(readPracticeJournal().map(row => row.record.id)).toEqual(["old"]);
  });
});
