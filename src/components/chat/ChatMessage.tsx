"use client";

import dynamic from "next/dynamic";
import { memo } from "react";

import { ContentOutline } from "@/components/common/ContentOutline";
import { StudyActions } from "@/components/common/StudyActions";
import type { ChatMessage as ChatMessageType } from "@/types/learning";

const MarkdownRenderer = dynamic(
  () => import("@/components/common/MarkdownRenderer").then((module) => module.MarkdownRenderer),
  {
    ssr: false,
    loading: () => <div className="text-sm text-zinc-500">正在排版公式...</div>,
  },
);

type ChatMessageProps = {
  message: ChatMessageType;
  sessionId?: string;
  showOutline?: boolean;
};

export const ChatMessage = memo(function ChatMessage({
  message,
  sessionId,
  showOutline = false,
}: ChatMessageProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end" data-testid="user-message">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-[18px] bg-[#f4f4f5] px-4 py-2.5 text-sm leading-6 text-zinc-950 sm:max-w-[70%]">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3" data-testid="assistant-message">
      <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white">
        P
      </div>
      <div className="min-w-0 flex-1">
        {message.content && message.status === "streaming" ? (
          <pre className="whitespace-pre-wrap break-words font-sans text-[0.95rem] leading-7 text-zinc-800">
            {message.content}
          </pre>
        ) : message.content ? (
          <div className="space-y-3">
            {showOutline && message.status === "complete" && message.content.length > 700 ? (
              <ContentOutline content={message.content} />
            ) : null}
            <MarkdownRenderer content={message.content} />
            {message.status === "complete" ? (
              <div className="flex justify-end">
                <StudyActions
                  title={message.content.split(/\r?\n/).find(Boolean)?.replace(/^#+\s*/, "").slice(0, 60) || "聊天回答"}
                  content={message.content}
                  source="chat"
                  type="answer"
                  sessionId={sessionId}
                  compact
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-zinc-500">正在等待模型返回...</div>
        )}
      </div>
    </div>
  );
});
