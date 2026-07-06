"use client";

import Image from "next/image";
import { memo } from "react";

import { ContentOutline } from "@/components/common/ContentOutline";
import { MarkdownRenderer } from "@/components/common/MarkdownRenderer";
import type { ChatMessage as ChatMessageType } from "@/types/learning";

type ChatMessageProps = {
  message: ChatMessageType;
  showOutline?: boolean;
};

export const ChatMessage = memo(function ChatMessage({
  message,
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
      <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white">
        <Image src="/logo.png" alt="Physics Learning Agent" width={20} height={20} className="object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        {message.content ? (
          <div className="space-y-3">
            {showOutline && message.status === "complete" && message.content.length > 700 ? (
              <ContentOutline content={message.content} />
            ) : null}
            <MarkdownRenderer
              content={message.content}
              streaming={message.status === "streaming"}
            />
          </div>
        ) : (
          <div className="text-sm text-zinc-500">Waiting for the model...</div>
        )}
      </div>
    </div>
  );
});
