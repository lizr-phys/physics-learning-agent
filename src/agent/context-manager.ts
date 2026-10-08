import { detectCourseFromText, detectExerciseCount, detectKnowledgeFromText, detectNamedCourseFromText, detectPracticeStyleFromText } from "@/agent/exercise-parser";
import { IMAGE_LIMITS, requestImageRefs } from "@/lib/image-attachments";
import { getKnowledgeItem } from "@/data/knowledge";
import { resolvePracticeStyle, resolveReferenceProfile } from "@/data/referenceProfiles";
import { detectExplicitLanguage, detectLanguage, isShortContextFollowUp } from "@/lib/language";
import type { AgentRequest, ChatMessage, ContextProvenance, LearningMemory } from "@/types/learning";

const defaultMessageBudget = 14_000;
const defaultMessageLimit = 14;
export const defaultContextCharBudget = 24_000;

export function estimateContextTokens(content: string) {
  const cjk = (content.match(/[\u3400-\u9fff]/g) ?? []).length;
  return cjk + Math.ceil((content.length - cjk) / 3);
}

/** Current text is authoritative; inferred client fields are not explicit user preferences. */
export function resolveLearningContext(input: AgentRequest): AgentRequest {
  const now = Date.now();
  const previous = input.memory;
  const followUp = isShortContextFollowUp(input.message);
  const explicitLanguage = detectExplicitLanguage(input.message);
  const language = explicitLanguage ?? (followUp && previous?.recentLanguage
    ? previous.recentLanguage
    : input.module === "practice" && input.detectedLanguage
      ? input.detectedLanguage
      : detectLanguage(input.message, previous?.recentLanguage ?? input.detectedLanguage ?? "en"));
  const detectedCourse = detectNamedCourseFromText(input.message);
  const selectedCourse = input.course && input.course !== "general" ? input.course : undefined;
  const inferredCourse = detectCourseFromText(input.message);
  const course = detectedCourse ?? selectedCourse ?? inferredCourse ?? previous?.currentCourse ?? "general";
  const changedCourse = Boolean(previous?.currentCourse && previous.currentCourse !== course);
  const detectedTopic = detectKnowledgeFromText(input.message, course);
  const selectedTopic = getKnowledgeItem(input.knowledgePoint);
  const rememberedTopic = getKnowledgeItem(previous?.currentKnowledgePoint);
  const validSelectedTopic = selectedTopic ? selectedTopic.course === course : !changedCourse;
  const validRememberedTopic = rememberedTopic ? rememberedTopic.course === course : !changedCourse;
  const knowledgePoint = detectedTopic
    ?? (validSelectedTopic ? input.knowledgePoint : undefined)
    ?? (validRememberedTopic ? previous?.currentKnowledgePoint : undefined);
  const detectedStyle = detectPracticeStyleFromText(input.message);
  const selectedStyle = input.practiceStyle && input.practiceStyle !== "auto"
    && (input.module === "practice" || input.contextProvenance?.practiceStyle?.source === "current-selection"
      || input.practiceStyle !== previous?.practiceStyle) ? input.practiceStyle : undefined;
  const practiceStyle = detectedStyle ?? selectedStyle
    ?? (followUp ? previous?.practiceStyle : undefined)
    ?? resolvePracticeStyle({ language });
  const selectedProfile = !explicitLanguage && input.referenceProfile && input.referenceProfile !== "auto"
    && (input.contextProvenance?.referenceProfile?.source === "current-selection"
      || input.referenceProfile !== previous?.referenceProfile) ? input.referenceProfile : undefined;
  const referenceProfile = resolveReferenceProfile({
    language,
    // A language switch resets inferred conventions; explicit current exam styles remain meaningful.
    practiceStyle: detectedStyle ?? selectedStyle ?? (followUp && !explicitLanguage ? practiceStyle : "auto"),
    referenceProfile: selectedProfile,
  });
  const contextProvenance: ContextProvenance = {
    course: { source: detectedCourse ? "current-input" : selectedCourse ? "current-selection" : inferredCourse ? "current-input" : previous?.currentCourse ? "history" : "default", updatedAt: now },
    knowledgePoint: { source: detectedTopic ? "current-input" : validSelectedTopic && input.knowledgePoint ? "current-selection" : knowledgePoint ? "history" : "default", updatedAt: now },
    language: { source: explicitLanguage ? "current-input" : followUp && previous?.recentLanguage ? "history" : "current-input", updatedAt: now },
    practiceStyle: { source: detectedStyle ? "current-input" : selectedStyle ? "current-selection" : followUp && previous?.practiceStyle ? "history" : "default", updatedAt: now },
    referenceProfile: { source: selectedProfile ? "current-selection" : explicitLanguage || detectedStyle ? "current-input" : "default", updatedAt: now },
  };
  return { ...input, course, knowledgePoint, detectedLanguage: language, practiceStyle, referenceProfile,
    exerciseCount: detectExerciseCount(input.message) ?? input.exerciseCount, contextProvenance };
}

