import { createHash } from "node:crypto";
import { expect, test } from "./fixtures";

test("document selection reaches the request and citations open the real saved excerpt", async ({page}, testInfo) => {
  const registered = await page.request.post("/api/auth/register", {data:{name:"Source Student",email:`source-${testInfo.project.name}-${Date.now()}@example.com`,password:"Physics123"}});
  expect(registered.ok()).toBe(true);
  const {user} = await registered.json();
  const text = "# Normalization\n\nAssume a normalizable state on the real line. The total probability is one.";
  const upload = await page.request.post("/api/knowledge/documents", {multipart:{file:{name:"normalization-notes.md",mimeType:"text/markdown",buffer:Buffer.from(text)},course:"quantum-mechanics"}});
  expect(upload.ok()).toBe(true);
  const {document} = await upload.json();
  const sourceId = `${document.id}:${createHash("sha256").update(text).digest("hex").slice(0,32)}:0`;
  const sourceResponse = await page.request.get(`/api/knowledge/sources/${encodeURIComponent(sourceId)}`);
  expect(sourceResponse.ok()).toBe(true);
  const {source} = await sourceResponse.json();
  expect(source.content).toBe(text);
  let selected: unknown;
  await page.route("**/api/chat", async route => {
    const request = route.request().postDataJSON(); selected = request.knowledgeDocumentIds;
    const binding = {ownerId:user.id,authEpoch:request.authEpoch,sessionId:request.conversationId,messageId:request.assistantMessageId,requestId:request.requestId};
    const event = (value: Record<string, unknown> & {type:string}) => `event: ${value.type}\ndata: ${JSON.stringify({...binding,...value})}\n\n`;
    await route.fulfill({contentType:"text/event-stream",body:event({type:"sources",status:"retrieved",sources:[source]})+event({type:"delta",seq:1,text:"A normalizable state has total probability one [1]."})+event({type:"complete",finishReason:"stop"})});
  });
  await page.goto("/chat");
  await page.getByText("Material scope", {exact:true}).click();
  await page.getByLabel("normalization-notes.md").check();
  await page.getByTestId("chat-input").fill("Use these notes to explain normalization");
  await page.getByTestId("send-message").click();
  await expect(page.getByRole("button",{name:"View source 1"})).toBeVisible();
  expect(selected).toEqual([document.id]);
  await page.getByRole("button",{name:"View source 1"}).click();
  await expect(page.getByTestId("source-inspector").locator("pre")).toHaveText(text);
  await expect(page.getByText("Source is available in your library.")).toBeVisible();
  await expect.poll(async () => {
    const {data} = await (await page.request.get("/api/user-data")).json();
    return data.sessions.flatMap((session: {messages: {sources?:{sourceId:string}[]}[]}) => session.messages).some((message: {sources?:{sourceId:string}[]}) => message.sources?.[0]?.sourceId === sourceId);
  }).toBe(true);
  await page.reload();
  await page.getByRole("button",{name:"View source 1"}).click();
  await expect(page.getByTestId("source-inspector").locator("pre")).toHaveText(text);
  expect((await page.request.delete(`/api/knowledge/documents/${document.id}`)).ok()).toBe(true);
  await page.reload();
  await page.getByRole("button",{name:"View source 1"}).click();
  await expect(page.getByText("The source is no longer accessible. The excerpt used for this answer is preserved below.")).toBeVisible();
});

