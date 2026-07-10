import "server-only";

import { getModelConfig } from "@/agent/model-config";
import { getResponseSuffix } from "@/agent/response-post-processor";
import { buildUserPrompt, PHYSICS_TUTOR_SYSTEM_PROMPT } from "@/lib/prompt-builder";
import {
  assertSafeProviderBaseUrl,
  validateProviderBaseUrl,
} from "@/lib/provider-url-policy";
import type {
  AgentIntent,
  AgentRequest,
  ChatMessage,
  ClientProviderConfig,
  DetectedLanguage,
} from "@/types/learning";

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

type RequestProviderConfig = {
  apiKey: string;
  baseUrl?: string;
  model: string;
  thinkingMode: string;
  timeoutMs: number;
  type: "openai-compatible" | "anthropic" | "gemini";
  label: string;
  clientProvided: boolean;
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
    public code:
      | "missing-key"
      | "invalid-provider"
      | "request-failed"
      | "empty-response"
      | "network-error"
      | "timeout",
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
      "DeepSeek API key is not configured. Please set DEEPSEEK_API_KEY in .env.local.",
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
    type: "openai-compatible" as const,
    label: "DeepSeek",
    clientProvided: false,
  };
}

function normalizeCustomBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim();

  try {
    const url = validateProviderBaseUrl(trimmed);

    const pathName = url.pathname
      .replace(/\/+$/, "")
      .replace(/\/chat\/completions$/i, "");
    return `${url.origin}${pathName}`.replace(/\/$/, "");
  } catch (error) {
    throw new DeepSeekError(
      error instanceof Error ? error.message : "Custom provider Base URL is invalid.",
      "invalid-provider",
      400,
    );
  }
}

function getClientProviderConfig(provider: ClientProviderConfig) {
  const apiKey = provider.apiKey.trim();
  const model = provider.model.trim();

  if (!apiKey) {
    throw new DeepSeekError("Custom provider API key is missing.", "missing-key", 400);
  }

  if (!model) {
    throw new DeepSeekError("Custom provider model is missing.", "invalid-provider", 400);
  }

  return {
    apiKey,
    baseUrl: provider.type === "openai-compatible" ? normalizeCustomBaseUrl(provider.baseUrl ?? "") : undefined,
    model: model.slice(0, 160),
    thinkingMode: "",
    timeoutMs: Number(process.env.DEEPSEEK_TIMEOUT_MS ?? 120000),
    type: provider.type,
    label: provider.label ?? provider.provider,
    clientProvided: true,
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

function resolveRequestConfig(input: AgentRequest): RequestProviderConfig {
  if (input.clientProvider?.type === "openai-compatible") {
    return getClientProviderConfig(input.clientProvider);
  }

  if (input.clientProvider?.type === "anthropic" || input.clientProvider?.type === "gemini") {
    return getClientProviderConfig(input.clientProvider);
  }

  const config = getConfig();

  return {
    ...config,
    model: resolveModel(input.model),
  };
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

async function assertProviderResponse(response: Response, providerLabel: string) {
  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 2000);
    throw new DeepSeekError(
      `${providerLabel} request failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`,
      "request-failed",
      response.status,
    );
  }
}

function openAiStreamLine(delta: string, finishReason?: string | null) {
  return `data: ${JSON.stringify({
    choices: [
      {
        delta: delta ? { content: delta } : {},
        finish_reason: finishReason ?? null,
      },
    ],
  })}\n\n`;
}

function transformAnthropicToOpenAiStream(body: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let stopped = false;

  function handleLine(line: string, controller: TransformStreamDefaultController<Uint8Array>) {
    const trimmed = line.trim();

    if (!trimmed.startsWith("data:")) {
      return;
    }

    const payload = trimmed.replace(/^data:\s*/, "");

    if (!payload || payload === "[DONE]") {
      return;
    }

    try {
      const parsed = JSON.parse(payload) as {
        type?: string;
        delta?: { text?: string; stop_reason?: string };
        error?: { message?: string };
      };

      if (parsed.error?.message) {
        controller.enqueue(encoder.encode(openAiStreamLine("", null)));
        return;
      }

      if (parsed.type === "content_block_delta" && parsed.delta?.text) {
        controller.enqueue(encoder.encode(openAiStreamLine(parsed.delta.text)));
      }

      if (parsed.type === "message_delta" && parsed.delta?.stop_reason) {
        stopped = true;
        const finishReason = parsed.delta.stop_reason === "max_tokens" ? "length" : "stop";
        controller.enqueue(encoder.encode(openAiStreamLine("", finishReason)));
      }

      if (parsed.type === "message_stop" && !stopped) {
        stopped = true;
        controller.enqueue(encoder.encode(openAiStreamLine("", "stop")));
      }
    } catch (error) {
      console.warn("Failed to parse Anthropic stream line", { payload, error });
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

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      },
    }),
  );
}

function transformGeminiToOpenAiStream(body: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  function handleLine(line: string, controller: TransformStreamDefaultController<Uint8Array>) {
    const trimmed = line.trim();

    if (!trimmed.startsWith("data:")) {
      return;
    }

    const payload = trimmed.replace(/^data:\s*/, "");

    if (!payload || payload === "[DONE]") {
      return;
    }

    try {
      const parsed = JSON.parse(payload) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
        }>;
      };
      const candidate = parsed.candidates?.[0];
      const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

      if (text) {
        controller.enqueue(encoder.encode(openAiStreamLine(text)));
      }

      if (candidate?.finishReason) {
        const finishReason = candidate.finishReason === "MAX_TOKENS" ? "length" : "stop";
        controller.enqueue(encoder.encode(openAiStreamLine("", finishReason)));
      }
    } catch (error) {
      console.warn("Failed to parse Gemini stream line", { payload, error });
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

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      },
    }),
  );
}

