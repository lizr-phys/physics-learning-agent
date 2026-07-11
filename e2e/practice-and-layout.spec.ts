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
      (_, index) =>
        `${index + 1}. Derivation checkpoint ${index + 1}: check assumptions, notation, and boundary conditions.\n`,
    ).join("");
    const body = [
      "### Problem 1\n",
      "**Source style**: English textbook exercise style\n\n",
      "**Training goal**: Practice bound-state boundary conditions.\n\n",
      "**Problem**: A particle is confined in a one-dimensional infinite well of width $a$. Find the allowed energy levels.\n\n",
      "$$E_n=\\frac{n^2\\pi^2\\hbar^2}{2ma^2}$$\n\n",
      "The momentum scale satisfies \\(p=mv\\).\n\n",
      "\\[\n\\nabla^2\\varphi=0\n\\]\n\n",
      "u_x=v_y=e^x\\cos y\\tag{1}\n\n",
      "**Topics**: one-dimensional stationary states\n\n",
      "**Difficulty**: basic\n\n",
      "**Hint**: Apply the boundary conditions at $x=0$ and $x=a$.\n\n",
      "**Solution**: Match the wave function to the boundary conditions and normalize it.\n\n",
      "**Answer**: The allowed energies are fixed by the integer quantum number $n$.\n\n",
      longExplanation,
      "\n**Output complete**\n",
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

test("practice infers course from a natural-language request", async ({ page }) => {
  await page.goto("/practice");
  await expect(page.getByTestId("course-selector")).toHaveValue("");
  await expect(page.getByTestId("knowledge-selector")).toBeDisabled();

  await page
    .getByTestId("generator-prompt")
    .fill("Generate 3 basic quantum mechanics one-dimensional stationary-state practice problems.");
  await page.getByTestId("generator-submit").click();

  await expect(page.getByTestId("course-selector")).toHaveValue("quantum-mechanics");
  await expect(page.getByTestId("practice-result-list")).toContainText("Problem 1");
  await expect(page.getByTestId("practice-result-list")).toContainText("Output complete");
  expect(await page.locator(".katex").count()).toBeGreaterThanOrEqual(4);
  await expect(page.getByTestId("practice-result-list")).not.toContainText("\\(");
  await expect(page.getByTestId("practice-result-list")).not.toContainText("\\[");
  await expect(page.getByText("Show answer")).toBeVisible();
  await expect(page.getByTestId("download-latex")).toBeVisible();
  await expect(
    page.getByText("The allowed energies are fixed by the integer quantum number", {
      exact: false,
    }),
  ).toBeHidden();
});

test("practice output mode is explicit and the answer stays folded", async ({ page }) => {
  await page.goto("/practice");
  await expect(page.getByTestId("practice-output-mode")).toHaveValue("hidden-answer");
  await expect(page.getByTestId("practice-style")).toHaveValue("auto");
  await page
    .getByTestId("generator-prompt")
    .fill("Generate 3 English textbook-style problems on the harmonic oscillator.");
  await page.getByTestId("generator-submit").click();

  await expect(page.getByText("Show answer")).toBeVisible();
  await page.getByText("Show answer").click();
  await expect(
    page.getByText("The allowed energies are fixed by the integer quantum number", {
      exact: false,
    }),
  ).toBeVisible();
});

test("practice self-assessment persists with the generated set", async ({ page }) => {
  await page.goto("/practice");
  await page
    .getByTestId("generator-prompt")
    .fill("Generate 3 English textbook-style problems on the harmonic oscillator.");
  await page.getByTestId("generator-submit").click();

  const solved = page.getByTestId("practice-assessment-solved-1");
  await solved.click();
  await expect(solved).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(page.getByTestId("practice-assessment-solved-1")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("a practice problem carries context into chat", async ({ page }) => {
  await page.goto("/practice");
  await page
    .getByTestId("generator-prompt")
    .fill("Generate 3 English textbook-style problems on the harmonic oscillator.");
  await page.getByTestId("generator-submit").click();
  await page.getByRole("button", { name: "Ask about this problem" }).click();
  await expect(page).toHaveURL(/\/chat\?sessionId=/);
  await expect(page.getByText(/Context attached: Practice/)).toBeVisible();
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
  await expect(page.getByText("Problem Type Analysis", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Topic Review", { exact: true })).toHaveCount(0);

  expect((await request.get("/types")).status()).toBe(404);
  expect((await request.get("/review")).status()).toBe(404);
});
