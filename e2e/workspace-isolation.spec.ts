import { expect, test, type Page } from "./fixtures";

async function workspace(page: Page) {
  return page.evaluate(() => {
    const identity = JSON.parse(localStorage.getItem("pla.workspace.identity.v2") ?? '{"ownerId":null}');
    const prefix = `pla.workspace.${identity.ownerId ? encodeURIComponent(identity.ownerId) : "guest"}.`;
    return { owner: identity.ownerId, sessions: JSON.parse(localStorage.getItem(`${prefix}pla.chat.sessions.v1`) ?? "[]") };
  });
}
async function register(page: Page, label: string) {
  const response = await page.request.post("/api/auth/register", { data: { name: label, email: `${label}-${Date.now()}@example.com`, password: "Physics123" } });
  expect(response.ok()).toBe(true);
  const { user } = await response.json();
  await page.evaluate(() => window.dispatchEvent(new Event("pla:auth-changed")));
  await expect.poll(async () => (await workspace(page)).owner).toBe(user.id);
  await expect(page.getByTestId("chat-input")).toBeVisible();
  return user;
}

test("switching account cancels active generation and rejects its queued output", async ({page}) => {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (String(input) !== "/api/chat") return original(input, init);
      const encoder = new TextEncoder();
      return Promise.resolve(new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("Private account A partial. "));
          setTimeout(() => { try { controller.enqueue(encoder.encode("Private A late output.\n[[PLA_STREAM_EVENT:done]]\n")); controller.close(); } catch { /* Deliberately arrive after cancellation. */ } }, 900);
        },
      }), {headers:{"Content-Type":"text/plain"}}));
    };
  });
  await page.goto("/chat");
  await register(page, "stream-a");
  await page.getByTestId("chat-input").fill("Explain a private problem");
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("Private account A partial");
  await page.request.post("/api/auth/logout");
  await page.evaluate(() => window.dispatchEvent(new Event("pla:auth-changed")));
  await register(page, "stream-b");
  await page.waitForTimeout(1100);
  await expect(page.getByTestId("assistant-message")).toHaveCount(0);
  expect((await workspace(page)).sessions).toEqual([]);
});

test("guest import is explicit, account streams and delayed snapshots stay isolated across tabs", async ({ page, context }) => {
  await page.route("**/api/chat", route => route.fulfill({ contentType: "text/plain", body: "Account-specific response.\n[[PLA_STREAM_EVENT:done]]\n" }));
  await page.goto("/chat");
  await page.getByTestId("chat-input").fill("Anonymous physics question");
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("Account-specific");
  const a = await register(page, "account-a");
  await expect(page.getByText("Anonymous records are separate from this account.")).toBeVisible();
  expect((await workspace(page)).sessions).toEqual([]);
  await page.getByRole("button", {name:"Keep separate", exact:true}).click();
  await page.getByTestId("chat-input").fill("Account A private question");
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("Account-specific");
  await expect.poll(async () => {
    const response = await page.request.get("/api/user-data");
    const body = await response.json();
    return body.data.sessions.some((session: {title:string}) => session.title.includes("Account A"));
  }).toBe(true);
  const other = await context.newPage();
  await other.goto("/chat");
  await expect(other.getByTestId("assistant-message")).toContainText("Account-specific");
  await page.request.post("/api/auth/logout");
  await page.evaluate(() => window.dispatchEvent(new Event("pla:auth-changed")));
  await expect.poll(async () => (await workspace(page)).owner).toBe(null);
  await expect.poll(async () => (await workspace(other)).owner).toBe(null);
  const b = await register(page, "account-b");
  await page.getByRole("button", {name:"Keep separate", exact:true}).click();
  expect((await workspace(page)).sessions).toEqual([]);
  await expect.poll(async () => (await workspace(other)).owner).toBe(b.id);
  await expect(other.getByTestId("assistant-message")).toHaveCount(0);
  const replay = await page.request.put("/api/user-data", { headers: {"X-PLA-Workspace-Owner": a.id}, data: {revision:0, operationId:"stale-a", sessions:[], practiceHistory:[]} });
  expect(replay.status()).toBe(409);
  const serverB = await (await page.request.get("/api/user-data")).json();
  expect(serverB.data.sessions).toEqual([]);
});

test("late account GET cannot populate a different account workspace", async ({ page }) => {
  await page.goto("/chat");
  const a = await register(page, "late-a");
  let release: (() => void) | undefined;
  let intercepted = false;
  await page.route("**/api/user-data", async route => {
    if (route.request().method() === "GET" && route.request().headers()["x-pla-workspace-owner"] === a.id) {
      intercepted = true;
      await new Promise<void>(resolve => { release = resolve; });
      await route.fulfill({json:{data:{version:1, revision:0, sessions:[{id:"private-a",title:"Private A data",createdAt:1,updatedAt:1,messages:[],context:{course:"general",taskType:"qa"}}],practiceHistory:[]}}}).catch(() => undefined);
    } else await route.continue();
  });
  await page.evaluate(() => window.dispatchEvent(new Event("pla:auth-changed")));
  await expect.poll(() => intercepted).toBe(true);
  await page.request.post("/api/auth/logout");
  await page.evaluate(() => window.dispatchEvent(new Event("pla:auth-changed")));
  const b = await register(page, "late-b");
  release?.();
  await page.waitForTimeout(200);
  expect((await workspace(page)).owner).toBe(b.id);
  expect((await workspace(page)).sessions).toEqual([]);
  await expect(page.getByText("Private A data", {exact:true})).toHaveCount(0);
});
