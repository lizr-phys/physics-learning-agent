import { AgentStreamError } from "@/lib/read-agent-stream";
import type { StoredChatSession } from "@/lib/storage";
import type { AgentRequest, ChatMessage } from "@/types/learning";

export type PendingContinuation = {
  sessionId: string;
  assistantMessageId: string;
  request: AgentRequest;
  messagesBeforeAssistant: ChatMessage[];
  firstMessage: string;
  partialContent: string;
};

export function recoverChatRequest(session: StoredChatSession): PendingContinuation | null {
  const assistant = session.messages.at(-1);
  const user = session.messages.at(-2);
  if (assistant?.role !== "assistant" || !assistant.id ||
    !["streaming", "error", "interrupted"].includes(assistant.status ?? "") ||
    user?.role !== "user" || (!user.content.trim() && !user.images?.length)) return null;

  const history = session.messages.slice(0, -2);
  return {
    sessionId: session.id,
    assistantMessageId: assistant.id,
    messagesBeforeAssistant: session.messages.slice(0, -1),
    firstMessage: session.messages[0]?.content || user.content,
    partialContent: assistant.content,
    request: {
      ...session.context,
      module: "chat",
      message: user.content,
      images: user.images,
      history,
      memory: session.memory,
      toolContext: session.toolContext,
      conversationId: session.id,
      assistantMessageId: assistant.id,
    },
  };
}

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
