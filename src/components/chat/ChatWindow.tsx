"use client";

import { memo } from "react";

import { ChatMessage } from "@/components/chat/ChatMessage";
import { WelcomePrompts } from "@/components/chat/WelcomePrompts";
import type {
  AnswerFeedback,
  ChatMessage as ChatMessageType,
} from "@/types/learning";

type ChatWindowProps = {
  messages: ChatMessageType[];
  onPickPrompt: (prompt: string) => void;
  onFeedback: (messageId: string, feedback?: AnswerFeedback) => void;
};

export const ChatWindow = memo(function ChatWindow({
  messages,
  onPickPrompt,
  onFeedback,
}: ChatWindowProps) {
  if (!messages.length) {
    return <WelcomePrompts onPick={onPickPrompt} />;
  }

  const lastAssistantIndex = messages.findLastIndex((message) => message.role === "assistant");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 md:py-8">
      {messages.map((message, index) => (
        <ChatMessage
          key={message.id ?? `${message.role}-${index}`}
          message={message}
          showOutline={index === lastAssistantIndex}
          onFeedback={onFeedback}
        />
      ))}
    </div>
  );
});
