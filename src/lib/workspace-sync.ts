/** Shared browser/server sync contract. Quotas are explicit; no history is trimmed. */
import type { GenerationDiagnostics } from "@/types/learning";
import { IMAGE_LIMITS, mergeImageAttachments } from "@/lib/image-attachments";
import type { ImageAttachment } from "@/types/learning";
export const WORKSPACE_LIMITS = {
  sessions: 80,
  practiceHistory: 80,
  messagesPerSession: 240,
  contentLength: 120_000,
  promptLength: 8_000,
} as const;

export type WorkspaceTombstone = { deletedAt: number; operationId: string };
export type WorkspaceTombstones = {
  sessions: Record<string, WorkspaceTombstone>;
  practiceHistory: Record<string, WorkspaceTombstone>;
};
export type WorkspaceConflict = {
  entity: "session" | "message" | "practice" | "preference";
  id: string;
  field: string;
  preservedId?: string;
  localValue?: unknown;
  remoteValue?: unknown;
};
export type WorkspaceSyncMetadata = {
  revision?: number;
  operationId?: string;
  appliedOperationIds?: string[];
  tombstones?: WorkspaceTombstones;
  conflicts?: WorkspaceConflict[];
};

type SyncMessage = {
  id?: string;
  role: string;
  content: string;
  images?: ImageAttachment[];
  createdAt?: number;
  requestId?: string;
  feedback?: { updatedAt: number };
  feedbackDeletedAt?: number;
  generation?: GenerationDiagnostics;
  generationAttempts?: GenerationDiagnostics[];
};
type SyncEntity = { id: string; updatedAt: number; title?: string };
type SyncSession = SyncEntity & { messages: SyncMessage[] };
type SyncPractice = SyncEntity & { content: string; problemAssessments?: Record<string, { updatedAt: number }>; assessmentTombstones?: Record<string, number>; generation?: GenerationDiagnostics; generationAttempts?: GenerationDiagnostics[] };
type SyncSnapshot = WorkspaceSyncMetadata & {
  sessions: SyncSession[];
  practiceHistory: SyncPractice[];
  updatedAt: number;
  activeSessionId?: string;
  preferences?: object;
  providerPreferences?: object;
  learningProfile?: unknown;
};

export class WorkspaceQuotaError extends Error {
  readonly code = "WORKSPACE_QUOTA_EXCEEDED";
  readonly status = 413;
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceQuotaError";
  }
}

export function emptyWorkspaceTombstones(): WorkspaceTombstones {
  return { sessions: {}, practiceHistory: {} };
}

export function mergeWorkspaceTombstones(
  ...sources: Array<Partial<WorkspaceTombstones> | undefined>
): WorkspaceTombstones {
  const result = emptyWorkspaceTombstones();
  for (const source of sources) {
    for (const kind of ["sessions", "practiceHistory"] as const) {
      for (const [id, value] of Object.entries(source?.[kind] ?? {})) {
        if (!Object.hasOwn(result[kind], id) || value.deletedAt >= result[kind][id].deletedAt) {
          Object.defineProperty(result[kind], id, { value, enumerable: true, configurable: true, writable: true });
        }
      }
    }
  }
  return result;
}

