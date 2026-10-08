"use client";

import { runWorkspaceTransaction, workspaceStorage } from "@/lib/workspace-storage";
import { assertWorkspaceCapacity, mergeWorkspaceSnapshots } from "@/lib/workspace-sync";
import { readPracticeJournal, writePracticeJournal } from "@/lib/practice-journal";
import { getWorkspaceMetadata } from "@/lib/workspace-metadata";
import { parsePracticeProblems } from "@/lib/practice-parser";
import { normalizePracticeProgress, safePracticeRequest, type PracticeTaskProgress, type PracticeRequestParameters } from "@/lib/practice-task";

import type {
  AnswerDepth,
  CourseId,
  DifficultyId,
  PracticeAssessment,
  PracticeAssessmentStatus,
  PracticeOutputMode,
  PracticeStyleId,
  GenerationDiagnostics,
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

const practiceHistoryKey = "pla.practice.history.v1";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function normalizeAssessments(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const normalized = Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => /^[A-Za-z0-9:._-]{1,180}$/.test(key))
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
            attemptDraft: typeof record.attemptDraft === "string" ? record.attemptDraft.slice(0, 4000) : undefined,
            stuckNote: typeof record.stuckNote === "string" ? record.stuckNote.slice(0, 1000) : undefined,
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
  if (!item?.id || !item?.title || (!item?.content && !item.originalRequest)) {
    return undefined;
  }

  const assessmentTombstones = Object.fromEntries(Object.entries(item.assessmentTombstones ?? {}).filter(([key, value]) => /^[A-Za-z0-9:._-]{1,180}$/.test(key) && Number.isFinite(value)));
  const assessments = normalizeAssessments(item.problemAssessments) ?? {};
  // Preserve old numbered self-assessments, then bind them to stable content IDs.
  for (const problem of parsePracticeProblems(item.content)) {
    if (assessments[String(problem.index)] && !assessments[problem.id]) assessments[problem.id] = assessments[String(problem.index)];
  }
  const problemAssessments = Object.fromEntries(Object.entries(assessments).filter(([id, assessment]) => (assessmentTombstones[id] ?? 0) < assessment.updatedAt));
  return {
    ...item,
    title: item.title.trim().slice(0, 240),
    prompt: item.prompt?.trim().slice(0, 8000) || "",
    content: (item.content ?? "").slice(0, 120000),
    status:
      item.status === "interrupted" || item.status === "error" ? item.status : "complete",
    problemAssessments: Object.keys(problemAssessments).length ? problemAssessments : undefined,
    assessmentTombstones: Object.keys(assessmentTombstones).length ? assessmentTombstones : undefined,
    task: normalizePracticeProgress(item.task),
    originalRequest: item.originalRequest ? safePracticeRequest(item.originalRequest) : undefined,
    createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
    updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now(),
  };
}

export function getStoredPracticeGenerations(ownerId?: string | null): StoredPracticeGeneration[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = workspaceStorage(ownerId).getItem(practiceHistoryKey);
    let parsed: StoredPracticeGeneration[] = [];
    try { const value = raw ? JSON.parse(raw) : []; if (Array.isArray(value)) parsed = value; } catch { /* Journal records remain independently recoverable. */ }
    const journal = readPracticeJournal(ownerId);
    const journalIds = new Set(journal.map(entry => entry.record.id));
    // The aggregate array is a compatibility index. Writer/ack rows are authoritative for their IDs.
    const indexed = parsed.filter(item => !journalIds.has(item.id))
      .map(normalizeItem)
      .filter((item): item is StoredPracticeGeneration => Boolean(item));
    const rawMetadata = workspaceStorage(ownerId).getItem("sync.v2");
    let metadata: ReturnType<typeof getWorkspaceMetadata> | undefined;
    try { metadata = rawMetadata ? JSON.parse(rawMetadata) : undefined; } catch { /* A damaged aggregate must not hide independent writer records. */ }
    let snapshot = { sessions: [], practiceHistory: indexed, updatedAt: 0, tombstones: metadata?.tombstones };
    for (const entry of journal.sort((a, b) => a.record.updatedAt - b.record.updatedAt)) {
      const record = normalizeItem(entry.record);
      if (record) snapshot = mergeWorkspaceSnapshots(snapshot, { sessions: [], practiceHistory: [record], updatedAt: record.updatedAt, tombstones: metadata?.tombstones });
    }
    return snapshot.practiceHistory.map(normalizeItem).filter((item): item is StoredPracticeGeneration => Boolean(item)).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveStoredPracticeGenerations(items: StoredPracticeGeneration[], options: { journal?: boolean } = {}) {
  if (!canUseStorage()) {
    return;
  }

  return runWorkspaceTransaction(() => {
    const normalized = items
      .map(normalizeItem)
      .filter((item): item is StoredPracticeGeneration => Boolean(item))
      .filter(item => !Object.hasOwn(getWorkspaceMetadata().tombstones.practiceHistory, item.id))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    assertWorkspaceCapacity({ practiceHistory: normalized });
    if (options.journal !== false) for (const item of normalized) writePracticeJournal(item);
    workspaceStorage().setItem(practiceHistoryKey, JSON.stringify(normalized));
    window.dispatchEvent(new Event("pla:practice-history-changed"));
    window.dispatchEvent(new Event("pla:user-data-changed"));
  });
}

export function upsertStoredPracticeGeneration(item: StoredPracticeGeneration) {
  if (!canUseStorage() || Object.hasOwn(getWorkspaceMetadata().tombstones.practiceHistory, item.id)) return;
  const normalized = normalizeItem(item);
  if (!normalized) return;
  runWorkspaceTransaction(() => {
    writePracticeJournal(normalized);
    // Only the edited set receives a writer row. Rebuild the compatible index from all durable writers.
    saveStoredPracticeGenerations(getStoredPracticeGenerations(), { journal: false });
  });
}

export function updateStoredPracticeAssessment(
  recordId: string,
  problemIndex: number | string,
  status?: PracticeAssessmentStatus,
  notes?: { attemptDraft?: string; stuckNote?: string },
) {
  const item = getStoredPracticeGenerations().find((entry) => entry.id === recordId);

  if (!item) {
    return {} as Record<string, PracticeAssessment>;
  }

  const key = String(problemIndex);
  const nextAssessments = { ...(item.problemAssessments ?? {}) };
  const assessmentTombstones = { ...(item.assessmentTombstones ?? {}) };
  const now = Date.now();

  if (status) {
    nextAssessments[key] = { ...nextAssessments[key], ...notes, status, updatedAt: now };
    delete assessmentTombstones[key];
  } else {
    delete nextAssessments[key];
    assessmentTombstones[key] = now;
    const problem = parsePracticeProblems(item.content).find(problem => problem.id === key || String(problem.index) === key);
    if (problem) {
      delete nextAssessments[String(problem.index)]; assessmentTombstones[String(problem.index)] = now;
      delete nextAssessments[problem.id]; assessmentTombstones[problem.id] = now;
    }
  }

  upsertStoredPracticeGeneration({
    ...item,
    problemAssessments: Object.keys(nextAssessments).length
      ? nextAssessments
      : undefined,
    updatedAt: Date.now(),
    assessmentTombstones,
  });

  return nextAssessments;
}
