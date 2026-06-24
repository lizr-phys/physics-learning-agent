import { classifyQuery, isPhysicsLikeQuery } from "@/lib/query-classifier";
import type { AgentRequest, TaskTypeId } from "@/types/learning";

export type AgentModelConfig = {
  temperature: number;
  max_tokens: number;
};

export function getModelConfig(input: AgentRequest): AgentModelConfig {
  const intent = input.intent;
  const queryType = input.queryType ?? classifyQuery(input);

  if (intent === "meta_question") {
    return { temperature: 0.2, max_tokens: 900 };
  }

  if (intent === "general_question" || !isPhysicsLikeQuery(queryType)) {
    if (queryType === "coding") {
      return { temperature: 0.3, max_tokens: 1800 };
    }

    if (queryType === "writing") {
      return { temperature: 0.45, max_tokens: 1600 };
    }

    return { temperature: 0.35, max_tokens: 1200 };
  }

  const taskType = input.taskType ?? "qa";

  if (taskType === "practice") {
    const count = input.exerciseCount ?? 5;
    return {
      temperature: 0.45,
      max_tokens: count === 10 ? 8000 : count === 5 ? 5200 : 3000,
    };
  }

  const configMap: Record<TaskTypeId, AgentModelConfig> = {
    qa: { temperature: 0.3, max_tokens: 1200 },
    explain: { temperature: 0.3, max_tokens: 1600 },
    derivation: { temperature: 0.25, max_tokens: 2600 },
    "solution-guide": { temperature: 0.25, max_tokens: 2600 },
    "problem-types": { temperature: 0.35, max_tokens: 3600 },
    practice: { temperature: 0.45, max_tokens: 3000 },
    "section-review": { temperature: 0.3, max_tokens: 4000 },
    "review-plan": { temperature: 0.3, max_tokens: 2200 },
    misconceptions: { temperature: 0.3, max_tokens: 1600 },
  };

  return configMap[taskType];
}
