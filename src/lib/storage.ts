"use client";

import { runWorkspaceTransaction, workspaceKey, workspaceStorage } from "@/lib/workspace-storage";
import { getWorkspaceMetadata, saveWorkspaceMetadata } from "@/lib/workspace-metadata";
import { assertWorkspaceCapacity, mergeWorkspaceSnapshots } from "@/lib/workspace-sync";
import { readSessionJournal, removeSessionJournal, writeSessionJournal } from "@/lib/session-journal";

import {
  createLearningMemory,
  createLearningProfile,
} from "@/agent/memory-manager";
import type {
  AnswerDepth,
  ChatMessage,
  CourseId,
  DetectedLanguage,
  KnowledgeMode,
  LearningMemory,
  LearningProfile,
  PracticeStyleId,
  ReferenceProfileId,
  TaskTypeId,
  ToolContext,
} from "@/types/learning";
import {
  knowledgeModeOptions,
  practiceStyleOptions,
  taskTypeOptions,
} from "@/types/learning";

export type StoredChatSession = {
  id: string;
  title: string;
  source?: "manual" | "tool";
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  context: {
    course: CourseId;
    taskType: TaskTypeId;
    knowledgePoint?: string;
    model?: string;
    useRag?: boolean;
    answerDepth?: AnswerDepth;
    practiceStyle?: PracticeStyleId;
    detectedLanguage?: DetectedLanguage;
    referenceProfile?: ReferenceProfileId;
    knowledgeMode?: KnowledgeMode;
    knowledgeDocumentIds?: string[];
    knowledgeCourseOnly?: boolean;
  };
  toolContext?: ToolContext;
  memory: LearningMemory;
};

const storageKey = "pla.chat.sessions.v1";
const activeSessionKey = "pla.chat.activeSessionId.v1";
const learningProfileKey = "pla.learning.profile.v1";

export const defaultSessionTitle = "New conversation";

const legacyDefaultTitles = new Set(["\u65b0\u5b66\u4e60\u4f1a\u8bdd"]);
const toolSourceLabels: Record<ToolContext["source"], string> = {
  practice: "Practice",
  knowledge: "Photo problem",
};
const validTaskTypes = new Set<string>(taskTypeOptions.map((item) => item.id));
const validPracticeStyles = new Set<string>(practiceStyleOptions.map((item) => item.id));
const validLanguages = new Set<string>(["zh", "en"]);
const validReferenceProfiles = new Set<string>(["auto", "chinese", "english"]);
const validKnowledgeModes = new Set<string>(knowledgeModeOptions.map((item) => item.id));

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function createSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptySession(
  context: Partial<StoredChatSession["context"]> = {},
): StoredChatSession {
  const now = Date.now();

  return {
    id: createSessionId(),
    title: defaultSessionTitle,
    source: "manual",
    createdAt: now,
    updatedAt: now,
    messages: [],
    context: {
      course: context.course ?? "general",
      taskType: context.taskType ?? "qa",
      knowledgePoint: context.knowledgePoint,
      model: context.model,
      useRag: context.useRag,
      answerDepth: context.answerDepth,
      practiceStyle: context.practiceStyle,
      detectedLanguage: context.detectedLanguage,
      referenceProfile: context.referenceProfile,
      knowledgeMode: context.knowledgeMode,
    },
    memory: createLearningMemory(),
  };
}

export function isDefaultSessionTitle(title: string) {
  const normalized = title.trim();
  return normalized === defaultSessionTitle || legacyDefaultTitles.has(normalized);
}

function normalizeContext(context?: Partial<StoredChatSession["context"]>) {
  return {
    ...context,
    course: context?.course ?? "general",
    taskType: validTaskTypes.has(String(context?.taskType))
      ? (context?.taskType as TaskTypeId)
      : "qa",
    practiceStyle: validPracticeStyles.has(String(context?.practiceStyle))
      ? context?.practiceStyle
      : undefined,
    detectedLanguage: validLanguages.has(String(context?.detectedLanguage))
      ? context?.detectedLanguage
      : undefined,
    referenceProfile: validReferenceProfiles.has(String(context?.referenceProfile))
      ? context?.referenceProfile
      : undefined,
    knowledgeMode: validKnowledgeModes.has(String(context?.knowledgeMode))
      ? context?.knowledgeMode
      : undefined,
  } satisfies StoredChatSession["context"];
}

