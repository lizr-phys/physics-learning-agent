import { NextRequest, NextResponse } from "next/server";

import { prepareAgentRequest } from "@/agent/workflow";
import { streamAgentTask, taskBudget } from "@/agent/task-workflow";
import { getModelConfig } from "@/agent/model-config";
import { sanitizeImageAttachments, IMAGE_LIMITS } from "@/lib/image-attachments";
import { ImageInputError, resolveRequestImages } from "@/lib/image-store";
import { imageRequestOwner } from "@/lib/image-request-owner";
import { acquireGenerationLease, GenerationBudgetError } from "@/lib/generation-budget";
import type { GenerationBinding, GenerationPayload } from "@/lib/generation-stream";
import { getUserFromRequest } from "@/lib/auth-server";
import { DeepSeekError } from "@/lib/deepseek";
import { consumeRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { readJsonRequest, RequestBodyError } from "@/lib/request-body";
import {
  difficultyOptions,
  taskTypeOptions,
  type AgentIntent,
  type AgentRequest,
  type AnswerDepth,
  type ChatMessage,
  type ClientProviderConfig,
  type CourseId,
  type DifficultyId,
  type KnowledgeMode,
  type LearningMemory,
  type PracticeOutputMode,
  type PracticeStyleId,
  type DetectedLanguage,
  type ReferenceProfileId,
  type TaskTypeId,
  type ToolContext,
  practiceStyleOptions,
} from "@/types/learning";
import { courseOptions } from "@/data/courses";

export const runtime = "nodejs";
export const maxDuration = 300;

const courseIds = new Set<string>(["general", ...courseOptions.map((course) => course.id)]);
const taskTypeIds = new Set<string>(taskTypeOptions.map((task) => task.id));
const difficultyIds = new Set<string>(difficultyOptions.map((difficulty) => difficulty.id));
const exerciseCounts = new Set(Array.from({ length: 20 }, (_, index) => index + 1));
const agentIntents = new Set<AgentIntent>([
  "physics_learning",
  "exercise_generation",
  "study_planning",
  "general_question",
  "meta_question",
]);
const answerDepths = new Set<AnswerDepth>([
  "concise",
  "standard",
  "detailed",
  "derivation-first",
  "problem-type-first",
]);
const practiceOutputModes = new Set<PracticeOutputMode>([
  "questions-only",
  "questions-hints",
  "full-solution",
  "hidden-answer",
]);
const practiceStyles = new Set<PracticeStyleId>(practiceStyleOptions.map((item) => item.id));
const detectedLanguages = new Set<DetectedLanguage>(["zh", "en"]);
const referenceProfiles = new Set<ReferenceProfileId>(["auto", "chinese", "english"]);
const knowledgeModes = new Set<KnowledgeMode>(["auto", "always", "never"]);
const modelIds = new Set(["deepseek-flash", "deepseek-v4-flash-vision-exp", "deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"]);
const clientProviderIds = new Set([
  "openai",
  "deepseek",
  "qwen",
  "kimi",
  "glm",
  "openrouter",
  "anthropic",
  "gemini",
  "custom",
]);
const clientProviderKinds = new Set(["openai-compatible", "anthropic", "gemini"]);

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown) {
  return value === true;
}

function trimToLength(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

function sanitizeToolContext(value: unknown): ToolContext | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const source = asString(record.source);
  const generatedContent = asString(record.generatedContent);

  if ((source !== "practice" && source !== "knowledge") || !generatedContent) {
    return undefined;
  }

  const selectedRecord =
    record.selectedItem && typeof record.selectedItem === "object"
      ? (record.selectedItem as Record<string, unknown>)
      : undefined;
  const selectedType = asString(selectedRecord?.type);
  const selectedItem =
    selectedRecord && ["problem", "summary"].includes(selectedType)
      ? {
          type: selectedType as NonNullable<ToolContext["selectedItem"]>["type"],
          title: trimToLength(asString(selectedRecord.title), 200) || undefined,
          content: asString(selectedRecord.content) || undefined,
          index:
            typeof selectedRecord.index === "number" && Number.isFinite(selectedRecord.index)
              ? selectedRecord.index
              : undefined,
        }
      : undefined;
  const course = asString(record.course);

  return {
    source: source as ToolContext["source"],
    images: sanitizeImageAttachments(record.images),
    course: courseIds.has(course) ? (course as CourseId) : undefined,
    knowledgeId: trimToLength(asString(record.knowledgeId), 120) || undefined,
    knowledgeTitle: trimToLength(asString(record.knowledgeTitle), 200) || undefined,
    topic: trimToLength(asString(record.topic), 200) || undefined,
    taskTitle: trimToLength(asString(record.taskTitle), 200) || undefined,
    userInput: trimToLength(asString(record.userInput), 1000) || undefined,
    generatedContent,
    selectedItem,
    createdAt:
      typeof record.createdAt === "number" && Number.isFinite(record.createdAt)
        ? record.createdAt
        : Date.now(),
  };
}

function sanitizeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is ChatMessage => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const message = item as Partial<ChatMessage>;
      return (
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        (message.content.trim().length > 0 || (message.role === "user" && Boolean(sanitizeImageAttachments(message.images)?.length)))
      );
    })
    .map((item) => ({
      id: item.id,
      role: item.role,
      content: item.content.trim(),
      images: item.role === "user" ? sanitizeImageAttachments(item.images) : undefined,
      status: item.status,
      createdAt: item.createdAt,
    }));
}

function sanitizeStringList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => trimToLength(item, maxLength))
    .filter(Boolean)
    .slice(-maxItems);
}

function sanitizeLearningMemory(value: unknown): LearningMemory | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const currentCourse = asString(record.currentCourse);
  const preferredStyle = asString(record.preferredStyle);

  return {
    currentCourse: courseIds.has(currentCourse) ? (currentCourse as CourseId) : undefined,
    currentKnowledgePoint:
      trimToLength(asString(record.currentKnowledgePoint), 160) || undefined,
    currentGoal: trimToLength(asString(record.currentGoal), 240) || undefined,
    recentConfusions: sanitizeStringList(record.recentConfusions, 6, 240),
    coveredConcepts: sanitizeStringList(record.coveredConcepts, 12, 120),
    exerciseTopics: sanitizeStringList(record.exerciseTopics, 8, 160),
    preferredStyle:
      preferredStyle === "step-by-step" || preferredStyle === "concise"
        ? preferredStyle
        : "balanced",
    recentLanguage: detectedLanguages.has(asString(record.recentLanguage) as DetectedLanguage)
      ? (asString(record.recentLanguage) as DetectedLanguage)
      : undefined,
    practiceStyle: practiceStyles.has(asString(record.practiceStyle) as PracticeStyleId)
      ? (asString(record.practiceStyle) as PracticeStyleId)
      : undefined,
    referenceProfile: referenceProfiles.has(asString(record.referenceProfile) as ReferenceProfileId)
      ? (asString(record.referenceProfile) as ReferenceProfileId)
      : undefined,
    conversationSummary:
      asString(record.conversationSummary) || undefined,
    contextProvenance: record.contextProvenance && typeof record.contextProvenance === "object" ? record.contextProvenance as LearningMemory["contextProvenance"] : undefined,
    updatedAt:
      typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
        ? record.updatedAt
        : Date.now(),
  };
}

function sanitizeClientProvider(value: unknown): ClientProviderConfig | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const type = asString(record.type);
  const provider = asString(record.provider);
  const apiKey = asString(record.apiKey);
  const baseUrl = asString(record.baseUrl);
  const model = asString(record.model);

  if (!clientProviderKinds.has(type) || !apiKey || !model) {
    return undefined;
  }

  if (type === "openai-compatible" && !baseUrl) {
    return undefined;
  }

  return {
    provider: clientProviderIds.has(provider)
      ? (provider as ClientProviderConfig["provider"])
      : "custom",
    type: type as ClientProviderConfig["type"],
    label: trimToLength(asString(record.label), 80) || undefined,
    apiKey: trimToLength(apiKey, 600),
    baseUrl: baseUrl ? trimToLength(baseUrl, 400) : undefined,
    model: trimToLength(model, 160),
  };
}

