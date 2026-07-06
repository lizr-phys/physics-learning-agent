import "server-only";

import { selectConversationHistory } from "@/agent/context-manager";
import {
  detectCourseFromText,
  detectKnowledgeFromText,
  detectPracticeStyleFromText,
} from "@/agent/exercise-parser";
import { classifyAgentIntent, isPhysicsIntent } from "@/agent/intent-classifier";
import { decidePersonalKnowledgeUse, resolveKnowledgeMode } from "@/agent/knowledge-mode";
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
  const queryType = input.queryType ?? classifyQuery({ ...input, course, knowledgePoint });
  const contextInput: AgentRequest = {
    ...input,
    intent,
    course,
    knowledgePoint,
    detectedLanguage: language,
    practiceStyle,
    referenceProfile,
    queryType,
    knowledgeMode: resolveKnowledgeMode(input.knowledgeMode),
    history: selectConversationHistory(input.history),
  };
  const memory = updateLearningMemory(
    input.memory ?? createLearningMemory(),
    contextInput,
    intent,
  );

  stages.push("resolve-context");

  const personalKnowledgeDecision = decidePersonalKnowledgeUse({
    request: {
      ...contextInput,
      memory,
    },
    mode: contextInput.knowledgeMode,
    intent,
    queryType,
    hasUser: Boolean(options.userId),
  });
  const personalRagResults =
    options.userId && personalKnowledgeDecision.shouldUse
      ? await retrievePersonalKnowledge(
          options.userId,
          personalKnowledgeDecision.retrievalQuery ?? contextInput.message,
          4,
        )
      : [];
  const sampleRagResults =
    contextInput.useRag && isPhysicsIntent(intent)
      ? await retrieveRagSnippets(contextInput.message, 4)
      : [];
  const ragResults = [
    ...personalRagResults.map((result) => ({ ...result, kind: "personal" as const })),
    ...sampleRagResults.map((result) => ({ ...result, kind: "sample" as const })),
  ].slice(0, 6);

  stages.push("retrieve-knowledge", "prepare-generation");

  return {
    stages,
    input: {
      ...contextInput,
      memory,
      personalKnowledgeDecision,
      ragContext: ragResults.length
        ? {
            snippets: ragResults.map((result) => ({
              source: result.source,
              heading: result.heading,
              content: result.content,
              kind: result.kind,
            })),
          }
        : undefined,
    },
  };
}
