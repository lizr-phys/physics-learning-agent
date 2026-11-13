import { expect, test } from "./fixtures";

const answer = "A synthetic reply about the boundary conditions.\n[[PLA_STREAM_EVENT:done]]\n";

test("the selected server model is the model sent to the connection test", async ({ page }) => {
  const tested: Array<string | null> = [];
  await page.route("**/api/deepseek/test**", route => {
    const url = new URL(route.request().url());
    const isStatus = url.searchParams.get("mode") === "status";
    if (!isStatus) tested.push(url.searchParams.get("model"));
    return route.fulfill({ json: {
      ok: true, status: isStatus ? "configured" : "ok", message: isStatus ? "Configured." : "Selected model responds.",
      config: { configured: true, model: url.searchParams.get("model") ?? "deepseek-flash", baseUrl: "https://example.com", timeoutMs: 1000, streaming: true },
    } });
  });
  await page.goto("/settings/api");
  await page.getByRole("combobox", { name: "Server model preference" }).selectOption("deepseek-v4-pro");
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByText("Selected model responds.", { exact: true })).toBeVisible();
  expect(tested).toEqual(["deepseek-v4-pro"]);
});

test("testing an unsaved provider uses its draft and leaves the active connection alone", async ({ page }) => {
  const tested: string[] = [];
  await page.route("**/api/deepseek/test**", route => {
    const isPost = route.request().method() === "POST";
    if (isPost) tested.push(route.request().postDataJSON().clientProvider.model);
    return route.fulfill({ json: {
      ok: !isPost, status: isPost ? "request-failed" : "configured", message: isPost ? "The draft key was rejected." : "Configured.",
      config: { configured: !isPost, model: "deepseek-flash", baseUrl: "https://example.com", timeoutMs: 1000, streaming: true },
    } });
  });
  await page.goto("/settings/api");
  await page.getByText("My API key", { exact: true }).click();
  await page.getByLabel("Model", { exact: true }).fill("draft-model");
  await page.getByLabel("API Key", { exact: true }).fill("synthetic-test-key");
  await page.getByRole("button", { name: "Test provider" }).click();
  await expect(page.getByText("The draft key was rejected.", { exact: true })).toBeVisible();
  expect(tested).toEqual(["draft-model"]);
  expect(await page.evaluate(() => sessionStorage.getItem("pla.clientProvider.apiKey") === null)).toBe(true);
  await page.reload();
  await expect(page.getByRole("radio", { name: "Server default" })).toBeChecked();
});

test("retrying a failed workspace save preserves the current input", async ({ page }) => {
  expect((await page.request.post("/api/auth/register", {
    data: { name: "Retry sync", email: `retry-${crypto.randomUUID()}@example.com`, password: "Physics123" },
  })).ok()).toBe(true);
  let failPut = true;
  let accountChecks = 0;
  await page.route("**/api/auth/me", route => { accountChecks++; return route.continue(); });
  await page.route("**/api/user-data", route =>
    route.request().method() === "PUT" && failPut
      ? route.fulfill({ status: 503, json: { error: "Temporary test sync outage." } })
      : route.continue(),
  );
  await page.goto("/chat");
  const input = page.getByTestId("chat-input");
  await input.fill("Keep this unsent question across a save retry.");
  await expect(page.getByText("Temporary test sync outage.", { exact: false })).toBeVisible();
  const beforeRetry = accountChecks;
  failPut = false;
  await page.getByRole("button", { name: "Retry save" }).click();
  await expect(page.getByTestId("workspace-save-state").getByRole("status")).toHaveText("Saved");
  await expect(input).toHaveValue("Keep this unsent question across a save retry.");
  expect(accountChecks).toBe(beforeRetry);
});

test("an interrupted chat can be retried after refresh", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/chat", route => ++attempts === 1
    ? route.fulfill({ status: 503, json: { error: "Temporary model outage." } })
    : route.fulfill({ contentType: "text/plain", body: answer }));
  await page.goto("/chat");
  await page.getByTestId("chat-input").fill("Explain boundary conditions.");
  await page.getByTestId("send-message").click();
  await expect(page.getByRole("button", { name: "Regenerate", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("user-message")).toContainText("Explain boundary conditions.");
  await page.getByRole("button", { name: "Regenerate", exact: true }).click({ timeout: 6000 });
  await expect(page.getByTestId("assistant-message")).toContainText("A synthetic reply");
  expect(attempts).toBe(2);
});

test("changing the practice course does not erase the request", async ({ page }) => {
  await page.goto("/practice");
  const prompt = page.getByTestId("generator-prompt");
  await prompt.fill("Write short problems about a particle in a box.");
  await page.getByTestId("course-selector").selectOption("quantum-mechanics");
  await expect(prompt).toHaveValue("Write short problems about a particle in a box.");
});

