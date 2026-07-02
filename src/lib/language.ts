import type { DetectedLanguage } from "@/types/learning";

const hanRegex = /[\u3400-\u9fff]/g;
const latinWordRegex = /[A-Za-z]{2,}/g;

export function detectLanguage(text: string, fallback: DetectedLanguage = "en"): DetectedLanguage {
  const hanCount = (text.match(hanRegex) ?? []).length;
  const latinCount = (text.match(latinWordRegex) ?? []).join("").length;

  if (hanCount === 0 && latinCount === 0) {
    return fallback;
  }

  if (hanCount >= 4 || hanCount > latinCount * 0.25) {
    return "zh";
  }

  return "en";
}

export function languageName(language: DetectedLanguage) {
  return language === "zh" ? "Chinese" : "English";
}