export function assertWorkspaceCapacity(input: {
  sessions?: unknown[];
  practiceHistory?: unknown[];
}) {
  if ((input.sessions?.length ?? 0) > WORKSPACE_LIMITS.sessions) {
    throw new WorkspaceQuotaError(`Workspace limit reached (${WORKSPACE_LIMITS.sessions} conversations). Export or delete a conversation before saving more.`);
  }
  if ((input.practiceHistory?.length ?? 0) > WORKSPACE_LIMITS.practiceHistory) {
    throw new WorkspaceQuotaError(`Workspace limit reached (${WORKSPACE_LIMITS.practiceHistory} practice sets). Export or delete a practice set before saving more.`);
  }
  for (const raw of input.sessions ?? []) {
    const session = raw as { messages?: unknown[] };
    if ((session.messages?.length ?? 0) > WORKSPACE_LIMITS.messagesPerSession) {
      throw new WorkspaceQuotaError(`Conversation limit reached (${WORKSPACE_LIMITS.messagesPerSession} messages). Export this conversation and start a new one.`);
    }
    for (const rawMessage of session.messages ?? []) {
      const message = rawMessage as { content?: unknown };
      if (((rawMessage as {images?: unknown[]}).images?.length ?? 0) > IMAGE_LIMITS.perMessage) throw new WorkspaceQuotaError("A message can contain at most four images.");
      if (typeof message.content === "string" && message.content.length > WORKSPACE_LIMITS.contentLength) {
        throw new WorkspaceQuotaError(`A message exceeds the ${WORKSPACE_LIMITS.contentLength}-character storage limit. Export the full response before shortening it.`);
      }
    }
  }
  for (const raw of input.practiceHistory ?? []) {
    const item = raw as { content?: unknown; prompt?: unknown };
    if (typeof item.content === "string" && item.content.length > WORKSPACE_LIMITS.contentLength) {
      throw new WorkspaceQuotaError(`A practice set exceeds the ${WORKSPACE_LIMITS.contentLength}-character storage limit. Export it before saving.`);
    }
    if (typeof item.prompt === "string" && item.prompt.length > WORKSPACE_LIMITS.promptLength) {
      throw new WorkspaceQuotaError(`A practice request exceeds the ${WORKSPACE_LIMITS.promptLength}-character storage limit.`);
    }
  }
}

function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(36);
}

function preservedId(id: string, value: unknown) {
  return `${id.slice(0, 110)}.conflict.${stableHash(JSON.stringify(value))}`;
}

function messageId(message: SyncMessage) {
  return message.id || `legacy.${stableHash(JSON.stringify([message.role, message.createdAt, message.content]))}`;
}

function normalizeMessageFeedback(message: SyncMessage) {
  return message.feedbackDeletedAt !== undefined && message.feedbackDeletedAt >= (message.feedback?.updatedAt ?? 0)
    ? { ...message, feedback: undefined } : message;
}

function mergeGenerationAttempts(local: Pick<SyncMessage, "generation" | "generationAttempts">, remote: Pick<SyncMessage, "generation" | "generationAttempts">) {
  const result = new Map<string, GenerationDiagnostics>();
  for (const attempt of [...(local.generationAttempts ?? []), ...(local.generation ? [local.generation] : []), ...(remote.generationAttempts ?? []), ...(remote.generation ? [remote.generation] : [])]) {
    const old = result.get(attempt.requestId);
    const later = !old || (attempt.durationMs ?? 0) >= (old.durationMs ?? 0) ? attempt : old;
    const earlier = later === attempt ? old : attempt;
    const fields = Object.fromEntries(Object.entries(later).filter(([, value]) => value !== undefined));
    result.set(attempt.requestId, { ...earlier, ...fields, ...(earlier?.usage || later.usage ? { usage: { ...earlier?.usage, ...later.usage } } : {}) } as GenerationDiagnostics);
  }
  return result.size ? [...result.values()].sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0)).slice(-100) : undefined;
}

function generationTime(message: SyncMessage, sessionTime: number) {
  return message.generation?.requestId === message.requestId ? message.generation?.startedAt ?? sessionTime : sessionTime;
}

