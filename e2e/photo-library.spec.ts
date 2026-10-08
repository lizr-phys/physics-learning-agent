import sharp from "sharp";
import { expect, test } from "./fixtures";

test("exam photos are reviewed, indexed, reopened and carried into chat with strict account ownership", async ({ page, context }, testInfo) => {
  const account = await page.request.post("/api/auth/register", { data: { name: "Photo test", email: `photo-${crypto.randomUUID()}@example.com`, password: "Physics123" } });
  expect(account.ok()).toBe(true);
  await page.route("**/api/chat", route => route.fulfill({ contentType: "text/plain", body: "## Question\nFind the stored energy of a capacitor.\n\n## Given conditions\n$C=2\\,\\mu F$, $V=5\\,V$.\n\n## Topics\nCapacitor energy.\n\n## Unclear details\n[unreadable] marking near the switch.\n[[PLA_STREAM_EVENT:done]]\n" }));
  await page.goto("/knowledge-base");
  await expect(page.getByTestId("photo-problem-capture")).toBeVisible();
  await page.getByTestId("image-upload").setInputFiles({ name: "synthetic-exam.png", mimeType: "image/png", buffer: await sharp({ create: { width: 80, height: 60, channels: 3, background: "white" } }).png().toBuffer() });
  await page.getByRole("combobox", { name: "Problem category", exact: true }).selectOption("exam");
  await page.getByRole("textbox", { name: "Title", exact: true }).fill("Reviewed capacitor exam");
  await expect(page.getByTestId("recognize-photo")).toBeEnabled();
  await page.getByTestId("recognize-photo").click();
  await expect(page.getByTestId("photo-problem-text")).toHaveValue(/\[unreadable\]/);
  await expect(page.getByTestId("save-photo-problem")).toBeDisabled();
  await page.getByTestId("photo-problem-text").fill("## Question\nFind the stored energy of a capacitor.\n\n## Given conditions\n$C=2\\,\\mu F$, $V=5\\,V$.\n\n## Topics\nCapacitor energy.\n\n## Unclear details\nThe mark near the switch is not a given condition (checked by the user).");
  await page.getByRole("checkbox", { name: "I checked the question, conditions, symbols and unclear details." }).check();
  const savedResponse = page.waitForResponse(response => response.url().endsWith("/api/knowledge/problems") && response.request().method() === "POST");
  await page.getByTestId("save-photo-problem").click();
  const saved = await (await savedResponse).json();
  await expect(page.getByRole("heading", { name: "Reviewed capacitor exam", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Library category", exact: true }).selectOption("homework");
  await expect(page.getByRole("heading", { name: "Reviewed capacitor exam", exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Library category", exact: true }).selectOption("exam");
  await page.reload();
  await page.getByText("View photo problem", { exact: true }).click();
  await expect(page.getByText("The mark near the switch is not a given condition", { exact: false })).toBeVisible();
  await expect(page.locator(".katex").first()).toBeVisible();
  const photoId = saved.document.problem.images[0].id;
  expect((await page.request.delete(`/api/images/${photoId}`)).status()).toBe(409);
  await page.screenshot({ path: testInfo.outputPath("photo-library.png") });
  await page.getByRole("button", { name: "Ask about this photo problem", exact: true }).click();
  await expect(page).toHaveURL(/\/chat\?sessionId=/);
  await expect(page.getByText(/Context attached: Photo problem/)).toBeVisible();
  await page.getByText("View source content", { exact: true }).click();
  await expect(page.getByTestId("message-images").locator("img")).toBeVisible();
  const other = await context.browser()!.newContext({ baseURL: "http://localhost:3217", extraHTTPHeaders: { "x-forwarded-for": "198.18.100.22" } });
  try {
    const registration = await other.request.post("/api/auth/register", { data: { name: "Other photo test", email: `other-photo-${crypto.randomUUID()}@example.com`, password: "Physics123" } });
    expect(registration.ok()).toBe(true);
    expect((await other.request.get(`/api/knowledge/documents/${saved.document.id}`)).status()).toBe(404);
    expect((await other.request.get(`/api/images/${photoId}`)).status()).toBe(404);
  } finally { await other.close(); }
});

test("an interrupted photo transcription remains editable after refresh", async ({ page }) => {
  expect((await page.request.post("/api/auth/register", { data: { name: "Draft test", email: `draft-photo-${crypto.randomUUID()}@example.com`, password: "Physics123" } })).ok()).toBe(true);
  await page.route("**/api/chat", route => route.fulfill({ contentType: "text/plain", body: "## Question\nPartial photographed question with an unclear force value.\n[[PLA_STREAM_EVENT:interrupted]]\n" }));
  await page.goto("/knowledge-base");
  await page.getByTestId("image-upload").setInputFiles({ name: "synthetic-homework.png", mimeType: "image/png", buffer: await sharp({ create: { width: 40, height: 30, channels: 3, background: "white" } }).png().toBuffer() });
  await expect(page.getByTestId("recognize-photo")).toBeEnabled();
  await page.getByTestId("recognize-photo").click();
  await expect(page.getByTestId("photo-problem-text")).toHaveValue(/Partial photographed question/);
  await expect(page.getByTestId("photo-problem-text")).toBeEnabled();
  await page.getByTestId("photo-problem-text").fill("## Question\nMy checked transcription of the homework question, with all given conditions.");
  await page.goto("/map");
  await page.goto("/knowledge-base");
  await expect(page.getByTestId("photo-problem-text")).toHaveValue(/My checked transcription/);
  await expect(page.getByRole("button", { name: "Remove image: synthetic-homework.png" })).toBeVisible();
  await expect(page.getByTestId("save-photo-problem")).toBeDisabled();
});
