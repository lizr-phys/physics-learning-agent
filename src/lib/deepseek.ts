import "server-only";

import { getModelConfig } from "@/agent/model-config";
import { getResponseSuffix } from "@/agent/response-post-processor";
import { buildUserPrompt, PHYSICS_TUTOR_SYSTEM_PROMPT } from "@/lib/prompt-builder";
import type { AgentIntent, AgentRequest, ChatMessage } from "@/types/learning";

type DeepSeekRole = "system" | "user" | "assistant";

type DeepSeekMessage = {
  role: DeepSeekRole;
  content: string;
};

type DeepSeekChoice = {
  delta?: {
    content?: string;
  };
  message?: {
    content?: string;
  };
  finish_reason?: string | null;
};

type DeepSeekStreamChunk = {
  choices?: DeepSeekChoice[];
  error?: {
    message?: string;
  };
};

type DeepSeekApiResponse = {
  choices?: DeepSeekChoice[];
  error?: {
    message?: string;
  };
};

const allowedModels = new Set([
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "deepseek-chat",
  "deepseek-reasoner",
]);

export class DeepSeekError extends Error {
  constructor(
    message: string,
    public code: "missing-key" | "request-failed" | "empty-response" | "network-error" | "timeout",
    public status = 500,
  ) {
    super(message);
  }
}

const streamEventPrefix = "[[PLA_STREAM_EVENT:";

function encodeStreamEvent(type: "done" | "length" | "error", detail = "") {
  return `\n${streamEventPrefix}${type}${detail ? `:${encodeURIComponent(detail)}` : ""}]]\n`;
}

function toDeepSeekHistory(history: ChatMessage[] = []): DeepSeekMessage[] {
  return history
    .filter((message) => message.content.trim().length > 0)
    .slice(-16)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 2000),
    }));
}

function buildMessages(input: AgentRequest): DeepSeekMessage[] {
  return [
    { role: "system", content: PHYSICS_TUTOR_SYSTEM_PROMPT },
    ...toDeepSeekHistory(input.history),
    { role: "user", content: buildUserPrompt(input) },
  ];
}

function getConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new DeepSeekError(
      "DeepSeek API Key 未配置。请在 .env.local 中设置 DEEPSEEK_API_KEY。",
      "missing-key",
      500,
    );
  }

  return {
    apiKey,
    baseUrl: (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, ""),
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    thinkingMode: process.env.DEEPSEEK_THINKING ?? "disabled",
    timeoutMs: Number(process.env.DEEPSEEK_TIMEOUT_MS ?? 120000),
  };
}

export function getDeepSeekPublicConfig() {
  return {
    configured: Boolean(process.env.DEEPSEEK_API_KEY),
    baseUrl: (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, ""),
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    thinkingMode: process.env.DEEPSEEK_THINKING ?? "disabled",
    timeoutMs: Number(process.env.DEEPSEEK_TIMEOUT_MS ?? 120000),
    streaming: true,
  };
}

function resolveModel(requestedModel?: string) {
  if (requestedModel && allowedModels.has(requestedModel)) {
    return requestedModel;
  }

  return process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
}

function createAbortController(timeoutMs: number, parentSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromParent = () => controller.abort();

  parentSignal?.addEventListener("abort", abortFromParent, { once: true });

  return {
    signal: controller.signal,
    clearTimeout: () => clearTimeout(timeout),
    clear: () => {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", abortFromParent);
    },
  };
}

function extractStreamEventFromLine(line: string) {
  const trimmed = line.trim();

  if (!trimmed.startsWith("data:")) {
    return { delta: "" };
  }

  const payload = trimmed.replace(/^data:\s*/, "");

  if (!payload) {
    return { delta: "" };
  }

  if (payload === "[DONE]") {
    return { delta: "", done: true };
  }

  try {
    const parsed = JSON.parse(payload) as DeepSeekStreamChunk;
    const choice = parsed.choices?.[0];

    return {
      delta: choice?.delta?.content ?? choice?.message?.content ?? "",
      finishReason: choice?.finish_reason ?? undefined,
      error: parsed.error?.message,
    };
  } catch (error) {
    console.warn("Failed to parse DeepSeek stream line", { payload, error });
    return { delta: "" };
  }
}