function sanitizeRequest(body: unknown): AgentRequest {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const message = asString(record.message);
  const course = asString(record.course);
  const taskType = asString(record.taskType);
  const knowledgePoint = asString(record.knowledgePoint);
  const difficulty = asString(record.difficulty);
  const model = asString(record.model);
  const intent = asString(record.intent);
  const answerDepth = asString(record.answerDepth);
  const practiceOutputMode = asString(record.practiceOutputMode);
  const practiceStyle = asString(record.practiceStyle);
  const detectedLanguage = asString(record.detectedLanguage);
  const referenceProfile = asString(record.referenceProfile);
  const knowledgeMode = asString(record.knowledgeMode);
  const parsedCount = Number(record.exerciseCount);

  return {
    message,
    images: sanitizeImageAttachments(record.images),
    intent: agentIntents.has(intent as AgentIntent) ? (intent as AgentIntent) : undefined,
    module:
      record.module === "practice" ||
      record.module === "chat"
        ? record.module
        : undefined,
    course: courseIds.has(course) ? (course as CourseId) : undefined,
    taskType: taskTypeIds.has(taskType) ? (taskType as TaskTypeId) : undefined,
    knowledgePoint: knowledgePoint || undefined,
    difficulty: difficultyIds.has(difficulty) ? (difficulty as DifficultyId) : undefined,
    exerciseCount: exerciseCounts.has(parsedCount)
      ? (parsedCount as AgentRequest["exerciseCount"])
      : undefined,
    includeHint: asBoolean(record.includeHint),
    includeAnswer: asBoolean(record.includeAnswer),
    includeSolution: asBoolean(record.includeSolution),
    useRag: asBoolean(record.useRag),
    toolContext: sanitizeToolContext(record.toolContext),
    model: modelIds.has(model) ? model : undefined,
    history: sanitizeHistory(record.history),
    memory: sanitizeLearningMemory(record.memory),
    answerDepth: answerDepths.has(answerDepth as AnswerDepth)
      ? (answerDepth as AnswerDepth)
      : undefined,
    practiceOutputMode: practiceOutputModes.has(practiceOutputMode as PracticeOutputMode)
      ? (practiceOutputMode as PracticeOutputMode)
      : undefined,
    practiceStyle: practiceStyles.has(practiceStyle as PracticeStyleId)
      ? (practiceStyle as PracticeStyleId)
      : undefined,
    detectedLanguage: detectedLanguages.has(detectedLanguage as DetectedLanguage)
      ? (detectedLanguage as DetectedLanguage)
      : undefined,
    referenceProfile: referenceProfiles.has(referenceProfile as ReferenceProfileId)
      ? (referenceProfile as ReferenceProfileId)
      : undefined,
    knowledgeMode: knowledgeModes.has(knowledgeMode as KnowledgeMode)
      ? (knowledgeMode as KnowledgeMode)
      : undefined,
    clientProvider: sanitizeClientProvider(record.clientProvider),
    conversationId: trimToLength(asString(record.conversationId), 160) || undefined,
    assistantMessageId: trimToLength(asString(record.assistantMessageId), 160) || undefined,
    requestId: trimToLength(asString(record.requestId), 160) || undefined,
    authEpoch: trimToLength(asString(record.authEpoch), 160) || undefined,
    practiceTask: record.practiceTask && typeof record.practiceTask === "object" && /^[A-Za-z0-9:._-]{1,120}$/.test(asString((record.practiceTask as Record<string, unknown>).setId))
      ? { setId: asString((record.practiceTask as Record<string, unknown>).setId), resumeContent: asString((record.practiceTask as Record<string, unknown>).resumeContent).slice(0, 120_000) || undefined } : undefined,
    knowledgeDocumentIds: sanitizeStringList(record.knowledgeDocumentIds, 20, 120),
    knowledgeCourseOnly: asBoolean(record.knowledgeCourseOnly),
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    const expectedOwner = request.headers.get("X-PLA-Workspace-Owner");
    if (expectedOwner && expectedOwner !== (user?.id ?? "guest")) {
      return NextResponse.json({ error: "The signed-in account changed. Reload the workspace before generating.", code: "WORKSPACE_OWNER_CHANGED" }, { status: 409 });
    }
    const rateLimit = consumeRateLimit(
      `chat:${user?.id ?? getRequestClientKey(request)}`,
      120,
      10 * 60 * 1000,
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many generation requests. Please wait before trying again." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const body = await readJsonRequest(request, 256 * 1024);
    const requestedCount = body && typeof body === "object" ? (body as Record<string, unknown>).exerciseCount : undefined;
    if (requestedCount !== undefined && (!Number.isSafeInteger(Number(requestedCount)) || Number(requestedCount) < 1 || Number(requestedCount) > 20)) {
      return NextResponse.json({ error: "Practice count must be an integer between 1 and 20." }, { status: 400 });
    }
    const input = sanitizeRequest(body);
    const rawImages = body && typeof body === "object" ? (body as Record<string,unknown>).images : undefined;
    if (rawImages !== undefined && (!Array.isArray(rawImages) || rawImages.length > IMAGE_LIMITS.perMessage || (input.images?.length ?? 0) !== rawImages.length)) throw new ImageInputError("Attach up to four valid images.");
    if (!input.message && input.images?.length) input.message = "Help me understand the attached images.";

    if (!input.message) {
      return NextResponse.json({ error: "Please enter a question or generation request." }, { status: 400 });
    }
    if (input.message.length > 16_000) {
      return NextResponse.json({ error: "This request exceeds 16,000 characters. Shorten it before sending." }, { status: 413 });
    }
    input.conversationId ??= crypto.randomUUID();
    input.assistantMessageId ??= crypto.randomUUID();
    input.requestId ??= crypto.randomUUID();
    input.authEpoch ??= "server";

    const binding: GenerationBinding = { ownerId: user?.id ?? "guest", authEpoch: input.authEpoch, sessionId: input.conversationId, messageId: input.assistantMessageId, requestId: input.requestId };
    const prepared = await prepareAgentRequest(input, { userId: user?.id, signal: request.signal });
    const normalized = prepared.input;
    if (normalized.images?.length || normalized.history?.some(message => message.images?.length) || normalized.toolContext?.images?.length) {
      const {owner} = await imageRequestOwner(request);
      if (!owner) throw new ImageInputError("These images are unavailable. Reattach them in this workspace.",404,"IMAGE_NOT_FOUND");
      normalized.resolvedImages = await resolveRequestImages(normalized,owner);
    }
    const initialEvents: GenerationPayload[] = [
      ...prepared.stages.map(stage => ({ type: "stage" as const, stage })),
      { type: "context", context: { course: normalized.course, knowledgePoint: normalized.knowledgePoint, taskType: normalized.taskType, detectedLanguage: normalized.detectedLanguage, referenceProfile: normalized.referenceProfile, practiceStyle: normalized.practiceStyle, exerciseCount: normalized.exerciseCount, answerDepth: normalized.answerDepth, knowledgeMode: normalized.knowledgeMode, contextProvenance: normalized.contextProvenance, contextBudget: normalized.contextBudget } },
      { type: "sources", sources: normalized.ragContext?.snippets ?? [], status: normalized.ragContext?.status ?? normalized.personalKnowledgeDecision?.status },
    ];
    const practice = normalized.module === "practice" || normalized.taskType === "practice" || normalized.intent === "exercise_generation";
    const lease = acquireGenerationLease(user?.id ?? getRequestClientKey(request), { serverDefault: !normalized.clientProvider, reservedOutputTokens: practice ? taskBudget.maxOutputTokens : getModelConfig(normalized).max_tokens });
    let stream: ReadableStream<Uint8Array>;
    try { stream = streamAgentTask(prepared, request.signal, { binding, initialEvents, onSettled: usage => lease.release(usage) }); }
    catch (error) { lease.release(); throw error; }

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "private, no-store, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
        "X-Agent-Intent": prepared.input.intent ?? "general_question",
        "X-Conversation-Id": prepared.input.conversationId ?? "",
        "X-Request-Id": prepared.input.requestId ?? "",
      },
    });
  } catch (error) {
    if (error instanceof ImageInputError) return NextResponse.json({error:error.message,code:error.code},{status:error.status});
    if (error instanceof GenerationBudgetError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : undefined });
    if (error instanceof RequestBodyError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    if (error instanceof DeepSeekError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    return NextResponse.json({ error: "The server failed to process the request." }, { status: 500 });
  }
}
