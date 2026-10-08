import { courseOptions } from "@/data/courses";
import { sanitizeImageAttachments } from "@/lib/image-attachments";
import { normalizePracticeProgress, type PracticeRequestParameters } from "@/lib/practice-task";
import {
  answerDepthOptions, difficultyOptions, practiceOutputModeOptions, practiceStyleOptions, taskTypeOptions,
  type ContextBudget, type ContextProvenance, type GenerationDiagnostics, type PracticeAssessment, type RagContext,
} from "@/types/learning";

const record = (input: unknown): Record<string, unknown> => input && typeof input === "object" ? input as Record<string, unknown> : {};
const text = (input: unknown, length = Number.MAX_SAFE_INTEGER) => typeof input === "string" ? input.trim().slice(0, length) : "";
const nonNegative = (input: unknown) => typeof input === "number" && Number.isFinite(input) && input >= 0 ? input : undefined;
const enumValue = <T extends string>(input: unknown, choices: readonly T[]): T | undefined => choices.includes(input as T) ? input as T : undefined;
export const stableEntityId = (input: unknown, length = 180) => typeof input === "string" && input.length <= length && /^[A-Za-z0-9:._-]+$/.test(input) ? input : undefined;
const documentIds = (input: unknown) => Array.isArray(input) ? [...new Set(input.filter((id): id is string => Boolean(stableEntityId(id, 160))))] : [];

export function sanitizeContextProvenance(input: unknown): ContextProvenance | undefined {
  const value = record(input);
  const result: ContextProvenance = {};
  for (const field of ["course", "knowledgePoint", "language", "practiceStyle", "referenceProfile"] as const) {
    const entry = record(value[field]);
    const source = enumValue(entry.source, ["current-input", "current-selection", "history", "default"] as const);
    const updatedAt = nonNegative(entry.updatedAt);
    if (source && updatedAt !== undefined) result[field] = { source, updatedAt };
  }
  return Object.keys(result).length ? result : undefined;
}

export function sanitizeContextBudget(input: unknown): ContextBudget | undefined {
  const value = record(input);
  const charBudget = nonNegative(value.charBudget), usedChars = nonNegative(value.usedChars);
  const estimatedTokens = nonNegative(value.estimatedTokens), omittedMessages = nonNegative(value.omittedMessages);
  return charBudget !== undefined && usedChars !== undefined && estimatedTokens !== undefined && omittedMessages !== undefined
    ? { charBudget, usedChars, estimatedTokens, omittedMessages } : undefined;
}

export function sanitizeSources(input: unknown): RagContext["snippets"] | undefined {
  if (!Array.isArray(input)) return undefined;
  return input.flatMap(raw => {
    const value = record(raw), source = text(value.source, 400), content = text(value.content);
    if (!source || !content) return [];
    return [{ source, content, heading: text(value.heading, 400), locator: text(value.locator, 400) || undefined,
      kind: enumValue(value.kind, ["personal", "sample"] as const), sourceId: text(value.sourceId, 180) || undefined,
      documentId: text(value.documentId, 160) || undefined, contentHash: text(value.contentHash, 128) || undefined,
      version: nonNegative(value.version) }];
  });
}

export function sanitizeGeneration(input: unknown): GenerationDiagnostics | undefined {
  const value = record(input), requestId = text(value.requestId, 160);
  const terminal = enumValue(value.terminal, ["complete", "truncated", "interrupted", "cancelled", "error"] as const);
  if (!requestId || !terminal) return undefined;
  const usage = record(value.usage);
  return { requestId, terminal, provider: text(value.provider, 80) || undefined, model: text(value.model, 160) || undefined,
    intent: enumValue(value.intent, ["physics_learning", "exercise_generation", "study_planning", "general_question", "meta_question"] as const),
    reason: stableEntityId(value.reason, 160), finishReason: stableEntityId(value.finishReason, 80),
    startedAt: nonNegative(value.startedAt), durationMs: nonNegative(value.durationMs), firstTokenMs: nonNegative(value.firstTokenMs), outputChars: nonNegative(value.outputChars),
    usage: value.usage ? { inputTokens: nonNegative(usage.inputTokens), outputTokens: nonNegative(usage.outputTokens), totalTokens: nonNegative(usage.totalTokens) } : undefined };
}

