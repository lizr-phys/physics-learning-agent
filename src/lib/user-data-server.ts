import { promises as fs } from "fs";
import path from "path";
import type { PracticeRequestParameters, PracticeTaskProgress } from "@/lib/practice-task";
import {
  normalizePracticeProgress, sanitizeContextBudget, sanitizeContextProvenance, sanitizeDocumentIds,
  sanitizeGeneration, sanitizeGenerationAttempts, sanitizePracticeAssessments, sanitizePracticeRequest, sanitizeProviderPreferenceUrl,
  sanitizeSources, sanitizeTimestampMap,
} from "@/lib/user-data-metadata";

import { withKeyedLock } from "@/lib/async-lock";
import { sanitizeImageAttachments } from "@/lib/image-attachments";
import {
  assertWorkspaceCapacity,
  emptyWorkspaceTombstones,
  mergeWorkspaceTombstones,
  WORKSPACE_LIMITS,
  type WorkspaceConflict,
  type WorkspaceSyncMetadata,
  type WorkspaceTombstones,
} from "@/lib/workspace-sync";

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
  type GenerationDiagnostics,
} from "@/types/learning";

export type StoredPracticeGeneration = {
  id: string;
  title: string;
  course?: CourseId;
  knowledgePoint?: string;
  difficulty?: DifficultyId;
  exerciseCount?: number;
  practiceOutputMode?: PracticeOutputMode;
  practiceStyle?: PracticeStyleId;
  answerDepth?: AnswerDepth;
  prompt: string;
  content: string;
  status: "complete" | "interrupted" | "error";
  problemAssessments?: Record<string, PracticeAssessment>;
  assessmentTombstones?: Record<string, number>;
  task?: PracticeTaskProgress;
  originalRequest?: PracticeRequestParameters;
  generation?: GenerationDiagnostics;
  generationAttempts?: GenerationDiagnostics[];
  createdAt: number;
  updatedAt: number;
};

export type UserDataSnapshot = WorkspaceSyncMetadata & {
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

const maxToolContentLength = 12_000;
const maxPromptLength = WORKSPACE_LIMITS.promptLength;

const courseIds = new Set<string>(["general", ...courseOptions.map((course) => course.id)]);
const taskTypeIds = new Set<string>(taskTypeOptions.map((task) => task.id));
const difficultyIds = new Set<string>(difficultyOptions.map((difficulty) => difficulty.id));
const answerDepthIds = new Set<string>(answerDepthOptions.map((depth) => depth.id));
const practiceOutputModeIds = new Set<string>(practiceOutputModeOptions.map((mode) => mode.id));
const practiceStyleIds = new Set<string>(practiceStyleOptions.map((style) => style.id));
const knowledgeModeIds = new Set<string>(["auto", "always", "never"]);
const exerciseCounts = new Set(Array.from({ length: 20 }, (_, index) => index + 1));
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
  const content = asString(record.content, Number.MAX_SAFE_INTEGER);
  const generation = sanitizeGeneration(record.generation);

  const emptyRecordedFailure = role === "assistant" && (record.status === "error" || record.status === "interrupted") && generation;
  const images = role === "user" ? sanitizeImageAttachments(record.images) : undefined;
  if (!role || (!content && !emptyRecordedFailure && !images?.length)) {
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
  const feedbackDeletedAt = typeof record.feedbackDeletedAt === "number" && Number.isFinite(record.feedbackDeletedAt) && record.feedbackDeletedAt >= 0 ? record.feedbackDeletedAt : undefined;
  const feedbackUpdatedAt = asNumber(feedbackRecord.updatedAt, Date.now());
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
    images,
    createdAt: asNumber(record.createdAt, Date.now()),
    status,
    requestId: asString(record.requestId, 160) || undefined,
    feedbackDeletedAt,
    sources: sanitizeSources(record.sources),
    retrievalStatus: ["disabled", "unauthenticated", "no_match", "retrieved", "failed"].includes(String(record.retrievalStatus)) ? record.retrievalStatus : undefined,
    generation,
    generationAttempts: sanitizeGenerationAttempts(record.generationAttempts),
    feedback:
      role === "assistant" && verdict && !(feedbackDeletedAt !== undefined && feedbackDeletedAt >= feedbackUpdatedAt)
        ? {
            verdict,
            issue: verdict === "needs-improvement" ? issue : undefined,
            updatedAt: feedbackUpdatedAt,
          }
        : undefined,
  };
}

