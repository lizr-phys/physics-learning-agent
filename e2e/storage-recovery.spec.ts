import { expect, test } from "./fixtures";

test("a full workspace keeps the draft and history while blocking unsavable generation", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("pla.workspace.guest.pla.chat.sessions.v1", JSON.stringify(Array.from({length:80}, (_, index) => ({
      id:`quota-${index}`, title:`Synthetic history ${index}`, createdAt:index+1, updatedAt:index+1,
      messages:[{id:`q-${index}`,role:"user",content:"Synthetic retained question"}],
      context:{course:"general",taskType:"qa"}, memory:{recentConfusions:[],coveredConcepts:[],exerciseTopics:[],preferredStyle:"balanced",updatedAt:0},
    }))));
  });
  let requests = 0;
  await page.route("**/api/chat", route => { requests++; return route.fulfill({status:500,json:{error:"Generation should not start"}}); });
  await page.goto("/chat");
  await page.getByTestId("chat-input").fill("Keep this unsent draft");
  await page.getByTestId("send-message").click();
  await expect(page.getByText(/Workspace limit reached \(80 conversations\)/).first()).toBeVisible();
  await expect(page.getByTestId("chat-input")).toHaveValue("Keep this unsent draft");
  await expect(page.getByTestId("stop-generation")).toHaveCount(0);
  expect(requests).toBe(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pla.workspace.guest.pla.chat.sessions.v1") ?? "[]").length)).toBe(80);
});

test("idle signed-in tabs do not keep replaying acknowledged snapshots", async ({ page, context }, testInfo) => {
  const registered = await page.request.post("/api/auth/register", {data:{name:"Idle sync",email:`idle-${testInfo.project.name}-${Date.now()}@example.com`,password:"Physics123"}});
  expect(registered.ok()).toBe(true);
  let saves = 0;
  await context.route("**/api/user-data", route => { if (route.request().method() === "PUT") saves++; return route.continue(); });
  await page.goto("/chat");
  await expect(page.getByTestId("chat-input")).toBeVisible();
  const other = await context.newPage();
  await other.goto("/chat");
  await expect(other.getByTestId("chat-input")).toBeVisible();
  await page.waitForTimeout(4500);
  const settled = saves;
  await page.waitForTimeout(2500);
  expect(saves).toBe(settled);
});

test("a peer's conversation changes preserve this tab's current conversation and typed draft", async ({ page, context }, testInfo) => {
  const registered = await page.request.post("/api/auth/register", {data:{name:"Independent tabs",email:`peer-${testInfo.project.name}-${Date.now()}@example.com`,password:"Physics123"}});
  expect(registered.ok()).toBe(true);
  let saves = 0;
  await context.route("**/api/user-data", route => { if (route.request().method() === "PUT") saves++; return route.continue(); });
  await context.route("**/api/chat", route => route.fulfill({contentType:"text/plain",body:"A retained synthetic answer.\n[[PLA_STREAM_EVENT:done]]\n"}));
  await page.goto("/chat");
  await page.getByTestId("chat-input").fill("Current tab question");
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("A retained synthetic answer");
  const other = await context.newPage();
  await other.goto("/chat");
  await expect(other.getByTestId("assistant-message")).toBeVisible();
  await page.getByTestId("chat-input").fill("Keep the current draft");
  await other.evaluate(() => window.dispatchEvent(new Event("pla:new-session")));
  await other.getByTestId("chat-input").fill("Peer tab question");
  await other.getByTestId("send-message").click();
  await expect(other.getByTestId("assistant-message")).toContainText("A retained synthetic answer");
  await expect(page.getByTestId("chat-input")).toHaveValue("Keep the current draft");
  await expect(page.getByTestId("chat-scroll-area")).toContainText("Current tab question");
  await expect(page.getByTestId("chat-scroll-area")).not.toContainText("Peer tab question");
  await page.waitForTimeout(4500);
  const settled = saves;
  await page.waitForTimeout(2000);
  expect(saves).toBe(settled);
  await expect(page.getByTestId("chat-input")).toHaveValue("Keep the current draft");
});