function mergeMessages(
  local: SyncSession,
  remote: SyncSession,
  base: SyncSession | undefined,
  conflicts: WorkspaceConflict[],
): SyncMessage[] {
  const result = new Map<string, SyncMessage>();
  const baseMessages = new Map(base?.messages.map((message) => [messageId(message), message]) ?? []);
  for (const message of local.messages) result.set(messageId(message), normalizeMessageFeedback(message));
  for (const incoming of remote.messages) {
    const id = messageId(incoming);
    const previous = result.get(id);
    if (!previous) {
      result.set(id, normalizeMessageFeedback(incoming));
      continue;
    }
    const old = baseMessages.get(id);
    const feedbackDeletedAt = Math.max(previous.feedbackDeletedAt ?? 0, incoming.feedbackDeletedAt ?? 0);
    let selected = generationTime(incoming, remote.updatedAt) >= generationTime(previous, local.updatedAt) ? incoming : previous;
    if (previous.content !== incoming.content) {
      const sameGeneration = !previous.requestId || !incoming.requestId || previous.requestId === incoming.requestId;
      if (old && old.content === previous.content && old.requestId === previous.requestId) selected = incoming;
      else if (old && old.content === incoming.content && old.requestId === incoming.requestId) selected = previous;
      else if (sameGeneration && incoming.content.startsWith(previous.content)) selected = incoming;
      else if (sameGeneration && previous.content.startsWith(incoming.content)) selected = previous;
      else {
        const alternative = selected === incoming ? previous : incoming;
        const copyId = preservedId(id, [alternative.role, alternative.content]);
        result.set(copyId, { ...alternative, id: copyId, createdAt: Math.max(0, (selected.createdAt ?? alternative.createdAt ?? 0) - 1), feedbackDeletedAt: feedbackDeletedAt || undefined, feedback: feedbackDeletedAt >= (alternative.feedback?.updatedAt ?? 0) ? undefined : alternative.feedback });
        conflicts.push({ entity: "message", id, field: "content", preservedId: copyId });
      }
    }
    const feedback = (incoming.feedback?.updatedAt ?? 0) >= (previous.feedback?.updatedAt ?? 0)
      ? incoming.feedback ?? previous.feedback
      : previous.feedback;
    result.set(id, { ...selected, images: selected.role === "user" ? mergeImageAttachments(previous.images, incoming.images) : undefined, generationAttempts: mergeGenerationAttempts(previous, incoming), feedbackDeletedAt: feedbackDeletedAt || undefined, feedback: feedbackDeletedAt && feedbackDeletedAt >= (feedback?.updatedAt ?? 0) ? undefined : feedback });
  }
  return [...result.values()].map(normalizeMessageFeedback).sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

function mergeFields(
  local: object | undefined,
  remote: object | undefined,
  base: object | undefined,
  conflicts: WorkspaceConflict[],
  entity: WorkspaceConflict["entity"],
  id: string,
  remoteNewer: boolean,
) {
  const a = (local ?? {}) as Record<string, unknown>;
  const b = (remote ?? {}) as Record<string, unknown>;
  const old = (base ?? {}) as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(key in b)) result[key] = a[key];
    else if (!(key in a) || same(a[key], b[key])) result[key] = b[key];
    else if (base && same(a[key], old[key])) result[key] = b[key];
    else if (base && same(b[key], old[key])) result[key] = a[key];
    else {
      result[key] = remoteNewer ? b[key] : a[key];
      conflicts.push({ entity, id, field: key, localValue: a[key], remoteValue: b[key] });
    }
  }
  return result;
}

