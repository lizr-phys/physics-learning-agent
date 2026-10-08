import { describe, expect, it } from "vitest";

import { AgentStreamError, readAgentStream } from "@/lib/read-agent-stream";
import { encodeGenerationEvent, type GenerationBinding, type GenerationPayload } from "@/lib/generation-stream";

const binding: GenerationBinding = { ownerId: "account-a", authEpoch: "epoch-a", sessionId: "session-a", messageId: "assistant-a", requestId: "request-a" };
const event = (payload: GenerationPayload, target = binding) => encodeGenerationEvent({ ...target, ...payload });

function responseFromChunks(chunks: string[], contentType = "text/event-stream") {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": contentType } },
  );
}

describe("readAgentStream", () => {
  it.each(["**A complete conclusion**", "An answer about C++", "https://example.com/", "```text\n$$\n```"])("accepts completed prose ending in %s", async content => {
    await expect(readAgentStream(responseFromChunks([event({type:"delta",seq:1,text:content}),event({type:"complete",finishReason:"stop"})]),()=>undefined)).resolves.toBe(content);
  });
  it("assembles fragmented text and stream-control events", async () => {
    const updates: string[] = [];
    const raw = event({ type: "delta", seq: 1, text: "第一段 [[PLA_STREAM_EVENT:done]]" }) + event({ type: "complete", finishReason: "stop" });
    const response = responseFromChunks([raw.slice(0, 30), raw.slice(30, 80), raw.slice(80)]);

    await expect(
      readAgentStream(response, (content) => updates.push(content)),
    ).resolves.toBe("第一段 [[PLA_STREAM_EVENT:done]]");
    expect(updates.at(-1)).toBe("第一段 [[PLA_STREAM_EVENT:done]]");
  });

  it("preserves partial content when the upstream stream ends abnormally", async () => {
    const response = responseFromChunks([
      event({ type: "delta", seq: 1, text: "已生成内容" }),
      event({ type: "interrupted", reason: "provider_error", retryable: true }),
    ]);

    await expect(readAgentStream(response, () => undefined)).rejects.toMatchObject({
      reason: "network",
      partialContent: "已生成内容",
    } satisfies Partial<AgentStreamError>);
  });

  it.each(["ownerId", "authEpoch", "sessionId", "messageId", "requestId"] as const)("rejects output bound to a different %s", async key => {
    const updates: string[] = [];
    await expect(readAgentStream(responseFromChunks([event({ type: "delta", seq: 1, text: "Private stale output" }, { ...binding, [key]: "old" })]), text => updates.push(text), { expectedBinding: binding }))
      .rejects.toMatchObject({ reason: "abort", partialContent: "" });
    expect(updates.join("")).toBe("");
  });

  it.each([
    [{ type: "truncated", reason: "output_limit", retryable: true }, "length"],
    [{ type: "cancelled", reason: "user_cancelled" }, "abort"],
    [{ type: "interrupted", reason: "provider_blocked", retryable: false }, "blocked"],
  ] as const)("preserves text for %j", async (terminal, reason) => {
    await expect(readAgentStream(responseFromChunks([event({ type: "delta", seq: 1, text: "Partial" }), event(terminal)]), () => undefined))
      .rejects.toMatchObject({ reason, partialContent: "Partial" });
  });

  it("deduplicates repeated sequences and flags missing output", async () => {
    const first = event({ type: "delta", seq: 1, text: "A" });
    await expect(readAgentStream(responseFromChunks([first, first, event({ type: "delta", seq: 3, text: "C" }), event({ type: "complete", finishReason: "stop" })]), () => undefined))
      .rejects.toMatchObject({ reason: "incomplete", partialContent: "AC" });
  });

  it("keeps text around a malformed event and reports possible data loss", async () => {
    await expect(readAgentStream(responseFromChunks([event({ type: "delta", seq: 1, text: "Before " }), "event: delta\ndata: broken JSON\n\n", event({ type: "delta", seq: 2, text: "after" }), event({ type: "complete", finishReason: "stop" })]), () => undefined))
      .rejects.toMatchObject({ reason: "incomplete", partialContent: "Before after" });
  });

  it("rejects EOF without a final event", async () => {
    await expect(readAgentStream(responseFromChunks([event({ type: "delta", seq: 1, text: "Partial" })]), () => undefined))
      .rejects.toMatchObject({ reason: "incomplete", partialContent: "Partial" });
  });

  it("confines marker compatibility to explicit legacy text/plain", async () => {
    await expect(readAgentStream(responseFromChunks(["Legacy\n[[PLA_STREAM_EVENT:done]]\n"], "text/plain"), () => undefined)).resolves.toBe("Legacy\n");
    await expect(readAgentStream(responseFromChunks(["Legacy\n[[PLA_STREAM_EVENT:done]]\n"], "application/octet-stream"), () => undefined)).rejects.toMatchObject({ reason: "network" });
  });

  it("cancels a stalled reader immediately and keeps its partial output", async () => {
    const stop = new AbortController();
    const response = new Response(new ReadableStream<Uint8Array>({ start(output) { output.enqueue(new TextEncoder().encode(event({ type: "delta", seq: 1, text: "Partial" }))); } }), { headers: { "Content-Type": "text/event-stream" } });
    await expect(readAgentStream(response, () => stop.abort(), { signal: stop.signal, throttleMs: 0, idleTimeoutMs: 1000 }))
      .rejects.toMatchObject({ reason: "abort", partialContent: "Partial" });
  });
});
