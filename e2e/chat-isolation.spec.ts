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
    let marker = "旧会话";

    try {
      const request = JSON.parse(String(init?.body ?? "{}")) as { message?: string };

      if (request.message?.includes("会话 A")) {
        marker = "会话 A 响应";
      } else if (request.message?.includes("会话 B")) {
        marker = "会话 B 响应";
      }
    } catch {
      marker = "旧会话";
    }

    const parts = [
      `${marker}片段 1，行内公式 \\(E=mc^2\\)\n`,
      `${marker}片段 2\n`,
      `${marker}片段 3\n`,
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
            }, 180);
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
    await page.getByLabel("打开侧边栏").click();
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
  const question = "详细推导一维线性谐振子的能级量子化过程";
  await page.getByTestId("chat-input").fill(question);
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("旧会话片段 1");
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
  await expect(page.getByTestId("assistant-message")).toContainText("旧会话片段 1");
  await expect(page.getByTestId("assistant-message")).not.toContainText("旧会话片段 3");
});

test("deleting the active streaming session prevents it from returning", async ({ page }, testInfo) => {
  const question = "详细说明 Maxwell 方程组如何推出电磁波方程";
  await page.getByTestId("chat-input").fill(question);
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("旧会话片段 1");

  await openSidebarIfNeeded(page, testInfo.project.name);
  const title = activeSidebarLocator(
    page.getByTitle(expectedSessionTitle(question)),
    testInfo.project.name,
  );
  await title.locator("..").getByLabel("会话菜单").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除" }).click();

  await expect(page.getByTestId("assistant-message")).toHaveCount(0);
  await page.waitForTimeout(700);
  await expect(page.getByTestId("assistant-message")).toHaveCount(0);
  await expect(page.getByTitle(expectedSessionTitle(question))).toHaveCount(0);
});

test("rapid session switching never mixes assistant content", async ({ page }, testInfo) => {
  const questionA = "会话 A：解释 Green 函数与边界条件";
  const questionB = "会话 B：解释正则系综与配分函数";

  await page.getByTestId("chat-input").fill(questionA);
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("会话 A 响应片段 3");
  await expect(page.getByTestId("stop-generation")).toHaveCount(0);

  await openSidebarIfNeeded(page, testInfo.project.name);
  await activeSidebarLocator(
    page.getByTestId("new-session"),
    testInfo.project.name,
  ).click();
  await page.getByTestId("chat-input").fill(questionB);
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("会话 B 响应片段 1");

  await openSidebarIfNeeded(page, testInfo.project.name);
  await activeSidebarLocator(
    page.getByTitle(expectedSessionTitle(questionA)),
    testInfo.project.name,
  ).click();
  await expect(page.getByTestId("assistant-message")).toContainText("会话 A 响应");
  await expect(page.getByTestId("assistant-message")).not.toContainText("会话 B 响应");

  await openSidebarIfNeeded(page, testInfo.project.name);
  await activeSidebarLocator(
    page.getByTitle(expectedSessionTitle(questionB)),
    testInfo.project.name,
  ).click();
  await expect(page.getByTestId("assistant-message")).toContainText("会话 B 响应");
  await expect(page.getByTestId("assistant-message")).not.toContainText("会话 A 响应");
});
