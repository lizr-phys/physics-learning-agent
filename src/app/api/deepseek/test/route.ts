import { NextResponse } from "next/server";

import { askDeepSeek, DeepSeekError, getDeepSeekPublicConfig } from "@/lib/deepseek";

export const runtime = "nodejs";

export async function GET(request: Request) {
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
