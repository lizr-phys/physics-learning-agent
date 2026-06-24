import "server-only";

import { selectConversationHistory } from "@/agent/context-manager";
import { detectCourseFromText, detectKnowledgeFromText } from "@/agent/exercise-parser";
import { classifyAgentIntent, isPhysicsIntent } from "@/agent/intent-classifier";
import { createLearningMemory, updateLearningMemory } from "@/agent/memory-manager";
import { classifyQuery } from "@/lib/query-classifier";
import { retrieveRagSnippets } from "@/rag/retrieve";
import type { AgentRequest } from "@/types/learning";

export type AgentWorkflowStage =
  | "understand-input"
  | "resolve-context"
  | "retrieve-knowledge"
  | "prepare-generation";

export type PreparedAgentRequest = {
  input: AgentRequest;
  stages: AgentWorkflowStage[];
};

export async function prepareAgentRequest(input: AgentRequest): Promise<PreparedAgentRequest> {
  const stages: AgentWorkflowStage[] = ["understand-input"];
  const intent = input.intent ?? classifyAgentIntent(input);
  const detectedCourse = detectCourseFromText(input.message);
  const course =
    input.course && input.course !== "general"
      ? input.course
      : detectedCourse ?? input.memory?.currentCourse ?? "general";
  const knowledgePoint =
    input.knowledgePoint ??
    detectKnowledgeFromText(input.message, course) ??
    input.memory?.currentKnowledgePoint;
  const contextInput: AgentRequest = {
    ...input,
    intent,
    course,
    knowledgePoint,
    queryType: input.queryType ?? classifyQuery({ ...input, course, knowledgePoint }),
    history: selectConversationHistory(input.history),
  };
  const memory = updateLearningMemory(
    input.memory ?? createLearningMemory(),
    contextInput,
    intent,
  );

  stages.push("resolve-context");

  const ragResults =
    contextInput.useRag && isPhysicsIntent(intent)
      ? await retrieveRagSnippets(contextInput.message, 4)
      : [];

  stages.push("retrieve-knowledge", "prepare-generation");

  return {
    stages,
    input: {
      ...contextInput,
      memory,
      ragContext: ragResults.length
        ? {
            snippets: ragResults.map((result) => ({
              source: result.source,
              heading: result.heading,
              content: result.content,
            })),
          }
        : undefined,
    },
  };
}
