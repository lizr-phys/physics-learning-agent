import "server-only";

import { selectConversationHistory } from "@/agent/context-manager";
import {
  detectCourseFromText,
  detectKnowledgeFromText,
  detectPracticeStyleFromText,
} from "@/agent/exercise-parser";
import { classifyAgentIntent, isPhysicsIntent } from "@/agent/intent-classifier";
import { createLearningMemory, updateLearningMemory } from "@/agent/memory-manager";
import { resolvePracticeStyle, resolveReferenceProfile } from "@/data/referenceProfiles";
import { detectLanguage } from "@/lib/language";
import { retrievePersonalKnowledge } from "@/lib/personal-knowledge";
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

export async function prepareAgentRequest(
  input: AgentRequest,
  options: { userId?: string } = {},
): Promise<PreparedAgentRequest> {
  const stages: AgentWorkflowStage[] = ["understand-input"];
  const intent = input.intent ?? classifyAgentIntent(input);
  const language =
    input.detectedLanguage ?? detectLanguage(input.message, input.memory?.recentLanguage ?? "en");
  const practiceStyle =
    input.practiceStyle ??
    detectPracticeStyleFromText(input.message) ??
    input.memory?.practiceStyle ??
    resolvePracticeStyle({ language });
  const referenceProfile =
    input.referenceProfile ??
    resolveReferenceProfile({
      language,
      practiceStyle,
      referenceProfile: input.memory?.referenceProfile,
    });
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
    detectedLanguage: language,
    practiceStyle,
    referenceProfile,
    queryType: input.queryType ?? classifyQuery({ ...input, course, knowledgePoint }),
    history: selectConversationHistory(input.history),
  };
  const memory = updateLearningMemory(
    input.memory ?? createLearningMemory(),
    contextInput,
    intent,
  );

  stages.push("resolve-context");

  const personalRagResults = options.userId
    ? await retrievePersonalKnowledge(options.userId, contextInput.message, 4)
    : [];
  const sampleRagResults =
    contextInput.useRag && isPhysicsIntent(intent)
      ? await retrieveRagSnippets(contextInput.message, 4)
      : [];
  const ragResults = [...personalRagResults, ...sampleRagResults].slice(0, 6);

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
