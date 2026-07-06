import "server-only";

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

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
import type {
  AgentIntent,
  AgentRequest,
  CourseId,
  DetectedLanguage,
  LearningMemory,
  PersonalKnowledgeDecision,
  PracticeStyleId,
  QueryType,
  RagContext,
  ReferenceProfileId,
} from "@/types/learning";

export type AgentWorkflowStage =
  | "understand-input"
  | "resolve-context"
  | "update-memory"
  | "plan-retrieval"
  | "retrieve-knowledge"
  | "prepare-generation";

export type PreparedAgentRequest = {
  input: AgentRequest;
  stages: AgentWorkflowStage[];
};

type WorkflowOptions = {
  userId?: string;
};

type WorkflowSnippet = RagContext["snippets"][number];

const AgentWorkflowState = Annotation.Root({
  input: Annotation<AgentRequest>(),
  options: Annotation<WorkflowOptions>(),
  stages: Annotation<AgentWorkflowStage[], AgentWorkflowStage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  intent: Annotation<AgentIntent>(),
  language: Annotation<DetectedLanguage>(),
  practiceStyle: Annotation<PracticeStyleId>(),
  referenceProfile: Annotation<ReferenceProfileId>(),
  course: Annotation<CourseId>(),
  knowledgePoint: Annotation<string | undefined>(),
  queryType: Annotation<QueryType>(),
  contextInput: Annotation<AgentRequest>(),
  memory: Annotation<LearningMemory>(),
  personalKnowledgeDecision: Annotation<PersonalKnowledgeDecision>(),
  ragSnippets: Annotation<WorkflowSnippet[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  preparedInput: Annotation<AgentRequest>(),
});

type WorkflowState = typeof AgentWorkflowState.State;

function understandInput(state: WorkflowState) {
  const { input } = state;
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

  return {
    intent,
    language,
    practiceStyle,
    referenceProfile,
    stages: ["understand-input"] satisfies AgentWorkflowStage[],
  };
}

function resolveContext(state: WorkflowState) {
  const { input, language, practiceStyle, referenceProfile, intent } = state;
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

  return {
    course,
    knowledgePoint,
    queryType,
    contextInput,
    stages: ["resolve-context"] satisfies AgentWorkflowStage[],
  };
}

function updateMemoryNode(state: WorkflowState) {
  const memory = updateLearningMemory(
    state.input.memory ?? createLearningMemory(),
    state.contextInput,
    state.intent,
  );

  return {
    memory,
    contextInput: {
      ...state.contextInput,
      memory,
    },
    stages: ["update-memory"] satisfies AgentWorkflowStage[],
  };
}

function planRetrieval(state: WorkflowState) {
  const personalKnowledgeDecision = decidePersonalKnowledgeUse({
    request: state.contextInput,
    mode: state.contextInput.knowledgeMode,
    intent: state.intent,
    queryType: state.queryType,
    hasUser: Boolean(state.options.userId),
  });

  return {
    personalKnowledgeDecision,
    stages: ["plan-retrieval"] satisfies AgentWorkflowStage[],
  };
}

async function retrieveKnowledge(state: WorkflowState) {
  const personalRagResults =
    state.options.userId && state.personalKnowledgeDecision.shouldUse
      ? await retrievePersonalKnowledge(
          state.options.userId,
          state.personalKnowledgeDecision.retrievalQuery ?? state.contextInput.message,
          4,
        )
      : [];
  const sampleRagResults =
    state.contextInput.useRag && isPhysicsIntent(state.intent)
      ? await retrieveRagSnippets(state.contextInput.message, 4)
      : [];

  const ragSnippets: WorkflowSnippet[] = [
    ...personalRagResults.map((result) => ({ ...result, kind: "personal" as const })),
    ...sampleRagResults.map((result) => ({ ...result, kind: "sample" as const })),
  ]
    .slice(0, 6)
    .map((result) => ({
      source: result.source,
      heading: result.heading,
      content: result.content,
      kind: result.kind,
    }));

  return {
    ragSnippets,
    stages: ["retrieve-knowledge"] satisfies AgentWorkflowStage[],
  };
}

function prepareGeneration(state: WorkflowState) {
  const preparedInput: AgentRequest = {
    ...state.contextInput,
    memory: state.memory,
    personalKnowledgeDecision: state.personalKnowledgeDecision,
    ragContext: state.ragSnippets.length
      ? {
          snippets: state.ragSnippets,
        }
      : undefined,
  };

  return {
    preparedInput,
    stages: ["prepare-generation"] satisfies AgentWorkflowStage[],
  };
}

const agentWorkflow = new StateGraph(AgentWorkflowState)
  .addNode("understandInput", understandInput)
  .addNode("resolveContext", resolveContext)
  .addNode("updateMemory", updateMemoryNode)
  .addNode("planRetrieval", planRetrieval)
  .addNode("retrieveKnowledge", retrieveKnowledge)
  .addNode("prepareGeneration", prepareGeneration)
  .addEdge(START, "understandInput")
  .addEdge("understandInput", "resolveContext")
  .addEdge("resolveContext", "updateMemory")
  .addEdge("updateMemory", "planRetrieval")
  .addEdge("planRetrieval", "retrieveKnowledge")
  .addEdge("retrieveKnowledge", "prepareGeneration")
  .addEdge("prepareGeneration", END)
  .compile();

export async function prepareAgentRequest(
  input: AgentRequest,
  options: WorkflowOptions = {},
): Promise<PreparedAgentRequest> {
  const result = await agentWorkflow.invoke({
    input,
    options,
  });

  return {
    stages: result.stages,
    input: result.preparedInput,
  };
}
