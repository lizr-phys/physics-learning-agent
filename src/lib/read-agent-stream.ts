import { getWorkspaceIdentity, isWorkspaceCurrent } from "@/lib/workspace-storage";
import { isGenerationEvent, matchesGenerationBinding, type GenerationBinding, type GenerationEvent } from "@/lib/generation-stream";
import { SseDecoder } from "@/lib/sse";

export class AgentStreamError extends Error {
  constructor(
    message: string,
    public partialContent = "",
    public reason:
      | "http"
      | "empty"
      | "network"
      | "timeout"
      | "abort"
      | "length"
      | "blocked"
      | "incomplete" = "network",
  ) {
    super(message);
  }
}

const streamEventStart = "[[PLA_STREAM_EVENT:";
const streamEventEnd = "]]";

export type StreamOptions = {
  signal?: AbortSignal;
  throttleMs?: number;
  idleTimeoutMs?: number;
  expectedBinding?: GenerationBinding;
  onEvent?: (event: GenerationEvent) => void;
};

function raceReadWithIdleTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    reader.read(),
    new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        reject(new AgentStreamError("No model output was received for a while. The connection may have stalled.", "", "timeout"));
      }, timeoutMs);
    }),
  ]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

function looksIncomplete(content: string) {
  const trimmed = content.trim();

  if (!trimmed) {
    return false;
  }

  const fenceCount = (trimmed.match(/```/g) ?? []).length;
  const outsideCode = trimmed.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, "");
  const displayMathCount = (outsideCode.match(/(?<!\\)\$\$/g) ?? []).length;

  if (fenceCount % 2 === 1 || displayMathCount % 2 === 1) {
    return true;
  }

  return (
    /(?:Answer|Solution|Hint|Final answer|Training advice|Equation|Result|Proof|Example|Conclusion|答案|解析|提示|最终答案|训练建议|方程|结果|证明|例题|小结|结论)[:：]\s*$/i.test(trimmed)
  );
}

function parseStreamEvent(raw: string) {
  const [type = "", detail = ""] = raw.split(":");

  return {
    type,
    detail: detail ? decodeURIComponent(detail) : "",
  };
}

function splitTrailingEventPrefix(text: string) {
  const maxPrefixLength = Math.min(text.length, streamEventStart.length - 1);

  for (let length = maxPrefixLength; length > 0; length -= 1) {
    const suffix = text.slice(-length);

    if (streamEventStart.startsWith(suffix)) {
      return {
        content: text.slice(0, -length),
        bufferedPrefix: suffix,
      };
    }
  }

  return { content: text, bufferedPrefix: "" };
}

async function readLegacyAgentStream(
  response: Response,
  onChunk: (content: string) => void,
  options?: StreamOptions,
) {
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const data = (await response.json()) as { error?: string };
      throw new AgentStreamError(data.error ?? "Agent request failed.", "", "http");
    }

    throw new AgentStreamError(`Agent request failed: ${response.status}`, "", "http");
  }

  if (!response.body) {
    throw new AgentStreamError("The browser did not receive a readable response stream.", "", "empty");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  const idleTimeoutMs = options?.idleTimeoutMs ?? 90000;
  let fullContent = "";
  let eventBuffer = "";
  let lengthLimited = false;
  let streamError = "";
  let doneReceived = false;
  let lastEmit = 0;

  function emit(force = false) {
    const now = performance.now();

    if (force || now - lastEmit >= (options?.throttleMs ?? 48)) {
      onChunk(fullContent);
      lastEmit = now;
    }
  }

  function appendChunk(rawChunk: string) {
    let text = `${eventBuffer}${rawChunk}`;
    eventBuffer = "";

    while (text) {
      const start = text.indexOf(streamEventStart);

      if (start < 0) {
        const trailing = splitTrailingEventPrefix(text);
        fullContent += trailing.content;
        eventBuffer = trailing.bufferedPrefix;
        return;
      }

      fullContent += text.slice(0, start);
      const end = text.indexOf(streamEventEnd, start);

      if (end < 0) {
        eventBuffer = text.slice(start);
        return;
      }

      const rawEvent = text.slice(start + streamEventStart.length, end);
      const event = parseStreamEvent(rawEvent);

      if (event.type === "length") {
        lengthLimited = true;
      }

      if (event.type === "error") {
        streamError = event.detail || "DeepSeek streaming was interrupted.";
      }

      if (event.type === "done") {
        doneReceived = true;
      }

      text = text.slice(end + streamEventEnd.length);
      if (text.startsWith("\n")) {
        text = text.slice(1);
      }
    }
  }

  try {
    while (true) {
      if (options?.signal?.aborted) {
        await reader.cancel();
        throw new AgentStreamError("Generation stopped.", fullContent, "abort");
      }

      const { done, value } = await raceReadWithIdleTimeout(reader, idleTimeoutMs);

      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });

      if (!chunk) {
        continue;
      }

      appendChunk(chunk);
      emit();
    }

    const tail = decoder.decode();

    if (tail) {
      appendChunk(tail);
    }

    if (eventBuffer) {
      streamError = "The stream control message was incomplete; the connection may have been interrupted.";
      eventBuffer = "";
    }

    emit(true);

    if (streamError) {
      throw new AgentStreamError(
        `Generation interrupted: ${streamError} The current content has been preserved.`,
        fullContent,
        "network",
      );
    }

    if (lengthLimited) {
      throw new AgentStreamError(
        "The answer may have reached the model output limit. The current content has been preserved; use Continue generation to complete it.",
        fullContent,
        "length",
      );
    }

    if (!doneReceived) {
      throw new AgentStreamError(
        "The stream ended without a completion marker. The current content has been preserved; use Continue generation to complete it.",
        fullContent,
        "incomplete",
      );
    }

    if (!fullContent.trim()) {
      throw new AgentStreamError("The agent returned empty content.", fullContent, "empty");
    }

    if (looksIncomplete(fullContent)) {
      throw new AgentStreamError(
        "The answer appears to end in the middle of a formula, list, or section. The current content has been preserved; use Continue generation to complete it.",
        fullContent,
        "incomplete",
      );
    }

    return fullContent;
  } catch (error) {
    emit(true);

    if (error instanceof AgentStreamError) {
      if (error.reason === "timeout") {
        await reader.cancel().catch(() => undefined);
      }
      throw error.partialContent ? error : new AgentStreamError(error.message, fullContent, error.reason);
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AgentStreamError("Generation stopped.", fullContent, "abort");
    }

    throw new AgentStreamError(
      error instanceof Error ? error.message : "A network error occurred while reading model output.",
      fullContent,
      "network",
    );
  } finally {
    reader.releaseLock();
  }
}

/** Production streams carry control data in SSE JSON, separate from model-authored text. */
export async function readAgentStream(response: Response, onChunk: (content: string) => void, options: StreamOptions = {}) {
  if (!response.ok) {
    let message = `Agent request failed (HTTP ${response.status}).`;
    if (response.headers.get("content-type")?.includes("application/json")) {
      const data = await response.json() as { error?: string };
      message = data.error ?? message;
    }
    throw new AgentStreamError(message, "", "http");
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/plain")) return readLegacyAgentStream(response, onChunk, options);
  if (!contentType.includes("text/event-stream")) throw new AgentStreamError("Unsupported generation stream format.", "", "network");
  if (!response.body) throw new AgentStreamError("The response stream was empty.", "", "empty");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const frames = new SseDecoder();
  let content = "";
  let seq = 0;
  let lastEmit = 0;
  let terminal: GenerationEvent | undefined;
  let protocolProblem = "";
  const emit = (force = false) => {
    const now = performance.now();
    if (force || now - lastEmit >= (options.throttleMs ?? 48)) { onChunk(content); lastEmit = now; }
  };
  const handle = (data: string, eventName: string) => {
    let event: unknown;
    try { event = JSON.parse(data); }
    catch { protocolProblem = "A stream event was malformed."; return; }
    if (!isGenerationEvent(event) || eventName !== event.type) { protocolProblem = "A stream event had an invalid format."; return; }
    if (options.expectedBinding && !matchesGenerationBinding(event, options.expectedBinding)) {
      throw new AgentStreamError("The response belongs to a different account or conversation.", content, "abort");
    }
    if (event.type === "delta") {
      if (event.seq <= seq) return;
      if (event.seq !== seq + 1) protocolProblem = "Some output events were missing.";
      if (terminal) protocolProblem = "Output arrived after the final event.";
      seq = event.seq;
      content += event.text;
      emit();
    } else if (event.type === "practice") {
      if (terminal) protocolProblem = "A practice snapshot arrived after the final event.";
      content = event.content;
      emit(true);
    } else if (["complete", "interrupted", "truncated", "cancelled"].includes(event.type)) {
      if (terminal) protocolProblem = "Multiple final events were received.";
      terminal = event;
    }
    options.onEvent?.(event);
  };
  const abortRead = () => { void reader.cancel().catch(() => undefined); };
  options.signal?.addEventListener("abort", abortRead, { once: true });
  try {
    while (true) {
      if (options.signal?.aborted) throw new AgentStreamError("Generation stopped.", content, "abort");
      const read = await raceReadWithIdleTimeout(reader, options.idleTimeoutMs ?? 90_000);
      if (read.done) break;
      for (const frame of frames.push(decoder.decode(read.value, { stream: true }))) {
        if (frame.data) handle(frame.data, frame.event);
      }
    }
    for (const frame of frames.push(decoder.decode())) if (frame.data) handle(frame.data, frame.event);
    if (frames.finish()) protocolProblem = "The last stream event was incomplete.";
    emit(true);
    if (options.signal?.aborted) throw new AgentStreamError("Generation stopped.", content, "abort");
    if (protocolProblem) throw new AgentStreamError(`${protocolProblem} Partial content has been preserved.`, content, "incomplete");
    if (!terminal) throw new AgentStreamError("The stream ended without a final event. Partial content has been preserved.", content, "incomplete");
    if (terminal.type === "cancelled") throw new AgentStreamError("Generation stopped.", content, "abort");
    if (terminal.type === "truncated") throw new AgentStreamError("The output limit was reached. Use Continue generation to finish the answer.", content, "length");
    if (terminal.type === "interrupted") {
      const reason = terminal.reason;
      throw new AgentStreamError(
        reason === "provider_authentication" ? "The provider rejected the credentials. Check API Settings before retrying; partial content has been preserved." : reason === "missing-key" ? "Configure a provider key in API Settings before generating." : reason === "invalid-provider" ? "Check the selected provider and endpoint in API Settings." : reason === "provider_rate_limit" ? "The provider rate limit was reached. Wait before retrying; partial content has been preserved." : reason === "provider_blocked" ? "The provider stopped this response. Partial content has been preserved." : "Generation was interrupted. Partial content has been preserved; continue or retry.",
        content,
        reason === "provider_blocked" ? "blocked" : reason.includes("timeout") ? "timeout" : reason === "empty_response" ? "empty" : ["unexpected_eof", "incomplete_event", "malformed_event"].includes(reason) ? "incomplete" : "network",
      );
    }
    if (!content.trim()) throw new AgentStreamError("The agent returned empty content.", content, "empty");
    if (looksIncomplete(content)) throw new AgentStreamError("The answer appears incomplete. Continue generation to finish it.", content, "incomplete");
    return content;
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    emit(true);
    if (error instanceof AgentStreamError) throw error.partialContent ? error : new AgentStreamError(error.message, content, error.reason);
    throw new AgentStreamError(options.signal?.aborted ? "Generation stopped." : "The generation connection was interrupted.", content, options.signal?.aborted ? "abort" : "network");
  } finally {
    options.signal?.removeEventListener("abort", abortRead);
    reader.releaseLock();
  }
}

export async function requestAgentStream(
  body: unknown,
  onChunk: (content: string) => void,
  options?: StreamOptions,
) {
  const identity = getWorkspaceIdentity();
  const request = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const binding: GenerationBinding = {
    ownerId: identity.ownerId ?? "guest", authEpoch: identity.authEpoch,
    sessionId: typeof request.conversationId === "string" && request.conversationId ? request.conversationId : crypto.randomUUID(),
    messageId: typeof request.assistantMessageId === "string" && request.assistantMessageId ? request.assistantMessageId : crypto.randomUUID(),
    requestId: typeof request.requestId === "string" && request.requestId ? request.requestId : crypto.randomUUID(),
  };
  const controller = new AbortController();
  const abort = () => controller.abort();
  options?.signal?.addEventListener("abort", abort, { once: true });
  if (options?.signal?.aborted) abort();
  window.addEventListener("pla:workspace-will-change", abort);
  try {
  const response = await fetch("/api/chat", {
    method: "POST",
    signal: controller.signal,
    headers: { "Content-Type": "application/json", "X-PLA-Workspace-Owner": identity.ownerId ?? "guest" },
    body: JSON.stringify({ ...request, authEpoch: binding.authEpoch, conversationId: binding.sessionId, assistantMessageId: binding.messageId, requestId: binding.requestId }),
  });

  const result = await readAgentStream(response, content => {
    if (!isWorkspaceCurrent(identity)) throw new AgentStreamError("Workspace changed.", "", "abort");
    onChunk(content);
  }, { ...options, signal: controller.signal, expectedBinding: binding, onEvent: event => {
    if (!isWorkspaceCurrent(identity)) throw new AgentStreamError("Workspace changed.", "", "abort");
    options?.onEvent?.(event);
  } });
  if (!isWorkspaceCurrent(identity)) throw new AgentStreamError("Workspace changed.", "", "abort");
  return result;
  } finally {
    window.removeEventListener("pla:workspace-will-change", abort);
    options?.signal?.removeEventListener("abort", abort);
  }
}
