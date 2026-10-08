import sharp from "sharp";
import { expect, test, type Page } from "./fixtures";

async function photo() {
  return { name: "synthetic-diagram.png", mimeType: "image/png", buffer: await sharp({ create: { width: 80, height: 60, channels: 3, background: "white" } }).png().toBuffer() };
}
async function register(page: Page, label: string) {
  const response = await page.request.post("/api/auth/register", { data: { name: label, email: `${label}-${crypto.randomUUID()}@example.com`, password: "Physics123" } });
  expect(response.ok()).toBe(true);
  const { user } = await response.json();
  await page.evaluate(() => window.dispatchEvent(new Event("pla:auth-changed")));
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("pla.workspace.identity.v2") ?? "{}").ownerId)).toBe(user.id);
  await expect(page.getByTestId("chat-input")).toBeVisible();
  return user;
}

test("images survive refresh and stay in the context of follow-up questions", async ({ page }) => {
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/chat", async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ contentType: "text/plain", body: "Mock image explanation.\n[[PLA_STREAM_EVENT:done]]\n" });
  });
  await page.goto("/chat");
  await page.getByTestId("image-upload").setInputFiles(await photo());
  await expect(page.getByRole("button", { name: "Remove image: synthetic-diagram.png" })).toBeVisible();
  await page.getByTestId("chat-input").fill("解释图中的坐标与单位");
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("Mock image explanation");
  expect(requests[0].model).toBe("deepseek-flash");
  expect(requests[0].images).toHaveLength(1);
  expect(JSON.stringify(requests[0])).not.toContain("data:image");
  await page.reload();
  const image = page.getByTestId("user-message").locator("img");
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(80);
  await page.getByTestId("chat-input").fill("继续解释纵轴");
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toHaveCount(2);
  expect(JSON.stringify(requests[1].history)).toContain("synthetic-diagram.png");
});

test("pasted screenshots can be removed and image-only questions can be sent", async ({ page }) => {
  await page.route("**/api/chat", route => route.fulfill({ contentType: "text/plain", body: "Mock picture answer.\n[[PLA_STREAM_EVENT:done]]\n" }));
  await page.goto("/chat");
  const fixture = await photo();
  await page.getByTestId("chat-input").evaluate((element, data) => {
    const bytes = Uint8Array.from(atob(data), character => character.charCodeAt(0));
    const clipboard = new DataTransfer();
    clipboard.items.add(new File([bytes], "pasted.png", { type: "image/png" }));
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: clipboard }));
  }, fixture.buffer.toString("base64"));
  await page.getByRole("button", { name: "Remove image: pasted.png" }).click();
  await expect(page.getByTestId("send-message")).toBeDisabled();
  await page.getByTestId("image-upload").setInputFiles(fixture);
  await expect(page.getByTestId("send-message")).toBeEnabled();
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("Mock picture answer");
  await expect(page.getByTestId("user-message").locator("img")).toBeVisible();
});

test("a late upload cannot attach to a new conversation", async ({ page }) => {
  await page.goto("/chat");
  let intercepted = false;
  let release!: () => void;
  await page.route("**/api/images", async route => {
    if (route.request().method() !== "POST") { await route.continue(); return; }
    intercepted = true;
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { image: { id: "image-00000000-0000-4000-8000-000000000001", name: "late.png", mimeType: "image/webp", size: 100, width: 80, height: 60 } } }).catch(() => undefined);
  });
  await page.getByTestId("image-upload").setInputFiles(await photo());
  await expect.poll(() => intercepted).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("pla:new-session")));
  release();
  await expect(page.getByRole("button", { name: "Attach images" })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Remove image:/ })).toHaveCount(0);
  await expect(page.getByTestId("send-message")).toBeDisabled();
});

