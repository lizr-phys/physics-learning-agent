import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { openProviderEventStream, streamDeepSeek } from "@/lib/deepseek";
import { readAgentStream } from "@/lib/read-agent-stream";
import type { ClientProviderKind } from "@/types/learning";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const request = (type: ClientProviderKind) => ({
  message: "Explain Newton's law.", intent: "physics_learning" as const,
  clientProvider: { type, provider: type === "anthropic" ? "anthropic" as const : "gemini" as const, apiKey: "mock-provider-key", model: "mock-model" },
  conversationId: "session", assistantMessageId: "message", requestId: "request",
});

describe("provider transport regressions", () => {
  it.each(["anthropic", "gemini"] as const)("keeps %s partial output and rejects unexpected EOF", async (type) => {
    const event = type === "anthropic"
      ? { type: "content_block_delta", delta: { type: "text_delta", text: "Partial explanation" } }
      : { candidates: [{ content: { parts: [{ text: "Partial explanation" }] } }] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`data: ${JSON.stringify(event)}\n\n`)));
    const stream = await streamDeepSeek(request(type));
    await expect(readAgentStream(new Response(stream, { headers: { "Content-Type": "text/event-stream" } }), () => undefined))
      .rejects.toMatchObject({ reason: "incomplete", partialContent: "Partial explanation" });
  });

  it("does not swallow an Anthropic error event after partial text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response([
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Partial explanation"}}\n\n',
      'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Secret raw upstream content"}}\n\n',
    ].join(""))));
    const stream = await streamDeepSeek(request("anthropic"));
    await expect(readAgentStream(new Response(stream, { headers: { "Content-Type": "text/event-stream" } }), () => undefined))
      .rejects.toMatchObject({ reason: "network", partialContent: "Partial explanation" });
  });

  it("includes connection establishment in the provider total time budget", async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    vi.stubGlobal("fetch", vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      return new Response(new ReadableStream<Uint8Array>({ start() {} }));
    }));
    const opening = openProviderEventStream(request("anthropic"), undefined, { totalTimeoutMs: 50, idleTimeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(20);
    const provider = await opening;
    const reading = provider.next();
    await vi.advanceTimersByTimeAsync(30);
    await expect(reading).resolves.toMatchObject({ done: false, value: { type: "interrupted", reason: "total_timeout" } });
    await provider.return(undefined);
  });
});