test("long answers retain inner scrolling, wide math and keyboard recovery across viewports", async ({page}, testInfo) => {
  const formula = `$$\n${Array.from({length:28},(_, i) => `x_{${i}}^2`).join("+")} = E \\tag{1}\n$$`;
  const answer = `## Assumptions\n\n${formula}\n\n| Quantity | Meaning |\n| --- | --- |\n| $E$ | Energy |\n\n${Array.from({length:24},(_,i)=>`Paragraph ${i+1}: the conditions and notation remain visible when the answer grows.\n\n`).join("")}`;
  await page.route("**/api/chat", async route => {
    const request = route.request().postDataJSON();
    const binding = {ownerId:"guest",authEpoch:request.authEpoch,sessionId:request.conversationId,messageId:request.assistantMessageId,requestId:request.requestId};
    await route.fulfill({contentType:"text/event-stream",body:`event: delta\ndata: ${JSON.stringify({...binding,type:"delta",seq:1,text:answer})}\n\nevent: complete\ndata: ${JSON.stringify({...binding,type:"complete",finishReason:"stop"})}\n\n`});
  });
  await page.goto("/chat");
  await page.getByTestId("chat-input").fill("Derive a long expression");
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("Paragraph 24");
  await expect(page.getByTestId("stop-generation")).toHaveCount(0);
  for (const [width,height] of [[360,640],[390,844],[768,500],[1024,768],[1280,900]]) {
    await page.setViewportSize({width,height});
    const bounds = await page.getByTestId("chat-input").boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.getByTestId("chat-scroll-area").evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByTestId("chat-scroll-area").evaluate(element => {element.scrollTop=0;});
  const math = page.locator(".katex-display").first();
  expect(await math.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.getByLabel("Open sidebar").click();
  await expect(page.getByRole("dialog",{name:"Navigation"})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog",{name:"Navigation"})).toHaveCount(0);
  await expect(page.getByLabel("Open sidebar")).toBeFocused();
  // Closing the drawer restores header focus; explicitly resume reading in
  // the scroll region before measuring the floating recovery control.
  await page.getByTestId("chat-scroll-area").evaluate(element => {element.scrollTop=0; element.dispatchEvent(new Event("scroll"));});
  await expect(page.getByRole("button",{name:"Back to bottom"})).toBeVisible();
  const back = await page.getByRole("button",{name:"Back to bottom"}).boundingBox();
  const input = await page.getByTestId("chat-input").boundingBox();
  expect(back!.y + back!.height).toBeLessThan(input!.y);
  await page.screenshot({path:testInfo.outputPath("mobile-chat.png")});
  await page.setViewportSize({width:1280,height:900});
  await page.screenshot({path:testInfo.outputPath("desktop-chat.png")});
});

test("stream checkpoints save less often than rendering and survive refresh", async ({page}) => {
  await page.addInitScript(() => {
    const originalSet = Storage.prototype.setItem;
    const counter = window as unknown as {checkpointWrites:number}; counter.checkpointWrites=0;
    Storage.prototype.setItem = function(key, value) { originalSet.call(this,key,value); if(this === localStorage && key.endsWith(".pla.chat.sessions.v1")) counter.checkpointWrites++; };
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (String(input) !== "/api/chat") return originalFetch(input,init);
      const request = JSON.parse(String(init?.body));
      const binding = {ownerId:"guest",authEpoch:request.authEpoch,sessionId:request.conversationId,messageId:request.assistantMessageId,requestId:request.requestId};
      const encoder = new TextEncoder(); let timer = 0;
      return Promise.resolve(new Response(new ReadableStream({
        start(controller) {
          let part = 0;
          timer = window.setInterval(() => {
            part++;
            if (part <= 30) controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({...binding,type:"delta",seq:part,text:`Part ${part}. `})}\n\n`));
            else {window.clearInterval(timer);controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify({...binding,type:"complete",finishReason:"stop"})}\n\n`));controller.close();}
          },70);
        },cancel(){window.clearInterval(timer);},
      }),{headers:{"Content-Type":"text/event-stream"}}));
    };
  });
  await page.goto("/chat");
  await page.getByTestId("chat-input").fill("Explain a derivation");
  await page.getByTestId("send-message").click();
  await expect(page.getByTestId("assistant-message")).toContainText("Part 30.");
  await expect(page.getByTestId("stop-generation")).toHaveCount(0);
  const writes = await page.evaluate(() => (window as unknown as {checkpointWrites:number}).checkpointWrites);
  expect(writes).toBeGreaterThanOrEqual(2);
  expect(writes).toBeLessThanOrEqual(6);
  await page.reload();
  await expect(page.getByTestId("assistant-message")).toContainText("Part 30.");
});