test("guest images require explicit import and remain inaccessible to another account", async ({ page }) => {
  await page.route("**/api/chat", route => route.fulfill({ contentType: "text/plain", body: "Mock private picture answer.\n[[PLA_STREAM_EVENT:done]]\n" }));
  await page.goto("/chat");
  await page.getByTestId("image-upload").setInputFiles(await photo());
  await expect(page.getByTestId("send-message")).toBeEnabled();
  await page.getByTestId("send-message").click();
  const original = await page.getByTestId("user-message").locator("img").getAttribute("src");
  await register(page, "picture-account-a");
  await expect(page.getByTestId("user-message")).toHaveCount(0);
  expect((await page.request.get(original!)).status()).toBe(404);
  await page.getByRole("button", { name: "Import into this account", exact: true }).click();
  await expect(page.getByTestId("user-message").locator("img")).toBeVisible();
  const imported = await page.getByTestId("user-message").locator("img").getAttribute("src");
  expect(imported).not.toBe(original);
  expect((await page.request.get(imported!)).status()).toBe(200);
  await page.request.post("/api/auth/logout");
  await page.evaluate(() => window.dispatchEvent(new Event("pla:auth-changed")));
  await register(page, "picture-account-b");
  await page.getByRole("button", { name: "Keep separate", exact: true }).click();
  await expect(page.getByTestId("user-message")).toHaveCount(0);
  expect((await page.request.get(imported!)).status()).toBe(404);
  expect((await page.request.get(original!)).status()).toBe(404);
});

test("image-based practice resumes after refresh and carries its image into chat", async ({ page }) => {
  const requests: { images?: unknown[]; practiceTask: { setId: string; resumeContent?: string } }[] = [];
  await page.route("**/api/chat", async route => {
    const body = route.request().postDataJSON(); requests.push(body);
    const count = body.practiceTask.resumeContent ? 3 : 1;
    const content = Array.from({ length: count }, (_, offset) => {
      const index = offset + 1;
      return `### Problem ${index}\n<!-- pla:problem-id ${body.practiceTask.setId}:problem:${index} -->\n**Training goal**: Use a new diagram parameter.\n**Conditions**: A length a equals ${index} m.\n**Problem**: Find twice this length.\n**Topics**: Length\n**Difficulty**: Basic\n**Hint**: Double the value.\n**Solution**: Evaluate 2a.\n**Answer**: ${index * 2} m.`;
    }).join("\n\n");
    await route.fulfill({ contentType: "text/plain", body: content + (count === 3 ? "\n[[PLA_STREAM_EVENT:done]]\n" : "\n[[PLA_STREAM_EVENT:interrupted]]\n") });
  });
  await page.goto("/practice");
  await page.getByTestId("course-selector").selectOption("general-physics");
  await page.getByRole("combobox", { name: "Count", exact: true }).selectOption("3");
  await page.getByTestId("image-upload").setInputFiles(await photo());
  await expect(page.getByTestId("generator-submit")).toBeEnabled();
  await page.getByTestId("generator-submit").click();
  await expect(page.getByRole("button", { name: "Continue generation", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Continue generation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ask about this problem" })).toHaveCount(3);
  expect(requests[0].images).toHaveLength(1); expect(requests[1].images).toEqual(requests[0].images);
  await page.getByRole("button", { name: "Ask about this problem" }).first().click();
  await expect(page).toHaveURL(/\/chat\?sessionId=/);
  await page.getByText("View source content", { exact: true }).click();
  await expect(page.getByTestId("message-images").locator("img")).toBeVisible();
});

test("the five compact pages fit the viewport and keep optional controls accessible", async ({ page }, testInfo) => {
  const pages = ["/chat", "/map", "/practice", "/knowledge-base", "/settings/api"];
  for (const path of pages) {
    await page.goto(path);
    await expect(page.getByRole("status").filter({ hasText: "Loading workspace" })).toHaveCount(0);
    if (path === "/chat") await expect(page.getByTestId("chat-input")).toBeVisible();
    else await expect(page.locator("h1")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    if (path === "/map") await expect(page.locator(".katex").first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`ui-${path.replaceAll("/", "-").slice(1)}.png`) });
  }
  await page.getByLabel("Enable", { exact: true }).check();
  await expect(page.getByRole("combobox", { name: "Provider", exact: true })).toHaveValue("deepseek");
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("deepseek-flash");
  await page.getByText("Workspace data", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Export workspace", exact: true })).toBeVisible();
});
