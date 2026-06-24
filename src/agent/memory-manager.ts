import { getKnowledgeItem, knowledgeItems } from "@/data/knowledge";
import type {
  AgentIntent,
  AgentRequest,
  CourseId,
  LearningMemory,
  LearningProfile,
} from "@/types/learning";

const confusionTerms = ["为什么", "不理解", "不明白", "区别", "怎么来的", "哪里错", "困惑"];

function uniqueRecent(items: string[], limit: number) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(-limit);
}

export function createLearningMemory(): LearningMemory {
  return {
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
    updatedAt: Date.now(),
  };
}

function inferPreferredStyle(message: string, current: LearningMemory["preferredStyle"]) {
  if (/一步一步|详细推导|每一步|完整过程/.test(message)) {
    return "step-by-step";
  }

  if (/简短|简洁|只要结论|概括/.test(message)) {
    return "concise";
  }

  return current;
}

function inferMentionedConcepts(message: string) {
  return knowledgeItems
    .filter(
      (item) =>
        message.includes(item.title) ||
        item.alias?.some((alias) => message.toLowerCase().includes(alias.toLowerCase())),
    )
    .map((item) => item.title)
    .slice(0, 4);
}

function buildGoal(input: AgentRequest, intent: AgentIntent) {
  if (intent === "exercise_generation") {
    return `围绕${input.knowledgePoint ?? input.message.slice(0, 60)}进行练习训练`;
  }

  if (intent === "study_planning") {
    return `整理并复习${input.knowledgePoint ?? input.message.slice(0, 60)}`;
  }

  if (intent === "physics_learning") {
    return `理解${input.knowledgePoint ?? input.message.slice(0, 60)}`;
  }

  return undefined;
}

export function updateLearningMemory(
  previous: LearningMemory | undefined,
  input: AgentRequest,
  intent: AgentIntent,
) {
  const current = previous ?? createLearningMemory();
  const selectedKnowledge = getKnowledgeItem(input.knowledgePoint);
  const mentionedConcepts = inferMentionedConcepts(input.message);
  const currentKnowledgePoint =
    selectedKnowledge?.title ?? mentionedConcepts[0] ?? current.currentKnowledgePoint;
  const isConfusion = confusionTerms.some((term) => input.message.includes(term));
  const exerciseTopic =
    intent === "exercise_generation"
      ? currentKnowledgePoint ?? input.message.replace(/\s+/g, " ").slice(0, 80)
      : "";

  return {
    ...current,
    currentCourse:
      input.course && input.course !== "general" ? input.course : current.currentCourse,
    currentKnowledgePoint,
    currentGoal: buildGoal(input, intent) ?? current.currentGoal,
    recentConfusions: uniqueRecent(
      [...current.recentConfusions, isConfusion ? input.message.slice(0, 160) : ""],
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
    updatedAt: Date.now(),
  } satisfies LearningProfile;
}

export function formatLearningMemory(memory?: LearningMemory) {
  if (!memory) {
    return "暂无结构化学习记忆。";
  }

  const course = memory.currentCourse as CourseId | undefined;
  return [
    course ? `持续课程：${course}` : "",
    memory.currentKnowledgePoint ? `持续知识点：${memory.currentKnowledgePoint}` : "",
    memory.currentGoal ? `当前学习目标：${memory.currentGoal}` : "",
    memory.recentConfusions.length
      ? `尚需关注的困惑：${memory.recentConfusions.slice(-3).join("；")}`
      : "",
    memory.coveredConcepts.length
      ? `已讨论概念：${memory.coveredConcepts.slice(-6).join("；")}`
      : "",
    memory.exerciseTopics.length
      ? `最近练习方向：${memory.exerciseTopics.slice(-4).join("；")}`
      : "",
    `偏好讲解方式：${memory.preferredStyle}`,
    memory.conversationSummary ? `长对话摘要：${memory.conversationSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
