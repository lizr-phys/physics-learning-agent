"use client";

import { runWorkspaceTransaction, workspaceKey, workspaceStorage, workspaceStorageKeys } from "@/lib/workspace-storage";
import { WorkspaceQuotaError } from "@/lib/workspace-sync";
import type { StoredPracticeGeneration } from "@/lib/practice-history";
import type { GenerationDiagnostics } from "@/types/learning";

const prefix = "journal.practice.";
const maxWritersPerRecord = 16;
let writerId: string | undefined;
const reportedCorruption = new Set<string>();
type JournalRecord = { kind: "writer" | "acknowledged"; record: StoredPracticeGeneration; revision?: number };
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

function validRecord(value: unknown): value is StoredPracticeGeneration {
  if (!isObject(value) || typeof value.id !== "string" || typeof value.title !== "string"
    || typeof value.prompt !== "string" || typeof value.content !== "string"
    || !["complete", "interrupted", "error"].includes(String(value.status))
    || !Number.isFinite(value.createdAt) || !Number.isFinite(value.updatedAt)) return false;
  if (value.problemAssessments !== undefined && (!isObject(value.problemAssessments)
    || !Object.values(value.problemAssessments).every((assessment) => isObject(assessment)
      && ["solved", "needs-work"].includes(String(assessment.status)) && Number.isFinite(assessment.updatedAt)))) return false;
  if (value.assessmentTombstones !== undefined && (!isObject(value.assessmentTombstones)
    || !Object.values(value.assessmentTombstones).every((time) => Number.isFinite(time)))) return false;
  if (value.task !== undefined && (!isObject(value.task) || !Array.isArray(value.task.completedProblemIds)
    || !value.task.completedProblemIds.every((id) => typeof id === "string"))) return false;
  const validAttempt = (attempt: unknown) => isObject(attempt) && typeof attempt.requestId === "string";
  return (value.generation === undefined || validAttempt(value.generation))
    && (value.generationAttempts === undefined || Array.isArray(value.generationAttempts) && value.generationAttempts.every(validAttempt));
}

export function readPracticeJournal(ownerId?: string | null) {
  return workspaceStorageKeys(prefix, ownerId).flatMap((key) => {
    const raw = workspaceStorage(ownerId).getItem(key);
    try {
      const entry: unknown = raw ? JSON.parse(raw) : undefined;
      if (raw && isObject(entry) && ["writer", "acknowledged"].includes(String(entry.kind))
        && validRecord(entry.record) && (entry.kind !== "acknowledged" || Number.isSafeInteger(entry.revision))) {
        return [{ key, raw, ...entry as JournalRecord }];
      }
    } catch { /* Retain the original value for manual recovery. */ }
    const physicalKey = workspaceKey(key, ownerId);
    if (!reportedCorruption.has(physicalKey)) {
      reportedCorruption.add(physicalKey);
      queueMicrotask(() => window.dispatchEvent(new CustomEvent("pla:storage-failed", {
        detail: "A cached practice writer snapshot is unreadable. Other records remain available; the original value was retained for recovery.",
      })));
    }
    return [];
  });
}

/** A document-local ID keeps cloned tabs from overwriting each other's snapshots. */
export function writePracticeJournal(record: StoredPracticeGeneration) {
  return runWorkspaceTransaction(() => {
    writerId ??= crypto.randomUUID();
    const writerPrefix = `${prefix}writer.${encodeURIComponent(record.id)}.`;
    const key = writerPrefix + writerId;
    const writers = workspaceStorageKeys(writerPrefix);
    if (!writers.includes(key) && writers.length >= maxWritersPerRecord) {
      throw new WorkspaceQuotaError("This practice set has 16 unacknowledged browser writer snapshots. Sync it or export and remove it before editing further.");
    }
    workspaceStorage().setItem(key, JSON.stringify({ kind: "writer", record } satisfies JournalRecord));
  });
}

function attemptCovered(attempt: GenerationDiagnostics, current: GenerationDiagnostics) {
  return Object.entries(attempt).every(([field, value]) => value === undefined || (
    ["durationMs", "outputChars"].includes(field) && typeof value === "number"
      ? typeof current[field as "durationMs" | "outputChars"] === "number" && current[field as "durationMs" | "outputChars"]! >= value
      : field === "usage" ? Object.entries(attempt.usage ?? {}).every(([name, count]) =>
        count === undefined || (current.usage?.[name as keyof NonNullable<GenerationDiagnostics["usage"]>] ?? -1) >= count)
        : same(value, current[field as keyof GenerationDiagnostics])
  ));
}

function coveredBy(record: StoredPracticeGeneration, acknowledged: StoredPracticeGeneration) {
  if (record.id !== acknowledged.id || record.updatedAt > acknowledged.updatedAt
    || !acknowledged.content.startsWith(record.content)) return false;
  for (const field of ["title", "prompt", "course", "knowledgePoint", "difficulty", "exerciseCount", "practiceOutputMode", "practiceStyle", "answerDepth", "originalRequest"] as const) {
    if (record[field] !== undefined && !same(record[field], acknowledged[field])) return false;
  }
  if (record.status === "complete" && acknowledged.status !== "complete") return false;
  if (!Object.entries(record.problemAssessments ?? {}).every(([id, assessment]) => {
    if ((acknowledged.assessmentTombstones?.[id] ?? -1) >= assessment.updatedAt) return true;
    const current = acknowledged.problemAssessments?.[id];
    return current && (current.updatedAt > assessment.updatedAt || same(current, assessment));
  })) return false;
  if (!Object.entries(record.assessmentTombstones ?? {}).every(([id, time]) => (acknowledged.assessmentTombstones?.[id] ?? -1) >= time)) return false;
  if (record.task && (!acknowledged.task || !["version", "setId", "targetCount", "outputMode"].every((field) =>
    same(record.task?.[field as keyof NonNullable<StoredPracticeGeneration["task"]>], acknowledged.task?.[field as keyof NonNullable<StoredPracticeGeneration["task"]>]))
    || !record.task.completedProblemIds.every((id) => acknowledged.task?.completedProblemIds.includes(id)))) return false;
  const attempts = [...(record.generationAttempts ?? []), ...(record.generation ? [record.generation] : [])];
  const acknowledgedAttempts = [...(acknowledged.generationAttempts ?? []), ...(acknowledged.generation ? [acknowledged.generation] : [])];
  return attempts.every((attempt) => acknowledgedAttempts.some((current) => current.requestId === attempt.requestId && attemptCovered(attempt, current)));
}

export function acknowledgePracticeJournal(records: StoredPracticeGeneration[], revision: number) {
  return runWorkspaceTransaction(() => {
    const entries = readPracticeJournal();
    for (const record of records) {
      // Immutable acknowledgement keys retain proof of coverage if a concurrent newer revision diverges.
      const key = `${prefix}acknowledged.${encodeURIComponent(record.id)}.${revision}.${crypto.randomUUID()}`;
      workspaceStorage().setItem(key, JSON.stringify({ kind: "acknowledged", record, revision } satisfies JournalRecord));
      for (const entry of entries) {
        if (entry.record.id === record.id && (entry.kind === "writer" || (entry.revision ?? 0) <= revision)
          && coveredBy(entry.record, record)) workspaceStorage().removeItemIfUnchanged(entry.key, entry.raw);
      }
    }
  });
}

export function removePracticeJournal(id: string) {
  return runWorkspaceTransaction(() => {
    for (const entry of readPracticeJournal()) {
      if (entry.record.id === id) workspaceStorage().removeItemIfUnchanged(entry.key, entry.raw);
    }
  });
}
