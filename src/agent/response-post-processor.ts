import type { AgentIntent, DetectedLanguage } from "@/types/learning";

export const generalQuestionReminderEn =
  "This assistant can help with that, but it is primarily designed for undergraduate physics, mathematical methods, and related STEM learning questions.";

export const generalQuestionReminderZh =
  "这个问题我可以帮你处理，不过这个助手更适合用来讨论大学物理、数学物理方法和相关理工科学习问题。";

export function getResponseSuffix(intent: AgentIntent, language: DetectedLanguage = "en") {
  if (intent !== "general_question") {
    return "";
  }

  return language === "zh" ? generalQuestionReminderZh : generalQuestionReminderEn;
}

export function appendResponseSuffix(
  content: string,
  intent: AgentIntent,
  language: DetectedLanguage = "en",
) {
  const suffix = getResponseSuffix(intent, language);
  const trimmed = content.trimEnd();

  if (!suffix || trimmed.endsWith(suffix)) {
    return content;
  }

  return `${trimmed}\n\n${suffix}`;
}
