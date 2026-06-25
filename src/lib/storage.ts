"use client";

import {
  createLearningMemory,
  createLearningProfile,
} from "@/agent/memory-manager";
import type {
  ChatMessage,
  AnswerDepth,
  CourseId,
  LearningMemory,
  LearningProfile,
  TaskTypeId,
  ToolContext,
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
  };
  toolContext?: ToolContext;
  memory: LearningMemory;
};

const storageKey = "pla.chat.sessions.v1";
const activeSessionKey = "pla.chat.activeSessionId.v1";
const learningProfileKey = "pla.learning.profile.v1";

export const defaultSessionTitle = "新学习会话";

const toolSourceLabels: Record<ToolContext["source"], string> = {
  review: "板块复习",
  practice: "练习题",
  types: "题型梳理",
};

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
    },
    memory: createLearningMemory(),
  };
}

export function isDefaultSessionTitle(title: string) {
  return title.trim() === defaultSessionTitle;
}

export function getStoredSessions(): StoredChatSession[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as StoredChatSession[]) : [];
    return parsed
      .filter((session) => session.id && session.title)
      .map((session) => ({
        ...session,
        source: session.source ?? (session.toolContext ? "tool" : "manual"),
        memory: session.memory ?? createLearningMemory(),
      }));
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
    saveStoredSessions(nextSessions);
  }
  return nextSessions;
}

export function saveStoredSessions(sessions: StoredChatSession[]) {
  if (!canUseStorage()) {
    return;
  }

  const sorted = sessions
    .filter((session) => session.id && session.title)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 60);

  window.localStorage.setItem(storageKey, JSON.stringify(sorted));
  window.dispatchEvent(new Event("pla:sessions-changed"));
}

export function upsertStoredSession(session: StoredChatSession) {
  const sessions = getStoredSessions();
  const existingIndex = sessions.findIndex((item) => item.id === session.id);
  const nextSessions =
    existingIndex >= 0
      ? sessions.map((item) => (item.id === session.id ? session : item))
      : [session, ...sessions];

  saveStoredSessions(nextSessions);
}

export function renameStoredSession(sessionId: string, nextTitle: string) {
  const title = nextTitle.trim();

  if (!title) {
    return;
  }

  saveStoredSessions(
    getStoredSessions().map((session) =>
      session.id === sessionId ? { ...session, title, updatedAt: Date.now() } : session,
    ),
  );
}

export function deleteStoredSession(sessionId: string) {
  const remaining = removeSessionFromList(getStoredSessions(), sessionId);
  saveStoredSessions(remaining);
  return remaining.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function removeSessionFromList(sessions: StoredChatSession[], sessionId: string) {
  return sessions.filter((session) => session.id !== sessionId);
}

export function getActiveSessionId() {
  if (!canUseStorage()) {
    return "";
  }

  return window.localStorage.getItem(activeSessionKey) ?? "";
}

export function setActiveSessionId(sessionId: string) {
  if (!canUseStorage()) {
    return;
  }

  if (sessionId) {
    window.localStorage.setItem(activeSessionKey, sessionId);
  } else {
    window.localStorage.removeItem(activeSessionKey);
  }

  window.dispatchEvent(new Event("pla:active-session-changed"));
}

export function getStoredLearningProfile() {
  if (!canUseStorage()) {
    return createLearningProfile();
  }

  try {
    const raw = window.localStorage.getItem(learningProfileKey);
    return raw ? (JSON.parse(raw) as LearningProfile) : createLearningProfile();
  } catch {
    return createLearningProfile();
  }
}

export function saveStoredLearningProfile(profile: LearningProfile) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(learningProfileKey, JSON.stringify(profile));
}

export function buildSessionTitle(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();
  return normalized.length > 20 ? `${normalized.slice(0, 20)}...` : normalized || defaultSessionTitle;
}

export function buildToolSessionTitle(toolContext: ToolContext) {
  const label = toolSourceLabels[toolContext.source];
  const topic =
    toolContext.selectedItem?.title ||
    toolContext.topic ||
    toolContext.knowledgeTitle ||
    toolContext.taskTitle ||
    "继续追问";

  return `${label}：${topic}`.trim();
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
    title: existing?.title && !isDefaultSessionTitle(existing.title)
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
      existing?.memory ??
      {
        ...createLearningMemory(),
        currentCourse: options.context.course ?? options.toolContext.course,
        currentKnowledgePoint:
          options.context.knowledgePoint ?? options.toolContext.knowledgeTitle,
        currentGoal: options.toolContext.topic ?? options.toolContext.taskTitle,
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
    recent: sessions.filter((session) => now - session.updatedAt >= day && now - session.updatedAt < 7 * day),
    older: sessions.filter((session) => now - session.updatedAt >= 7 * day),
  };
}
