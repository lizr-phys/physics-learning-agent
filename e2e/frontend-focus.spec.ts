import { expect, test } from "./fixtures";

test("conversation history is contextual and Chat restores the current conversation", async ({ page }) => {
  await page.route("**/api/chat", route => route.fulfill({ contentType: "text/plain", body: "Retained synthetic answer.\n[[PLA_STREAM_EVENT:done]]\n" }));
  await page.goto("/chat");
  await page.getByTestId("chat-input").fill("A retained question");
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("Retained synthetic answer");
  await page.goto("/map");
  await expect(page.getByTestId("new-session")).toHaveCount(0);
  if ((page.viewportSize()?.width ?? 0) < 768) await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  const navigation = page.getByRole("navigation", { name: "Workspaces", exact: true });
  await expect(navigation.getByRole("link")).toHaveCount(4);
  await expect(navigation.getByRole("link", { name: "API Settings", exact: true })).toHaveCount(0);
  await navigation.getByRole("link", { name: "Chat", exact: true }).click();
  await expect(page.getByTestId("assistant-message")).toContainText("Retained synthetic answer");
});

test("chat options preserve the draft and reading space and dismiss with Escape", async ({ page }) => {
  await page.goto("/chat");
  const input = page.getByTestId("chat-input");
  await input.fill("My retained draft");
  const note = await page.getByText("Check important results against your course materials.", { exact: true }).boundingBox();
  const saveState = await page.getByTestId("workspace-save-state").boundingBox();
  expect(note!.y + note!.height).toBeLessThanOrEqual(saveState!.y);
  const before = await input.boundingBox();
  await expect(page.getByText("Material scope", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Chat options", exact: true }).click();
  await page.getByRole("combobox", { name: "Answer depth", exact: true }).selectOption("concise");
  await page.getByText("Material scope", { exact: true }).click();
  await page.getByLabel("Current course only").check();
  await page.screenshot({ path: test.info().outputPath("chat-options.png") });
  const after = await input.boundingBox();
  expect(after?.y).toBe(before?.y);
  expect(after?.height).toBe(before?.height);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("group", { name: "Chat options", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Chat options", exact: true })).toBeFocused();
  await expect(input).toHaveValue("My retained draft");
  await page.getByRole("button", { name: "Chat options", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Answer depth", exact: true })).toHaveValue("concise");
});

test("the library starts with saved materials and document upload has protected focus", async ({ page }, testInfo) => {
  expect((await page.request.post("/api/auth/register", { data: { name: "Library UI", email: `library-ui-${crypto.randomUUID()}@example.com`, password: "Physics123" } })).ok()).toBe(true);
  await page.goto("/knowledge-base");
  const add = page.getByRole("button", { name: "Add material", exact: true });
  await expect(add).toBeVisible();
  await expect(page.getByTestId("photo-problem-capture")).toHaveCount(0);
  await add.click();
  const dialog = page.getByRole("dialog", { name: "Add material", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByText("Document", { exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("document-panel.png") });
  await dialog.getByLabel("File", { exact: true }).setInputFiles({ name: "synthetic-focused-note.md", mimeType: "text/markdown", buffer: Buffer.from("# Boundary conditions\n\nA wave function must satisfy the supplied boundary conditions.") });
  await dialog.getByRole("button", { name: "Upload and index", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(add).toBeFocused();
  await expect(page.getByRole("heading", { name: "synthetic-focused-note.md", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("library-overview.png") });
  await page.getByRole("button", { name: "Actions for synthetic-focused-note.md", exact: true }).click();
  const reindex = page.waitForResponse(response => response.request().method() === "PATCH" && response.url().includes("/api/knowledge/documents/"));
  await page.getByRole("button", { name: "Reindex", exact: true }).click();
  expect((await reindex).ok()).toBe(true);
  await add.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Add material", exact: true })).toHaveCount(0);
  await expect(add).toBeFocused();
});

test("connection choices show one form and retain separate server and BYOK status", async ({ page }, testInfo) => {
  const config = { configured: true, baseUrl: "https://api.deepseek.com", model: "deepseek-flash", thinkingMode: "disabled", timeoutMs: 120000, streaming: true };
  let modelCalls = 0;
  await page.route("**/api/deepseek/test**", route => {
    const custom = route.request().method() === "POST";
    if (custom) modelCalls++;
    return route.fulfill({ json: { ok: true, status: custom ? "custom-ok" : "server-ok", message: custom ? "My provider connection passed." : "Server connection ready.", config } });
  });
  await page.goto("/settings/api");
  await expect(page.getByRole("combobox", { name: "Server model preference", exact: true })).toBeVisible();
  await expect(page.getByLabel("API Key", { exact: true })).toHaveCount(0);
  await page.getByText("My API key", { exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Server model preference", exact: true })).toHaveCount(0);
  await page.getByLabel("API Key", { exact: true }).fill("synthetic-ui-test-key");
  await page.getByRole("button", { name: "Save for this browser", exact: true }).click();
  expect(modelCalls).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("my-key-settings.png") });
  await page.getByRole("button", { name: "Test provider", exact: true }).click();
  await expect(page.getByText("My provider connection passed.", { exact: true })).toBeVisible();
  await page.getByText("Server default", { exact: true }).click();
  await expect(page.getByText("Server connection ready.", { exact: true })).toBeVisible();
  await expect(page.getByText("My provider connection passed.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Server model preference", exact: true })).toBeVisible();
});
