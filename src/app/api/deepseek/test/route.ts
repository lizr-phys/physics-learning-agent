import { NextRequest, NextResponse } from "next/server";

import { askDeepSeek, DeepSeekError, getDeepSeekPublicConfig } from "@/lib/deepseek";
import { consumeRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { readJsonRequest, RequestBodyError } from "@/lib/request-body";
import type { ClientProviderConfig } from "@/types/learning";

export const runtime = "nodejs";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeClientProvider(value: unknown): ClientProviderConfig | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const type = asString(record.type);
  const provider = asString(record.provider);

  if (!["openai-compatible", "anthropic", "gemini"].includes(type)) {
    return undefined;
  }

  if (type === "openai-compatible" && !asString(record.baseUrl)) {
    return undefined;
  }

  return {
    provider: [
      "openai",
      "deepseek",
      "qwen",
      "kimi",
      "glm",
      "openrouter",
      "anthropic",
      "gemini",
      "custom",
    ].includes(provider)
      ? (provider as ClientProviderConfig["provider"])
      : "custom",
    type: type as ClientProviderConfig["type"],
    label: asString(record.label).slice(0, 80) || undefined,
    apiKey: asString(record.apiKey).slice(0, 600),
    baseUrl: asString(record.baseUrl).slice(0, 400) || undefined,
    model: asString(record.model).slice(0, 160),
  };
}

export async function GET(request: NextRequest) {
  const config = getDeepSeekPublicConfig();
  const url = new URL(request.url);

  if (url.searchParams.get("mode") === "status") {
    return NextResponse.json({
      ok: config.configured,
      status: config.configured ? "configured" : "missing-key",
      message: config.configured ? "DeepSeek API is configured." : "DeepSeek API key is not configured.",
      config,
    });
  }

  if (!config.configured) {
    return NextResponse.json({
      ok: false,
      status: "missing-key",
      message: "DeepSeek API key is not configured. Set DEEPSEEK_API_KEY in .env.local.",
      config,
    });
  }

  const rateLimit = consumeRateLimit(
    `provider-test:${getRequestClientKey(request)}`,
    20,
    10 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        status: "rate-limited",
        message: "Too many connection tests. Please wait before trying again.",
        config,
      },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  try {
    const content = await askDeepSeek({
      message: 'Reply with exactly: "connection ok"',
      course: "general",
      taskType: "qa",
      model: config.model,
      detectedLanguage: "en",
    });

    return NextResponse.json({
      ok: true,
      status: "ok",
      message: content || "Connection ok.",
      config,
    });
  } catch (error) {
    if (error instanceof DeepSeekError) {
      return NextResponse.json({
        ok: false,
        status: error.code,
        message: error.message,
        config,
      });
    }

    return NextResponse.json({
      ok: false,
      status: "unknown-error",
      message: "An unknown error occurred while testing the DeepSeek connection.",
      config,
    });
  }
}

export async function POST(request: NextRequest) {
  const config = getDeepSeekPublicConfig();
  const rateLimit = consumeRateLimit(
    `provider-test:${getRequestClientKey(request)}`,
    20,
    10 * 60 * 1000,
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        status: "rate-limited",
        message: "Too many connection tests. Please wait before trying again.",
        config,
      },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  try {
    const body = await readJsonRequest<Record<string, unknown>>(request, 32 * 1024);
    const clientProvider = sanitizeClientProvider(body.clientProvider);

    if (!clientProvider) {
      return NextResponse.json(
        {
          ok: false,
          status: "invalid-provider",
          message: "Enter a provider, model, and API key. OpenAI-compatible providers also need a Base URL.",
          config,
        },
        { status: 400 },
      );
    }

    const content = await askDeepSeek({
      message: 'Reply with exactly: "connection ok"',
      course: "general",
      taskType: "qa",
      model: clientProvider.model,
      detectedLanguage: "en",
      clientProvider,
    });

    return NextResponse.json({
      ok: true,
      status: "ok",
      message: content || "Connection ok.",
      config: {
        ...config,
        configured: true,
        baseUrl: clientProvider.baseUrl?.replace(/\/$/, "") ?? clientProvider.label ?? clientProvider.provider,
        model: clientProvider.model,
      },
    });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json(
        { ok: false, status: error.code, message: error.message, config },
        { status: error.status },
      );
    }

    if (error instanceof DeepSeekError) {
      return NextResponse.json(
        {
          ok: false,
          status: error.code,
          message: error.message,
          config,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        status: "unknown-error",
        message: "An unknown error occurred while testing the custom provider.",
        config,
      },
      { status: 500 },
    );
  }
}
