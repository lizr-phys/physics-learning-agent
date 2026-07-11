import { classifyQuery, isPhysicsLikeQuery } from "@/lib/query-classifier";
import type { AgentIntent, AgentRequest } from "@/types/learning";

const exerciseTerms = [
  "出题",
  "练习题",
  "习题",
  "测验",
  "题库",
  "生成题目",
  "再出几道",
  "答案解析",
  "problem",
  "problems",
  "exercise",
  "exercises",
  "problem set",
  "assignment",
  "quiz",
  "generate",
  "make it harder",
  "harder",
];

const planningTerms = [
  "学习计划",
  "复习计划",
  "复习路线",
  "知识点梳理",
  "学习路径",
  "怎么学",
  "备考",
  "study plan",
  "learning plan",
  "roadmap",
  "how should i study",
];

const physicsStudyActionTerms = [
  "复习",
  "预习",
  "梳理",
  "总结",
  "巩固",
  "备考",
  "review",
  "revise",
  "recap",
  "summarize",
];

const metaTerms = [
  "你能做什么",
  "怎么使用",
  "如何使用",
  "这个助手",
  "这个 agent",
  "功能有哪些",
  "支持什么",
  "api 设置",
  "what can you do",
  "how do i use",
  "how to use",
  "this assistant",
  "features",
  "api settings",
];

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export function classifyAgentIntent(input: AgentRequest): AgentIntent {
  const text = input.message.toLowerCase();
  const queryType = classifyQuery(input);
  const physicsLike = isPhysicsLikeQuery(queryType);

  if (includesAny(text, metaTerms)) {
    return "meta_question";
  }

  if (
    input.taskType === "practice" ||
    (includesAny(text, exerciseTerms) && physicsLike)
  ) {
    return "exercise_generation";
  }

  if (
    input.taskType === "study-plan" ||
    (includesAny(text, planningTerms) && physicsLike) ||
    (includesAny(text, physicsStudyActionTerms) && physicsLike)
  ) {
    return "study_planning";
  }

  if (physicsLike) {
    return "physics_learning";
  }

  return "general_question";
}

export function isPhysicsIntent(intent: AgentIntent) {
  return (
    intent === "physics_learning" ||
    intent === "exercise_generation" ||
    intent === "study_planning"
  );
}
