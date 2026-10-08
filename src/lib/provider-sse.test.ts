import { describe, expect, it } from "vitest";
import { ProviderSseParser, readProviderEvents, type ProviderEvent } from "@/lib/provider-sse";
import type { ClientProviderKind } from "@/types/learning";

const sse = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
const delta = (protocol: ClientProviderKind, text = "Partial text") => sse(protocol === "anthropic"
  ? { type: "content_block_delta", delta: { type: "text_delta", text } }
  : protocol === "gemini" ? { candidates: [{ content: { parts: [{ text }] } }] }
  : { choices: [{ delta: { content: text } }] });
const finish = (protocol: ClientProviderKind, reason = "normal") => protocol === "anthropic"
  ? sse({ type: "message_delta", delta: { stop_reason: reason === "normal" ? "end_turn" : reason } }) + sse({ type: "message_stop" })
  : protocol === "gemini" ? sse({ candidates: [{ finishReason: reason === "normal" ? "STOP" : reason }] })
  : sse({ choices: [{ finish_reason: reason === "normal" ? "stop" : reason }] }) + "data: [DONE]\n\n";
function parse(protocol: ClientProviderKind, raw: string) {
  const parser = new ProviderSseParser(protocol);
  const events: ProviderEvent[] = [];
  for (let index = 0; index < raw.length; index += 7) events.push(...parser.push(raw.slice(index, index + 7)));
  events.push(...parser.finish());
  expect(parser.finish()).toEqual([]);
  return events;
}
const terminal = (events: ProviderEvent[]) => events.filter(event => !["delta", "activity"].includes(event.type));

describe.each(["openai-compatible", "anthropic", "gemini"] as const)("%s stream protocol", protocol => {
  it("requires provider terminal evidence and emits it once", () => {
    const events = parse(protocol, delta(protocol) + finish(protocol));
    expect(events.filter(event => event.type === "delta")).toEqual([{ type: "delta", text: "Partial text" }]);
    expect(terminal(events)).toMatchObject([{ type: "complete" }]);
  });
  it("reports premature EOF while preserving text", () => {
    expect(terminal(parse(protocol, delta(protocol)))).toMatchObject([{ type: "interrupted", reason: "unexpected_eof" }]);
  });
  it("distinguishes output truncation", () => {
    const reason = protocol === "anthropic" ? "max_tokens" : protocol === "gemini" ? "MAX_TOKENS" : "length";
    expect(terminal(parse(protocol, delta(protocol) + finish(protocol, reason)))).toMatchObject([{ type: "truncated", reason: "output_limit" }]);
  });
  it("does not hide errors behind later completion or expose raw errors", () => {
    const events = parse(protocol, delta(protocol) + sse({ type: "error", error: { message: "private secret mock-provider-key" } }) + finish(protocol));
    expect(terminal(events)).toMatchObject([{ type: "interrupted", reason: "provider_error" }]);
    expect(JSON.stringify(events)).not.toContain("secret");
  });
  it("keeps deltas around malformed JSON while marking possible loss", () => {
    const events = parse(protocol, delta(protocol, "Before ") + "data: {bad JSON}\n\n" + delta(protocol, "after") + finish(protocol));
    expect(events.filter(event => event.type === "delta").map(event => event.text).join("")).toBe("Before after");
    expect(terminal(events)).toMatchObject([{ type: "interrupted", reason: "malformed_event" }]);
  });
  it("reports an incomplete trailing frame even after prior completion", () => {
    expect(terminal(parse(protocol, delta(protocol) + finish(protocol) + 'data: {"unfinished":'))).toMatchObject([{ type: "interrupted", reason: "incomplete_event" }]);
  });
  it("handles fragmented CRLF boundaries", () => {
    expect(terminal(parse(protocol, (delta(protocol) + finish(protocol)).replaceAll("\n", "\r\n")))).toMatchObject([{ type: "complete" }]);
  });
});

describe("provider activity and interruption", () => {
  it("hides private reasoning and keeps activity and usage", () => {
    const openai = parse("openai-compatible", sse({ choices: [{ delta: { reasoning_content: "private thinking" } }], usage: { prompt_tokens: 10, completion_tokens: 3 } }) + delta("openai-compatible") + finish("openai-compatible"));
    const gemini = parse("gemini", sse({ candidates: [{ content: { parts: [{ text: "private thinking", thought: true }] } }] }) + delta("gemini") + finish("gemini"));
    expect(JSON.stringify([...openai, ...gemini])).not.toContain("private thinking");
    expect(terminal(openai)).toMatchObject([{ usage: { inputTokens: 10, outputTokens: 3 } }]);
  });
  it("does not mark Gemini safety blocking as successful", () => {
    expect(terminal(parse("gemini", delta("gemini") + finish("gemini", "SAFETY")))).toMatchObject([{ type: "interrupted", reason: "provider_blocked", retryable: false }]);
  });
  it("requires Claude message_stop after message_delta", () => {
    expect(terminal(parse("anthropic", delta("anthropic") + sse({ type: "message_delta", delta: { stop_reason: "end_turn" } })))).toMatchObject([{ type: "interrupted", reason: "unexpected_eof" }]);
  });
  it("cancels an idle stream and releases its reader", async () => {
    const stop = new AbortController();
    const body = new ReadableStream<Uint8Array>({ start() { stop.abort(); } });
    const events = [];
    for await (const event of readProviderEvents(body, "gemini", { signal: stop.signal })) events.push(event);
    expect(events).toEqual([{ type: "cancelled", reason: "user_cancelled" }]);
    expect(body.locked).toBe(false);
  });
  it("classifies idle timeout without manufacturing completion", async () => {
    const body = new ReadableStream<Uint8Array>({ start() {} });
    const events = [];
    for await (const event of readProviderEvents(body, "anthropic", { idleTimeoutMs: 5 })) events.push(event);
    expect(events).toEqual([{ type: "interrupted", reason: "idle_timeout", retryable: true }]);
  });
});