test("the mobile navigation closes from the scrim and returns keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto("/chat");
  const opener = page.getByRole("button", { name: "Open sidebar" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Navigation" });
  await expect(dialog).toBeVisible();
  await page.mouse.click(380, 240);
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("chat examples fill the draft without sending and a saved model applies to an existing conversation", async ({ page }) => {
  const models: Array<string | undefined> = [];
  await page.route("**/api/chat", route => {
    models.push(route.request().postDataJSON().model);
    return route.fulfill({ contentType: "text/plain", body: answer });
  });
  await page.goto("/chat");
  await page.getByRole("button", { name: "Build intuition" }).click();
  const input = page.getByTestId("chat-input");
  await expect(input).toHaveValue(/particle in a box/);
  await expect(input).toBeFocused();
  expect(models).toEqual([]);
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("A synthetic reply");

  await page.goto("/settings/api");
  await page.getByRole("combobox", { name: "Server model preference" }).selectOption("deepseek-v4-pro");
  await page.getByRole("button", { name: "Use server connection" }).click();
  await expect(page.getByText("Server connection selected.", { exact: true })).toBeVisible();
  await page.goto("/chat");
  await expect(page.getByTestId("assistant-message")).toHaveCount(1);
  await input.fill("What assumptions did we use?");
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toHaveCount(2);
  expect(models).toEqual([undefined, "deepseek-v4-pro"]);
});

test("a saved key is never reused for a changed provider endpoint", async ({ page }) => {
  let tests = 0;
  await page.route("**/api/deepseek/test**", route => {
    if (route.request().method() === "POST") tests++;
    return route.fulfill({ json: { ok: true, status: "ok", message: "Mock connection." } });
  });
  await page.goto("/settings/api");
  await page.getByText("My API key", { exact: true }).click();
  await page.getByLabel("API Key", { exact: true }).fill("synthetic-tab-key");
  await page.getByRole("button", { name: "Save for this browser", exact: true }).click();
  await expect(page.getByText("Connection saved for this browser.", { exact: true })).toBeVisible();
  await page.getByText("Connection details", { exact: true }).click();
  await page.getByLabel("Base URL").fill("https://another-provider.example.com");
  await page.getByRole("button", { name: "Test provider" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("API key for this endpoint");
  expect(tests).toBe(0);
  await page.reload();
  await expect(page.getByPlaceholder("A key is saved for this tab")).toBeVisible();
});

test("a tab without the selected personal key does not send to the server default", async ({ page, context }) => {
  await page.goto("/settings/api");
  await page.getByText("My API key", { exact: true }).click();
  await page.getByLabel("API Key", { exact: true }).fill("synthetic-tab-key");
  await page.getByRole("button", { name: "Save for this browser", exact: true }).click();
  await expect(page.getByText("Connection saved for this browser.", { exact: true })).toBeVisible();
  const other = await context.newPage();
  let requests = 0;
  await other.route("**/api/chat", route => {
    requests++;
    return route.fulfill({ contentType: "text/plain", body: answer });
  });
  await other.goto("/chat");
  const input = other.getByTestId("chat-input");
  await input.fill("Keep this draft until I supply the key.");
  await other.getByTestId("send-message").click();
  await expect(other.getByRole("link", { name: "Open API Settings" })).toBeVisible();
  await expect(input).toHaveValue("Keep this draft until I supply the key.");
  expect(requests).toBe(0);
});

test("the library recovers from a failed load and searches across title and topic", async ({ page }) => {
  const registered = await page.request.post("/api/auth/register", {
    data: { name: "Search library", email: `search-${crypto.randomUUID()}@example.com`, password: "Physics123" },
  });
  expect(registered.ok()).toBe(true);
  const { user } = await registered.json();
  let fail = true;
  await page.route("**/api/knowledge/documents", route => fail
    ? route.fulfill({ status: 503, json: { error: "Materials are temporarily unavailable." } })
    : route.fulfill({ json: { documents: [
      { id: "a", userId: user.id, fileName: "傅里叶笔记.md", topic: "Wave equations", size: 712, indexStatus: "indexed", chunkCount: 2, createdAt: Date.now() },
      { id: "b", userId: user.id, fileName: "Thermal equilibrium.md", size: 212, indexStatus: "stored-only", chunkCount: 0, createdAt: Date.now() },
    ] } }));
  await page.goto("/knowledge-base");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Materials are temporarily unavailable.");
  await expect(page.getByText("No materials yet", { exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Retry loading materials" }).click();
  await expect(page.getByRole("heading", { name: "傅里叶笔记.md" })).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search materials" });
  await search.fill("傅里叶 wave");
  await expect(page.getByText("1 of 2 materials", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Thermal equilibrium.md" })).toHaveCount(0);
  await search.fill("no results");
  await expect(page.getByRole("heading", { name: "No matching materials" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("heading", { name: "Thermal equilibrium.md" })).toBeVisible();
});

test("a rejected sign-out keeps the library available and shows the reason", async ({ page }) => {
  const registered = await page.request.post("/api/auth/register", {
    data: { name: "Logout test", email: `logout-${crypto.randomUUID()}@example.com`, password: "Physics123" },
  });
  expect(registered.ok()).toBe(true);
  await page.route("**/api/auth/logout", route => route.fulfill({ status: 503, json: { error: "Sign-out is temporarily unavailable." } }));
  await page.goto("/knowledge-base");
  await expect(page.getByRole("button", { name: "Add material" })).toBeVisible();
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Sign-out is temporarily unavailable.");
  await expect(page.getByRole("button", { name: "Add material" })).toBeVisible();
  expect((await (await page.request.get("/api/auth/me")).json()).user.name).toBe("Logout test");
});