export function getStoredSessions(ownerId?: string | null): StoredChatSession[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = workspaceStorage(ownerId).getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as StoredChatSession[]) : [];
    const metadataRaw = workspaceStorage(ownerId).getItem("sync.v2");
    const metadata = metadataRaw ? JSON.parse(metadataRaw) : { tombstones: { sessions: {}, practiceHistory: {} } };
    let merged = { sessions: parsed, practiceHistory: [], updatedAt: 0,
      tombstones: metadata.tombstones ?? { sessions: {}, practiceHistory: {} } };
    for (const record of readSessionJournal(ownerId)) {
      merged = mergeWorkspaceSnapshots(merged, { sessions: [record.session], updatedAt: record.session.updatedAt });
    }
    return merged.sessions
      .filter((session) => !Object.hasOwn(merged.tombstones.sessions, session.id))
      .filter((session) => session.id && session.title)
      .map((session) => {
        const toolContext =
          session.toolContext?.source === "practice" || session.toolContext?.source === "knowledge" ? session.toolContext : undefined;

        return {
          ...session,
          title: isDefaultSessionTitle(session.title) ? defaultSessionTitle : session.title,
          source: toolContext ? "tool" : "manual",
          context: normalizeContext(session.context),
          toolContext,
          memory: session.memory ?? createLearningMemory(),
        };
      });
  } catch {
    return [];
  }
}

export function isEmptySession(session: StoredChatSession | null | undefined) {
  if (!session || session.toolContext || session.source === "tool") {
    return false;
  }

  return !session.messages?.some(
    (message) =>
      (message.role === "user" || message.role === "assistant") &&
      message.content.trim().length > 0,
  );
}

export function compactEmptyManualSessionList(
  sessions: StoredChatSession[],
  preferredSessionId?: string,
) {
  const emptyManualSessions = sessions.filter(isEmptySession);

  if (emptyManualSessions.length <= 1) {
    return sessions;
  }

  const preferred =
    emptyManualSessions.find((session) => session.id === preferredSessionId) ??
    [...emptyManualSessions].sort((a, b) => b.updatedAt - a.updatedAt)[0];

  return sessions.filter(
    (session) => !isEmptySession(session) || session.id === preferred.id,
  );
}

export function compactEmptyManualSessions(preferredSessionId?: string) {
  const sessions = getStoredSessions();
  const nextSessions = compactEmptyManualSessionList(sessions, preferredSessionId);

  if (nextSessions.length !== sessions.length) {
    runWorkspaceTransaction(() => {
      for (const session of sessions) {
        if (!nextSessions.some((item) => item.id === session.id)) {
          const metadata = getWorkspaceMetadata();
          Object.defineProperty(metadata.tombstones.sessions, session.id, { value: { deletedAt: Date.now(), operationId: crypto.randomUUID() },
            enumerable: true, configurable: true, writable: true });
          saveWorkspaceMetadata(metadata); removeSessionJournal(session.id);
        }
      }
      saveStoredSessions(nextSessions);
    });
  }
  return nextSessions;
}

export function saveStoredSessions(sessions: StoredChatSession[]) {
  if (!canUseStorage()) {
    return;
  }

  const sorted = sessions
    .filter((session) => session.id && session.title)
    .filter((session) => !Object.hasOwn(getWorkspaceMetadata().tombstones.sessions, session.id))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    ;

  assertWorkspaceCapacity({ sessions: sorted });

  workspaceStorage().setItem(storageKey, JSON.stringify(sorted));
  window.dispatchEvent(new Event("pla:sessions-changed"));
  window.dispatchEvent(new Event("pla:user-data-changed"));
}

export function upsertStoredSession(session: StoredChatSession) {
  if (Object.hasOwn(getWorkspaceMetadata().tombstones.sessions, session.id)) return;
  runWorkspaceTransaction(() => {
    writeSessionJournal(session);
    // Independent writers retain their own latest row even if a stale tab overwrites this compatible base array.
    saveStoredSessions(getStoredSessions());
  });
}

export function renameStoredSession(sessionId: string, nextTitle: string) {
  const title = nextTitle.trim();

  if (!title) {
    return;
  }

  const session = getStoredSessions().find((item) => item.id === sessionId);
  if (session) upsertStoredSession({ ...session, title, updatedAt: Date.now() });
}

