import { describe, expect, it } from "vitest";
import { createGenerationBudgetManager } from "@/lib/generation-budget";

const admission = (reservedOutputTokens = 10, now = Date.UTC(2026, 9, 8, 12)) => ({ serverDefault: true, reservedOutputTokens, now });
const manager = (overrides: Record<string, string> = {}) => createGenerationBudgetManager(() => ({
  PLA_GENERATION_MAX_CONCURRENT_PER_USER: "2", PLA_GENERATION_MAX_CONCURRENT_GLOBAL: "3",
  PLA_GENERATION_DAILY_OUTPUT_TOKENS_PER_USER: "100", PLA_GENERATION_DAILY_OUTPUT_TOKENS_GLOBAL: "200", ...overrides,
}));

describe("generation admission budgets", () => {
  it("reserves output before generation and prevents concurrent user-budget overspend", () => {
    const budget = manager();
    const first = budget.acquire("a", admission(60));
    expect(() => budget.acquire("a", admission(60))).toThrow(expect.objectContaining({ code: "GENERATION_USER_DAILY_LIMIT" }));
    first.release({ outputTokens: 20 });
    expect(() => budget.acquire("a", admission(60))).not.toThrow();
  });
  it("shares the default-key pool across different accounts", () => {
    const budget = manager();
    budget.acquire("a", admission(100)).release();
    budget.acquire("b", admission(100)).release();
    expect(() => budget.acquire("c", admission(1))).toThrow(expect.objectContaining({ code: "GENERATION_GLOBAL_DAILY_LIMIT" }));
  });
  it("applies user and global concurrency to BYOK as well", () => {
    const budget = manager();
    const byok = { ...admission(), serverDefault: false };
    const a = budget.acquire("a", byok), b = budget.acquire("a", byok);
    expect(() => budget.acquire("a", byok)).toThrow(expect.objectContaining({ code: "GENERATION_USER_BUSY" }));
    const c = budget.acquire("b", byok);
    expect(() => budget.acquire("c", byok)).toThrow(expect.objectContaining({ code: "GENERATION_GLOBAL_BUSY" }));
    a.release(); b.release(); c.release();
    expect(() => budget.acquire("c", byok)).not.toThrow();
  });
  it("keeps cancelled or unreported usage reserved, and release is idempotent", () => {
    const budget = manager();
    const lease = budget.acquire("a", admission(100));
    lease.release(); lease.release({ outputTokens: 0 });
    expect(() => budget.acquire("a", admission(1))).toThrow(expect.objectContaining({ code: "GENERATION_USER_DAILY_LIMIT" }));
    expect(() => budget.acquire("a", { ...admission(), serverDefault: false })).not.toThrow();
  });
  it("does not spend server-key daily quotas for BYOK", () => {
    const budget = manager();
    for (let index = 0; index < 25; index++) budget.acquire("a", { ...admission(100), serverDefault: false }).release({ outputTokens: 100 });
    expect(() => budget.acquire("a", admission(100))).not.toThrow();
  });
  it("resets daily pools at UTC midnight without an old lease changing the new day", () => {
    const budget = manager();
    const before = Date.UTC(2026, 9, 8, 23, 59, 59), after = Date.UTC(2026, 9, 9);
    const old = budget.acquire("a", admission(100, before));
    const next = budget.acquire("a", admission(100, after));
    old.release({ outputTokens: 1 }); next.release();
    expect(() => budget.acquire("a", admission(1, after))).toThrow(expect.objectContaining({ code: "GENERATION_USER_DAILY_LIMIT" }));
  });
  it.each(["0", "-1", "1.5", "NaN", "999999999999999", "unlimited"])("rejects invalid limit %s instead of silently disabling protection", value => {
    const budget = manager({ PLA_GENERATION_MAX_CONCURRENT_GLOBAL: value });
    expect(() => budget.acquire("a", admission())).toThrow(expect.objectContaining({ code: "GENERATION_CONFIG_INVALID", status: 503 }));
  });
  it("honors the generation kill switch for both key modes", () => {
    const budget = manager({ PLA_GENERATION_ENABLED: "false" });
    for (const serverDefault of [true, false]) expect(() => budget.acquire("a", { ...admission(), serverDefault })).toThrow(expect.objectContaining({ code: "GENERATION_DISABLED" }));
  });
  it("settles higher reported usage conservatively", () => {
    const budget = manager();
    budget.acquire("a", admission(50)).release({ outputTokens: 100 });
    expect(() => budget.acquire("a", admission(1))).toThrow(expect.objectContaining({ code: "GENERATION_USER_DAILY_LIMIT" }));
  });
});
