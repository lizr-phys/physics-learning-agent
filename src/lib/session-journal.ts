"use client";

import { workspaceStorage, workspaceStorageKeys } from "@/lib/workspace-storage";
import { WorkspaceQuotaError } from "@/lib/workspace-sync";
import type { StoredChatSession } from "@/lib/storage";

const prefix = "journal.sessions.";
const maxWritersPerSession = 16;
let writerId: string | undefined;
const reportedCorruption = new Set<string>();
type JournalRecord = { kind: "writer" | "acknowledged"; session: StoredChatSession; revision?: number };

export function readSessionJournal(ownerId?: string | null, includeOldAcknowledged = false) {
  const records = workspaceStorageKeys(prefix, ownerId).flatMap((key) => {
    const raw = workspaceStorage(ownerId).getItem(key);
    try {
      const record = raw ? JSON.parse(raw) as JournalRecord : undefined;
      if (record && ["writer", "acknowledged"].includes(record.kind) && typeof record.session?.id === "string"
        && typeof record.session.title === "string" && Array.isArray(record.session.messages)
        && record.session.messages.every((message) => message && ["user", "assistant"].includes(message.role) && typeof message.content === "string")) {
        return [{ key, raw, ...record }];
      }
    } catch { /* Keep the unreadable value available for manual recovery. */ }
    if (!reportedCorruption.has(key)) {
      reportedCorruption.add(key);
      const targetWindow = window;
      queueMicrotask(() => targetWindow.dispatchEvent(new CustomEvent("pla:storage-failed", { detail: "A cached conversation writer snapshot is unreadable. Other records remain available; the original value was retained for recovery." })));
    }
    return [];
  });
  const latest = new Map<string, number>();
  for (const record of records) if (record.kind === "acknowledged") {
    latest.set(record.session.id, Math.max(latest.get(record.session.id) ?? 0, record.revision ?? 0));
  }
  return includeOldAcknowledged ? records : records.filter((record) => record.kind !== "acknowledged" || (record.revision ?? 0) === latest.get(record.session.id));
}

/** The writer identity is stable for this document's lifetime and unique even for cloned tabs. */
export function writeSessionJournal(session: StoredChatSession) {
  writerId ??= crypto.randomUUID();
  const key = `${prefix}writer.${encodeURIComponent(session.id)}.${writerId}`;
  const writers = readSessionJournal().filter((record) => record.kind === "writer" && record.session.id === session.id);
  if (!writers.some((record) => record.key === key) && writers.length >= maxWritersPerSession) {
    throw new WorkspaceQuotaError("This conversation has 16 unacknowledged browser writer snapshots. Sync it or export and remove it before editing further.");
  }
  workspaceStorage().setItem(key, JSON.stringify({ kind: "writer", session } satisfies JournalRecord));
}

function coveredBy(record: StoredChatSession, acknowledged: StoredChatSession) {
  if (record.updatedAt > acknowledged.updatedAt || record.title !== acknowledged.title) return false;
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonical(item)]));
    return value;
  };
  const same = (left: unknown, right: unknown) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
  const { messages: recordMessages, updatedAt: recordTime, ...recordFields } = record;
  const { messages: acknowledgedMessages, updatedAt: acknowledgedTime, ...acknowledgedFields } = acknowledged;
  void recordTime; void acknowledgedTime;
  // Context, memory, tool state and any future session metadata must also be durably represented.
  if (!same(recordFields, acknowledgedFields)) return false;
  return recordMessages.every((message) => acknowledgedMessages.some((current) => {
    const { content: previousText, id: previousId, ...previousMetadata } = message;
    const { content: currentText, id: currentId, ...currentMetadata } = current;
    return (currentId === previousId || Boolean(previousId && currentId?.startsWith(`${previousId}.conflict.`)))
      && (currentText === previousText || currentText.startsWith(previousText))
      && same(previousMetadata, currentMetadata);
  }));
}

export function acknowledgeSessionJournal(sessions: StoredChatSession[], revision: number) {
  const records = readSessionJournal();
  for (const session of sessions) {
    const key = `${prefix}acknowledged.${encodeURIComponent(session.id)}.${revision}`;
    const existing = records.find((record) => record.kind === "acknowledged" && record.session.id === session.id);
    if (!existing || (existing.revision ?? 0) <= revision) {
      workspaceStorage().setItem(key, JSON.stringify({ kind: "acknowledged", session, revision } satisfies JournalRecord));
    }
    for (const oldKey of workspaceStorageKeys(`${prefix}acknowledged.${encodeURIComponent(session.id)}.`)) {
      const raw = workspaceStorage().getItem(oldKey);
      try {
        const older = raw ? JSON.parse(raw) as JournalRecord : undefined;
        if (older?.kind === "acknowledged" && older.session.id === session.id && (older.revision ?? 0) < revision) workspaceStorage().removeItemIfUnchanged(oldKey, raw);
      } catch { /* An unreadable row remains available for recovery; it cannot block a valid acknowledgement. */ }
    }
    for (const record of records) {
      if (record.kind === "writer" && record.session.id === session.id && coveredBy(record.session, session)) {
        // The separate acknowledged record retains content even if another tab writes an older base array.
        workspaceStorage().removeItemIfUnchanged(record.key, record.raw);
      }
    }
  }
}

export function removeSessionJournal(sessionId: string) {
  for (const record of readSessionJournal(undefined, true)) {
    if (record.session.id === sessionId) workspaceStorage().removeItemIfUnchanged(record.key, record.raw);
  }
}
