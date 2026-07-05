"use client";

import {
  getClientProviderPublicConfig,
  saveClientProviderPublicConfig,
} from "@/lib/client-provider";
import {
  getStoredPracticeGenerations,
  saveStoredPracticeGenerations,
  type StoredPracticeGeneration,
} from "@/lib/practice-history";
import {
  dismissOnboarding,
  getStoredAnswerDepth,
  isOnboardingDismissed,
  resetOnboarding,
  saveStoredAnswerDepth,
} from "@/lib/preferences";
import {
  getActiveSessionId,
  getStoredLearningProfile,
  getStoredSessions,
  saveStoredLearningProfile,
  saveStoredSessions,
  setActiveSessionId,
  type StoredChatSession,
} from "@/lib/storage";
import type { AnswerDepth, LearningProfile } from "@/types/learning";
import type { ClientProviderId } from "@/types/learning";

export type ClientUserDataSnapshot = {
  version: 1;
  sessions: StoredChatSession[];
  activeSessionId?: string;
  learningProfile?: LearningProfile;
  preferences?: {
    answerDepth?: AnswerDepth;
    onboardingDismissed?: boolean;
    selectedModel?: string;
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

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function selectedServerModel() {
  return canUseStorage() ? window.localStorage.getItem("pla.deepseek.model") ?? undefined : undefined;
}

function setSelectedServerModel(model?: string) {
  if (canUseStorage() && model) {
    window.localStorage.setItem("pla.deepseek.model", model);
  }
}

export function collectClientUserDataSnapshot(): ClientUserDataSnapshot {
  const provider = getClientProviderPublicConfig();

  return {
    version: 1,
    sessions: getStoredSessions(),
    activeSessionId: getActiveSessionId() || undefined,
    learningProfile: getStoredLearningProfile(),
    preferences: {
      answerDepth: getStoredAnswerDepth(),
      onboardingDismissed: isOnboardingDismissed(),
      selectedModel: selectedServerModel(),
    },
    providerPreferences: {
      enabled: provider.enabled,
      provider: provider.provider,
      type: provider.type,
      label: provider.label,
      baseUrl: provider.baseUrl,
      model: provider.model,
    },
    practiceHistory: getStoredPracticeGenerations(),
    updatedAt: Date.now(),
  };
}

function mergeById<T extends { id: string; updatedAt: number }>(local: T[], remote: T[], limit: number) {
  const items = new Map<string, T>();

  for (const item of [...local, ...remote]) {
    const existing = items.get(item.id);

    if (!existing || item.updatedAt >= existing.updatedAt) {
      items.set(item.id, item);
    }
  }

  return [...items.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
}

export function applyClientUserDataSnapshot(remote: Partial<ClientUserDataSnapshot>) {
  const localSessions = getStoredSessions();
  const remoteSessions = Array.isArray(remote.sessions)
    ? (remote.sessions as StoredChatSession[])
    : [];
  const mergedSessions = mergeById(localSessions, remoteSessions, 80);

  if (mergedSessions.length) {
    saveStoredSessions(mergedSessions);
  }

  const remoteActiveId = remote.activeSessionId;
  const localActiveId = getActiveSessionId();
  const activeId =
    remoteActiveId && mergedSessions.some((session) => session.id === remoteActiveId)
      ? remoteActiveId
      : localActiveId && mergedSessions.some((session) => session.id === localActiveId)
        ? localActiveId
        : mergedSessions[0]?.id;

  if (activeId) {
    setActiveSessionId(activeId);
  }

  if (
    remote.learningProfile &&
    (!getStoredLearningProfile().updatedAt ||
      (remote.learningProfile.updatedAt ?? 0) >= getStoredLearningProfile().updatedAt)
  ) {
    saveStoredLearningProfile(remote.learningProfile);
  }

  const localPractice = getStoredPracticeGenerations();
  const remotePractice = Array.isArray(remote.practiceHistory)
    ? (remote.practiceHistory as StoredPracticeGeneration[])
    : [];
  const mergedPractice = mergeById(localPractice, remotePractice, 80);

  if (mergedPractice.length) {
    saveStoredPracticeGenerations(mergedPractice);
  }

  if (remote.preferences?.answerDepth) {
    saveStoredAnswerDepth(remote.preferences.answerDepth);
  }

  if (typeof remote.preferences?.onboardingDismissed === "boolean") {
    if (remote.preferences.onboardingDismissed) {
      dismissOnboarding();
    } else {
      resetOnboarding();
    }
  }

  setSelectedServerModel(remote.preferences?.selectedModel);

  if (
    remote.providerPreferences?.provider &&
    remote.providerPreferences?.model &&
    remote.providerPreferences?.type
  ) {
    saveClientProviderPublicConfig({
      enabled: Boolean(remote.providerPreferences.enabled),
      provider: remote.providerPreferences.provider as ClientProviderId,
      label: remote.providerPreferences.label,
      baseUrl: remote.providerPreferences.baseUrl,
      model: remote.providerPreferences.model,
    });
  }
}
