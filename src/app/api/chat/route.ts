import { NextResponse } from "next/server";

import { prepareAgentRequest } from "@/agent/workflow";
import { DeepSeekError, streamDeepSeek } from "@/lib/deepseek";
import {
  difficultyOptions,
  taskTypeOptions,
  type AgentIntent,
  type AgentRequest,
  type AnswerDepth,
  type ChatMessage,
  type CourseId,
  type DifficultyId,
  type LearningMemory,
  type PracticeOutputMode,
  type TaskTypeId,
  type ToolContext,
} from "@/types/learning";
import { courseOptions } from "@/data/courses";

export const runtime = "nodejs";
export const maxDuration = 300;

const courseIds = new Set<string>(["general", ...courseOptions.map((course) => course.id)]);
const taskTypeIds = new Set<string>(taskTypeOptions.map((task) => task.id));
const difficultyIds = new Set<string>(difficultyOptions.map((difficulty) => difficulty.id));
const exerciseCounts = new Set([3, 5, 10]);
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
const modelIds = new Set(["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"]);

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

  if (!["review", "practice", "types"].includes(source) || !generatedContent) {
    return undefined;
  }

  const selectedRecord =
    record.selectedItem && typeof record.selectedItem === "object"
      ? (record.selectedItem as Record<string, unknown>)
      : undefined;
  const selectedType = asString(selectedRecord?.type);
  const selectedItem =
    selectedRecord && ["section", "problem", "problemType", "summary"].includes(selectedType)
      ? {
          type: selectedType as NonNullable<ToolContext["selectedItem"]>["type"],
          title: trimToLength(asString(selectedRecord.title), 200) || undefined,
          content: trimToLength(asString(selectedRecord.content), 6000) || undefined,
          index:
            typeof selectedRecord.index === "number" && Number.isFinite(selectedRecord.index)
              ? selectedRecord.index
              : undefined,
        }
      : undefined;
  const course = asString(record.course);

  return {
    source: source as ToolContext["source"],
    course: courseIds.has(course) ? (course as CourseId) : undefined,
    knowledgeId: trimToLength(asString(record.knowledgeId), 120) || undefined,
    knowledgeTitle: trimToLength(asString(record.knowledgeTitle), 200) || undefined,
    topic: trimToLength(asString(record.topic), 200) || undefined,
    taskTitle: trimToLength(asString(record.taskTitle), 200) || undefined,
    userInput: trimToLength(asString(record.userInput), 1000) || undefined,
    generatedContent: trimToLength(generatedContent, 8000),
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
        message.content.trim().length > 0
      );
    })
    .slice(-20)
    .map((item) => ({
      role: item.role,
      content: trimToLength(item.content, 2000),
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
    conversationSummary:
      trimToLength(asString(record.conversationSummary), 2000) || undefined,
    updatedAt:
      typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
        ? record.updatedAt
        : Date.now(),
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
  const parsedCount = Number(record.exerciseCount);

  return {
    message,
    intent: agentIntents.has(intent as AgentIntent) ? (intent as AgentIntent) : undefined,
    module:
      record.module === "practice" ||
      record.module === "review" ||
      record.module === "types" ||
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
    conversationId: trimToLength(asString(record.conversationId), 160) || undefined,
    assistantMessageId: trimToLength(asString(record.assistantMessageId), 160) || undefined,
    requestId: trimToLength(asString(record.requestId), 160) || undefined,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = sanitizeRequest(body);

    if (!input.message) {
      return NextResponse.json({ error: "请输入要提问或生成的内容。" }, { status: 400 });
    }

    const prepared = await prepareAgentRequest(input);
    const stream = await streamDeepSeek(prepared.input, request.signal);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Content-Type-Options": "nosniff",
        "X-Agent-Intent": prepared.input.intent ?? "general_question",
        "X-Conversation-Id": prepared.input.conversationId ?? "",
        "X-Request-Id": prepared.input.requestId ?? "",
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "请求体不是有效 JSON。" }, { status: 400 });
    }

    if (error instanceof DeepSeekError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    return NextResponse.json({ error: "服务端处理请求时发生未知错误。" }, { status: 500 });
  }
}