/** Paragraphs, fenced code and display-math environments are indivisible budget units. */
export function splitContextBlocks(content: string): string[] {
  const blocks: string[] = [];
  let lines: string[] = [];
  let fence = "";
  let displayMath = false;
  let bracketMath = false;
  let environment = "";
  const flush = () => { const block = lines.join("\n").trim(); if (block) blocks.push(block); lines = []; };
  for (const line of content.replace(/\r\n?/g, "\n").split("\n")) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch && !displayMath && !bracketMath && !environment) {
      if (!fence) { flush(); fence = fenceMatch[1][0]; }
      else if (fenceMatch[1][0] === fence) { lines.push(line); fence = ""; flush(); continue; }
    }
    if (!fence) {
      const dollars = (line.match(/(?<!\\)\$\$/g) ?? []).length;
      if (dollars % 2) displayMath = !displayMath;
      if (line.includes("\\[")) bracketMath = true;
      if (line.includes("\\]")) bracketMath = false;
      const begin = line.match(/\\begin\{(equation\*?|align\*?|aligned|gather\*?|gathered|multline\*?|cases|[pbvBV]?matrix)\}/)?.[1];
      if (begin) environment = begin;
      if (environment && line.includes(`\\end{${environment}}`)) environment = "";
    }
    if (!trimmed && !fence && !displayMath && !bracketMath && !environment) flush();
    else lines.push(line);
  }
  flush();
  return blocks;
}

