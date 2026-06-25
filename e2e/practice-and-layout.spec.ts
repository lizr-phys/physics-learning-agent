import { expect, test } from "@playwright/test";

function installCompleteResponseMock() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (!url.includes("/api/chat")) {
      return originalFetch(input, init);
    }

    const longExplanation = Array.from(
      { length: 80 },
      (_, index) => `${index + 1}. 推导步骤 ${index + 1}：检查条件、符号与结果。\n`,
    ).join("");
    const body = [
      "### 题目 1\n",
      "求一维势阱中的允许能级。\n\n",
      "$$E_n=\\frac{n^2\\pi^2\\hbar^2}{2ma^2}$$\n\n",
      "动量满足 \\(p=mv\\)。\n\n",
      "\\[\n\\nabla^2\\varphi=0\n\\]\n\n",
      "u_x=v_y=e^x\\cos y\\tag{1}\n\n",
      "**答案**：由边界条件与归一化条件确定。\n",
      longExplanation,
      "\n**完整输出结束**\n",
      "[[PLA_STREAM_EVENT:done]]\n",
    ].join("");

    return Promise.resolve(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
    );
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installCompleteResponseMock);
});

test("practice infers course and knowledge from a natural-language request", async ({ page }) => {
  await page.goto("/practice");
  await expect(page.getByTestId("course-selector")).toHaveValue("");
  await expect(page.getByTestId("knowledge-selector")).toBeDisabled();

  await page
    .getByTestId("generator-prompt")
    .fill("生成 3 道量子力学一维定态问题的基础练习题");
  await page.getByTestId("generator-submit").click();

  await expect(page.getByTestId("course-selector")).toHaveValue("quantum-mechanics");
  await expect(page.getByTestId("practice-result-list")).toContainText("题目 1");
  await expect(page.getByTestId("practice-result-list")).toContainText("完整输出结束");
  await expect(page.locator(".katex")).toHaveCount(4);
  await expect(page.getByTestId("practice-result-list")).not.toContainText("\\(");
  await expect(page.getByTestId("practice-result-list")).not.toContainText("\\[");
  await expect(page.getByText("显示答案")).toBeVisible();
  await expect(
    page.getByText("由边界条件与归一化条件确定。", { exact: true }),
  ).toBeHidden();
});

test("practice output mode is explicit and the answer stays folded", async ({ page }) => {
  await page.goto("/practice");
  await expect(page.getByTestId("practice-output-mode")).toHaveValue("hidden-answer");
  await page.getByTestId("generator-prompt").fill("生成 3 道量子力学一维定态问题练习题");
  await page.getByTestId("generator-submit").click();

  await expect(page.getByText("显示答案")).toBeVisible();
  await page.getByText("显示答案").click();
  await expect(
    page.getByText("由边界条件与归一化条件确定。", { exact: true }),
  ).toBeVisible();
});

test("a practice problem carries context into chat", async ({ page }) => {
  await page.goto("/practice");
  await page.getByTestId("generator-prompt").fill("生成 3 道量子力学一维定态问题练习题");
  await page.getByTestId("generator-submit").click();
  await page.getByRole("button", { name: "追问本题" }).click();
  await expect(page).toHaveURL(/\/chat\?sessionId=/);
  await expect(page.getByText(/当前基于：练习题/)).toBeVisible();
});

test("chat and tool pages do not overflow horizontally", async ({ page }) => {
  await page.goto("/chat");
  const chatOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(chatOverflow).toBe(false);

  await page.goto("/map");
  const mapOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(mapOverflow).toBe(false);
});

test("knowledge formulas use KaTeX and removed tool routes return 404", async ({
  page,
  request,
}) => {
  await page.goto("/map");
  await expect(page.locator(".katex").first()).toBeVisible();
  await expect(page.getByText("题型梳理", { exact: true })).toHaveCount(0);
  await expect(page.getByText("板块复习", { exact: true })).toHaveCount(0);

  expect((await request.get("/types")).status()).toBe(404);
  expect((await request.get("/review")).status()).toBe(404);
});
