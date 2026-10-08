import { buildConversationSummary, resolveLearningContext } from "@/agent/context-manager";
import { getKnowledgeItem, knowledgeItems } from "@/data/knowledge";
import type {
  AgentIntent,
  AgentRequest,
  CourseId,
  LearningMemory,
  LearningProfile,
} from "@/types/learning";

const confusionTerms = [
  "why",
  "confused",
  "do not understand",
  "difference",
  "where does",
  "why is",
  "为什么",
  "不理解",
  "不明白",
  "区别",
  "怎么来的",
  "哪里错",
  "困惑",
];

function uniqueRecent(items: string[], limit: number) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(-limit);
}

export function createLearningMemory(): LearningMemory {
  return {
    recentLanguage: "en",
    referenceProfile: "auto",
    practiceStyle: "auto",
    recentConfusions: [],
    coveredConcepts: [],
    exerciseTopics: [],
    preferredStyle: "balanced",
    updatedAt: Date.now(),
  };
}

export function createLearningProfile(): LearningProfile {
  return {
    courseFrequency: {},
    recentTopics: [],
    preferredStyle: "balanced",
    recentLanguage: "en",
    referenceProfile: "auto",
    practiceStyle: "auto",
    updatedAt: Date.now(),
  };
}

function inferPreferredStyle(message: string, current: LearningMemory["preferredStyle"]) {
  if (/step by step|detailed derivation|every step|一步一步|详细推导|每一步|完整过程/i.test(message)) {
    return "step-by-step";
  }

  if (/brief|concise|short answer|只要结论|简短|简洁|概括/i.test(message)) {
    return "concise";
  }

  return current;
}

function inferMentionedConcepts(message: string) {
  const normalized = message.toLowerCase();

  return knowledgeItems
    .filter(
      (item) =>
        normalized.includes(item.title.toLowerCase()) ||
        item.alias?.some((alias) => normalized.includes(alias.toLowerCase())),
    )
    .map((item) => item.title)
    .slice(0, 4);
}

function buildGoal(input: AgentRequest, intent: AgentIntent) {
  if (intent === "exercise_generation") {
    return `Practice around ${input.knowledgePoint ?? input.message.slice(0, 80)}`;
  }

  if (intent === "study_planning") {
    return `Plan study around ${input.knowledgePoint ?? input.message.slice(0, 80)}`;
  }

  if (intent === "physics_learning") {
    return `Understand ${input.knowledgePoint ?? input.message.slice(0, 80)}`;
  }

  return undefined;
}

export function updateLearningMemory(
  previous: LearningMemory | undefined,
  input: AgentRequest,
  intent: AgentIntent,
) {
  const current = previous ?? createLearningMemory();
  const resolved = resolveLearningContext({ ...input, memory: current });
  const isLearningTask = intent !== "general_question" && intent !== "meta_question";
  const selectedKnowledge = getKnowledgeItem(resolved.knowledgePoint);
  const mentionedConcepts = isLearningTask ? inferMentionedConcepts(input.message) : [];
  const currentKnowledgePoint = isLearningTask
    ? selectedKnowledge?.title ?? resolved.knowledgePoint
    : current.currentKnowledgePoint;
  const isConfusion = confusionTerms.some((term) => input.message.toLowerCase().includes(term));
  const exerciseTopic =
    intent === "exercise_generation"
      ? currentKnowledgePoint ?? input.message.replace(/\s+/g, " ").slice(0, 100)
      : "";

  return {
    ...current,
    currentCourse:
      isLearningTask && resolved.course !== "general" ? resolved.course : current.currentCourse,
    currentKnowledgePoint,
    currentGoal: buildGoal(resolved, intent) ?? current.currentGoal,
    recentLanguage: resolved.detectedLanguage,
    practiceStyle: resolved.practiceStyle,
    referenceProfile: resolved.referenceProfile,
    contextProvenance: resolved.contextProvenance,
    recentConfusions: uniqueRecent(
      [...current.recentConfusions, isConfusion ? input.message.slice(0, 200) : ""],
      6,
    ),
    coveredConcepts: uniqueRecent(
      [...current.coveredConcepts, ...mentionedConcepts, selectedKnowledge?.title ?? ""],
      12,
    ),
    exerciseTopics: uniqueRecent([...current.exerciseTopics, exerciseTopic], 8),
    preferredStyle: inferPreferredStyle(input.message, current.preferredStyle),
    updatedAt: Date.now(),
  } satisfies LearningMemory;
}

/** Called only after a provider terminal signal and output validation confirm completion. */
export function commitLearningMemory(input: AgentRequest, content: string): LearningMemory {
  const memory = updateLearningMemory(input.memory, input, input.intent ?? "physics_learning");
  const messages = [
    ...(input.history ?? []),
    { id: `${input.requestId ?? "current"}:user`, role: "user" as const, content: input.message },
    { id: input.assistantMessageId ?? `${input.requestId ?? "current"}:assistant`, role: "assistant" as const,
      content, status: "complete" as const },
  ];
  return { ...memory, conversationSummary: buildConversationSummary(messages, memory), updatedAt: Date.now() };
}

export function updateLearningProfile(
  previous: LearningProfile | undefined,
  memory: LearningMemory,
) {
  const profile = previous ?? createLearningProfile();
  const courseFrequency = { ...profile.courseFrequency };

  if (memory.currentCourse && memory.currentCourse !== "general") {
    courseFrequency[memory.currentCourse] = (courseFrequency[memory.currentCourse] ?? 0) + 1;
  }

  return {
    courseFrequency,
    recentTopics: uniqueRecent(
      [...profile.recentTopics, memory.currentKnowledgePoint ?? "", ...memory.exerciseTopics],
      12,
    ),
    preferredStyle: memory.preferredStyle,
    recentLanguage: memory.recentLanguage ?? profile.recentLanguage,
    practiceStyle: memory.practiceStyle ?? profile.practiceStyle,
    referenceProfile: memory.referenceProfile ?? profile.referenceProfile,
    updatedAt: Date.now(),
  } satisfies LearningProfile;
}

export function formatLearningMemory(memory?: LearningMemory) {
  if (!memory) {
    return "No structured learning memory.";
  }

  const course = memory.currentCourse as CourseId | undefined;

  return [
    course ? `Ongoing course: ${course}` : "",
    memory.currentKnowledgePoint ? `Ongoing topic: ${memory.currentKnowledgePoint}` : "",
    memory.currentGoal ? `Current learning goal: ${memory.currentGoal}` : "",
    memory.referenceProfile ? `Reference profile: ${memory.referenceProfile}` : "",
    memory.practiceStyle ? `Practice style: ${memory.practiceStyle}` : "",
    memory.preferredStyle ? `Preferred explanation style: ${memory.preferredStyle}` : "",
    memory.coveredConcepts.length ? `Covered concepts: ${memory.coveredConcepts.join("; ")}` : "",
    memory.recentConfusions.length ? `Recent confusions: ${memory.recentConfusions.join("; ")}` : "",
    memory.exerciseTopics.length ? `Recent exercise topics: ${memory.exerciseTopics.join("; ")}` : "",
    memory.conversationSummary ? `Conversation evidence (assistant explanations are unverified, not established facts):\n${memory.conversationSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
