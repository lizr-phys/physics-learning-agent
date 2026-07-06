import { expect, test, type Locator, type Page } from "@playwright/test";

function installStreamingMock() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (!url.includes("/api/chat")) {
      return originalFetch(input, init);
    }

    const encoder = new TextEncoder();
    let timer = 0;
    let marker = "old session";

    try {
      const request = JSON.parse(String(init?.body ?? "{}")) as { message?: string };

      if (request.message?.includes("Session A")) {
        marker = "Session A response";
      } else if (request.message?.includes("Session B")) {
        marker = "Session B response";
      }
    } catch {
      marker = "old session";
    }

    const parts = [
      `${marker} segment 1 with inline math \\(E=mc^2\\)\n`,
      `${marker} segment 2\n`,
      `${marker} segment 3\n`,
      "[[PLA_STREAM_EVENT:done]]\n",
    ];

    return Promise.resolve(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            let index = 0;
            timer = window.setInterval(() => {
              if (index >= parts.length) {
                window.clearInterval(timer);
                controller.close();
                return;
              }

              controller.enqueue(encoder.encode(parts[index]));
              index += 1;
            }, 400);
          },
          cancel() {
            window.clearInterval(timer);
          },
        }),
        { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
      ),
    );
  };
}

function expectedSessionTitle(question: string) {
  return question.length > 20 ? `${question.slice(0, 20)}...` : question;
}

async function openSidebarIfNeeded(
  page: Page,
  projectName: string,
) {
  if (projectName.includes("mobile")) {
    await page.getByLabel("Open sidebar").click();
  }
}

function activeSidebarLocator(
  locator: Locator,
  projectName: string,
) {
  return projectName.includes("mobile") ? locator.last() : locator.first();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installStreamingMock);
  await page.goto("/chat");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("new session aborts and isolates the previous stream", async ({ page }, testInfo) => {
  const question = "Derive the energy quantization of the one-dimensional harmonic oscillator in detail.";
  await page.getByTestId("chat-input").fill(question);
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("old session segment 1");
  await expect(page.locator(".katex").first()).toBeVisible();

  await openSidebarIfNeeded(page, testInfo.project.name);
  await activeSidebarLocator(
    page.getByTestId("new-session"),
    testInfo.project.name,
  ).click();
  await expect(page.getByTestId("assistant-message")).toHaveCount(0);
  await expect(page.getByTestId("stop-generation")).toHaveCount(0);
  await page.waitForTimeout(700);
  await expect(page.getByTestId("assistant-message")).toHaveCount(0);

  await openSidebarIfNeeded(page, testInfo.project.name);
  await activeSidebarLocator(
    page.getByTitle(expectedSessionTitle(question)),
    testInfo.project.name,
  ).click();
  await expect(page.getByTestId("assistant-message")).toContainText("old session segment 1");
  await expect(page.getByTestId("assistant-message")).not.toContainText("old session segment 3");
});

test("deleting the active streaming session prevents it from returning", async ({ page }, testInfo) => {
  const question = "Explain how Maxwell's equations imply the electromagnetic wave equation.";
  await page.getByTestId("chat-input").fill(question);
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("old session segment 1");

  await openSidebarIfNeeded(page, testInfo.project.name);
  const title = activeSidebarLocator(
    page.getByTitle(expectedSessionTitle(question)),
    testInfo.project.name,
  );
  await title.locator("..").getByLabel("Conversation menu").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();

  await expect(page.getByTestId("assistant-message")).toHaveCount(0);
  await page.waitForTimeout(700);
  await expect(page.getByTestId("assistant-message")).toHaveCount(0);
  await expect(page.getByTitle(expectedSessionTitle(question))).toHaveCount(0);
});

test("rapid session switching never mixes assistant content", async ({ page }, testInfo) => {
  const questionA = "Session A: explain Green's functions and boundary conditions.";
  const questionB = "Session B: explain the canonical ensemble and partition function.";

  await page.getByTestId("chat-input").fill(questionA);
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("Session A response segment 3");
  await expect(page.getByTestId("stop-generation")).toHaveCount(0);

  await openSidebarIfNeeded(page, testInfo.project.name);
  await activeSidebarLocator(
    page.getByTestId("new-session"),
    testInfo.project.name,
  ).click();
  await page.getByTestId("chat-input").fill(questionB);
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("Session B response segment 1");

  await openSidebarIfNeeded(page, testInfo.project.name);
  await activeSidebarLocator(
    page.getByTitle(expectedSessionTitle(questionA)),
    testInfo.project.name,
  ).click();
  await expect(page.getByTestId("assistant-message")).toContainText("Session A response");
  await expect(page.getByTestId("assistant-message")).not.toContainText("Session B response");

  await openSidebarIfNeeded(page, testInfo.project.name);
  await activeSidebarLocator(
    page.getByTitle(expectedSessionTitle(questionB)),
    testInfo.project.name,
  ).click();
  await expect(page.getByTestId("assistant-message")).toContainText("Session B response");
  await expect(page.getByTestId("assistant-message")).not.toContainText("Session A response");
});
