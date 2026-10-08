import { describe, expect, it } from "vitest";
import { workspaceMutationRequiresSync } from "@/lib/workspace-storage";

describe("cross-tab synchronization admission", () => {
  it.each(["sync.acknowledged.v2", "sync.conflicts.v2", "sync.preference-changes.v2", "journal.sessions.acknowledged.s.8", "journal.practice.acknowledged.p.8.tab"])("does not echo %s", key => {
    expect(workspaceMutationRequiresSync(key, "{}", '{"revision":8}')).toBe(false);
  });
  it("does not echo a revision update while accepting a real deletion", () => {
    const old = JSON.stringify({revision:1,tombstones:{sessions:{},practiceHistory:{}}});
    expect(workspaceMutationRequiresSync("sync.v2", old, JSON.stringify({revision:2,tombstones:{sessions:{},practiceHistory:{}}}))).toBe(false);
    expect(workspaceMutationRequiresSync("sync.v2", old, JSON.stringify({revision:2,tombstones:{sessions:{s:{deletedAt:3,operationId:"delete"}},practiceHistory:{}}}))).toBe(true);
  });
  it.each(["journal.sessions.writer.s.tab", "journal.practice.writer.p.tab", "sync.preference-change.preferences.answerDepth"])("saves new %s but not its acknowledgement cleanup", key => {
    expect(workspaceMutationRequiresSync(key, null, "new edit")).toBe(true);
    expect(workspaceMutationRequiresSync(key, "old edit", null)).toBe(false);
  });
  it("keeps real content changes eligible without echoing another tab's selection", () => {
    for (const key of ["pla.chat.sessions.v1", "pla.practice.history.v1", "pla.learning.profile.v1", "pla.preferences.answerDepth.v1"]) {
      expect(workspaceMutationRequiresSync(key, "old", "new")).toBe(true);
      expect(workspaceMutationRequiresSync(key, "same", "same")).toBe(false);
    }
    expect(workspaceMutationRequiresSync("guest-import-choice", null, "separate")).toBe(false);
    expect(workspaceMutationRequiresSync("pla.chat.activeSessionId.v1", "tab-a", "tab-b")).toBe(false);
  });
});
