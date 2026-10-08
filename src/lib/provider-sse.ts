import { SseDecoder, type SseFrame } from "@/lib/sse";
import type { TokenUsage } from "@/lib/generation-stream";
import type { ClientProviderKind } from "@/types/learning";

export type ProviderEvent =
  | { type: "delta"; text: string }
  | { type: "activity" }
  | { type: "complete"; finishReason: string; usage?: TokenUsage }
  | { type: "truncated"; reason: string; retryable: boolean; usage?: TokenUsage }
  | { type: "interrupted"; reason: string; retryable: boolean; usage?: TokenUsage }
  | { type: "cancelled"; reason: string; usage?: TokenUsage };

type ProviderTerminal = Exclude<ProviderEvent, { type: "delta" | "activity" }>;
type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord => value && typeof value === "object" ? value as JsonRecord : {};
const text = (value: unknown) => typeof value === "string" ? value : "";
const token = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;

/** Pure parser: completion requires provider evidence; no raw payloads enter diagnostics. */
export class ProviderSseParser {
  private frames = new SseDecoder();
  private terminal?: ProviderTerminal;
  private problem?: ProviderTerminal;
  private anthropicStopReason = "";
  private usage: TokenUsage = {};
  private ended = false;
  constructor(private protocol: ClientProviderKind) {}

  private finishReason(reason: string): ProviderTerminal {
    const normal = this.protocol === "gemini" ? ["STOP"] : this.protocol === "anthropic" ? ["end_turn", "stop_sequence"] : ["stop"];
    const limited = this.protocol === "gemini" ? ["MAX_TOKENS"] : this.protocol === "anthropic" ? ["max_tokens", "model_context_window_exceeded"] : ["length"];
    if (normal.includes(reason)) return { type: "complete", finishReason: reason };
    if (limited.includes(reason)) return { type: "truncated", reason: "output_limit", retryable: true };
    return { type: "interrupted", reason: ["content_filter", "refusal", "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY"].includes(reason) ? "provider_blocked" : "unsupported_finish_reason", retryable: false };
  }

  private handle(frame: SseFrame, partial = false): ProviderEvent[] {
    if (!frame.data) return frame.comment ? [{ type: "activity" }] : [];
    if (frame.data.trim() === "[DONE]") {
      if (!partial && this.protocol === "openai-compatible" && !this.terminal) this.terminal = { type: "complete", finishReason: "done" };
      return [{ type: "activity" }];
    }
    let value: JsonRecord;
    try { value = record(JSON.parse(frame.data)); }
    catch {
      this.problem = { type: "interrupted", reason: "malformed_event", retryable: true };
      return [{ type: "activity" }];
    }
    if (value.error || frame.event === "error" || value.type === "error") {
      this.problem = { type: "interrupted", reason: "provider_error", retryable: true };
      return [{ type: "activity" }];
    }
    const events: ProviderEvent[] = [{ type: "activity" }];
    if (this.protocol === "openai-compatible") {
      const usage = record(value.usage);
      this.usage = { ...this.usage, inputTokens: token(usage.prompt_tokens) ?? this.usage.inputTokens, outputTokens: token(usage.completion_tokens) ?? this.usage.outputTokens, totalTokens: token(usage.total_tokens) ?? this.usage.totalTokens };
      const choices = Array.isArray(value.choices) ? value.choices : [];
      const choice = record(choices[0]);
      const delta = text(record(choice.delta).content) || text(record(choice.message).content);
      if (delta) events.push({ type: "delta", text: delta });
      const reason = text(choice.finish_reason);
      if (reason && !partial) this.terminal = this.finishReason(reason);
    } else if (this.protocol === "anthropic") {
      const type = text(value.type) || frame.event;
      const delta = record(value.delta);
      const usage = type === "message_start" ? record(record(value.message).usage) : record(value.usage);
      this.usage = { ...this.usage, inputTokens: token(usage.input_tokens) ?? this.usage.inputTokens, outputTokens: token(usage.output_tokens) ?? this.usage.outputTokens };
      if (type === "content_block_delta" && (delta.type === "text_delta" || !delta.type) && typeof delta.text === "string") events.push({ type: "delta", text: delta.text });
      if (type === "content_block_start") {
        const block = record(value.content_block);
        if (block.type === "text" && text(block.text)) events.push({ type: "delta", text: text(block.text) });
      }
      if (type === "message_delta" && text(delta.stop_reason)) this.anthropicStopReason = text(delta.stop_reason);
      if (type === "message_stop" && !partial) this.terminal = this.finishReason(this.anthropicStopReason || "end_turn");
    } else {
      const usage = record(value.usageMetadata);
      this.usage = { ...this.usage, inputTokens: token(usage.promptTokenCount) ?? this.usage.inputTokens, outputTokens: token(usage.candidatesTokenCount) ?? this.usage.outputTokens, totalTokens: token(usage.totalTokenCount) ?? this.usage.totalTokens };
      const candidates = Array.isArray(value.candidates) ? value.candidates : [];
      const candidate = record(candidates[0]);
      const parts = record(candidate.content).parts;
      for (const part of Array.isArray(parts) ? parts : []) {
        const item = record(part);
        if (!item.thought && text(item.text)) events.push({ type: "delta", text: text(item.text) });
      }
      if (text(record(value.promptFeedback).blockReason)) this.problem = { type: "interrupted", reason: "provider_blocked", retryable: false };
      const reason = text(candidate.finishReason);
      if (reason && !partial) this.terminal = this.finishReason(reason);
    }
    return events;
  }

