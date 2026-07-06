import { expect, test } from "@playwright/test";

test("signed-in users can persist and reload workspace data", async ({ request }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name.replace(/\W+/g, "-")}`;
  const registerResponse = await request.post("/api/auth/register", {
    data: {
      name: "Physics Student",
      email: `student-${suffix}@example.com`,
      password: "Physics123",
    },
  });

  expect(registerResponse.ok()).toBe(true);

  const saveResponse = await request.put("/api/user-data", {
    data: {
      sessions: [
        {
          id: "session-e2e",
          title: "Boundary conditions",
          source: "manual",
          createdAt: 1,
          updatedAt: 2,
          messages: [
            {
              id: "m1",
              role: "user",
              content: "Explain Green functions.",
              createdAt: 1,
            },
          ],
          context: { course: "math-physics", taskType: "explain" },
          memory: {
            currentCourse: "math-physics",
            recentConfusions: [],
            coveredConcepts: ["Green functions"],
            exerciseTopics: [],
            preferredStyle: "balanced",
            updatedAt: 2,
          },
        },
      ],
      activeSessionId: "session-e2e",
      preferences: {
        answerDepth: "detailed",
        onboardingDismissed: true,
        selectedModel: "deepseek-chat",
      },
      practiceHistory: [
        {
          id: "practice-e2e",
          title: "Green function set",
          prompt: "Generate problems.",
          content: "### Problem 1\n\nFind a Green function.",
          status: "complete",
          createdAt: 3,
          updatedAt: 4,
        },
      ],
    },
  });

  expect(saveResponse.ok()).toBe(true);

  const loadResponse = await request.get("/api/user-data");
  const body = await loadResponse.json();

  expect(loadResponse.ok()).toBe(true);
  expect(body.data.activeSessionId).toBe("session-e2e");
  expect(body.data.sessions[0].title).toBe("Boundary conditions");
  expect(body.data.practiceHistory[0].title).toBe("Green function set");
  expect(body.data.preferences.answerDepth).toBe("detailed");
});