function transformDeepSeekStream(
  body: ReadableStream<Uint8Array>,
  onClose: () => void,
  intent: AgentIntent,
) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let reachedLengthLimit = false;
  let reachedTerminalSignal = false;
  let emittedContent = "";

  function handleLine(line: string, controller: TransformStreamDefaultController<Uint8Array>) {
    const event = extractStreamEventFromLine(line);

    if (event.done || event.finishReason) {
      reachedTerminalSignal = true;
    }

    if (event.error) {
      controller.enqueue(encoder.encode(encodeStreamEvent("error", event.error)));
      return;
    }

    if (event.finishReason === "length") {
      reachedLengthLimit = true;
    }

    if (event.delta) {
      emittedContent += event.delta;
      controller.enqueue(encoder.encode(event.delta));
    }
  }

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          handleLine(line, controller);
        }
      },
      flush(controller) {
        buffer += decoder.decode();

        for (const line of buffer.split("\n")) {
          handleLine(line, controller);
        }

        if (reachedLengthLimit) {
          controller.enqueue(encoder.encode(encodeStreamEvent("length")));
        } else if (!reachedTerminalSignal && emittedContent.trim()) {
          controller.enqueue(
            encoder.encode(
              encodeStreamEvent("error", "上游连接在返回完成标记前结束。"),
            ),
          );
        } else {
          const suffix = getResponseSuffix(intent);

          if (suffix && !emittedContent.trimEnd().endsWith(suffix)) {
            controller.enqueue(encoder.encode(`\n\n${suffix}`));
          }

          controller.enqueue(encoder.encode(encodeStreamEvent("done")));
        }

        onClose();
      },
    }),
  );
}

async function requestDeepSeek(input: AgentRequest, stream: boolean, signal: AbortSignal) {
  const { apiKey, baseUrl, thinkingMode } = getConfig();
  const model = resolveModel(input.model);
  const modelConfig = getModelConfig(input);
  const thinking =
    thinkingMode === "enabled" || thinkingMode === "disabled"
      ? { thinking: { type: thinkingMode } }
      : {};

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: buildMessages(input),
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.max_tokens,
      stream,
      stream_options: stream ? { include_usage: false } : undefined,
      ...thinking,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new DeepSeekError(
      `DeepSeek 请求失败：${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`,
      "request-failed",
      response.status,
    );
  }

  return response;
}

export async function streamDeepSeek(input: AgentRequest, parentSignal?: AbortSignal) {
  const { timeoutMs } = getConfig();
  const abort = createAbortController(Math.min(timeoutMs, 30000), parentSignal);

  try {
    const response = await requestDeepSeek(input, true, abort.signal);

    if (!response.body) {
      abort.clear();
      throw new DeepSeekError("DeepSeek 返回内容为空。", "empty-response", 502);
    }

    // The timeout only protects connection establishment. Once streaming starts,
    // the browser-side idle timeout is reset for every received chunk.
    abort.clearTimeout();
    return transformDeepSeekStream(
      response.body,
      abort.clear,
      input.intent ?? "general_question",
    );
  } catch (error) {
    abort.clear();

    if (error instanceof DeepSeekError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new DeepSeekError("DeepSeek 请求超时，请缩短问题或稍后重试。", "timeout", 504);
    }

    throw new DeepSeekError(
      error instanceof Error ? `网络错误：${error.message}` : "网络错误：DeepSeek 请求未完成。",
      "network-error",
      502,
    );
  }
}

export async function askDeepSeek(input: AgentRequest) {
  const { timeoutMs } = getConfig();
  const abort = createAbortController(timeoutMs);

  try {
    const response = await requestDeepSeek(input, false, abort.signal);
    const data = (await response.json()) as DeepSeekApiResponse;
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new DeepSeekError("DeepSeek 返回内容为空。", "empty-response", 502);
    }

    return content;
  } catch (error) {
    if (error instanceof DeepSeekError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new DeepSeekError("DeepSeek 请求超时，请缩短问题或稍后重试。", "timeout", 504);
    }

    throw new DeepSeekError(
      error instanceof Error ? `网络错误：${error.message}` : "网络错误：DeepSeek 请求未完成。",
      "network-error",
      502,
    );
  } finally {
    abort.clear();
  }
}
