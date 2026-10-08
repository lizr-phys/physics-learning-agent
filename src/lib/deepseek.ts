import "server-only";

import { getModelConfig } from "@/agent/model-config";
import { getResponseSuffix } from "@/agent/response-post-processor";
import { buildUserPrompt, PHYSICS_TUTOR_SYSTEM_PROMPT } from "@/lib/prompt-builder";
import { encodeGenerationEvent, type GenerationBinding, type GenerationPayload } from "@/lib/generation-stream";
import { readProviderEvents, type ProviderEvent } from "@/lib/provider-sse";
import { mergeImageAttachments } from "@/lib/image-attachments";
import {
  assertSafeProviderBaseUrl,
  validateProviderBaseUrl,
} from "@/lib/provider-url-policy";
import type {
  AgentRequest,
  ChatMessage,
  ClientProviderConfig,
} from "@/types/learning";

type DeepSeekRole = "system" | "user" | "assistant";

type DeepSeekMessage = {
  role: DeepSeekRole;
  content: string | Array<{type:"text";text:string} | {type:"image_url";image_url:{url:string;detail:"high"}}>;
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
  "deepseek-flash",
  "deepseek-v4-flash-vision-exp",
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

function visualContent(text:string, images:ChatMessage["images"], input:AgentRequest):DeepSeekMessage["content"] {
  if (!images?.length) return text;
  return [{type:"text",text},...images.map(image => {
    const stored=input.resolvedImages?.[image.id];
    if (!stored) throw new DeepSeekError("An attached image is unavailable. Reattach it before generating.","invalid-provider",400);
    return {type:"image_url" as const,image_url:{url:`data:${stored.mimeType};base64,${stored.data}`,detail:"high" as const}};
  })];
}
function toDeepSeekHistory(history: ChatMessage[] = [], input:AgentRequest): DeepSeekMessage[] {
  const seen = new Set(mergeImageAttachments(input.images, input.toolContext?.images)?.map(image => image.id));
  const visualHistory = [...history].reverse().map(message => ({
    ...message,
    images: message.role === "user" ? message.images?.filter(image => {
      if (seen.has(image.id)) return false;
      seen.add(image.id);
      return true;
    }) : undefined,
  })).reverse();
  return visualHistory
    .filter((message) => message.content.trim().length > 0 || message.images?.length)
    .map((message) => ({
      role: message.role,
      content: visualContent(message.content || "Attached image",message.images,input),
    }));
}

function buildMessages(input: AgentRequest): DeepSeekMessage[] {
  return [
    { role: "system", content: PHYSICS_TUTOR_SYSTEM_PROMPT },
    ...toDeepSeekHistory(input.history,input),
    { role: "user", content: visualContent(buildUserPrompt(input),mergeImageAttachments(input.images,input.toolContext?.images),input) },
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
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-flash",
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
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-flash",
    thinkingMode: process.env.DEEPSEEK_THINKING ?? "disabled",
    timeoutMs: Number(process.env.DEEPSEEK_TIMEOUT_MS ?? 120000),
    streaming: true,
  };
}

function resolveModel(requestedModel?: string) {
  if (requestedModel && allowedModels.has(requestedModel)) {
    return requestedModel;
  }

  return process.env.DEEPSEEK_MODEL ?? "deepseek-flash";
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
  if (parentSignal?.aborted) controller.abort();
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

async function assertProviderResponse(response: Response, providerLabel: string) {
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new DeepSeekError(
      `${providerLabel} request failed (HTTP ${response.status}). Check the provider settings or retry.`,
      "request-failed",
      response.status,
    );
  }
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
  maxOutputTokens?: number,
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
        content: typeof message.content === "string" ? message.content : message.content.map(part => part.type === "text" ? part : {
          type:"image",source:{type:"base64",media_type:"image/webp",data:part.image_url.url.split(",")[1]},
        }),
      })),
      temperature: modelConfig.temperature,
      max_tokens: Math.min(modelConfig.max_tokens, maxOutputTokens ?? modelConfig.max_tokens),
      stream,
    }),
  });

  await assertProviderResponse(response, config.label);

  if (stream) {
    if (!response.body) {
      throw new DeepSeekError(`${config.label} returned an empty response.`, "empty-response", 502);
    }

    return new Response(response.body, {
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
  maxOutputTokens?: number,
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
          parts: typeof message.content === "string" ? [{text:message.content}] : message.content.map(part => part.type === "text" ? {text:part.text} : {
            inlineData:{mimeType:"image/webp",data:part.image_url.url.split(",")[1]},
          }),
        })),
        generationConfig: {
          temperature: modelConfig.temperature,
          maxOutputTokens: Math.min(modelConfig.max_tokens, maxOutputTokens ?? modelConfig.max_tokens),
        },
      }),
    },
  );

  await assertProviderResponse(response, config.label);

  if (stream) {
    if (!response.body) {
      throw new DeepSeekError(`${config.label} returned an empty response.`, "empty-response", 502);
    }

    return new Response(response.body, {
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

async function requestDeepSeek(input: AgentRequest, stream: boolean, signal: AbortSignal, maxOutputTokens?: number) {
  const config = resolveRequestConfig(input);
  if (Object.keys(input.resolvedImages ?? {}).length && config.type === "openai-compatible"
    && (!config.clientProvided || config.baseUrl?.includes("api.deepseek.com"))
    && !["deepseek-flash","deepseek-v4-flash","deepseek-v4-flash-vision-exp"].includes(config.model)) {
    throw new DeepSeekError("Choose DeepSeek V4.1 Flash (deepseek-flash) in API Settings to use images.","invalid-provider",400);
  }

  if (config.type === "anthropic") {
    return requestAnthropic(input, stream, signal, config, maxOutputTokens);
  }

  if (config.type === "gemini") {
    return requestGemini(input, stream, signal, config, maxOutputTokens);
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
      max_tokens: Math.min(modelConfig.max_tokens, maxOutputTokens ?? modelConfig.max_tokens),
      stream,
      ...thinking,
    }),
  });

  await assertProviderResponse(response, config.label);

  return response;
}

