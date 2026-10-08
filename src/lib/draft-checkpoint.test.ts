import { afterEach, describe, expect, it, vi } from "vitest";
import { createDraftCheckpoint } from "@/lib/draft-checkpoint";

afterEach(() => vi.useRealTimers());
describe("stream checkpoint recovery", () => {
  it("keeps the latest draft while rendering rapidly and flushes on departure", () => {
    vi.useFakeTimers();
    const save = vi.fn();
    const checkpoint = createDraftCheckpoint<string>(save, () => true);
    for (let i = 0; i < 100; i++) { checkpoint.update(`content-${i}`); vi.advanceTimersByTime(64); }
    checkpoint.flush();
    expect(save.mock.calls.length).toBeLessThanOrEqual(7);
    expect(save.mock.calls.at(-1)).toEqual(["content-99"]);
  });
  it("cannot checkpoint an old account or a deleted target after a queued timer", () => {
    vi.useFakeTimers();
    let current = true;
    const save = vi.fn();
    const checkpoint = createDraftCheckpoint(save, () => current);
    checkpoint.update("old private output"); current = false;
    vi.advanceTimersByTime(2000); checkpoint.flush();
    expect(save).not.toHaveBeenCalled();
  });
  it("checkpoints a paused provider and retains explicit cancellation control", () => {
    vi.useFakeTimers(); const save = vi.fn();
    const checkpoint = createDraftCheckpoint(save, () => true);
    checkpoint.update("partial before a long pause"); vi.advanceTimersByTime(1100);
    expect(save).toHaveBeenCalledWith("partial before a long pause");
    checkpoint.update("discarded superseded request"); checkpoint.discard(); vi.advanceTimersByTime(1100);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