function sanitizeToolContext(value: unknown) {
  const record = asRecord(value);

  if (record.source !== "practice" && record.source !== "knowledge") {
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
    source: record.source === "knowledge" ? "knowledge" as const : "practice" as const,
    images: sanitizeImageAttachments(record.images),
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
    knowledgeDocumentIds: sanitizeDocumentIds(record.knowledgeDocumentIds),
    knowledgeCourseOnly: typeof record.knowledgeCourseOnly === "boolean" ? record.knowledgeCourseOnly : undefined,
    contextProvenance: sanitizeContextProvenance(record.contextProvenance),
    contextBudget: sanitizeContextBudget(record.contextBudget),
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
    conversationSummary: asString(record.conversationSummary, Number.MAX_SAFE_INTEGER) || undefined,
    contextProvenance: sanitizeContextProvenance(record.contextProvenance),
    contextBudget: sanitizeContextBudget(record.contextBudget),
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
  const content = asString(record.content, Number.MAX_SAFE_INTEGER);
  const prompt = asString(record.prompt, Number.MAX_SAFE_INTEGER);

  const originalRequest = sanitizePracticeRequest(record.originalRequest);
  if (!id || !title || (!content && (!originalRequest?.message || !["interrupted", "error"].includes(String(record.status))))) {
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
  const assessmentTombstones = sanitizeTimestampMap(record.assessmentTombstones);

  return {
    id,
    title,
    course: courseIds.has(course) ? (course as CourseId) : undefined,
    knowledgePoint: asString(record.knowledgePoint, 160) || undefined,
    difficulty: difficultyIds.has(difficulty) ? (difficulty as DifficultyId) : undefined,
    exerciseCount: exerciseCounts.has(count) ? count : undefined,
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
    problemAssessments: sanitizePracticeAssessments(record.problemAssessments, assessmentTombstones),
    assessmentTombstones,
    task: normalizePracticeProgress(record.task),
    originalRequest,
    generation: sanitizeGeneration(record.generation),
    generationAttempts: sanitizeGenerationAttempts(record.generationAttempts),
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
    baseUrl: sanitizeProviderPreferenceUrl(record.baseUrl),
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
    : [];
  const practiceHistory = Array.isArray(record.practiceHistory)
    ? record.practiceHistory
        .map(sanitizePracticeGeneration)
        .filter((item): item is StoredPracticeGeneration => Boolean(item))
        .sort((a, b) => b.updatedAt - a.updatedAt)
    : [];
  const tombstones = sanitizeTombstones(record.tombstones);
  const retainedSessions = sessions.filter((session) => !Object.hasOwn(tombstones.sessions, session.id));
  const activeSessionId = asString(record.activeSessionId, 160);

  return {
    version: 1,
    revision: typeof record.revision === "number" && Number.isSafeInteger(record.revision) && record.revision >= 0 ? record.revision : 0,
    operationId: asString(record.operationId, 160) || undefined,
    appliedOperationIds: stringList(record.appliedOperationIds, 256, 160),
    tombstones,
    conflicts: sanitizeConflicts(record.conflicts),
    sessions: retainedSessions,
    activeSessionId: retainedSessions.some((session) => session.id === activeSessionId) ? activeSessionId : undefined,
    learningProfile: record.learningProfile
      ? sanitizeLearningProfile(record.learningProfile)
      : undefined,
    preferences: sanitizePreferences(record.preferences),
    providerPreferences: sanitizeProviderPreferences(record.providerPreferences),
    practiceHistory: practiceHistory.filter((item) => !Object.hasOwn(tombstones.practiceHistory, item.id)),
    updatedAt: asNumber(record.updatedAt, Date.now()),
  };
}

function sanitizeTombstones(input: unknown): WorkspaceTombstones {
  const record = asRecord(input);
  const result = emptyWorkspaceTombstones();
  for (const kind of ["sessions", "practiceHistory"] as const) {
    for (const [id, raw] of Object.entries(asRecord(record[kind]))) {
      const value = asRecord(raw);
      const operationId = asString(value.operationId, 160);
      if (id && id.length <= 160 && operationId && typeof value.deletedAt === "number" && Number.isFinite(value.deletedAt)) {
        Object.defineProperty(result[kind], id, { value: { deletedAt: value.deletedAt, operationId }, enumerable: true, configurable: true, writable: true });
      }
    }
  }
  return result;
}

function sanitizeConflicts(input: unknown): WorkspaceConflict[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((raw) => {
    const value = asRecord(raw);
    const entity = value.entity;
    const id = asString(value.id, 160);
    const field = asString(value.field, 160);
    if (!["session", "message", "practice", "preference"].includes(String(entity)) || !id || !field) return [];
    const scalarFields = ["title", "answerDepth", "knowledgeMode", "onboardingDismissed", "selectedModel", "enabled", "provider", "type", "label", "baseUrl", "model", "course", "taskType", "knowledgePoint", "detectedLanguage", "referenceProfile", "practiceStyle", "source", "createdAt"];
    if (field !== "content" && !scalarFields.includes(field)) return [];
    // Only keep non-secret scalar settings. Full alternate content is stored in conflict copies.
    const scalar = (item: unknown) => field === "content" ? undefined : field === "baseUrl" ? sanitizeProviderPreferenceUrl(item) : typeof item === "string" ? item.slice(0, 400) : typeof item === "number" || typeof item === "boolean" ? item : undefined;
    return [{ entity: entity as WorkspaceConflict["entity"], id, field, preservedId: asString(value.preservedId, 160) || undefined, localValue: scalar(value.localValue), remoteValue: scalar(value.remoteValue) }];
  });
}

export class WorkspaceConflictError extends Error {
  readonly code = "WORKSPACE_CONFLICT";
  readonly status = 409;
  constructor(readonly data: UserDataSnapshot) {
    super("Workspace changed on another device. Merge the latest version before saving.");
    this.name = "WorkspaceConflictError";
  }
}

export class WorkspaceWriteError extends Error {
  readonly code = "INVALID_WORKSPACE_WRITE";
  readonly status = 400;
}

export async function readUserData(userId: string): Promise<UserDataSnapshot> {
  const snapshot = await readJsonFile<UserDataSnapshot | null>(userDataPath(userId), null);
  return sanitizeUserDataSnapshot(snapshot ?? { version: 1, sessions: [], practiceHistory: [] });
}

export async function writeUserData(userId: string, input: unknown): Promise<UserDataSnapshot> {
  const record = asRecord(input);
  return withKeyedLock(`workspace:${userId}`, async () => {
    const current = await readUserData(userId);
    const operationId = asString(record.operationId, 160);
    if (!operationId) throw new WorkspaceWriteError("A unique operationId is required to save workspace data.");
    if (current.appliedOperationIds?.includes(operationId)) return current;
    if (!Number.isSafeInteger(record.revision) || record.revision !== current.revision) {
      throw new WorkspaceConflictError(current);
    }
    // Merge deletion markers with the persisted state even after a client rebases an old snapshot.
    const retainOmitted = (incoming: unknown, persisted: unknown[]) => {
      const list = Array.isArray(incoming) ? incoming : [];
      const ids = new Set(list.map((item) => asRecord(item).id));
      return [...list, ...persisted.filter((item) => !ids.has(asRecord(item).id))];
    };
    const sessions = retainOmitted(record.sessions, current.sessions).map(raw => {
      const value = asRecord(raw);
      const existing = asRecord(current.sessions.find(item => asRecord(item).id === value.id));
      const messageKey = (item: Record<string, unknown>) => asString(item.id, 160) || JSON.stringify([item.role, item.createdAt, item.content]);
      const oldMessages = new Map((Array.isArray(existing.messages) ? existing.messages : []).map(rawMessage => {
        const message = asRecord(rawMessage); return [messageKey(message), message] as const;
      }));
      const incomingMessages = Array.isArray(value.messages) ? value.messages : [];
      const incomingMessageIds = new Set(incomingMessages.map(rawMessage => messageKey(asRecord(rawMessage))));
      const messages = [...incomingMessages, ...[...oldMessages.values()].filter(message => !incomingMessageIds.has(messageKey(message)))].map(rawMessage => {
        const message = asRecord(rawMessage), old = oldMessages.get(messageKey(message));
        const feedbackDeletedAt = Math.max(asNumber(message.feedbackDeletedAt, 0), asNumber(old?.feedbackDeletedAt, 0));
        return { ...message, feedbackDeletedAt: feedbackDeletedAt || undefined,
          images: message.images ?? old?.images,
          sources: message.sources ?? old?.sources, generation: message.generation ?? old?.generation, retrievalStatus: message.retrievalStatus ?? old?.retrievalStatus,
          generationAttempts: sanitizeGenerationAttempts([...(Array.isArray(old?.generationAttempts) ? old.generationAttempts : []), ...(Array.isArray(message.generationAttempts) ? message.generationAttempts : [])]) };
      }).sort((a, b) => asNumber(asRecord(a).createdAt, 0) - asNumber(asRecord(b).createdAt, 0));
      return { ...value, messages };
    });
    const practiceHistory = retainOmitted(record.practiceHistory, current.practiceHistory).map(raw => {
      const value = asRecord(raw), existing = current.practiceHistory.find(item => item.id === value.id);
      const tombstones = { ...(existing?.assessmentTombstones ?? {}) };
      for (const [id, deletedAt] of Object.entries(sanitizeTimestampMap(value.assessmentTombstones) ?? {})) {
        Object.defineProperty(tombstones, id, { value: Math.max(Object.hasOwn(tombstones, id) ? tombstones[id] : 0, deletedAt), enumerable: true, configurable: true, writable: true });
      }
      return { ...value, assessmentTombstones: tombstones, task: value.task ?? existing?.task, originalRequest: value.originalRequest ?? existing?.originalRequest,
        generation: value.generation ?? existing?.generation,
        generationAttempts: sanitizeGenerationAttempts([...(existing?.generationAttempts ?? []), ...(existing?.generation ? [existing.generation] : []), ...(Array.isArray(value.generationAttempts) ? value.generationAttempts : []), ...(value.generation ? [value.generation] : [])]) };
    });
    const snapshot = sanitizeUserDataSnapshot({
      ...record,
      sessions,
      practiceHistory,
      revision: (current.revision ?? 0) + 1,
      operationId,
      appliedOperationIds: [...(current.appliedOperationIds ?? []), operationId].slice(-256),
      tombstones: mergeWorkspaceTombstones(current.tombstones, sanitizeTombstones(record.tombstones)),
      updatedAt: Date.now(),
    });
    assertWorkspaceCapacity(snapshot);
    await writeJsonFile(userDataPath(userId), snapshot);
    return snapshot;
  });
}
