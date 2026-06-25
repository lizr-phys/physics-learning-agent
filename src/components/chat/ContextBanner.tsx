"use client";

import { Link2, X } from "lucide-react";

import type { ToolContext } from "@/types/learning";

const labels: Record<ToolContext["source"], string> = {
  review: "板块复习",
  practice: "练习题",
  types: "题型梳理",
};

type ContextBannerProps = {
  context: ToolContext;
  onClear: () => void;
};

export function ContextBanner({ context, onClear }: ContextBannerProps) {
  const title =
    context.selectedItem?.title ||
    context.topic ||
    context.knowledgeTitle ||
    context.taskTitle ||
    "来源内容";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">
        <div className="flex items-center gap-2">
          <Link2 size={14} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            当前基于：{labels[context.source]} · {title}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200 hover:text-zinc-950"
            aria-label="清除上下文"
          >
            <X size={14} />
          </button>
        </div>
        <details className="mt-1 text-xs text-zinc-500">
          <summary className="cursor-pointer">查看来源内容</summary>
          <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap border-t border-zinc-200 pt-2 leading-5">
            {context.selectedItem?.content ?? context.generatedContent}
          </p>
        </details>
      </div>
    </div>
  );
}