function splitSystemAndConversation(messages: DeepSeekMessage[]) {
  return {
    system: messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n"),
    conversation: messages.filter((message) => message.role !== "system"),
  };
}

async function requestAnthropic(
  input: AgentRequest,
  stream: boolean,
  signal: AbortSignal,
  config: RequestProviderConfig,
) {
  const modelConfig = getModelConfig(input);
  const { system, conversation } = splitSystemAndConversation(buildMessages(input));
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      system,
      messages: conversation.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      })),
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.max_tokens,
      stream,
    }),
  });

  await assertProviderResponse(response, config.label);

  if (stream) {
    if (!response.body) {
      throw new DeepSeekError(`${config.label} returned an empty response.`, "empty-response", 502);
    }

    return new Response(transformAnthropicToOpenAiStream(response.body), {
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    });
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const content = data.content?.map((part) => part.text ?? "").join("").trim() ?? "";

  return Response.json({ choices: [{ message: { content } }] });
}

function geminiRole(role: DeepSeekRole) {
  return role === "assistant" ? "model" : "user";
}

async function requestGemini(
  input: AgentRequest,
  stream: boolean,
  signal: AbortSignal,
  config: RequestProviderConfig,
) {
  const modelConfig = getModelConfig(input);
  const { system, conversation } = splitSystemAndConversation(buildMessages(input));
  const method = stream ? "streamGenerateContent" : "generateContent";
  const query = stream
    ? `alt=sse&key=${encodeURIComponent(config.apiKey)}`
    : `key=${encodeURIComponent(config.apiKey)}`;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:${method}?${query}`,
    {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: conversation.map((message) => ({
          role: geminiRole(message.role),
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          temperature: modelConfig.temperature,
          maxOutputTokens: modelConfig.max_tokens,
        },
      }),
    },
  );

  await assertProviderResponse(response, config.label);

  if (stream) {
    if (!response.body) {
      throw new DeepSeekError(`${config.label} returned an empty response.`, "empty-response", 502);
    }

    return new Response(transformGeminiToOpenAiStream(response.body), {
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    });
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content =
    data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";

  return Response.json({ choices: [{ message: { content } }] });
}

function transformDeepSeekStream(
  body: ReadableStream<Uint8Array>,
  onClose: () => void,
  intent: AgentIntent,
  language: DetectedLanguage,
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
              encodeStreamEvent(
                "error",
                "The upstream connection ended before a completion marker was received.",
              ),
            ),
          );
        } else {
          const suffix = getResponseSuffix(intent, language);

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
  const config = resolveRequestConfig(input);

  if (config.type === "anthropic") {
    return requestAnthropic(input, stream, signal, config);
  }

  if (config.type === "gemini") {
    return requestGemini(input, stream, signal, config);
  }

  const { apiKey, baseUrl, thinkingMode, model } = config;
  const modelConfig = getModelConfig(input);
  const thinking =
    thinkingMode === "enabled" || thinkingMode === "disabled"
      ? { thinking: { type: thinkingMode } }
      : {};

  if (config.clientProvided && baseUrl) {
    try {
      await assertSafeProviderBaseUrl(baseUrl);
    } catch (error) {
      throw new DeepSeekError(
        error instanceof Error ? error.message : "The custom provider endpoint is not allowed.",
        "invalid-provider",
        400,
      );
    }
  }

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
      ...thinking,
    }),
  });

  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 2000);
    throw new DeepSeekError(
      `${config.label} request failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`,
      "request-failed",
      response.status,
    );
  }

  return response;
}

export async function streamDeepSeek(input: AgentRequest, parentSignal?: AbortSignal) {
  const { timeoutMs } = resolveRequestConfig(input);
  const abort = createAbortController(Math.min(timeoutMs, 30000), parentSignal);

  try {
    const response = await requestDeepSeek(input, true, abort.signal);

    if (!response.body) {
      abort.clear();
      throw new DeepSeekError(`${resolveRequestConfig(input).label} returned an empty response.`, "empty-response", 502);
    }

    // The timeout only protects connection establishment. Once streaming starts,
    // the browser-side idle timeout is reset for every received chunk.
    abort.clearTimeout();
    return transformDeepSeekStream(
      response.body,
      abort.clear,
      input.intent ?? "general_question",
      input.detectedLanguage ?? "en",
    );
  } catch (error) {
    abort.clear();

    if (error instanceof DeepSeekError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new DeepSeekError(
        "DeepSeek request timed out. Please shorten the request or try again later.",
        "timeout",
        504,
      );
    }

    throw new DeepSeekError(
      error instanceof Error
        ? `Network error: ${error.message}`
        : "Network error: the DeepSeek request did not complete.",
      "network-error",
      502,
    );
  }
}

export async function askDeepSeek(input: AgentRequest) {
  const { timeoutMs } = resolveRequestConfig(input);
  const abort = createAbortController(timeoutMs);

  try {
    const response = await requestDeepSeek(input, false, abort.signal);
    const data = (await response.json()) as DeepSeekApiResponse;
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new DeepSeekError(`${resolveRequestConfig(input).label} returned an empty response.`, "empty-response", 502);
    }

    return content;
  } catch (error) {
    if (error instanceof DeepSeekError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new DeepSeekError(
        "DeepSeek request timed out. Please shorten the request or try again later.",
        "timeout",
        504,
      );
    }

    throw new DeepSeekError(
      error instanceof Error
        ? `Network error: ${error.message}`
        : "Network error: the DeepSeek request did not complete.",
      "network-error",
      502,
    );
  } finally {
    abort.clear();
  }
}
