import "server-only";

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import { allocateRequestContext, resolveLearningContext } from "@/agent/context-manager";
import { detectExerciseCount } from "@/agent/exercise-parser";
import { classifyAgentIntent, isPhysicsIntent } from "@/agent/intent-classifier";
import { decidePersonalKnowledgeUse, resolveKnowledgeMode } from "@/agent/knowledge-mode";
import { commitLearningMemory, createLearningMemory, updateLearningMemory } from "@/agent/memory-manager";
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
  RetrievalStatus,
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
  signal?: AbortSignal;
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
  retrievalStatus: Annotation<RetrievalStatus>(),
  preparedInput: Annotation<AgentRequest>(),
});

type WorkflowState = typeof AgentWorkflowState.State;

function understandInput(state: WorkflowState) {
  const { input } = state;
  state.options.signal?.throwIfAborted();
  const resolved = resolveLearningContext(input);
  const intent = input.intent ?? (detectExerciseCount(input.message) && (resolved.course !== "general" || input.memory?.exerciseTopics.length)
    ? "exercise_generation" : classifyAgentIntent(resolved));
  const language = resolved.detectedLanguage ?? "en";
  const practiceStyle = resolved.practiceStyle ?? "auto";
  const referenceProfile = resolved.referenceProfile ?? "auto";

  return {
    intent,
    language,
    practiceStyle,
    referenceProfile,
    contextInput: resolved,
    stages: ["understand-input"] satisfies AgentWorkflowStage[],
  };
}

function resolveContext(state: WorkflowState) {
  const { contextInput: input, language, practiceStyle, referenceProfile, intent } = state;
  const course = input.course ?? "general";
  const knowledgePoint = input.knowledgePoint;
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
    history: input.history,
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
  state.options.signal?.throwIfAborted();
  let retrievalStatus: RetrievalStatus = state.personalKnowledgeDecision.shouldUse ? state.options.userId ? "no_match" : "unauthenticated" : state.personalKnowledgeDecision.status ?? "disabled";
  let personalRagResults: Awaited<ReturnType<typeof retrievePersonalKnowledge>> = [];
  if (state.options.userId && state.personalKnowledgeDecision.shouldUse) {
    try {
      personalRagResults = await retrievePersonalKnowledge(
          state.options.userId,
          state.personalKnowledgeDecision.retrievalQuery ?? state.contextInput.message,
          {
            limit: 4,
            course: state.course,
            topic: state.knowledgePoint,
            documentIds: state.contextInput.knowledgeDocumentIds,
            courseOnly: state.contextInput.knowledgeCourseOnly,
            signal: state.options.signal,
          },
        );
      retrievalStatus = personalRagResults.length ? "retrieved" : "no_match";
    } catch (error) {
      state.options.signal?.throwIfAborted();
      if (error instanceof Error && error.name === "AbortError") throw error;
      retrievalStatus = "failed";
    }
  }
  state.options.signal?.throwIfAborted();
  const sampleRagResults =
    state.contextInput.useRag && isPhysicsIntent(state.intent)
      ? await retrieveRagSnippets(state.contextInput.message, {
          limit: 4,
          course: state.course,
          topic: state.knowledgePoint,
        })
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
      locator: result.locator,
      sourceId: result.sourceId,
      documentId: result.metadata?.documentId,
      contentHash: result.metadata?.contentHash,
      version: result.metadata?.version,
    }));

  return {
    ragSnippets,
    retrievalStatus,
    stages: ["retrieve-knowledge"] satisfies AgentWorkflowStage[],
  };
}

function prepareGeneration(state: WorkflowState) {
  const preparedInput: AgentRequest = allocateRequestContext({
    ...state.contextInput,
    memory: state.memory,
    personalKnowledgeDecision: { ...state.personalKnowledgeDecision, status: state.retrievalStatus },
    ragContext: {
          snippets: state.ragSnippets,
          status: state.retrievalStatus,
        },
  });

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
  }, { signal: options.signal });

  return {
    stages: result.stages,
    input: result.preparedInput,
  };
}

export function finalizePreparedAgentMemory(prepared: PreparedAgentRequest, content: string) {
  return commitLearningMemory(prepared.input, content);
}