export async function openProviderEventStream(
  input: AgentRequest, parentSignal?: AbortSignal,
  budget: { idleTimeoutMs?: number; totalTimeoutMs?: number; maxOutputTokens?: number } = {},
): Promise<AsyncGenerator<ProviderEvent>> {
  const { timeoutMs, type } = resolveRequestConfig(input);
  const startedAt = Date.now();
  const totalTimeoutMs = budget.totalTimeoutMs ?? 240_000;
  const abort = createAbortController(Math.min(timeoutMs, 30_000, totalTimeoutMs), parentSignal);

  try {
    const response = await requestDeepSeek(input, true, abort.signal, budget.maxOutputTokens);

    if (!response.body) {
      abort.clear();
      throw new DeepSeekError(`${resolveRequestConfig(input).label} returned an empty response.`, "empty-response", 502);
    }

    // The timeout only protects connection establishment. Once streaming starts,
    // the browser-side idle timeout is reset for every received chunk.
    abort.clearTimeout();
    const events = readProviderEvents(response.body, type, { ...budget, totalTimeoutMs: Math.max(0, totalTimeoutMs - (Date.now() - startedAt)), signal: abort.signal });
    return (async function* () {
      try { yield* events; }
      finally { abort.clear(); }
    })();
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
      "The provider connection could not be established. Check network access and provider settings.",
      "network-error",
      502,
    );
  }
}

export type GenerationStreamOptions = {
  binding?: GenerationBinding;
  initialEvents?: GenerationPayload[];
  idleTimeoutMs?: number;
  totalTimeoutMs?: number;
  maxOutputTokens?: number;
  finalize?: (content: string) => GenerationPayload[] | Promise<GenerationPayload[]>;
};

export async function streamDeepSeek(input: AgentRequest, parentSignal?: AbortSignal, options: GenerationStreamOptions = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parentSignal?.addEventListener("abort", abort, { once: true });
  if (parentSignal?.aborted) abort();
  let events: AsyncGenerator<ProviderEvent>;
  try { events = await openProviderEventStream(input, controller.signal, options); }
  catch (error) { parentSignal?.removeEventListener("abort", abort); throw error; }
  const binding = options.binding ?? {
    ownerId: "guest", authEpoch: input.authEpoch ?? "guest",
    sessionId: input.conversationId ?? crypto.randomUUID(),
    messageId: input.assistantMessageId ?? crypto.randomUUID(),
    requestId: input.requestId ?? crypto.randomUUID(),
  };
  const encoder = new TextEncoder();
  let seq = 0;
  let content = "";
  let cancelled = false;
  return new ReadableStream<Uint8Array>({
    async start(output) {
      const emit = (event: GenerationPayload) => { if (!cancelled) output.enqueue(encoder.encode(encodeGenerationEvent({ ...binding, ...event }))); };
      try {
        for (const event of options.initialEvents ?? []) emit(event);
        for await (const event of events) {
          if (cancelled) break;
          if (event.type === "delta") { content += event.text; emit({ ...event, seq: ++seq }); }
          else if (event.type === "complete") {
            if (!content.trim()) { emit({ type: "interrupted", reason: "empty_response", retryable: true }); continue; }
            const suffix = getResponseSuffix(input.intent ?? "general_question", input.detectedLanguage ?? "en");
            if (suffix && !content.trimEnd().endsWith(suffix)) { const text = `\n\n${suffix}`; content += text; emit({ type: "delta", seq: ++seq, text }); }
            for (const finalized of await options.finalize?.(content) ?? []) emit(finalized);
            emit(event);
          } else emit(event);
        }
      } catch {
        if (controller.signal.aborted) emit({ type: "cancelled", reason: "user_cancelled" });
        else emit({ type: "interrupted", reason: "generation_failed", retryable: true });
      } finally {
        parentSignal?.removeEventListener("abort", abort);
        if (!cancelled) output.close();
      }
    },
    async cancel() { cancelled = true; controller.abort(); await events.return(undefined); },
  });
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
      "The provider connection failed. Check network access and provider settings.",
      "network-error",
      502,
    );
  } finally {
    abort.clear();
  }
}