  push(chunk: string): ProviderEvent[] {
    if (this.ended) return [];
    return this.frames.push(chunk).flatMap((frame) => this.handle(frame));
  }
  finish(): ProviderEvent[] {
    if (this.ended) return [];
    this.ended = true;
    const tail = this.frames.finish();
    const events = tail ? this.handle(tail, true) : [];
    if (tail) this.problem = { type: "interrupted", reason: "incomplete_event", retryable: true };
    const final = this.problem ?? this.terminal ?? { type: "interrupted" as const, reason: "unexpected_eof", retryable: true };
    return [...events, { ...final, usage: this.usage }];
  }
}

export async function* readProviderEvents(
  body: ReadableStream<Uint8Array>, protocol: ClientProviderKind,
  options: { signal?: AbortSignal; idleTimeoutMs?: number; totalTimeoutMs?: number } = {},
): AsyncGenerator<ProviderEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new ProviderSseParser(protocol);
  const startedAt = Date.now();
  try {
    while (true) {
      if (options.signal?.aborted) { yield { type: "cancelled", reason: "user_cancelled" }; return; }
      const remaining = (options.totalTimeoutMs ?? 240_000) - (Date.now() - startedAt);
      if (remaining <= 0) { yield { type: "interrupted", reason: "total_timeout", retryable: true }; return; }
      let timer: ReturnType<typeof setTimeout> | undefined;
      let stop: (() => void) | undefined;
      const read = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(remaining < (options.idleTimeoutMs ?? 90_000) ? "total_timeout" : "idle_timeout")), Math.min(remaining, options.idleTimeoutMs ?? 90_000));
          stop = () => reject(new Error("user_cancelled"));
          options.signal?.addEventListener("abort", stop, { once: true });
        }),
      ]).finally(() => { if (timer) clearTimeout(timer); if (stop) options.signal?.removeEventListener("abort", stop); });
      if (read.done) break;
      for (const event of parser.push(decoder.decode(read.value, { stream: true }))) yield event;
    }
    for (const event of parser.push(decoder.decode())) yield event;
    for (const event of parser.finish()) yield event;
  } catch (error) {
    const reason = options.signal?.aborted ? "user_cancelled" : error instanceof Error && ["idle_timeout", "total_timeout"].includes(error.message) ? error.message : "network_error";
    yield reason === "user_cancelled" ? { type: "cancelled", reason } : { type: "interrupted", reason, retryable: true };
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
