import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getStoredPracticeGenerations,
  saveStoredPracticeGenerations,
  updateStoredPracticeAssessment,
  upsertStoredPracticeGeneration,
} from "@/lib/practice-history";

function createLocalStorageMock() {
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

describe("practice history", () => {
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
});
