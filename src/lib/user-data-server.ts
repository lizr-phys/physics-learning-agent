import { promises as fs } from "fs";
import path from "path";

import { withKeyedLock } from "@/lib/async-lock";

import { courseOptions } from "@/data/courses";
import {
  answerDepthOptions,
  difficultyOptions,
  practiceOutputModeOptions,
  practiceStyleOptions,
  taskTypeOptions,
  type AnswerDepth,
  type CourseId,
  type DifficultyId,
  type KnowledgeMode,
  type PracticeAssessment,
  type PracticeOutputMode,
  type PracticeStyleId,
  type TaskTypeId,
} from "@/types/learning";

export type StoredPracticeGeneration = {
  id: string;
  title: string;
  course?: CourseId;
  knowledgePoint?: string;
  difficulty?: DifficultyId;
  exerciseCount?: 3 | 5 | 10;
  practiceOutputMode?: PracticeOutputMode;
  practiceStyle?: PracticeStyleId;
  answerDepth?: AnswerDepth;
  prompt: string;
  content: string;
  status: "complete" | "interrupted" | "error";
  problemAssessments?: Record<string, PracticeAssessment>;
  createdAt: number;
  updatedAt: number;
};

export type UserDataSnapshot = {
  version: 1;
  sessions: unknown[];
  activeSessionId?: string;
  learningProfile?: unknown;
  preferences?: {
    answerDepth?: AnswerDepth;
    onboardingDismissed?: boolean;
    selectedModel?: string;
    knowledgeMode?: KnowledgeMode;
  };
  providerPreferences?: {
    enabled?: boolean;
    provider?: string;
    type?: string;
    label?: string;
    baseUrl?: string;
    model?: string;
  };
  practiceHistory: StoredPracticeGeneration[];
  updatedAt: number;
};

const maxSessions = 80;
const maxMessagesPerSession = 240;
const maxPracticeHistory = 80;
const maxContentLength = 120_000;
const maxToolContentLength = 12_000;
const maxPromptLength = 8_000;

const courseIds = new Set<string>(["general", ...courseOptions.map((course) => course.id)]);
const taskTypeIds = new Set<string>(taskTypeOptions.map((task) => task.id));
const difficultyIds = new Set<string>(difficultyOptions.map((difficulty) => difficulty.id));
const answerDepthIds = new Set<string>(answerDepthOptions.map((depth) => depth.id));
const practiceOutputModeIds = new Set<string>(practiceOutputModeOptions.map((mode) => mode.id));
const practiceStyleIds = new Set<string>(practiceStyleOptions.map((style) => style.id));
const knowledgeModeIds = new Set<string>(["auto", "always", "never"]);
const exerciseCounts = new Set([3, 5, 10]);
const clientProviderKinds = new Set(["openai-compatible", "anthropic", "gemini"]);

function dataRoot() {
  return process.env.PLA_DATA_DIR || path.join(process.cwd(), ".pla-data");
}

function userDir(userId: string) {
  return path.join(dataRoot(), "users", userId);
}

function userDataPath(userId: string) {
  return path.join(userDir(userId), "workspace.json");
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function asNumber(value: unknown, fallback = Date.now()) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringList(value: unknown, maxItems: number, maxLength: number) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, maxLength))
        .filter(Boolean)
        .slice(-maxItems)
    : [];
}

function sanitizeMessage(value: unknown) {
  const record = asRecord(value);
  const role = record.role === "user" || record.role === "assistant" ? record.role : undefined;
  const content = asString(record.content, maxContentLength);

  if (!role || !content) {
    return undefined;
  }

  const status =
    record.status === "streaming" ||
    record.status === "complete" ||
    record.status === "interrupted" ||
    record.status === "error"
      ? record.status
      : undefined;
  const feedbackRecord = asRecord(record.feedback);
  const verdict =
    feedbackRecord.verdict === "helpful" ||
    feedbackRecord.verdict === "needs-improvement"
      ? feedbackRecord.verdict
      : undefined;
  const issue =
    feedbackRecord.issue === "unclear" ||
    feedbackRecord.issue === "formula-error" ||
    feedbackRecord.issue === "citation-error" ||
    feedbackRecord.issue === "other"
      ? feedbackRecord.issue
      : undefined;

  return {
    id: asString(record.id, 160) || undefined,
    role,
    content,
    createdAt: asNumber(record.createdAt, Date.now()),
    status,
    requestId: asString(record.requestId, 160) || undefined,
    feedback:
      role === "assistant" && verdict
        ? {
            verdict,
            issue: verdict === "needs-improvement" ? issue : undefined,
            updatedAt: asNumber(feedbackRecord.updatedAt, Date.now()),
          }
        : undefined,
  };
}

