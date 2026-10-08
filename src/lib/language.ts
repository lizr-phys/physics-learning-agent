import type { DetectedLanguage } from "@/types/learning";

const hanRegex = /[\u3400-\u9fff]/g;
const latinWordRegex = /[A-Za-z]{2,}/g;

export function detectExplicitLanguage(text: string): DetectedLanguage | undefined {
  const matches = Array.from(text.matchAll(
    /(?:answer|respond|reply|explain|write|output)(?:\s+\w+){0,3}\s+(?:in\s+)?(Chinese|English)\b|(?:用|使用|改成|切换到|请以)\s*(中文|汉语|英文|英语)|(?:requested\s+output\s+language|response\s+language)\s*:\s*(Chinese|English)/gi,
  )).filter((match) => !/(?:not|don't|do not|不要|不用)\s*$/i.test(text.slice(Math.max(0, (match.index ?? 0) - 12), match.index)));
  const last = matches.at(-1);
  const value = last?.[1] ?? last?.[2] ?? last?.[3];
  return value ? (/Chinese|中文|汉语/i.test(value) ? "zh" : "en") : undefined;
}

export function isShortContextFollowUp(text: string) {
  const normalized = text.trim().toLowerCase();
  return normalized.length < 110 && /^(?:continue\b|go on\b|why[?？.!。\s]*$|why (?:is|does) (?:that|this)|make (?:it|the next one) harder\b|(?:give me )?(?:another|next|more)\b|再来|再出|继续|为什么[？?。\s]*$|这(?:里|个|一步)|那(?:个|一步)|然后呢)/i.test(normalized);
}

export function detectLanguage(text: string, fallback: DetectedLanguage = "en"): DetectedLanguage {
  const explicit = detectExplicitLanguage(text);
  if (explicit) return explicit;
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
