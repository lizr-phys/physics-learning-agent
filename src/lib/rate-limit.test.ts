import { describe, expect, it } from "vitest";

import { consumeRateLimit } from "@/lib/rate-limit";

describe("in-process rate limiter", () => {
  it("limits a bucket and resets it after the window", () => {
    const key = `test:${crypto.randomUUID()}`;

    expect(consumeRateLimit(key, 2, 1000, 100).allowed).toBe(true);
    expect(consumeRateLimit(key, 2, 1000, 200).allowed).toBe(true);
    expect(consumeRateLimit(key, 2, 1000, 300).allowed).toBe(false);
    expect(consumeRateLimit(key, 2, 1000, 1200).allowed).toBe(true);
  });
});
