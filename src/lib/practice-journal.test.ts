import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StoredPracticeGeneration } from "@/lib/practice-history";
import { WorkspaceQuotaError } from "@/lib/workspace-sync";
import { runWorkspaceTransaction, workspaceIdentityKey, workspaceKey } from "@/lib/workspace-storage";
import { acknowledgePracticeJournal, readPracticeJournal, removePracticeJournal, writePracticeJournal } from "@/lib/practice-journal";

function memoryStorage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; } };
}

let local: ReturnType<typeof memoryStorage>;
beforeEach(() => {
  local = memoryStorage();
  vi.stubGlobal("window", { localStorage: local, dispatchEvent: vi.fn(() => true) });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const practice = (overrides: Partial<StoredPracticeGeneration> = {}): StoredPracticeGeneration => ({
  id: "synthetic:set", title: "Synthetic oscillator", prompt: "A synthetic request", content: "### Problem 1\nSynthetic text.",
  status: "interrupted", createdAt: 1, updatedAt: 2, ...overrides,
});
const seedWriter = (writer: string, record = practice(), ownerId?: string | null) => {
  const key = `journal.practice.writer.${encodeURIComponent(record.id)}.${writer}`;
  local.setItem(workspaceKey(key, ownerId), JSON.stringify({ kind: "writer", record }));
  return key;
};
const writerRows = () => readPracticeJournal().filter((row) => row.kind === "writer");
const acknowledgedRows = () => readPracticeJournal().filter((row) => row.kind === "acknowledged");

describe("practice writer journal", () => {
  it("keeps one stable writer per document while preserving other tab writers", () => {
    seedWriter("other-tab", practice({ content: "Independent draft" }));
    writePracticeJournal(practice());
    const first = writerRows().find((row) => row.record.content === practice().content)!;
    writePracticeJournal(practice({ content: "Extended draft", updatedAt: 3 }));
    expect(writerRows()).toHaveLength(2);
    expect(writerRows().find((row) => row.key === first.key)?.record.content).toBe("Extended draft");
    expect(writerRows().some((row) => row.record.content === "Independent draft")).toBe(true);
  });

  it("gives a cloned document a different writer even when session storage was cloned", async () => {
    writePracticeJournal(practice());
    const firstKey = writerRows()[0].key;
    vi.resetModules();
    const clonedTab = await import("@/lib/practice-journal");
    clonedTab.writePracticeJournal(practice({ content: "A second document draft" }));
    const rows = clonedTab.readPracticeJournal().filter((row) => row.kind === "writer");
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.key)).size).toBe(2);
    expect(rows.some((row) => row.key === firstKey)).toBe(true);
  });

  it("retains acknowledged content separately after the writer is collected", () => {
    writePracticeJournal(practice());
    acknowledgePracticeJournal([practice({ content: practice().content + "\nContinued", updatedAt: 3 })], 8);
    expect(writerRows()).toHaveLength(0);
    expect(acknowledgedRows()).toHaveLength(1);
    expect(acknowledgedRows()[0]).toMatchObject({ revision: 8, record: { content: practice().content + "\nContinued" } });
    local.setItem(workspaceKey("pla.practice.history.v1"), "[]");
    expect(acknowledgedRows()[0].record.content).toContain("Continued");
  });

  it("keeps divergent and newer writer content until actually covered", () => {
    seedWriter("divergent", practice({ content: "Other content" }));
    seedWriter("newer", practice({ updatedAt: 5 }));
    acknowledgePracticeJournal([practice({ updatedAt: 4 })], 1);
    expect(writerRows()).toHaveLength(2);
  });

  it("retains safe requests and failure diagnostics before the first content token", () => {
    const record = practice({ content: "", status: "error", originalRequest: { message: "Synthetic request", exerciseCount: 2 },
      generation: { requestId: "before-first-token", terminal: "error", reason: "Synthetic transport failure" } });
    writePracticeJournal(record);
    expect(writerRows()[0].record).toEqual(record);
    acknowledgePracticeJournal([record], 1);
    expect(writerRows()).toHaveLength(0);
    expect(acknowledgedRows()[0].record.generation?.reason).toBe("Synthetic transport failure");
  });

  it("retains assessments with differing equal-time notes and collects newer assessments or tombstones", () => {
    const record = practice({ problemAssessments: { p1: { status: "needs-work", attemptDraft: "Draft A", updatedAt: 3 } } });
    seedWriter("assessment", record);
    acknowledgePracticeJournal([practice({ problemAssessments: { p1: { status: "needs-work", attemptDraft: "Draft B", updatedAt: 3 } } })], 1);
    expect(writerRows()).toHaveLength(1);
    acknowledgePracticeJournal([practice({ problemAssessments: { p1: { status: "solved", updatedAt: 4 } } })], 2);
    expect(writerRows()).toHaveLength(0);
    seedWriter("assessment", record);
    acknowledgePracticeJournal([practice({ assessmentTombstones: { p1: 3 } })], 3);
    expect(writerRows()).toHaveLength(0);
  });

  it("requires every assessment tombstone and completed task ID before collecting", () => {
    const record = practice({ assessmentTombstones: { p1: 3 },
      task: { version: 1, setId: "synthetic:set", targetCount: 2, outputMode: "questions-only", completedProblemIds: ["p1", "p2"] } });
    seedWriter("progress", record);
    acknowledgePracticeJournal([{ ...record, assessmentTombstones: undefined }], 1);
    expect(writerRows()).toHaveLength(1);
    acknowledgePracticeJournal([{ ...record, task: { ...record.task!, completedProblemIds: ["p1"] } }], 2);
    expect(writerRows()).toHaveLength(1);
    acknowledgePracticeJournal([{ ...record, assessmentTombstones: { p1: 4 } }], 3);
    expect(writerRows()).toHaveLength(0);
  });

  it("requires all current and historical diagnostics, including usage fields", () => {
    const generation = { requestId: "current", terminal: "interrupted" as const, durationMs: 10, usage: { outputTokens: 5 } };
    const generationAttempts = [{ requestId: "previous", terminal: "error" as const, reason: "Synthetic failure" }];
    const record = practice({ generation, generationAttempts });
    seedWriter("diagnostics", record);
    acknowledgePracticeJournal([{ ...record, generationAttempts: [] }], 1);
    expect(writerRows()).toHaveLength(1);
    acknowledgePracticeJournal([{ ...record, generation: { ...generation, usage: { outputTokens: 4 } } }], 2);
    expect(writerRows()).toHaveLength(1);
    acknowledgePracticeJournal([{ ...record, generation: undefined,
      generationAttempts: [...generationAttempts, { ...generation, durationMs: 20, usage: { outputTokens: 6 } }] }], 3);
    expect(writerRows()).toHaveLength(0);
  });

  it("preserves a writer replaced by another tab during acknowledgement commit", () => {
    const key = seedWriter("racing-tab");
    const set = local.setItem;
    local.setItem = (physicalKey, value) => {
      set(physicalKey, value);
      if (physicalKey.includes("journal.practice.acknowledged.")) set(workspaceKey(key), JSON.stringify({ kind: "writer", record: practice({ content: "Changed during commit", updatedAt: 9 }) }));
    };
    acknowledgePracticeJournal([practice()], 1);
    expect(writerRows()[0].record.content).toBe("Changed during commit");
  });

  it("retains covering proof when a concurrent higher revision contains divergent content", () => {
    seedWriter("racing-tab");
    const set = local.setItem;
    local.setItem = (key, value) => {
      set(key, value);
      if (key.includes("journal.practice.acknowledged.") && !key.endsWith("other-tab")) {
        set(workspaceKey("journal.practice.acknowledged.synthetic%3Aset.10.other-tab"), JSON.stringify({ kind: "acknowledged", revision: 10, record: practice({ content: "Different authoritative branch", updatedAt: 10 }) }));
      }
    };
    runWorkspaceTransaction(() => acknowledgePracticeJournal([practice()], 9));
    expect(writerRows()).toHaveLength(0);
    expect(acknowledgedRows().map((row) => row.record.content)).toContain(practice().content);
    expect(acknowledgedRows().map((row) => row.revision)).toEqual(expect.arrayContaining([9, 10]));
  });

  it("compacts covered acknowledged snapshots without discarding higher revisions", () => {
    acknowledgePracticeJournal([practice()], 7);
    acknowledgePracticeJournal([practice({ content: practice().content + "\nMore", updatedAt: 3 })], 8);
    expect(acknowledgedRows()).toHaveLength(1);
    acknowledgePracticeJournal([practice()], 6);
    expect(acknowledgedRows().map((row) => row.revision)).toEqual(expect.arrayContaining([6, 8]));
  });

  it("fails explicitly at 16 writers while allowing the current document to update", () => {
    for (let index = 0; index < 16; index++) seedWriter(`tab-${index}`);
    const before = new Map(local.values);
    expect(() => writePracticeJournal(practice())).toThrow(WorkspaceQuotaError);
    expect(local.values).toEqual(before);
    local.values.clear();
    writePracticeJournal(practice());
    for (let index = 0; index < 15; index++) seedWriter(`tab-${index}`);
    expect(() => writePracticeJournal(practice({ updatedAt: 3 }))).not.toThrow();
    expect(writerRows()).toHaveLength(16);
  });

  it("rolls back acknowledgement and preserves writers if a storage write fails", () => {
    seedWriter("tab");
    const before = new Map(local.values);
    const set = local.setItem;
    local.setItem = (key, value) => {
      if (key.includes("journal.practice.acknowledged.") && value.includes('"id":"second"')) throw new DOMException("Synthetic quota", "QuotaExceededError");
      set(key, value);
    };
    expect(() => acknowledgePracticeJournal([practice(), practice({ id: "second" })], 2)).toThrow();
    expect(local.values).toEqual(before);
  });

  it("isolates reads, acknowledgement and deletion by account", () => {
    seedWriter("tab-a", practice(), "account-a");
    seedWriter("tab-b", practice({ content: "Account B synthetic text" }), "account-b");
    local.setItem(workspaceIdentityKey, JSON.stringify({ ownerId: "account-a", authEpoch: "epoch-a" }));
    expect(readPracticeJournal()).toHaveLength(1);
    expect(readPracticeJournal("account-b")[0].record.content).toContain("Account B");
    acknowledgePracticeJournal([practice()], 1);
    removePracticeJournal(practice().id);
    expect(readPracticeJournal("account-a")).toHaveLength(0);
    expect(readPracticeJournal("account-b")).toHaveLength(1);
  });

  it("retains corrupted values for recovery while removing only matching valid rows", async () => {
    local.setItem(workspaceKey("journal.practice.writer.corrupt.tab"), "{broken");
    seedWriter("valid");
    seedWriter("other", practice({ id: "other" }));
    expect(readPracticeJournal()).toHaveLength(2);
    await Promise.resolve();
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "pla:storage-failed" }));
    removePracticeJournal(practice().id);
    expect(readPracticeJournal().map((row) => row.record.id)).toEqual(["other"]);
    expect(local.getItem(workspaceKey("journal.practice.writer.corrupt.tab"))).toBe("{broken");
  });
});
