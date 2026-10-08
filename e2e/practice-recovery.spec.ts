import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures";

function installPracticeRecoveryMock() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes("/api/chat")) return originalFetch(input, init);
    const body = JSON.parse(String(init?.body));
    const binding = { ownerId: new Headers(init?.headers).get("X-PLA-Workspace-Owner") ?? "guest", authEpoch: body.authEpoch, sessionId: body.conversationId, messageId: body.assistantMessageId, requestId: body.requestId };
    const setId = body.practiceTask.setId;
    const resumed = Boolean(body.practiceTask.resumeContent);
    sessionStorage.setItem("synthetic-practice-last-request", JSON.stringify({ ...body, clientProvider: undefined }));
    const ready = resumed ? 10 : 2;
    const content = Array.from({ length: ready }, (_, offset) => {
      const index = offset + 1;
      return `### Problem ${index}\n<!-- pla:problem-id ${setId}:problem:${index} -->\n**Training goal**: Apply an original parameter variant.\n**Conditions**: A parameter a has the supplied value ${index}.\n**Problem**: Evaluate $2a+1$ for this parameter.\n**Topics**: Parameter substitution\n**Difficulty**: Basic\n**Hint**: Substitute the value into the expression.\n**Solution**: Double the value and add one.\n**Answer**: $${2 * index + 1}$`;
    }).join("\n\n");
    const events = [
      { type: "stage", stage: "generate" },
      { type: "practice", content, task: { version: 1, setId, targetCount: 10, outputMode: "hidden-answer", completedProblemIds: Array.from({ length: ready }, (_, offset) => `${setId}:problem:${offset + 1}`) } },
      resumed ? { type: "complete", finishReason: "task_complete", usage: { outputTokens: 100 } } : { type: "interrupted", reason: "unexpected_eof", retryable: true },
    ];
    const response = events.map(event => `event: ${event.type}\ndata: ${JSON.stringify({ ...binding, ...event })}\n\n`).join("");
    return Promise.resolve(new Response(response, { headers: { "Content-Type": "text/event-stream" } }));
  };
}

test("a ten-problem set resumes after refresh with completed IDs, assessments and safe original parameters", async ({ page }) => {
  await page.addInitScript(installPracticeRecoveryMock);
  await page.goto("/practice");
  await page.getByTestId("generator-prompt").fill("Generate 10 original quantum mechanics practice problems.");
  await page.getByTestId("generator-submit").click();
  await expect(page.getByRole("button", { name: "Continue generation", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask about this problem" })).toHaveCount(2);
  await page.getByTestId("practice-assessment-solved-1").click();
  await expect(page.getByTestId("practice-assessment-solved-1")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Show answer").first()).toBeVisible();
  await expect(page.getByText("$3$", { exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: "Continue generation", exact: true })).toBeVisible();
  await expect(page.getByTestId("practice-assessment-solved-1")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Continue generation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ask about this problem" })).toHaveCount(10);
  await expect(page.getByRole("button", { name: "Continue generation", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("practice-assessment-solved-1")).toHaveAttribute("aria-pressed", "true");
  const request = await page.evaluate(() => JSON.parse(sessionStorage.getItem("synthetic-practice-last-request") ?? "{}"));
  expect(request.exerciseCount).toBe(10);
  expect(request.practiceTask.resumeContent).toContain("Problem 2");
  expect(request.message).toContain("Generate 10");
  expect(request.message).not.toContain("Continue from the interruption point");
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("download-latex").click();
  const download = await downloadPromise;
  const path = await download.path();
  const tex = await readFile(path!, "utf8");
  expect(tex).toContain("Problem 10");
  expect(tex).not.toContain("pla:problem-id");
});
