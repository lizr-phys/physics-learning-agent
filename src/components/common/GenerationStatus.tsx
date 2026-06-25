"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import type { AgentModule, TaskTypeId } from "@/types/learning";

const stages: Record<string, string[]> = {
  practice: ["正在构造题目条件...", "正在生成提示与解析...", "正在检查公式格式..."],
  types: ["正在识别题型结构...", "正在整理标准解法...", "正在生成原创例题..."],
  review: ["正在整理知识结构...", "正在提取主要公式...", "正在组织典型题型..."],
  derivation: ["正在确认推导前提...", "正在生成推导步骤...", "正在检查符号一致性..."],
  chat: ["正在组织回答...", "正在补充必要解释...", "正在检查表达与公式..."],
};

type GenerationStatusProps = {
  module?: AgentModule;
  taskType?: TaskTypeId;
  hasContent?: boolean;
};

export function GenerationStatus({
  module = "chat",
  taskType,
  hasContent = false,
}: GenerationStatusProps) {
  const key = taskType === "derivation" ? "derivation" : module;
  const labels = stages[key] ?? stages.chat;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % labels.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, [labels.length]);

  return (
    <div
      className={`flex min-h-6 items-center gap-2 text-xs text-zinc-500 ${
        hasContent ? "opacity-70" : ""
      }`}
      aria-live="polite"
    >
      <Loader2 size={13} className="shrink-0 animate-spin" />
      <span>{labels[index]}</span>
    </div>
  );
}
