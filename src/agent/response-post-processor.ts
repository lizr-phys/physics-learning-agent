import type { AgentIntent } from "@/types/learning";

export const generalQuestionReminder =
  "这个问题我可以帮你处理，不过这个助手更适合用来讨论大学物理、数学物理方法和四大力学相关问题。";

export function getResponseSuffix(intent: AgentIntent) {
  return intent === "general_question" ? generalQuestionReminder : "";
}

export function appendResponseSuffix(content: string, intent: AgentIntent) {
  const suffix = getResponseSuffix(intent);
  const trimmed = content.trimEnd();

  if (!suffix || trimmed.endsWith(suffix)) {
    return content;
  }

  return `${trimmed}\n\n${suffix}`;
}