export function selectContextExcerpt(content: string, budget: number): string {
  const normalized = content.trim();
  if (normalized.length <= budget) return normalized;
  const blocks = splitContextBlocks(normalized);
  const selected: Array<{ index: number; content: string }> = [];
  let used = 0;
  const ranked = blocks.map((block, index) => ({ index, content: block,
    priority: /\$|\\(?:begin|\[)|boundary|condition|assum|symbol|where|therefore|thus|conclu|条件|假设|符号|定义|因此|结论/i.test(block) ? 2 : 1,
  })).sort((left, right) => right.priority - left.priority || left.index - right.index);
  for (const block of ranked) {
    const cost = block.content.length + (selected.length ? 2 : 0);
    if (used + cost <= budget) { selected.push(block); used += cost; }
  }
  return selected.sort((left, right) => left.index - right.index).map((block) => block.content).join("\n\n");
}

export function selectContinuationExcerpt(content: string, budget: number): string {
  if (content.trim().length <= budget) return content.trim();
  const marker = "[Earlier prose omitted; retained conditions and final continuation blocks follow.]\n\n";
  if (budget <= marker.length) return "";
  const blocks = splitContextBlocks(content);
  const lastFormula = blocks.findLastIndex((block) => /\$|\\(?:begin|\[)/.test(block));
  const ranked = blocks.map((block, index) => ({ index, content: block,
    priority: index === blocks.length - 1 ? 10 : index === lastFormula ? 9
      : /boundary|condition|assum|symbol|where|条件|假设|符号|定义/i.test(block) ? 8 : 1,
  })).sort((left, right) => right.priority - left.priority || right.index - left.index);
  const selected: typeof ranked = [];
  let used = marker.length;
  for (const block of ranked) {
    const cost = block.content.length + (selected.length ? 2 : 0);
    if (used + cost <= budget) { selected.push(block); used += cost; }
  }
  return selected.length ? marker + selected.sort((left, right) => left.index - right.index).map((block) => block.content).join("\n\n") : "";
}

export function selectConversationHistory(messages: ChatMessage[] = [], options: { charBudget?: number; messageLimit?: number } = {}) {
  const selected: ChatMessage[] = [];
  let usedCharacters = 0;
  const charBudget = options.charBudget ?? defaultMessageBudget;
  const latestAssistant = messages.findLast((message) => message.role === "assistant");
  for (const message of [...messages].reverse()) {
    if ((!message.content.trim() && !message.images?.length) || (message.role !== "user" && message.role !== "assistant")) continue;
    if (selected.length >= (options.messageLimit ?? defaultMessageLimit)) break;
    let content = message.content.trim();
    if (message === latestAssistant && (message.status === "interrupted" || message.status === "error")) {
      content = selectContinuationExcerpt(content, charBudget - usedCharacters);
    }
    if (!content && message.images?.length) content = "Attached image";
    if (!content) continue;
    // Skip oversized old turns rather than retaining a tail without its assumptions.
    if (usedCharacters + content.length > charBudget) continue;
    selected.push({ ...message, content });
    usedCharacters += content.length;
  }
  return selected.reverse();
}

export function buildConversationSummary(messages: ChatMessage[], memory?: LearningMemory) {
  const parts = [
    memory?.currentGoal ? `Current goal: ${memory.currentGoal}` : "",
    memory?.currentKnowledgePoint ? `Current topic: ${memory.currentKnowledgePoint}` : "",
    memory?.recentConfusions.length ? `Recent confusions: ${memory.recentConfusions.slice(-3).join("; ")}` : "",
    memory?.recentLanguage ? `Recent language: ${memory.recentLanguage}` : "",
    memory?.practiceStyle ? `Practice style: ${memory.practiceStyle}` : "",
  ].filter(Boolean);
  for (const [index, message] of messages.slice(-8).entries()) {
    if (!message.content.trim()) continue;
    if (message.role === "assistant" && message.status && message.status !== "complete") continue;
    const excerpt = selectContextExcerpt(message.content, message.role === "assistant" ? 520 : 200);
    if (!excerpt) continue;
    const source = message.id ?? `legacy-turn-${messages.length - Math.min(messages.length, 8) + index}`;
    for (const block of splitContextBlocks(excerpt)) {
      parts.push(`[${source}] ${message.role === "assistant" ? "Prior explanation (unverified)" : "User question / constraints"}: ${block}`);
    }
  }
  return selectContextExcerpt(parts.join("\n\n"), 1800);
}

/** One shared allocation; the current question is never mechanically truncated. */
export function allocateRequestContext(input: AgentRequest, options: { charBudget?: number; messageLimit?: number } = {}): AgentRequest {
  if (input.contextBudget && options.charBudget === undefined && options.messageLimit === undefined) return input;
  const charBudget = Math.max(input.message.length, options.charBudget ?? defaultContextCharBudget);
  let used = input.message.length;
  const take = (content: string) => {
    const excerpt = selectContextExcerpt(content, Math.max(0, charBudget - used));
    used += excerpt.length;
    return excerpt;
  };
  const tool = input.toolContext;
  const selectedContent = tool?.selectedItem?.content ? take(tool.selectedItem.content) : undefined;
  let history = selectConversationHistory(input.history, {
    charBudget: Math.min(defaultMessageBudget, Math.max(0, charBudget - used)),
    messageLimit: options.messageLimit,
  });
  used += history.reduce((sum, message) => sum + message.content.length, 0);
  const imageIds = new Set([...(input.images ?? []), ...(input.toolContext?.images ?? [])].map(image => image.id));
  history = [...history].reverse().map(message => {
    const images = message.images?.filter(image => {
      if (imageIds.has(image.id)) return true;
      if (imageIds.size >= IMAGE_LIMITS.perRequest) return false;
      imageIds.add(image.id); return true;
    });
    return message.images?.length && images?.length !== message.images.length
      ? {...message,images,content:message.content + "\n[Earlier images omitted from this request. Ask for reattachment if needed.]"}
      : message;
  }).reverse();
  used = input.message.length + (selectedContent?.length ?? 0) + history.reduce((sum, message) => sum + message.content.length, 0);
  const selectedIds = new Set(history.map((message) => message.id).filter(Boolean));
  const previousSummary = (input.memory?.conversationSummary ?? "").split(/\n\n/)
    .filter((block) => !Array.from(selectedIds).some((id) => block.includes(`[${id}]`))).join("\n\n");
  const conversationSummary = previousSummary ? take(previousSummary) : undefined;
  const snippets = (input.ragContext?.snippets ?? []).filter((snippet, index, all) =>
    all.findIndex((candidate) => candidate.source === snippet.source && candidate.content === snippet.content) === index,
  ).flatMap((snippet) => {
    if (snippet.content.length > charBudget - used) return [];
    used += snippet.content.length;
    return [snippet];
  });
  const generatedContent = tool && !selectedContent ? take(tool.generatedContent) : "";
  return {
    ...input, history,
    memory: input.memory ? { ...input.memory, conversationSummary } : undefined,
    toolContext: tool ? { ...tool, generatedContent,
      selectedItem: tool.selectedItem ? { ...tool.selectedItem, content: selectedContent } : undefined } : undefined,
    ragContext: input.ragContext ? { ...input.ragContext, snippets } : snippets.length ? { snippets } : undefined,
    contextBudget: { charBudget, usedChars: used, estimatedTokens: estimateContextTokens([
      input.message, selectedContent, ...history.map((message) => message.content),
      conversationSummary, ...snippets.map((snippet) => snippet.content), generatedContent,
    ].filter(Boolean).join("")) + requestImageRefs({...input,history}).length * 1024,
      omittedMessages: (input.history?.length ?? 0) - history.length },
  };
}