/** Three-way rebasing preserves independent edits; divergent content gets a stable conflict copy. */
export function mergeWorkspaceSnapshots<T extends SyncSnapshot>(local: T, remote: Partial<T>, base?: Partial<T>): T {
  const conflicts = [...(local.conflicts ?? []), ...(remote.conflicts ?? [])];
  const tombstones = mergeWorkspaceTombstones(local.tombstones, remote.tombstones);
  const normalizedSession = (session: SyncSession) => ({ ...session, messages: session.messages.map(normalizeMessageFeedback) });
  const sessions = new Map(local.sessions.map((session) => [session.id, normalizedSession(session)]));
  const baseSessions = new Map(base?.sessions?.map((session) => [session.id, session]) ?? []);
  for (const incoming of remote.sessions ?? []) {
    if (Object.hasOwn(tombstones.sessions, incoming.id)) continue;
    const previous = sessions.get(incoming.id);
    if (!previous) sessions.set(incoming.id, normalizedSession(incoming));
    else {
      const old = baseSessions.get(incoming.id);
      const fields = mergeFields(previous, incoming, old, conflicts, "session", incoming.id, incoming.updatedAt >= previous.updatedAt);
      // Message and memory differences are resolved separately, without copying their entire private content into diagnostics.
      const filtered = conflicts.filter((conflict) => !(conflict.entity === "session" && conflict.id === incoming.id && ["messages", "updatedAt", "memory"].includes(conflict.field)));
      conflicts.splice(0, conflicts.length, ...filtered);
      sessions.set(incoming.id, {
        ...fields,
        id: incoming.id,
        updatedAt: Math.max(previous.updatedAt, incoming.updatedAt),
        messages: mergeMessages(previous, incoming, old, conflicts),
      } as SyncSession);
    }
  }
  const practice = new Map(local.practiceHistory.map((item) => [item.id, item]));
  const basePractice = new Map(base?.practiceHistory?.map((item) => [item.id, item]) ?? []);
  for (const incoming of remote.practiceHistory ?? []) {
    if (Object.hasOwn(tombstones.practiceHistory, incoming.id)) continue;
    const previous = practice.get(incoming.id);
    if (!previous) practice.set(incoming.id, incoming);
    else {
      const old = basePractice.get(incoming.id);
      const selected = incoming.updatedAt >= previous.updatedAt ? incoming : previous;
      let merged = selected;
      if (previous.content !== incoming.content) {
        if (old?.content === previous.content || incoming.content.startsWith(previous.content)) merged = incoming;
        else if (old?.content === incoming.content || previous.content.startsWith(incoming.content)) merged = previous;
        else {
          const alternative = selected === incoming ? previous : incoming;
          const copyId = preservedId(incoming.id, alternative.content);
          practice.set(copyId, { ...alternative, id: copyId, title: `${alternative.title ?? "Practice set"} (conflict copy)` });
          conflicts.push({ entity: "practice", id: incoming.id, field: "content", preservedId: copyId });
        }
      }
      const assessments = { ...(previous.problemAssessments ?? {}) };
      const assessmentTombstones = { ...(previous.assessmentTombstones ?? {}) };
      for (const [id, deletedAt] of Object.entries(incoming.assessmentTombstones ?? {})) {
        assessmentTombstones[id] = Math.max(assessmentTombstones[id] ?? 0, deletedAt);
      }
      for (const [id, value] of Object.entries(incoming.problemAssessments ?? {})) {
        if (!assessments[id] || value.updatedAt >= assessments[id].updatedAt) assessments[id] = value;
      }
      for (const [id, deletedAt] of Object.entries(assessmentTombstones)) {
        if (deletedAt >= (assessments[id]?.updatedAt ?? 0)) delete assessments[id];
      }
      practice.set(incoming.id, { ...merged, problemAssessments: assessments, assessmentTombstones, generationAttempts: mergeGenerationAttempts(previous, incoming) });
    }
  }
  for (const [id, item] of practice) {
    const assessments = { ...(item.problemAssessments ?? {}) };
    for (const [problemId, deletedAt] of Object.entries(item.assessmentTombstones ?? {})) {
      if (deletedAt >= (assessments[problemId]?.updatedAt ?? 0)) delete assessments[problemId];
    }
    practice.set(id, { ...item, problemAssessments: assessments });
  }
  const mergedSessions = [...sessions.values()].filter((session) => !Object.hasOwn(tombstones.sessions, session.id)).sort((a, b) => b.updatedAt - a.updatedAt);
  const mergedPractice = [...practice.values()].filter((item) => !Object.hasOwn(tombstones.practiceHistory, item.id)).sort((a, b) => b.updatedAt - a.updatedAt);
  const activeSessionId = [local.activeSessionId, remote.activeSessionId, mergedSessions[0]?.id]
    .find((id) => id && mergedSessions.some((session) => session.id === id));
  const preferences = mergeFields(local.preferences, remote.preferences, base?.preferences, conflicts, "preference", "preferences", (remote.updatedAt ?? 0) >= local.updatedAt);
  const providerPreferences = mergeFields(local.providerPreferences, remote.providerPreferences, base?.providerPreferences, conflicts, "preference", "providerPreferences", (remote.updatedAt ?? 0) >= local.updatedAt);
  return {
    ...remote,
    ...local,
    revision: remote.revision ?? local.revision ?? 0,
    sessions: mergedSessions,
    practiceHistory: mergedPractice,
    activeSessionId,
    tombstones,
    conflicts: [...new Map(conflicts.map((conflict) => [JSON.stringify(conflict), conflict])).values()],
    preferences,
    providerPreferences,
    learningProfile: (remote.updatedAt ?? 0) >= local.updatedAt ? remote.learningProfile ?? local.learningProfile : local.learningProfile ?? remote.learningProfile,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt ?? 0),
  } as T;
}
