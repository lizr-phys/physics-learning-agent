import sharp from "sharp";
import { expect, test, type Page } from "./fixtures";

async function controlMetrics(page: Page) {
  return Promise.all(["Attach images", "Take photo", "Chat options", "Send"].map(name => page.getByRole("button", { name, exact: true }).evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return { center: bounds.y + bounds.height / 2, height: bounds.height, fontSize: getComputedStyle(element).fontSize };
  })));
}

test("reading and control typography use the intended font roles", async ({ page }) => {
  const externalFontRequests: string[] = [];
  page.on("request", request => { if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) externalFontRequests.push(request.url()); });
  await page.route("**/api/chat", route => route.fulfill({ contentType: "text/plain", body: "## Boundary conditions\n\n先检查边界条件，再推导公式。 Keep the same symbols and units.\n\n$$E=\\frac{1}{2}mv^2$$\n[[PLA_STREAM_EVENT:done]]\n" }));
  await page.goto("/chat");
  await page.evaluate(() => document.fonts.ready);
  expect.soft(await page.locator("body").evaluate(element => getComputedStyle(element).fontFamily)).toMatch(/Geist/);
  expect.soft(await page.getByRole("button", { name: "Chat options", exact: true }).evaluate(element => getComputedStyle(element).fontSize)).toBe("14px");
  expect.soft(await page.getByTestId("chat-input").evaluate(element => getComputedStyle(element).fontSize)).toBe("16px");
  await page.getByTestId("chat-input").fill("Explain the boundary conditions / 解释边界条件");
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("先检查边界条件");
  expect(await page.getByTestId("assistant-message").locator(".markdown").evaluate(element => getComputedStyle(element).fontSize)).toBe("16px");
  const avatar = await page.getByTestId("assistant-message").locator(":scope > div").first().boundingBox();
  const heading = await page.getByRole("heading", { name: "Boundary conditions", exact: true }).boundingBox();
  expect(Math.abs(avatar!.y - heading!.y)).toBeLessThanOrEqual(1);
  expect(externalFontRequests).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("reading-typography.png") });
});

test("composer actions stay aligned before and after attaching an image", async ({ page }) => {
  await page.goto("/chat");
  for (const withImage of [false, true]) {
    if (withImage) {
      const buffer = await sharp({ create: { width: 80, height: 60, channels: 3, background: "white" } }).png().toBuffer();
      await page.getByTestId("image-upload").setInputFiles({ name: "synthetic-alignment.png", mimeType: "image/png", buffer });
      await expect(page.getByRole("button", { name: "Remove image: synthetic-alignment.png", exact: true })).toBeVisible();
    }
    const metrics = await controlMetrics(page);
    expect.soft(Math.max(...metrics.map(item => item.center)) - Math.min(...metrics.map(item => item.center))).toBeLessThanOrEqual(1);
    expect.soft(new Set(metrics.map(item => item.height)).size).toBe(1);
    expect.soft(metrics[0].fontSize).toBe(metrics[2].fontSize);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (withImage) await page.screenshot({ path: test.info().outputPath("composer-with-image.png") });
  }
});

test("interaction feedback respects reduced motion and preserves keyboard use", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/chat");
  await page.getByTestId("chat-input").fill("Retained while changing motion preferences");
  const options = page.getByRole("button", { name: "Chat options", exact: true });
  await options.click();
  const panel = page.getByRole("group", { name: "Chat options", exact: true });
  expect(await panel.evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  expect(await options.evaluate(element => getComputedStyle(element).transitionDuration)).toBe("0s");
  await page.keyboard.press("Escape");
  await expect(options).toBeFocused();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await options.click();
  expect(await panel.evaluate(element => getComputedStyle(element).animationName)).toBe("popover-enter");
  expect(await panel.evaluate(element => getComputedStyle(element).animationDuration)).toBe("0.14s");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("chat-input")).toHaveValue("Retained while changing motion preferences");
});

test("larger text keeps the composer usable on narrow and intermediate screens", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.getByTestId("chat-input")).toBeVisible();
  await page.addStyleTag({ content: "html { font-size: 125%; }" });
  await page.getByTestId("chat-input").fill("检查长公式和条件 / boundary conditions and notation");
  for (const width of [320, 393, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const send = await page.getByTestId("send-message").boundingBox();
    expect(send!.x + send!.width).toBeLessThanOrEqual(width);
    const metrics = await controlMetrics(page);
    expect(Math.max(...metrics.map(item => item.center)) - Math.min(...metrics.map(item => item.center))).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: "Chat options", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Answer depth", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 393, height: 800 });
  await page.screenshot({ path: test.info().outputPath("larger-text.png") });
});
