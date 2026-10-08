import { AgentStreamError } from "@/lib/read-agent-stream";
import type { ChatMessage } from "@/types/learning";

export function buildContinuationMessage(originalMessage: string) {
  return `The previous answer stopped at the following point. Do not repeat existing content. Continue from the interruption point while preserving the structure, numbering, notation, language, and LaTeX format.

Original user request:
${originalMessage}

Continue the interrupted assistant answer included in the conversation history.`;
}

export function withAssistantMessage(
  messagesBeforeAssistant: ChatMessage[],
  assistantMessageId: string,
  content: string,
  status: ChatMessage["status"] = "streaming",
  requestId?: string,
) {
  const assistantMessage: ChatMessage = {
    id: assistantMessageId,
    role: "assistant",
    content,
    createdAt: Date.now(),
    status,
    requestId,
  };
  const existingIndex = messagesBeforeAssistant.findIndex(
    (message) => message.id === assistantMessageId,
  );

  if (existingIndex < 0) {
    return [...messagesBeforeAssistant, assistantMessage];
  }

  return messagesBeforeAssistant.map((message, index) =>
    index === existingIndex ? { ...message, ...assistantMessage } : message,
  );
}

export function isAbortLikeError(error: unknown) {
  if (error instanceof AgentStreamError) {
    return error.reason === "abort";
  }

  return error instanceof DOMException && error.name === "AbortError";
}
