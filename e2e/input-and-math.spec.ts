import { expect, test } from "./fixtures";

test("composition confirmation and Shift Enter preserve the draft", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/chat", route => { requests++; return route.fulfill({ contentType: "text/plain", body: "Result.\n[[PLA_STREAM_EVENT:done]]\n" }); });
  await page.goto("/chat");
  const input = page.getByTestId("chat-input");
  await input.fill("中文问题");
  await input.dispatchEvent("compositionstart");
  await input.dispatchEvent("keydown", {key:"Enter",code:"Enter",isComposing:true,keyCode:229,bubbles:true});
  await input.dispatchEvent("compositionend");
  expect(requests).toBe(0);
  await expect(input).toHaveValue("中文问题");
  await input.press("Shift+Enter");
  expect(requests).toBe(0);
  await input.press("Enter");
  await expect.poll(() => requests).toBe(1);
});

test("tagged display math and GFM tables render on a narrow viewport", async ({ page }) => {
  await page.route("**/api/chat", route => route.fulfill({ contentType:"text/plain", body: "$$\nE=mc^2 \\tag{1}\n$$\n\n| Symbol | Meaning |\n| --- | --- |\n| $E$ | Energy |\n\nFollowing explanation.\n[[PLA_STREAM_EVENT:done]]\n" }));
  await page.goto("/chat");
  await page.getByTestId("chat-input").fill("Explain the symbols");
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message").locator("table")).toBeVisible();
  await expect(page.getByTestId("assistant-message").locator(".katex-display")).toBeVisible();
  await expect(page.getByTestId("assistant-message")).toContainText("Following explanation.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