/** Diagnostics retain the latest 100 distinct attempts for a message, without private model payloads. */
export function sanitizeGenerationAttempts(input: unknown): GenerationDiagnostics[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const attempts = new Map<string, GenerationDiagnostics>();
  for (const raw of input) {
    const attempt = sanitizeGeneration(raw);
    const previous = attempt ? attempts.get(attempt.requestId) : undefined;
    if (attempt && (!previous || (attempt.durationMs ?? 0) >= (previous.durationMs ?? 0))) attempts.set(attempt.requestId, attempt);
  }
  return attempts.size ? [...attempts.values()].slice(-100) : undefined;
}

export function sanitizeTimestampMap(input: unknown): Record<string, number> | undefined {
  const entries = Object.entries(record(input)).flatMap(([id, value]) => stableEntityId(id) && nonNegative(value) !== undefined ? [[id, value as number]] : []);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function sanitizePracticeAssessments(input: unknown, tombstones?: Record<string, number>): Record<string, PracticeAssessment> | undefined {
  const entries = Object.entries(record(input)).flatMap(([id, raw]) => {
    const value = record(raw), status = enumValue(value.status, ["solved", "needs-work"] as const), updatedAt = nonNegative(value.updatedAt) ?? Date.now();
    if (!stableEntityId(id) || !status || (tombstones?.[id] !== undefined && tombstones[id] >= updatedAt)) return [];
    return [[id, { status, updatedAt, attemptDraft: text(value.attemptDraft, 4000) || undefined, stuckNote: text(value.stuckNote, 1000) || undefined }]];
  });
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function sanitizePracticeRequest(input: unknown): PracticeRequestParameters | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = record(input), count = Number(value.exerciseCount);
  return { message: text(value.message, 16_000), module: enumValue(value.module, ["practice", "chat"] as const),
    images: sanitizeImageAttachments(value.images), model: text(value.model,160) || undefined,
    course: enumValue(value.course, ["general", ...courseOptions.map(course => course.id)] as const), taskType: enumValue(value.taskType, taskTypeOptions.map(task => task.id)),
    knowledgePoint: text(value.knowledgePoint, 240) || undefined, difficulty: enumValue(value.difficulty, difficultyOptions.map(item => item.id)),
    exerciseCount: Number.isSafeInteger(count) && count >= 1 && count <= 20 ? count : undefined,
    includeAnswer: typeof value.includeAnswer === "boolean" ? value.includeAnswer : undefined, includeSolution: typeof value.includeSolution === "boolean" ? value.includeSolution : undefined,
    includeHint: typeof value.includeHint === "boolean" ? value.includeHint : undefined,
    practiceOutputMode: enumValue(value.practiceOutputMode, practiceOutputModeOptions.map(item => item.id)), practiceStyle: enumValue(value.practiceStyle, practiceStyleOptions.map(item => item.id)),
    detectedLanguage: enumValue(value.detectedLanguage, ["en", "zh"] as const), answerDepth: enumValue(value.answerDepth, answerDepthOptions.map(item => item.id)),
    referenceProfile: enumValue(value.referenceProfile, ["auto", "chinese", "english"] as const), knowledgeMode: enumValue(value.knowledgeMode, ["auto", "always", "never"] as const),
    knowledgeDocumentIds: documentIds(value.knowledgeDocumentIds), knowledgeCourseOnly: typeof value.knowledgeCourseOnly === "boolean" ? value.knowledgeCourseOnly : undefined };
}

export function sanitizeProviderPreferenceUrl(input: unknown) {
  const value = text(input, 400);
  if (!value) return undefined;
  try {
    const url = new URL(value);
    url.username = ""; url.password = ""; url.search = ""; url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch { return undefined; }
}

export { normalizePracticeProgress, documentIds as sanitizeDocumentIds };