function sanitizePracticeAssessments(value: unknown) {
  const record = asRecord(value);
  const entries = Object.entries(record)
    .filter(([key]) => /^\d{1,3}$/.test(key))
    .slice(0, 40)
    .flatMap(([key, rawAssessment]) => {
      const assessment = asRecord(rawAssessment);
      const status = assessment.status;

      if (status !== "solved" && status !== "needs-work") {
        return [];
      }

      return [[
        key,
        {
          status,
          updatedAt: asNumber(assessment.updatedAt, Date.now()),
        },
      ]] as const;
    });

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function sanitizeToolContext(value: unknown) {
  const record = asRecord(value);

  if (record.source !== "practice") {
    return undefined;
  }

  const generatedContent = asString(record.generatedContent, maxToolContentLength);

  if (!generatedContent) {
    return undefined;
  }

  const selectedRecord = asRecord(record.selectedItem);
  const selectedType =
    selectedRecord.type === "problem" || selectedRecord.type === "summary"
      ? selectedRecord.type
      : undefined;

  return {
    source: "practice" as const,
    course: courseIds.has(asString(record.course, 80))
      ? (asString(record.course, 80) as CourseId)
      : undefined,
    knowledgeId: asString(record.knowledgeId, 160) || undefined,
    knowledgeTitle: asString(record.knowledgeTitle, 240) || undefined,
    topic: asString(record.topic, 240) || undefined,
    taskTitle: asString(record.taskTitle, 240) || undefined,
    userInput: asString(record.userInput, maxPromptLength) || undefined,
    generatedContent,
    selectedItem: selectedType
      ? {
          type: selectedType,
          title: asString(selectedRecord.title, 240) || undefined,
          content: asString(selectedRecord.content, maxToolContentLength) || undefined,
          index: typeof selectedRecord.index === "number" ? selectedRecord.index : undefined,
        }
      : undefined,
    createdAt: asNumber(record.createdAt, Date.now()),
  };
}

function sanitizeContext(value: unknown) {
  const record = asRecord(value);
  const course = asString(record.course, 80);
  const taskType = asString(record.taskType, 80);
  const answerDepth = asString(record.answerDepth, 80);
  const practiceStyle = asString(record.practiceStyle, 80);
  const detectedLanguage = asString(record.detectedLanguage, 12);
  const referenceProfile = asString(record.referenceProfile, 24);
  const knowledgeMode = asString(record.knowledgeMode, 24);

  return {
    course: (courseIds.has(course) ? course : "general") as CourseId,
    taskType: (taskTypeIds.has(taskType) ? taskType : "qa") as TaskTypeId,
    knowledgePoint: asString(record.knowledgePoint, 160) || undefined,
    model: asString(record.model, 160) || undefined,
    useRag: typeof record.useRag === "boolean" ? record.useRag : undefined,
    answerDepth: answerDepthIds.has(answerDepth) ? (answerDepth as AnswerDepth) : undefined,
    practiceStyle: practiceStyleIds.has(practiceStyle)
      ? (practiceStyle as PracticeStyleId)
      : undefined,
    detectedLanguage:
      detectedLanguage === "zh" || detectedLanguage === "en" ? detectedLanguage : undefined,
    referenceProfile:
      referenceProfile === "auto" || referenceProfile === "chinese" || referenceProfile === "english"
        ? referenceProfile
        : undefined,
    knowledgeMode: knowledgeModeIds.has(knowledgeMode)
      ? (knowledgeMode as KnowledgeMode)
      : undefined,
  };
}

function sanitizeMemory(value: unknown) {
  const record = asRecord(value);
  const course = asString(record.currentCourse, 80);
  const recentLanguage = asString(record.recentLanguage, 12);
  const practiceStyle = asString(record.practiceStyle, 80);
  const referenceProfile = asString(record.referenceProfile, 24);
  const preferredStyle = asString(record.preferredStyle, 32);

  return {
    currentCourse: courseIds.has(course) ? (course as CourseId) : undefined,
    currentKnowledgePoint: asString(record.currentKnowledgePoint, 240) || undefined,
    currentGoal: asString(record.currentGoal, 320) || undefined,
    recentLanguage: recentLanguage === "zh" || recentLanguage === "en" ? recentLanguage : undefined,
    practiceStyle: practiceStyleIds.has(practiceStyle)
      ? (practiceStyle as PracticeStyleId)
      : undefined,
    referenceProfile:
      referenceProfile === "auto" || referenceProfile === "chinese" || referenceProfile === "english"
        ? referenceProfile
        : undefined,
    recentConfusions: stringList(record.recentConfusions, 8, 240),
    coveredConcepts: stringList(record.coveredConcepts, 16, 160),
    exerciseTopics: stringList(record.exerciseTopics, 12, 200),
    preferredStyle:
      preferredStyle === "step-by-step" || preferredStyle === "concise"
        ? preferredStyle
        : "balanced",
    conversationSummary: asString(record.conversationSummary, 3000) || undefined,
    updatedAt: asNumber(record.updatedAt, Date.now()),
  };
}

function sanitizeLearningProfile(value: unknown) {
  const record = asRecord(value);
  const frequencyRecord = asRecord(record.courseFrequency);
  const courseFrequency = Object.fromEntries(
    Object.entries(frequencyRecord)
      .filter(([course]) => courseIds.has(course))
      .map(([course, count]) => [
        course,
        typeof count === "number" && Number.isFinite(count) ? Math.max(0, Math.min(9999, count)) : 0,
      ]),
  );
  const preferredStyle = asString(record.preferredStyle, 32);
  const recentLanguage = asString(record.recentLanguage, 12);
  const practiceStyle = asString(record.practiceStyle, 80);
  const referenceProfile = asString(record.referenceProfile, 24);

  return {
    courseFrequency,
    recentTopics: stringList(record.recentTopics, 20, 160),
    preferredStyle:
      preferredStyle === "step-by-step" || preferredStyle === "concise"
        ? preferredStyle
        : "balanced",
    recentLanguage: recentLanguage === "zh" || recentLanguage === "en" ? recentLanguage : undefined,
    practiceStyle: practiceStyleIds.has(practiceStyle)
      ? (practiceStyle as PracticeStyleId)
      : undefined,
    referenceProfile:
      referenceProfile === "auto" || referenceProfile === "chinese" || referenceProfile === "english"
        ? referenceProfile
        : undefined,
    updatedAt: asNumber(record.updatedAt, Date.now()),
  };
}

function sanitizeSession(value: unknown) {
  const record = asRecord(value);
  const id = asString(record.id, 160);
  const title = asString(record.title, 240);

  if (!id || !title) {
    return undefined;
  }

  const messages = Array.isArray(record.messages)
    ? record.messages
        .map(sanitizeMessage)
        .filter((message): message is NonNullable<ReturnType<typeof sanitizeMessage>> =>
          Boolean(message),
        )
        .slice(-maxMessagesPerSession)
    : [];
  const toolContext = sanitizeToolContext(record.toolContext);

  return {
    id,
    title,
    source: record.source === "tool" || toolContext ? "tool" : "manual",
    createdAt: asNumber(record.createdAt, Date.now()),
    updatedAt: asNumber(record.updatedAt, Date.now()),
    messages,
    context: sanitizeContext(record.context),
    toolContext,
    memory: sanitizeMemory(record.memory),
  };
}

function sanitizePracticeGeneration(value: unknown): StoredPracticeGeneration | undefined {
  const record = asRecord(value);
  const id = asString(record.id, 160);
  const title = asString(record.title, 240);
  const content = asString(record.content, maxContentLength);
  const prompt = asString(record.prompt, maxPromptLength);

  if (!id || !title || !content) {
    return undefined;
  }

  const course = asString(record.course, 80);
  const difficulty = asString(record.difficulty, 80);
  const practiceOutputMode = asString(record.practiceOutputMode, 80);
  const practiceStyle = asString(record.practiceStyle, 80);
  const answerDepth = asString(record.answerDepth, 80);
  const count = Number(record.exerciseCount);
  const status =
    record.status === "interrupted" || record.status === "error" ? record.status : "complete";

  return {
    id,
    title,
    course: courseIds.has(course) ? (course as CourseId) : undefined,
    knowledgePoint: asString(record.knowledgePoint, 160) || undefined,
    difficulty: difficultyIds.has(difficulty) ? (difficulty as DifficultyId) : undefined,
    exerciseCount: exerciseCounts.has(count) ? (count as 3 | 5 | 10) : undefined,
    practiceOutputMode: practiceOutputModeIds.has(practiceOutputMode)
      ? (practiceOutputMode as PracticeOutputMode)
      : undefined,
    practiceStyle: practiceStyleIds.has(practiceStyle)
      ? (practiceStyle as PracticeStyleId)
      : undefined,
    answerDepth: answerDepthIds.has(answerDepth) ? (answerDepth as AnswerDepth) : undefined,
    prompt,
    content,
    status,
    problemAssessments: sanitizePracticeAssessments(record.problemAssessments),
    createdAt: asNumber(record.createdAt, Date.now()),
    updatedAt: asNumber(record.updatedAt, Date.now()),
  };
}

function sanitizePreferences(value: unknown): UserDataSnapshot["preferences"] {
  const record = asRecord(value);
  const answerDepth = asString(record.answerDepth, 80);
  const knowledgeMode = asString(record.knowledgeMode, 24);

  return {
    answerDepth: answerDepthIds.has(answerDepth) ? (answerDepth as AnswerDepth) : undefined,
    onboardingDismissed: typeof record.onboardingDismissed === "boolean"
      ? record.onboardingDismissed
      : undefined,
    selectedModel: asString(record.selectedModel, 160) || undefined,
    knowledgeMode: knowledgeModeIds.has(knowledgeMode)
      ? (knowledgeMode as KnowledgeMode)
      : undefined,
  };
}

function sanitizeProviderPreferences(value: unknown): UserDataSnapshot["providerPreferences"] {
  const record = asRecord(value);
  const type = asString(record.type, 80);

  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : undefined,
    provider: asString(record.provider, 80) || undefined,
    type: clientProviderKinds.has(type) ? type : undefined,
    label: asString(record.label, 120) || undefined,
    baseUrl: asString(record.baseUrl, 400) || undefined,
    model: asString(record.model, 160) || undefined,
  };
}

