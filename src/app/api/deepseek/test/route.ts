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
      message: config.configured ? "DeepSeek API 已配置。" : "DeepSeek API Key 未配置。",
      config,
    });
  }

  if (!config.configured) {
    return NextResponse.json({
      ok: false,
      status: "missing-key",
      message: "DeepSeek API Key 未配置。请在 .env.local 中设置 DEEPSEEK_API_KEY。",
      config,
    });
  }

  try {
    const content = await askDeepSeek({
      message: "请只回复“连接成功”。",
      course: "math-physics",
      taskType: "qa",
      model: config.model,
    });

    return NextResponse.json({
      ok: true,
      status: "ok",
      message: content || "连接成功",
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
      message: "测试 DeepSeek 连接时发生未知错误。",
      config,
    });
  }
}
