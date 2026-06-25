import { describe, expect, it } from "vitest";

import { getPersonalizedRecommendations } from "@/lib/recommendations";

describe("recommendations", () => {
  it("returns random practice recommendations without history", () => {
    const items = getPersonalizedRecommendations({
      type: "practice",
      count: 3,
      sessions: [],
      profile: {
        courseFrequency: {},
        recentTopics: [],
        preferredStyle: "balanced",
        updatedAt: 0,
      },
    });

    expect(items).toHaveLength(3);
    expect(new Set(items.map((item) => item.id)).size).toBe(3);
  });
});
