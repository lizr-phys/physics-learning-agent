import type { ChatMessage, LearningMemory } from "@/types/learning";

const defaultMessageBudget = 14_000;
const defaultMessageLimit = 14;

export function selectConversationHistory(
  messages: ChatMessage[] = [],
  options: { charBudget?: number; messageLimit?: number } = {},
) {
  const charBudget = options.charBudget ?? defaultMessageBudget;
  const messageLimit = options.messageLimit ?? defaultMessageLimit;
  const selected: ChatMessage[] = [];
  let usedCharacters = 0;

  for (const message of [...messages].reverse()) {
    const content = message.content.trim();

    if (!content || (message.role !== "user" && message.role !== "assistant")) {
      continue;
    }

    const remaining = charBudget - usedCharacters;

    if (remaining <= 0 || selected.length >= messageLimit) {
      break;
    }

    selected.push({
      ...message,
      content: content.slice(Math.max(0, content.length - remaining)),
    });
    usedCharacters += Math.min(content.length, remaining);
  }

  return selected.reverse();
}

export function buildConversationSummary(
  messages: ChatMessage[],
  memory?: LearningMemory,
) {
  const userMessages = messages
    .filter((message) => message.role === "user" && message.content.trim())
    .slice(-4)
    .map((message) => message.content.replace(/\s+/g, " ").trim().slice(0, 180));

  const parts = [
    memory?.currentGoal ? `Current goal: ${memory.currentGoal}` : "",
    memory?.currentKnowledgePoint
      ? `Current topic: ${memory.currentKnowledgePoint}`
      : "",
    memory?.recentConfusions.length
      ? `Recent confusions: ${memory.recentConfusions.slice(-3).join("; ")}`
      : "",
    memory?.recentLanguage ? `Recent language: ${memory.recentLanguage}` : "",
    memory?.practiceStyle ? `Practice style: ${memory.practiceStyle}` : "",
    userMessages.length ? `Recent user questions: ${userMessages.join("; ")}` : "",
  ].filter(Boolean);

  return parts.join("\n").slice(0, 1800);
}