export function sanitizeUserDataSnapshot(input: unknown): UserDataSnapshot {
  const record = asRecord(input);
  const sessions = Array.isArray(record.sessions)
    ? record.sessions
        .map(sanitizeSession)
        .filter((session): session is NonNullable<ReturnType<typeof sanitizeSession>> =>
          Boolean(session),
        )
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, maxSessions)
    : [];
  const practiceHistory = Array.isArray(record.practiceHistory)
    ? record.practiceHistory
        .map(sanitizePracticeGeneration)
        .filter((item): item is StoredPracticeGeneration => Boolean(item))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, maxPracticeHistory)
    : [];

  return {
    version: 1,
    sessions,
    activeSessionId: asString(record.activeSessionId, 160) || undefined,
    learningProfile: record.learningProfile
      ? sanitizeLearningProfile(record.learningProfile)
      : undefined,
    preferences: sanitizePreferences(record.preferences),
    providerPreferences: sanitizeProviderPreferences(record.providerPreferences),
    practiceHistory,
    updatedAt: asNumber(record.updatedAt, Date.now()),
  };
}

export async function readUserData(userId: string): Promise<UserDataSnapshot> {
  const snapshot = await readJsonFile<UserDataSnapshot | null>(userDataPath(userId), null);
  return sanitizeUserDataSnapshot(snapshot ?? { version: 1, sessions: [], practiceHistory: [] });
}

export async function writeUserData(userId: string, input: unknown): Promise<UserDataSnapshot> {
  const snapshot = sanitizeUserDataSnapshot({
    ...(asRecord(input)),
    updatedAt: Date.now(),
  });
  await withKeyedLock(`workspace:${userId}`, () =>
    writeJsonFile(userDataPath(userId), snapshot),
  );
  return snapshot;
}