export function deleteStoredSession(sessionId: string) {
  let remaining: StoredChatSession[] = [];
  runWorkspaceTransaction(() => {
    const metadata = getWorkspaceMetadata();
    Object.defineProperty(metadata.tombstones.sessions, sessionId, { value: { deletedAt: Date.now(), operationId: crypto.randomUUID() },
      enumerable: true, configurable: true, writable: true });
    saveWorkspaceMetadata(metadata); removeSessionJournal(sessionId);
    remaining = removeSessionFromList(getStoredSessions(), sessionId);
    saveStoredSessions(remaining);
  });
  return remaining.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function removeSessionFromList(sessions: StoredChatSession[], sessionId: string) {
  return sessions.filter((session) => session.id !== sessionId);
}

export function getActiveSessionId() {
  if (!canUseStorage()) {
    return "";
  }

  const selected = getTabActiveSessionId();
  if (selected !== null && !Object.hasOwn(getWorkspaceMetadata().tombstones.sessions, selected)) return selected;
  return workspaceStorage().getItem(activeSessionKey) ?? "";
}

export function getTabActiveSessionId() {
  return canUseStorage() ? window.sessionStorage?.getItem(workspaceKey(activeSessionKey)) ?? null : null;
}

export function setActiveSessionId(sessionId: string, options: { updateTab?: boolean } = {}) {
  if (!canUseStorage()) {
    return;
  }

  if (sessionId) {
    workspaceStorage().setItem(activeSessionKey, sessionId);
  } else {
    workspaceStorage().removeItem(activeSessionKey);
  }

  if (options.updateTab !== false) {
    window.sessionStorage?.setItem(workspaceKey(activeSessionKey), sessionId);
    window.dispatchEvent(new Event("pla:user-data-changed"));
  }

  window.dispatchEvent(new Event("pla:active-session-changed"));
}

export function getStoredLearningProfile() {
  if (!canUseStorage()) {
    return { ...createLearningProfile(), updatedAt: 0 };
  }

  try {
    const raw = workspaceStorage().getItem(learningProfileKey);
    return raw ? (JSON.parse(raw) as LearningProfile) : { ...createLearningProfile(), updatedAt: 0 };
  } catch {
    return { ...createLearningProfile(), updatedAt: 0 };
  }
}

export function saveStoredLearningProfile(profile: LearningProfile) {
  if (!canUseStorage()) {
    return;
  }

  workspaceStorage().setItem(learningProfileKey, JSON.stringify(profile));
  window.dispatchEvent(new Event("pla:user-data-changed"));
}

export function buildSessionTitle(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized.length > 20
    ? `${normalized.slice(0, 20)}...`
    : normalized || defaultSessionTitle;
}

export function buildToolSessionTitle(toolContext: ToolContext) {
  const label = toolSourceLabels[toolContext.source];
  const topic =
    toolContext.selectedItem?.title ||
    toolContext.topic ||
    toolContext.knowledgeTitle ||
    toolContext.taskTitle ||
    "Continue in chat";

  return `${label}: ${topic}`.trim();
}

export function upsertToolContextSession(options: {
  existingSessionId?: string;
  toolContext: ToolContext;
  context: StoredChatSession["context"];
}) {
  const now = Date.now();
  const sessions = getStoredSessions();
  const existing = options.existingSessionId
    ? sessions.find((session) => session.id === options.existingSessionId)
    : undefined;
  const session: StoredChatSession = {
    id: existing?.id ?? createSessionId(),
    title:
      existing?.title && !isDefaultSessionTitle(existing.title)
        ? existing.title
        : buildToolSessionTitle(options.toolContext),
    source: "tool",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    messages: existing?.messages ?? [],
    context: {
      ...options.context,
      course: options.context.course ?? options.toolContext.course ?? "general",
      taskType: options.context.taskType ?? "qa",
      knowledgePoint: options.context.knowledgePoint ?? options.toolContext.knowledgeId,
    },
    toolContext: options.toolContext,
    memory:
      existing?.memory ?? {
        ...createLearningMemory(),
        currentCourse: options.context.course ?? options.toolContext.course,
        currentKnowledgePoint:
          options.context.knowledgePoint ?? options.toolContext.knowledgeTitle,
        currentGoal: options.toolContext.topic ?? options.toolContext.taskTitle,
        practiceStyle: options.context.practiceStyle,
        recentLanguage: options.context.detectedLanguage,
        referenceProfile: options.context.referenceProfile,
      },
  };

  upsertStoredSession(session);
  setActiveSessionId(session.id);
  return session;
}

export function groupSessionsByTime(sessions: StoredChatSession[]) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  return {
    today: sessions.filter((session) => now - session.updatedAt < day),
    recent: sessions.filter(
      (session) => now - session.updatedAt >= day && now - session.updatedAt < 7 * day,
    ),
    older: sessions.filter((session) => now - session.updatedAt >= 7 * day),
  };
}
