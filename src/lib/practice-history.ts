"use client";

import type {
  AnswerDepth,
  CourseId,
  DifficultyId,
  PracticeAssessment,
  PracticeAssessmentStatus,
  PracticeOutputMode,
  PracticeStyleId,
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

const practiceHistoryKey = "pla.practice.history.v1";
const maxPracticeHistory = 80;

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function normalizeAssessments(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const normalized = Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => /^\d{1,3}$/.test(key))
      .slice(0, 40)
      .flatMap(([key, assessment]) => {
        if (!assessment || typeof assessment !== "object") {
          return [];
        }

        const record = assessment as Record<string, unknown>;
        const status = record.status;

        if (status !== "solved" && status !== "needs-work") {
          return [];
        }

        return [[
          key,
          {
            status,
            updatedAt:
              typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
                ? record.updatedAt
                : Date.now(),
          },
        ]];
      }),
  ) as Record<string, PracticeAssessment>;

  return Object.keys(normalized).length ? normalized : undefined;
}

export function createPracticeGenerationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `practice-${crypto.randomUUID()}`;
  }

  return `practice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeItem(item: StoredPracticeGeneration): StoredPracticeGeneration | undefined {
  if (!item?.id || !item?.title || !item?.content) {
    return undefined;
  }

  return {
    ...item,
    title: item.title.trim().slice(0, 240),
    prompt: item.prompt?.trim().slice(0, 8000) || "",
    content: item.content.slice(0, 120000),
    status:
      item.status === "interrupted" || item.status === "error" ? item.status : "complete",
    problemAssessments: normalizeAssessments(item.problemAssessments),
    createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
    updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now(),
  };
}

export function getStoredPracticeGenerations(): StoredPracticeGeneration[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(practiceHistoryKey);
    const parsed = raw ? (JSON.parse(raw) as StoredPracticeGeneration[]) : [];

    return parsed
      .map(normalizeItem)
      .filter((item): item is StoredPracticeGeneration => Boolean(item))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, maxPracticeHistory);
  } catch {
    return [];
  }
}

export function saveStoredPracticeGenerations(items: StoredPracticeGeneration[]) {
  if (!canUseStorage()) {
    return;
  }

  const normalized = items
    .map(normalizeItem)
    .filter((item): item is StoredPracticeGeneration => Boolean(item))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, maxPracticeHistory);

  window.localStorage.setItem(practiceHistoryKey, JSON.stringify(normalized));
  window.dispatchEvent(new Event("pla:practice-history-changed"));
  window.dispatchEvent(new Event("pla:user-data-changed"));
}

export function upsertStoredPracticeGeneration(item: StoredPracticeGeneration) {
  const existing = getStoredPracticeGenerations();
  const next = existing.some((entry) => entry.id === item.id)
    ? existing.map((entry) => (entry.id === item.id ? item : entry))
    : [item, ...existing];

  saveStoredPracticeGenerations(next);
}

export function updateStoredPracticeAssessment(
  recordId: string,
  problemIndex: number,
  status?: PracticeAssessmentStatus,
) {
  const item = getStoredPracticeGenerations().find((entry) => entry.id === recordId);

  if (!item) {
    return {} as Record<string, PracticeAssessment>;
  }

  const key = String(problemIndex);
  const nextAssessments = { ...(item.problemAssessments ?? {}) };

  if (status) {
    nextAssessments[key] = { status, updatedAt: Date.now() };
  } else {
    delete nextAssessments[key];
  }

  upsertStoredPracticeGeneration({
    ...item,
    problemAssessments: Object.keys(nextAssessments).length
      ? nextAssessments
      : undefined,
    updatedAt: Date.now(),
  });

  return nextAssessments;
}
