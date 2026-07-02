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
      | "incomplete" = "network",
  ) {
    super(message);
  }
}

const streamEventStart = "[[PLA_STREAM_EVENT:";
const streamEventEnd = "]]";

type StreamOptions = {
  signal?: AbortSignal;
  throttleMs?: number;
  idleTimeoutMs?: number;
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
  const displayMathCount = (trimmed.match(/\$\$/g) ?? []).length;

  if (fenceCount % 2 === 1 || displayMathCount % 2 === 1) {
    return true;
  }

  return (
    /(?:Answer|Solution|Hint|Final answer|Training advice|Equation|Result|Proof|Example|Conclusion|答案|解析|提示|最终答案|训练建议|方程|结果|证明|例题|小结|结论)[:：]\s*$/i.test(trimmed) ||
    /[，、；：=+\-*/(（\[]$/.test(trimmed)
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

export async function readAgentStream(
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

export async function requestAgentStream(
  body: unknown,
  onChunk: (content: string) => void,
  options?: StreamOptions,
) {
  const response = await fetch("/api/chat", {
    method: "POST",
    signal: options?.signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return readAgentStream(response, onChunk, options);
}
